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
