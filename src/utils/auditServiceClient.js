import env from '../config/env.js';
import logger from './logger.js';

const BASE = env.services.clubServiceUrl;

const headers = {
  'Content-Type': 'application/json',
  'x-internal-secret': env.internalServiceSecret,
};

const numericEnv = (key, fallback) => {
  const value = parseInt(process.env[key] || '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const AUDIT_TIMEOUT_MS = numericEnv('AUDIT_SERVICE_TIMEOUT_MS', 3000);

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUDIT_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

// club-service owns the AuditLog model — its immutability guard and feed cache
// live there — so every audit entry goes through its internal endpoint rather
// than a second writer touching the collection. Same shape as
// notificationServiceClient: never throws, so a failed audit write can never
// roll back or fail the action it was recording.
//
// Note the tradeoff this accepts: audit is best-effort. If club-service is
// down, the action still succeeds and we log a warning. For a stricter
// guarantee the write would have to be transactional with the action, which
// isn't possible across two databases without an outbox — see the README note
// before changing this.
const record = async (entry) => {
  try {
    const res = await fetchWithTimeout(`${BASE}/api/v1/internal/audit`, {
      method: 'POST',
      headers,
      body: JSON.stringify(entry),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      logger.warn(
        `[auditServiceClient] ${entry.action} rejected: HTTP ${res.status} ${detail.slice(0, 200)}`
      );
    }
  } catch (err) {
    logger.warn(`[auditServiceClient] ${entry.action} unreachable: ${err.message}`);
  }
};

export default { record };
