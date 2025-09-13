import { verifyToken, extractToken } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';

/**
 * Authentication middleware to verify JWT tokens
 */
export const authenticate = async (req, res, next) => {
  try {
    // Skip authentication for certain routes
    const publicRoutes = ['/health', '/webhook', '/auth/login', '/docs'];
    const isPublicRoute = publicRoutes.some(route => req.path.startsWith(route));
    
    if (isPublicRoute) {
      return next();
    }

    const token = extractToken(req.headers.authorization);
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided',
        code: 'NO_TOKEN'
      });
    }

    const decoded = verifyToken(token);
    req.user = decoded;
    
    next();
  } catch (error) {
    logger.warn('Authentication failed:', error.message);
    
    return res.status(401).json({
      success: false,
      message: error.message || 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }
};

/**
 * Role-based authorization middleware
 * @param {string[]} allowedRoles - Array of roles that can access the route
 */
export const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    try {
      // Skip authorization for public routes
      const publicRoutes = ['/health', '/webhook', '/auth/login', '/docs'];
      const isPublicRoute = publicRoutes.some(route => req.path.startsWith(route));
      
      if (isPublicRoute) {
        return next();
      }

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Access denied. Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      if (allowedRoles.length === 0) {
        // No specific role required, just need to be authenticated
        return next();
      }

      if (!allowedRoles.includes(req.user.role)) {
        logger.warn(`Authorization failed: User ${req.user.email} with role ${req.user.role} attempted to access route requiring roles: ${allowedRoles.join(', ')}`);
        
        return res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      next();
    } catch (error) {
      logger.error('Authorization error:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Authorization check failed',
        code: 'AUTHORIZATION_ERROR'
      });
    }
  };
};

/**
 * School-specific authorization middleware
 * Ensures users can only access data for their own school
 */
export const authorizeSchool = (req, res, next) => {
  try {
    // Skip for admin users
    if (req.user && req.user.role === 'admin') {
      return next();
    }

    const schoolId = req.params.schoolId || req.body.school_id || req.query.school_id;
    
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: 'School ID is required',
        code: 'SCHOOL_ID_REQUIRED'
      });
    }

    if (req.user && req.user.school_id && req.user.school_id !== schoolId) {
      logger.warn(`School authorization failed: User ${req.user.email} attempted to access school ${schoolId} but belongs to school ${req.user.school_id}`);
      
      return res.status(403).json({
        success: false,
        message: 'Access denied. Cannot access data for different school',
        code: 'SCHOOL_ACCESS_DENIED'
      });
    }

    next();
  } catch (error) {
    logger.error('School authorization error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'School authorization check failed',
      code: 'SCHOOL_AUTHORIZATION_ERROR'
    });
  }
};