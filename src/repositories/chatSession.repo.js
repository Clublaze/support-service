import crypto from 'crypto';
import redis from '../config/redis.js';
import logger from '../utils/logger.js';

// The transcript is held server-side, keyed by sessionId AND the owning
// userId, so a fabricated assistant turn can no longer be smuggled in by the
// client — every assistant turn in the stored history is one this server
// actually produced (M13). TTL matches a reasonable single support session.
const SESSION_TTL_SECONDS = 60 * 60; // 1 hour
const MAX_TURNS = 40; // 20 user + 20 assistant, matches the old client-side cap

const keyFor = (userId, sessionId) => `unihub:support-chat:v1:${userId}:${sessionId}`;

const chatSessionRepo = {
  newSessionId() {
    return crypto.randomUUID();
  },

  /** Returns [] for an unknown/expired session — never throws, so a stale
   *  sessionId just starts a fresh conversation rather than erroring. */
  async getHistory(userId, sessionId) {
    if (!sessionId) return [];
    try {
      const raw = await redis.get(keyFor(userId, sessionId));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      logger.warn(`[chatSession] getHistory failed for ${sessionId}: ${err.message}`);
      return [];
    }
  },

  async appendTurns(userId, sessionId, turns) {
    try {
      const existing = await this.getHistory(userId, sessionId);
      const next = [...existing, ...turns].slice(-MAX_TURNS);
      await redis.setex(keyFor(userId, sessionId), SESSION_TTL_SECONDS, JSON.stringify(next));
      return next;
    } catch (err) {
      // Best-effort: losing a turn of chat memory is far less bad than
      // failing the request the user is actively waiting on.
      logger.warn(`[chatSession] appendTurns failed for ${sessionId}: ${err.message}`);
      return null;
    }
  },

  async clearSession(userId, sessionId) {
    try { await redis.del(keyFor(userId, sessionId)); } catch { /* best-effort */ }
  },
};

export default chatSessionRepo;
