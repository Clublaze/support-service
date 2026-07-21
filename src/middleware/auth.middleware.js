import jwt from 'jsonwebtoken';
import AppError from '../utils/AppError.js';
import env from '../config/env.js';
import authServiceClient from '../utils/authServiceClient.js';

// Verifies the Bearer JWT issued by auth-service.
// Populates req.user with { id, universityId, userType }.
// Must run before tenantMiddleware on any protected route.
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('No token provided. Please log in.', 401));
  }

  const token = authHeader.split(' ')[1];

  try {
    // JWT payload from auth-service: { sub, universityId, type, permissions }
    const decoded = jwt.verify(token, env.jwtSecret);
    const currentUser = await authServiceClient.verifyUser(decoded.sub);

    if (!currentUser) {
      throw new AppError('User account no longer exists. Please log in again.', 401);
    }

    if ((decoded.tokenVersion ?? 0) !== (currentUser.tokenVersion ?? 0)) {
      throw new AppError('Session has been invalidated. Please log in again.', 401);
    }

    req.user = {
      id: decoded.sub,          // auth-service uses 'sub' for userId
      universityId: currentUser.universityId?.toString?.() || decoded.universityId,
      userType: currentUser.userType || decoded.type,         // auth-service uses 'type', we expose as 'userType'
      permissions: decoded.permissions || [],
      tokenVersion: currentUser.tokenVersion ?? 0,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Your session has expired. Please log in again.', 401));
    }
    if (err.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token. Please log in again.', 401));
    }
    next(err);
  }
};

// Gates a route to specific userTypes, e.g. authorize('UNIVERSITY_ADMIN', 'ADMIN', 'SUPER_ADMIN').
// Must run after authMiddleware, since it reads req.user.
export const authorize = (...allowedTypes) => (req, res, next) => {
  if (!req.user) {
    return next(new AppError('No token provided. Please log in.', 401));
  }
  if (!allowedTypes.includes(req.user.userType)) {
    return next(new AppError('You do not have permission to perform this action.', 403));
  }
  next();
};

export default authMiddleware;
