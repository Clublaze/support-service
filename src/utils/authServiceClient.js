import env from '../config/env.js';
import logger from './logger.js';
import AppError from './AppError.js';
import { createAuthUserCache } from './authUserCache.js';

const BASE = env.services.authServiceUrl;

const headers = {
  'Content-Type': 'application/json',
  'x-internal-secret': env.internalServiceSecret,
};

const numericEnv = (key, fallback) => {
  const value = parseInt(process.env[key] || '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const AUTH_TIMEOUT_MS = numericEnv('AUTH_SERVICE_TIMEOUT_MS', 2500);
const AUTH_USER_CACHE_TTL_MS = numericEnv('AUTH_USER_CACHE_TTL_MS', 60000);
const AUTH_USER_STALE_TTL_MS = Math.max(
  AUTH_USER_CACHE_TTL_MS,
  numericEnv('AUTH_USER_STALE_TTL_MS', 5 * 60000),
);

const { getCachedUser, setCachedUser, clearCachedUser } = createAuthUserCache({
  ttlMs: AUTH_USER_CACHE_TTL_MS,
  staleTtlMs: AUTH_USER_STALE_TTL_MS,
});

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

// Used by auth.middleware.js on every authenticated request.
export const verifyUser = async (userId) => {
  if (!userId) return null;

  const cached = await getCachedUser(userId);
  if (cached) return cached;

  try {
    const res = await fetchWithTimeout(`${BASE}/api/auth/internal/users/${userId}`, { headers });

    if (res.status === 404) {
      await clearCachedUser(userId);
      return null;
    }
    if (res.status === 403) {
      await clearCachedUser(userId);
      throw new AppError('User account is deactivated.', 403);
    }
    if (!res.ok) {
      const stale = await getCachedUser(userId, true);
      if (stale && res.status >= 500) {
        logger.warn(`[authServiceClient] verifyUser HTTP ${res.status}; using cached user for ${userId}`);
        return stale;
      }
      logger.warn(`[authServiceClient] verifyUser failed for ${userId}: HTTP ${res.status}`);
      throw new AppError('Could not verify user. Please try again.', 502);
    }

    const body = await res.json();
    await setCachedUser(userId, body.data);
    return body.data || null;
  } catch (err) {
    if (err instanceof AppError) throw err;
    const stale = await getCachedUser(userId, true);
    if (stale) {
      logger.warn(`[authServiceClient] verifyUser unreachable; using cached user for ${userId}`);
      return stale;
    }
    logger.warn(`[authServiceClient] verifyUser failed for ${userId}: ${err.message}`);
    throw new AppError('Auth service is currently unavailable. Please try again.', 503);
  }
};

// Used when resolving a single requester's name/email — e.g. to notify them
// about a reply, or to display their identity on a non-anonymous ticket.
export const getUser = async (userId) => {
  if (!userId) return null;

  const cached = await getCachedUser(userId);
  if (cached) return cached;

  try {
    const res = await fetchWithTimeout(`${BASE}/api/auth/internal/users/${userId}`, { headers });

    if (res.status === 404) {
      await clearCachedUser(userId);
      return null;
    }
    if (res.status === 403) {
      await clearCachedUser(userId);
      return null;
    }
    if (!res.ok) {
      const stale = await getCachedUser(userId, true);
      if (stale && res.status >= 500) {
        logger.warn(`[authServiceClient] getUser HTTP ${res.status}; using cached user for ${userId}`);
        return stale;
      }
      logger.warn(`[authServiceClient] getUser failed for ${userId}: HTTP ${res.status}`);
      return null;
    }

    const body = await res.json();
    await setCachedUser(userId, body.data);
    return body.data || null;
  } catch (err) {
    const stale = await getCachedUser(userId, true);
    if (stale) {
      logger.warn(`[authServiceClient] getUser unreachable; using cached user for ${userId}`);
      return stale;
    }
    logger.warn(`[authServiceClient] getUser failed for ${userId}: ${err.message}`);
    return null;
  }
};

// Used by the admin ticket queue to resolve several requesters' names at once
// instead of one lookup per row.
export const getUsersBatch = async (userIds) => {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (ids.length === 0) return {};

  const cachedMap = {};
  const idsToFetch = [];
  for (const id of ids) {
    const cached = await getCachedUser(id);
    if (cached) cachedMap[id] = cached;
    else idsToFetch.push(id);
  }

  if (idsToFetch.length === 0) return cachedMap;

  try {
    const res = await fetchWithTimeout(`${BASE}/api/auth/internal/users/batch`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userIds: idsToFetch.slice(0, 50) }),
    });

    if (!res.ok) {
      logger.warn(`[authServiceClient] getUsersBatch failed: HTTP ${res.status}`);
      return cachedMap;
    }

    const body = await res.json();
    const map = body.data || {};
    for (const [userId, user] of Object.entries(map)) {
      await setCachedUser(userId, user);
    }

    return { ...cachedMap, ...map };
  } catch (err) {
    logger.warn(`[authServiceClient] getUsersBatch failed: ${err.message}`);
    return cachedMap;
  }
};

// Used when a ticket or grievance is created, to find who should be notified.
export const getUniversityAdmins = async (universityId) => {
  if (!universityId) return [];

  try {
    const url = `${BASE}/api/auth/internal/users?universityId=${universityId}&userType=UNIVERSITY_ADMIN&status=ACTIVE&limit=50`;
    const res = await fetchWithTimeout(url, { headers });

    if (!res.ok) {
      logger.warn(`[authServiceClient] getUniversityAdmins failed for ${universityId}: HTTP ${res.status}`);
      return [];
    }

    const body = await res.json();
    return body.data?.users || [];
  } catch (err) {
    logger.warn(`[authServiceClient] getUniversityAdmins failed for ${universityId}: ${err.message}`);
    return [];
  }
};

export default { verifyUser, getUser, getUsersBatch, getUniversityAdmins };
