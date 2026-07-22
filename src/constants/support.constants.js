export const TICKET_TYPE = Object.freeze({
  SUPPORT: 'SUPPORT',
  GRIEVANCE: 'GRIEVANCE',
});

export const TICKET_STATUS = Object.freeze({
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_ON_USER: 'WAITING_ON_USER',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
});

// Statuses that count as "still needs attention" for admin queue default filters.
export const OPEN_TICKET_STATUSES = [TICKET_STATUS.OPEN, TICKET_STATUS.IN_PROGRESS, TICKET_STATUS.WAITING_ON_USER];

export const TICKET_PRIORITY = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
});

export const TICKET_SOURCE = Object.freeze({
  FORM: 'FORM',
  CHATBOT: 'CHATBOT',
});

export const MESSAGE_AUTHOR_TYPE = Object.freeze({
  USER: 'USER',
  ADMIN: 'ADMIN',
  BOT: 'BOT',
});

// Free-text category is stored on the model (so new ones don't need a schema
// migration), but the frontend dropdown and the FAQ browser both read from
// this list. Add to it here, in one place, when the product needs a new one.
export const SUPPORT_CATEGORIES = Object.freeze([
  'ACCOUNT_LOGIN',
  'CLUBS_MEMBERSHIP',
  'EVENTS_APPROVALS',
  'BUDGETS_SETTLEMENTS',
  'LEADERBOARD_BADGES',
  'ROLES_PERMISSIONS',
  'TECHNICAL_ISSUE',
  'OTHER',
]);

// Deliberately smaller and more serious than SUPPORT_CATEGORIES — grievances
// aren't "how do I..." questions, so they don't inherit the technical ones.
export const GRIEVANCE_CATEGORIES = Object.freeze([
  'UNFAIR_DECISION',
  'MISCONDUCT',
  'HARASSMENT',
  'FINANCIAL_DISPUTE',
  'OTHER',
]);

export const ADMIN_USER_TYPES = Object.freeze(['UNIVERSITY_ADMIN', 'ADMIN', 'SUPER_ADMIN']);

// Mirrors the support-domain entries in club-service's AUDIT_ACTIONS /
// AUDIT_ENTITY_TYPE. club-service validates against its own copy and rejects
// anything unrecognised, so these two lists must stay in step — that rejection
// is deliberate: a typo'd action would otherwise be stored and then never
// match an audit-feed filter.
export const AUDIT_ENTITY = Object.freeze({
  TICKET: 'TICKET',
  GRIEVANCE: 'GRIEVANCE',
  FAQ: 'FAQ',
});

export const AUDIT_ACTION = Object.freeze({
  TICKET_CREATED: 'TICKET_CREATED',
  TICKET_STATUS_CHANGED: 'TICKET_STATUS_CHANGED',
  TICKET_PRIORITY_CHANGED: 'TICKET_PRIORITY_CHANGED',
  TICKET_ASSIGNED: 'TICKET_ASSIGNED',
  TICKET_UNASSIGNED: 'TICKET_UNASSIGNED',
  TICKET_REPLIED_BY_ADMIN: 'TICKET_REPLIED_BY_ADMIN',
  TICKET_INTERNAL_NOTE_ADDED: 'TICKET_INTERNAL_NOTE_ADDED',
  GRIEVANCE_FILED: 'GRIEVANCE_FILED',
  GRIEVANCE_ACCESSED: 'GRIEVANCE_ACCESSED',
  FAQ_CREATED: 'FAQ_CREATED',
  FAQ_UPDATED: 'FAQ_UPDATED',
  FAQ_DELETED: 'FAQ_DELETED',
});

// An anonymous grievance still stores requesterId (abuse prevention), but the
// audit trail must not become the back door that undoes the anonymity the UI
// promises. Anonymous filings are recorded against this sentinel instead.
export const ANONYMOUS_ACTOR = 'ANONYMOUS';
