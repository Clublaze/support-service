import { Router } from 'express';
import multer from 'multer';
import authMiddleware, { authorize } from '../middleware/auth.middleware.js';
import tenantMiddleware from '../middleware/tenant.middleware.js';
import { validate, validateQuery } from '../middleware/validate.middleware.js';
import env from '../config/env.js';

import ticketController from '../controllers/ticket.controller.js';
import faqController from '../controllers/faq.controller.js';

import {
  updateTicketSchema,
  adminReplySchema,
  createFaqSchema,
  updateFaqSchema,
  adminTicketListQuerySchema,
  faqListQuerySchema,
} from '../validators/support.validator.js';
import { ADMIN_USER_TYPES } from '../constants/support.constants.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.upload.maxAttachmentMb * 1024 * 1024, files: env.upload.maxAttachmentsPerTicket },
});

router.use(authMiddleware, tenantMiddleware, authorize(...ADMIN_USER_TYPES));

// ── Ticket queue ────────────────────────────────────────────────────────
router.get('/tickets', validateQuery(adminTicketListQuerySchema), ticketController.listForAdmin);
router.get('/tickets/summary', ticketController.summary);
router.get('/tickets/:id', ticketController.getForAdmin);
router.patch('/tickets/:id', validate(updateTicketSchema), ticketController.update);
router.post('/tickets/:id/messages', upload.array('attachments', env.upload.maxAttachmentsPerTicket), validate(adminReplySchema), ticketController.adminReply);

// ── FAQ management ──────────────────────────────────────────────────────
router.get('/faqs', validateQuery(faqListQuerySchema), faqController.listForAdmin);
router.post('/faqs', validate(createFaqSchema), faqController.create);
router.patch('/faqs/:id', validate(updateFaqSchema), faqController.update);
router.delete('/faqs/:id', faqController.remove);

export default router;
