import redis from '../config/redis.js';

const keyFor = (userId) => `unihub:auth-user:v1:${String(userId)}`;
const ADMIN_USER_TYPES = new Set(['ADMIN', 'SUPER_ADMIN']);
// Admins were previously never cached at all, which meant they were also
// never *stale* — so when auth-service degrades, everyone else keeps working
// from stale cache while admins alone get 503s. During an incident, the only
// people who can't log in are the ones who need to fix it. Caching them too,
// with a much shorter fresh window, keeps freshness favoured without that
// inversion (M3).
const ADMIN_FRESH_TTL_MS = 15_000;

export const createAuthUserCache = ({ ttlMs, staleTtlMs }) => ({
  async getCachedUser(userId, allowStale = false) {
    try {
      const raw = await redis.get(keyFor(userId));
      if (!raw) return null;
      const entry = JSON.parse(raw);
      const isAdmin = ADMIN_USER_TYPES.has(entry.user?.userType);
      const freshTtl = isAdmin ? Math.min(ADMIN_FRESH_TTL_MS, ttlMs) : ttlMs;
      if (Date.now() - entry.cachedAt <= (allowStale ? staleTtlMs : freshTtl)) return entry.user;
      await redis.del(keyFor(userId));
    } catch {
      // Redis is an optimization. Auth-service remains the source of truth.
    }
    return null;
  },

  async setCachedUser(userId, user) {
    if (!user) return;
    try {
      await redis.setex(keyFor(userId), Math.ceil(staleTtlMs / 1000), JSON.stringify({ user, cachedAt: Date.now() }));
    } catch {
      // Redis is an optimization. Auth-service remains the source of truth.
    }
  },

  async clearCachedUser(userId) {
    try { await redis.del(keyFor(userId)); } catch { /* cache miss/failure is safe */ }
  },
});
