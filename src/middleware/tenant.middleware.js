import AppError from '../utils/AppError.js';

const tenantMiddleware = (req, res, next) => {
  const universityId = req.user?.universityId;

  if (!universityId) {
    return next(
      new AppError('University context is missing from your token. Please log in again.', 400)
    );
  }

  req.universityId = universityId;
  next();
};

export default tenantMiddleware;
