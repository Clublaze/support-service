import redis from '../config/redis.js';

const keyFor = (userId) => `unihub:auth-user:v1:${String(userId)}`;

export const createAuthUserCache = ({ ttlMs, staleTtlMs }) => ({
  async getCachedUser(userId, allowStale = false) {
    try {
      const raw = await redis.get(keyFor(userId));
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (Date.now() - entry.cachedAt <= (allowStale ? staleTtlMs : ttlMs)) return entry.user;
      await redis.del(keyFor(userId));
    } catch {
      // Redis is an optimization. Auth-service remains the source of truth.
    }
    return null;
  },

  async setCachedUser(userId, user) {
    if (!user || user.userType === 'ADMIN' || user.userType === 'SUPER_ADMIN') return;
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
