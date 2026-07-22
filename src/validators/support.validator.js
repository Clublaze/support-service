import { z } from 'zod';
import {
  TICKET_TYPE,
  TICKET_STATUS,
  TICKET_PRIORITY,
  SUPPORT_CATEGORIES,
  GRIEVANCE_CATEGORIES,
} from '../constants/support.constants.js';

const ALL_CATEGORIES = [...new Set([...SUPPORT_CATEGORIES, ...GRIEVANCE_CATEGORIES])];

// Ticket create/reply travel as multipart (multer), so every field arrives as a
// string — and `z.coerce.boolean()` is just `Boolean(value)`, which makes the
// string "false" resolve to true. That silently inverted every unticked
// checkbox: support tickets were rejected as "anonymous", grievances were
// marked anonymous nobody asked for, and admin replies became internal notes
// the requester never saw. Parse the string form explicitly instead.
const FALSY_FORM_VALUES = new Set(['false', '0', 'no', 'off', '']);

const formBoolean = z.union([z.boolean(), z.string(), z.number()]).transform((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return !FALSY_FORM_VALUES.has(value.trim().toLowerCase());
});

export const createTicketSchema = z
  .object({
    type: z.enum([TICKET_TYPE.SUPPORT, TICKET_TYPE.GRIEVANCE]).default(TICKET_TYPE.SUPPORT),
    category: z.enum(ALL_CATEGORIES, { message: 'Please choose a valid category' }),
    subject: z.string().trim().min(5, 'Subject must be at least 5 characters').max(150),
    description: z.string().trim().min(10, 'Please describe the issue in at least 10 characters').max(5000),
    isAnonymous: formBoolean.optional().default(false),
  })
  .refine((data) => data.type === TICKET_TYPE.GRIEVANCE || data.isAnonymous === false, {
    message: 'Only grievances can be submitted anonymously',
    path: ['isAnonymous'],
  })
  .refine(
    (data) =>
      data.type === TICKET_TYPE.GRIEVANCE
        ? GRIEVANCE_CATEGORIES.includes(data.category)
        : SUPPORT_CATEGORIES.includes(data.category),
    { message: 'That category does not belong to the selected ticket type', path: ['category'] }
  );

export const replyToTicketSchema = z.object({
  body: z.string().trim().min(1, 'Message cannot be empty').max(5000),
});

export const adminReplySchema = z.object({
  body: z.string().trim().min(1, 'Message cannot be empty').max(5000),
  isInternalNote: formBoolean.optional().default(false),
});

export const updateTicketSchema = z
  .object({
    status: z.enum(Object.values(TICKET_STATUS)).optional(),
    priority: z.enum(Object.values(TICKET_PRIORITY)).optional(),
    assignedTo: z.string().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export const faqFeedbackSchema = z.object({
  helpful: formBoolean,
});

export const createFaqSchema = z.object({
  universityId: z.string().nullable().optional(),
  category: z.enum(SUPPORT_CATEGORIES, { message: 'Please choose a valid category' }),
  question: z.string().trim().min(5).max(300),
  answer: z.string().trim().min(10).max(8000),
  tags: z.array(z.string().trim().min(1)).max(10).optional().default([]),
  isPublished: formBoolean.optional().default(true),
  order: z.coerce.number().int().optional().default(0),
});

export const updateFaqSchema = createFaqSchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
});

export const chatMessageSchema = z.object({
  message: z.string().trim().min(1, 'Message cannot be empty').max(2000),
  // Short client-held history, oldest first — this service is stateless
  // between turns, matching the request/response shape of Anthropic's API.
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(2000),
      })
    )
    .max(20)
    .optional()
    .default([]),
});

export const chatEscalateSchema = z.object({
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(2000),
      })
    )
    .min(1, 'Nothing to escalate yet — send a message first')
    .max(20),
  category: z.enum(SUPPORT_CATEGORIES, { message: 'Please choose a valid category' }),
  additionalDetails: z.string().trim().max(2000).optional().default(''),
});

const paginationSchema = {
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
};

export const ticketListQuerySchema = z.object({
  ...paginationSchema,
  status: z.enum(Object.values(TICKET_STATUS)).optional(),
  type: z.enum(Object.values(TICKET_TYPE)).optional(),
});

export const adminTicketListQuerySchema = z.object({
  ...paginationSchema,
  status: z.enum(Object.values(TICKET_STATUS)).optional(),
  type: z.enum(Object.values(TICKET_TYPE)).optional(),
  category: z.enum(ALL_CATEGORIES).optional(),
  priority: z.enum(Object.values(TICKET_PRIORITY)).optional(),
  assignedTo: z.string().optional(),
  unassigned: formBoolean.optional(),
  q: z.string().trim().max(200).optional(),
});

export const faqListQuerySchema = z.object({
  ...paginationSchema,
  category: z.enum(SUPPORT_CATEGORIES).optional(),
  q: z.string().trim().max(200).optional(),
});

export const faqSuggestSchema = z.object({
  text: z.string().trim().min(3).max(2000),
});
