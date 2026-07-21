import crypto from 'crypto';
import AppError from '../utils/AppError.js';
import env from '../config/env.js';

const isValidSecret = (provided, expected) => {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;

  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  return (
    providedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  );
};

// Protects internal endpoints — only other microservices can call these.
// Uses the shared INTERNAL_SERVICE_SECRET across all UniHub services.
export const internalAuth = (req, res, next) => {
  const secret = req.headers['x-internal-secret'];

  if (!isValidSecret(secret, env.internalServiceSecret)) {
    return next(new AppError('Unauthorized', 401));
  }

  next();
};

export default internalAuth;
