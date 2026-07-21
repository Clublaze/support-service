import env from '../config/env.js';
import logger from './logger.js';

const BASE = env.services.notificationServiceUrl;

const headers = {
  'Content-Type': 'application/json',
  'x-internal-secret': env.internalServiceSecret,
};

const numericEnv = (key, fallback) => {
  const value = parseInt(process.env[key] || '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const NOTIFICATION_TIMEOUT_MS = numericEnv('NOTIFICATION_SERVICE_TIMEOUT_MS', 3000);

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NOTIFICATION_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

// Fires an in-app notification (bell icon) + an email in one call, respecting
// the recipient's own notification settings. Requires the small addition to
// notification-service documented in the support-service README: a
// POST /internal/notify route that forwards straight to its existing
// NotificationService.notify(). Never throws — a notification failure should
// never roll back or fail the ticket action that triggered it.
const notify = async ({ userId, universityId, type, title, body, metadata = {}, emailType, emailData = {} }) => {
  try {
    const res = await fetchWithTimeout(`${BASE}/internal/notify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId, universityId, type, title, body, metadata, emailType, emailData, alwaysSend: true }),
    });

    if (!res.ok) {
      logger.warn(`[notificationServiceClient] notify failed for userId=${userId}: HTTP ${res.status}`);
    }
  } catch (err) {
    logger.warn(`[notificationServiceClient] notify unreachable for userId=${userId}: ${err.message}`);
  }
};

export const notifyTicketCreated = (ticket, admins) => {
  const label = ticket.type === 'GRIEVANCE' ? 'grievance' : 'support ticket';
  return Promise.all(
    (admins || []).map((admin) =>
      notify({
        userId: admin._id || admin.id,
        universityId: ticket.universityId,
        type: 'SUPPORT_TICKET_RECEIVED',
        title: `New ${label}: ${ticket.subject}`,
        body: ticket.isAnonymous
          ? `An anonymous ${label} was submitted in ${ticket.category}.`
          : `A new ${label} was submitted in ${ticket.category}.`,
        metadata: { ticketId: ticket._id, ticketType: ticket.type },
        emailType: 'SUPPORT_TICKET_RECEIVED',
        emailData: {
          ticketId: String(ticket._id),
          subject: ticket.subject,
          category: ticket.category,
          type: ticket.type,
          isAnonymous: ticket.isAnonymous,
        },
      })
    )
  );
};

export const notifyTicketReplied = (ticket, authorType) => {
  // Never notify the ticket owner about their own reply.
  if (authorType === 'USER') return Promise.resolve();

  return notify({
    userId: ticket.requesterId,
    universityId: ticket.universityId,
    type: 'SUPPORT_TICKET_REPLIED',
    title: `New reply on: ${ticket.subject}`,
    body: authorType === 'BOT' ? 'The support assistant replied to your question.' : 'An admin replied to your ticket.',
    metadata: { ticketId: ticket._id },
    emailType: 'SUPPORT_TICKET_REPLIED',
    emailData: { ticketId: String(ticket._id), subject: ticket.subject },
  });
};

export const notifyTicketResolved = (ticket) =>
  notify({
    userId: ticket.requesterId,
    universityId: ticket.universityId,
    type: 'SUPPORT_TICKET_RESOLVED',
    title: `Resolved: ${ticket.subject}`,
    body: 'Your ticket has been marked resolved. Reply if you still need help.',
    metadata: { ticketId: ticket._id },
    emailType: 'SUPPORT_TICKET_RESOLVED',
    emailData: { ticketId: String(ticket._id), subject: ticket.subject },
  });

export default { notifyTicketCreated, notifyTicketReplied, notifyTicketResolved };
