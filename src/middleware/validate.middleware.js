import { ZodError } from 'zod';
import AppError from '../utils/AppError.js';

export const validate = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.issues?.[0]?.message || 'Invalid request data';
      return next(new AppError(message, 400));
    }
    next(error);
  }
};

export const validateQuery = (schema) => (req, res, next) => {
  try {
    req.query = schema.parse(req.query);
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.issues?.[0]?.message || 'Invalid query parameters';
      return next(new AppError(message, 400));
    }
    next(error);
  }
};
