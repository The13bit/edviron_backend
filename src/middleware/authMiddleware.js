import authService from '../services/authService.js';
import logger from '../utils/logger.js';
import { AppError } from './errorHandler.js';
import { catchAsync } from '../utils/asyncHelpers.js';

/**
 * Middleware to protect routes with JWT authentication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const protect = catchAsync(async (req, res, next) => {
  // Get token from request
  const token = authService.extractTokenFromRequest(req);

  if (!token) {
    logger.warn('Access attempt without token', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.originalUrl
    });
    return next(new AppError('You are not logged in! Please log in to get access', 401));
  }

  // Get current user from token
  const currentUser = await authService.getCurrentUser(token);

  // Grant access to protected route
  req.user = currentUser;
  req.token = token;

  logger.debug('Route access granted', {
    userId: currentUser._id,
    username: currentUser.username,
    role: currentUser.role,
    path: req.originalUrl
  });

  next();
});

/**
 * Middleware to restrict access to specific roles
 * @param {...string} roles - Allowed roles
 * @returns {Function} Middleware function
 */
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      logger.warn('Access denied - insufficient role', {
        userId: req.user._id,
        userRole: req.user.role,
        requiredRoles: roles,
        path: req.originalUrl
      });
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  };
};

/**
 * Optional authentication middleware - doesn't fail if no token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const optionalAuth = catchAsync(async (req, res, next) => {
  const token = authService.extractTokenFromRequest(req);

  if (token) {
    try {
      const currentUser = await authService.getCurrentUser(token);
      req.user = currentUser;
      req.token = token;
      
      logger.debug('Optional auth - user authenticated', {
        userId: currentUser._id,
        username: currentUser.username
      });
    } catch (error) {
      // Don't fail, just continue without user
      logger.debug('Optional auth - invalid token, continuing without user', {
        error: error.message
      });
    }
  }

  next();
});

/**
 * Middleware to check if user belongs to the same school
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const checkSchoolAccess = (req, res, next) => {
  const { schoolId } = req.params;
  const userSchoolId = req.user.school_id;

  // Admin can access all schools
  if (req.user.role === 'admin') {
    return next();
  }

  // Check if user belongs to the requested school
  if (schoolId && userSchoolId && schoolId !== userSchoolId.toString()) {
    logger.warn('School access denied', {
      userId: req.user._id,
      userSchoolId: userSchoolId.toString(),
      requestedSchoolId: schoolId
    });
    return next(new AppError('You can only access data from your own school', 403));
  }

  next();
};

/**
 * Middleware to check if user can access trustee data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const checkTrusteeAccess = (req, res, next) => {
  const { trusteeId } = req.params;
  const userTrusteeId = req.user.trustee_id;

  // Admin can access all trustee data
  if (req.user.role === 'admin') {
    return next();
  }

  // Trustee can only access their own data
  if (req.user.role === 'trustee' && trusteeId && userTrusteeId && trusteeId !== userTrusteeId.toString()) {
    logger.warn('Trustee access denied', {
      userId: req.user._id,
      userTrusteeId: userTrusteeId.toString(),
      requestedTrusteeId: trusteeId
    });
    return next(new AppError('You can only access your own trustee data', 403));
  }

  next();
};

/**
 * Middleware to validate user is active
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const requireActiveUser = (req, res, next) => {
  if (!req.user.isActive) {
    logger.warn('Inactive user access attempt', {
      userId: req.user._id,
      username: req.user.username
    });
    return next(new AppError('Your account has been deactivated. Please contact support', 401));
  }
  next();
};