import logger from '../utils/logger.js';

const errorMiddleware = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  err.statusCode = err.statusCode || 500;
  err.message = err.message || 'Internal Server Error';

  logger.error(`${err.message}`, {
    statusCode: err.statusCode,
    path: req.path,
    method: req.method,
    stack: err.stack,
  });

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    return res.status(409).json({
      success: false,
      message: `Duplicate value for field: ${field}`,
      data: null,
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: messages.join('. '),
      data: null,
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token. Please log in again.',
      data: null,
    });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Your session has expired. Please log in again.',
      data: null,
    });
  }

  // Multer upload errors
  if (err.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      message: err.code === 'LIMIT_FILE_SIZE' ? 'One or more attachments exceed the size limit.' : err.message,
      data: null,
    });
  }

  // Operational errors (thrown by AppError)
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      data: null,
    });
  }

  // Unknown errors — hide details in production
  if (process.env.NODE_ENV === 'production') {
    return res.status(500).json({
      success: false,
      message: 'Something went wrong on our end. Please try again.',
      data: null,
    });
  }

  return res.status(err.statusCode).json({
    success: false,
    message: err.message,
    stack: err.stack,
    data: null,
  });
};

export default errorMiddleware;
