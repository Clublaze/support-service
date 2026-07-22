import mongoose from 'mongoose';
import Ticket from '../models/Ticket.model.js';
import TicketMessage from '../models/TicketMessage.model.js';
import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { uploadFile } from '../utils/s3.util.js';
import authServiceClient from '../utils/authServiceClient.js';
import notificationServiceClient from '../utils/notificationServiceClient.js';
import { ticketsCreatedTotal } from '../utils/metrics.js';
import { TICKET_STATUS, TICKET_TYPE, MESSAGE_AUTHOR_TYPE, OPEN_TICKET_STATUSES } from '../constants/support.constants.js';

const uploadAttachments = async (files, ticketFolder) => {
  if (!files?.length) return [];
  return Promise.all(
    files.map((file, i) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const key = `support/${ticketFolder}/${Date.now()}-${i}-${safeName}`;
      return uploadFile(file.buffer, key, file.mimetype);
    })
  );
};

// Anonymity is enforced here, once, rather than trusting every call site to
// remember to redact. See Ticket.model.js's comment on isAnonymous.
const toAdminTicket = (ticket, requesterInfo) => {
  const obj = ticket.toObject ? ticket.toObject() : ticket;
  if (obj.isAnonymous) {
    return { ...obj, requesterId: undefined, requester: { name: 'Anonymous', email: null } };
  }
  return { ...obj, requester: requesterInfo ? { name: requesterInfo.displayName || requesterInfo.email, email: requesterInfo.email } : null };
};

class TicketService {
  async createTicket({ universityId, requesterId, type, category, subject, description, isAnonymous, files, source = 'FORM' }) {
    const attachmentUrls = await uploadAttachments(files, `${universityId}-${requesterId}-${Date.now()}`);

    const ticket = await Ticket.create({
      universityId,
      requesterId,
      type,
      category,
      subject,
      description,
      isAnonymous: !!isAnonymous,
      attachmentUrls,
      source,
    });

    ticketsCreatedTotal.inc({ type, source });

    // Best-effort: a notification failure must never fail ticket creation.
    authServiceClient
      .getUniversityAdmins(universityId)
      .then((admins) => notificationServiceClient.notifyTicketCreated(ticket, admins))
      .catch((err) => logger.warn(`[TicketService] Failed to notify admins of new ticket ${ticket._id}: ${err.message}`));

    return ticket.toObject();
  }

  async listMine(universityId, requesterId, { status, type, page, limit }) {
    const filter = { universityId, requesterId };
    if (status) filter.status = status;
    if (type) filter.type = type;

    const [tickets, total] = await Promise.all([
      Ticket.find(filter).sort({ lastActivityAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Ticket.countDocuments(filter),
    ]);

    return { tickets, page, limit, total, pages: Math.ceil(total / limit) || 1 };
  }

  async getForUser(universityId, requesterId, ticketId) {
    const ticket = await Ticket.findOne({ _id: ticketId, universityId, requesterId }).lean();
    if (!ticket) throw new AppError('Ticket not found.', 404);

    const messages = await TicketMessage.find({ ticketId, isInternalNote: false }).sort({ createdAt: 1 }).lean();
    return { ticket, messages };
  }

  async replyAsUser({ universityId, requesterId, ticketId, body, files }) {
    const ticket = await Ticket.findOne({ _id: ticketId, universityId, requesterId });
    if (!ticket) throw new AppError('Ticket not found.', 404);
    if (ticket.status === TICKET_STATUS.CLOSED) {
      throw new AppError('This ticket is closed. Please raise a new ticket if you need further help.', 400);
    }

    const attachmentUrls = await uploadAttachments(files, `${universityId}-${requesterId}-${ticketId}`);
    const message = await TicketMessage.create({
      ticketId,
      authorId: requesterId,
      authorType: MESSAGE_AUTHOR_TYPE.USER,
      body,
      attachmentUrls,
    });

    ticket.status = TICKET_STATUS.IN_PROGRESS;
    ticket.lastActivityAt = new Date();
    await ticket.save();

    if (ticket.assignedTo) {
      notificationServiceClient
        .notifyTicketReplied(ticket, MESSAGE_AUTHOR_TYPE.USER)
        .catch((err) => logger.warn(`[TicketService] Failed to notify assignee for ticket ${ticketId}: ${err.message}`));
    }

    return message.toObject();
  }

  async listForAdmin(universityId, { status, type, category, priority, assignedTo, unassigned, q, page, limit }) {
    const filter = { universityId };
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    if (unassigned) filter.assignedTo = null;
    else if (assignedTo) filter.assignedTo = assignedTo;
    if (q) filter.$text = { $search: q };

    const [tickets, total] = await Promise.all([
      Ticket.find(filter).sort({ lastActivityAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Ticket.countDocuments(filter),
    ]);

    const requesterIds = tickets.filter((t) => !t.isAnonymous).map((t) => t.requesterId);
    const requesterMap = await authServiceClient.getUsersBatch(requesterIds);

    return {
      tickets: tickets.map((t) => toAdminTicket(t, requesterMap[t.requesterId])),
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    };
  }

  async getForAdmin(universityId, ticketId) {
    const ticket = await Ticket.findOne({ _id: ticketId, universityId });
    if (!ticket) throw new AppError('Ticket not found.', 404);

    const [messages, requesterInfo] = await Promise.all([
      TicketMessage.find({ ticketId }).sort({ createdAt: 1 }).lean(),
      ticket.isAnonymous ? null : authServiceClient.getUser(ticket.requesterId),
    ]);

    return { ticket: toAdminTicket(ticket, requesterInfo), messages };
  }

  async updateAsAdmin({ universityId, ticketId, updates }) {
    const ticket = await Ticket.findOne({ _id: ticketId, universityId });
    if (!ticket) throw new AppError('Ticket not found.', 404);

    const wasResolved = ticket.status === TICKET_STATUS.RESOLVED;

    if (updates.status) {
      ticket.status = updates.status;
      if (updates.status === TICKET_STATUS.RESOLVED) ticket.resolvedAt = new Date();
      if (updates.status === TICKET_STATUS.CLOSED) ticket.closedAt = new Date();
    }
    if (updates.priority) ticket.priority = updates.priority;
    if (updates.assignedTo !== undefined) ticket.assignedTo = updates.assignedTo;

    ticket.lastActivityAt = new Date();
    await ticket.save();

    if (updates.status === TICKET_STATUS.RESOLVED && !wasResolved) {
      notificationServiceClient
        .notifyTicketResolved(ticket)
        .catch((err) => logger.warn(`[TicketService] Failed to notify resolution for ticket ${ticketId}: ${err.message}`));
    }

    return ticket.toObject();
  }

  async replyAsAdmin({ universityId, ticketId, adminId, body, isInternalNote, files }) {
    const ticket = await Ticket.findOne({ _id: ticketId, universityId });
    if (!ticket) throw new AppError('Ticket not found.', 404);

    const attachmentUrls = await uploadAttachments(files, `${universityId}-admin-${ticketId}`);
    const message = await TicketMessage.create({
      ticketId,
      authorId: adminId,
      authorType: MESSAGE_AUTHOR_TYPE.ADMIN,
      body,
      attachmentUrls,
      isInternalNote: !!isInternalNote,
    });

    ticket.lastActivityAt = new Date();
    if (!isInternalNote) {
      ticket.status = TICKET_STATUS.WAITING_ON_USER;
      if (!ticket.assignedTo) ticket.assignedTo = adminId; // first reply claims it, like most helpdesks
    }
    await ticket.save();

    if (!isInternalNote) {
      notificationServiceClient
        .notifyTicketReplied(ticket, MESSAGE_AUTHOR_TYPE.ADMIN)
        .catch((err) => logger.warn(`[TicketService] Failed to notify requester for ticket ${ticketId}: ${err.message}`));
    }

    return message.toObject();
  }

  async getAdminSummary(universityId) {
    // Mongoose casts query filters against the schema, but aggregation pipelines
    // are passed to the driver untouched — so the string universityId every
    // caller holds never matches the ObjectId stored on the document, and the
    // whole summary comes back as zeros. Cast explicitly.
    const results = await Ticket.aggregate([
      { $match: { universityId: new mongoose.Types.ObjectId(universityId) } },
      { $group: { _id: { status: '$status', type: '$type' }, count: { $sum: 1 } } },
    ]);

    const summary = { total: 0, open: 0, byStatus: {}, byType: { [TICKET_TYPE.SUPPORT]: 0, [TICKET_TYPE.GRIEVANCE]: 0 } };
    for (const row of results) {
      const { status, type } = row._id;
      summary.total += row.count;
      summary.byStatus[status] = (summary.byStatus[status] || 0) + row.count;
      summary.byType[type] = (summary.byType[type] || 0) + row.count;
      if (OPEN_TICKET_STATUSES.includes(status)) summary.open += row.count;
    }
    return summary;
  }
}

export default new TicketService();
