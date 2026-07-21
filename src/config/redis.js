import Redis from 'ioredis';
import logger from '../utils/logger.js';
import env from './env.js';

const redis = new Redis(env.redisUrl, {
  maxRetriesPerRequest: 3,

  retryStrategy(times) {
    return Math.min(times * 200, 2000); // backoff, capped at 2s between attempts
  },

  enableOfflineQueue: false,
  lazyConnect: false,
});

redis.on('connect', () => logger.info('Redis client connected'));
redis.on('reconnecting', () => logger.warn('Redis reconnecting...'));
redis.on('error', (err) => logger.error(`Redis error: ${err.message}`));

export default redis;
