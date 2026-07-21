import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import authMiddleware from '../middleware/auth.middleware.js';
import tenantMiddleware from '../middleware/tenant.middleware.js';
import { validate, validateQuery } from '../middleware/validate.middleware.js';
import redis from '../config/redis.js';
import RedisRateLimitStore from '../utils/redisRateLimitStore.js';
import env from '../config/env.js';

import ticketController from '../controllers/ticket.controller.js';
import faqController from '../controllers/faq.controller.js';
import chatController from '../controllers/chat.controller.js';

import {
  createTicketSchema,
  replyToTicketSchema,
  faqFeedbackSchema,
  faqSuggestSchema,
  chatMessageSchema,
  chatEscalateSchema,
  ticketListQuerySchema,
  faqListQuerySchema,
} from '../validators/support.validator.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.upload.maxAttachmentMb * 1024 * 1024, files: env.upload.maxAttachmentsPerTicket },
});

// Same keyGenerator-per-user pattern as profile-service's data export limiter —
// this is what actually keeps Claude API spend predictable.
const chatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: env.ai.rateLimitPerHour,
  store: new RedisRateLimitStore({ redis, prefix: 'support-chat-limit:' }),
  keyGenerator: (req) => req.user.id,
  message: { success: false, message: 'You have hit the hourly limit for the support assistant. Please try again later or raise a ticket.', data: null },
});

router.use(authMiddleware, tenantMiddleware);

// ── FAQs ─────────────────────────────────────────────────────────────────
router.get('/faqs', validateQuery(faqListQuerySchema), faqController.list);
router.get('/faqs/categories', faqController.categories);
router.post('/faqs/suggest', validate(faqSuggestSchema), faqController.suggest);
router.get('/faqs/:id', faqController.getOne);
router.post('/faqs/:id/feedback', validate(faqFeedbackSchema), faqController.feedback);

// ── Tickets & grievances ────────────────────────────────────────────────
router.post('/tickets', upload.array('attachments', env.upload.maxAttachmentsPerTicket), validate(createTicketSchema), ticketController.create);
router.get('/tickets', validateQuery(ticketListQuerySchema), ticketController.listMine);
router.get('/tickets/:id', ticketController.getOne);
router.post('/tickets/:id/messages', upload.array('attachments', env.upload.maxAttachmentsPerTicket), validate(replyToTicketSchema), ticketController.reply);

// ── Chat ─────────────────────────────────────────────────────────────────
router.post('/chat', chatLimiter, validate(chatMessageSchema), chatController.sendMessage);
router.post('/chat/escalate', chatLimiter, validate(chatEscalateSchema), chatController.escalate);

export default router;
