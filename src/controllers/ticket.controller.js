import ticketService from '../services/ticket.service.js';

class TicketController {
  async create(req, res, next) {
    try {
      const ticket = await ticketService.createTicket({
        universityId: req.universityId,
        requesterId: req.user.id,
        ...req.body,
        files: req.files,
      });
      res.success(ticket, 'Ticket submitted', 201);
    } catch (err) {
      next(err);
    }
  }

  async listMine(req, res, next) {
    try {
      const result = await ticketService.listMine(req.universityId, req.user.id, req.query);
      res.success(result);
    } catch (err) {
      next(err);
    }
  }

  async getOne(req, res, next) {
    try {
      const result = await ticketService.getForUser(req.universityId, req.user.id, req.params.id);
      res.success(result);
    } catch (err) {
      next(err);
    }
  }

  async reply(req, res, next) {
    try {
      const message = await ticketService.replyAsUser({
        universityId: req.universityId,
        requesterId: req.user.id,
        ticketId: req.params.id,
        body: req.body.body,
        files: req.files,
      });
      res.success(message, 'Reply sent', 201);
    } catch (err) {
      next(err);
    }
  }

  // ── Admin ──────────────────────────────────────────────────────────────
  async listForAdmin(req, res, next) {
    try {
      const result = await ticketService.listForAdmin(req.universityId, req.query);
      res.success(result);
    } catch (err) {
      next(err);
    }
  }

  async getForAdmin(req, res, next) {
    try {
      const result = await ticketService.getForAdmin(req.universityId, req.params.id, req.user.id);
      res.success(result);
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const ticket = await ticketService.updateAsAdmin({
        universityId: req.universityId,
        ticketId: req.params.id,
        adminId: req.user.id,
        updates: req.body,
      });
      res.success(ticket, 'Ticket updated');
    } catch (err) {
      next(err);
    }
  }

  async adminReply(req, res, next) {
    try {
      const message = await ticketService.replyAsAdmin({
        universityId: req.universityId,
        ticketId: req.params.id,
        adminId: req.user.id,
        body: req.body.body,
        isInternalNote: req.body.isInternalNote,
        files: req.files,
      });
      res.success(message, 'Reply sent', 201);
    } catch (err) {
      next(err);
    }
  }

  async summary(req, res, next) {
    try {
      const result = await ticketService.getAdminSummary(req.universityId);
      res.success(result);
    } catch (err) {
      next(err);
    }
  }
}

export default new TicketController();
