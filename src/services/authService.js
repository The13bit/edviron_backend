import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';
import User from '../models/User.js';
import { AppError } from '../middleware/errorHandler.js';

class AuthService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET;
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
  }

  /**
   * Generate JWT token for user
   * @param {string} userId - User ID
   * @returns {string} JWT token
   */
  generateToken(userId) {
    try {
      if (!this.jwtSecret) {
        throw new Error('JWT_SECRET is not configured');
      }

      const token = jwt.sign(
        { id: userId },
        this.jwtSecret,
        { 
          expiresIn: this.jwtExpiresIn,
          algorithm: 'HS256'
        }
      );

      logger.debug('JWT token generated', {
        userId,
        expiresIn: this.jwtExpiresIn
      });

      return token;
    } catch (error) {
      logger.error('Failed to generate JWT token', {
        userId,
        error: error.message
      });
      throw new Error(`Token generation failed: ${error.message}`);
    }
  }

  /**
   * Verify JWT token
   * @param {string} token - JWT token
   * @returns {Object} Decoded token payload
   */
  verifyToken(token) {
    try {
      if (!this.jwtSecret) {
        throw new Error('JWT_SECRET is not configured');
      }

      const decoded = jwt.verify(token, this.jwtSecret);

      logger.debug('JWT token verified', {
        userId: decoded.id,
        exp: decoded.exp,
        iat: decoded.iat
      });

      return {
        success: true,
        payload: decoded
      };
    } catch (error) {
      logger.warn('JWT token verification failed', {
        error: error.message,
        name: error.name
      });

      return {
        success: false,
        error: {
          message: error.message,
          name: error.name
        }
      };
    }
  }

  /**
   * Create and send JWT token response
   * @param {Object} user - User object
   * @param {number} statusCode - HTTP status code
   * @param {Object} res - Express response object
   */
  createSendToken(user, statusCode, res) {
    const token = this.generateToken(user._id);
    
    const cookieOptions = {
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    };

    // Set JWT cookie
    res.cookie('jwt', token, cookieOptions);

    // Remove password from output
    user.password = undefined;

    logger.info('Authentication successful', {
      userId: user._id,
      username: user.username,
      role: user.role
    });

    res.status(statusCode).json({
      status: 'success',
      message: 'Authentication successful',
      token,
      data: {
        user
      }
    });
  }

  /**
   * Extract token from request
   * @param {Object} req - Express request object
   * @returns {string|null} JWT token
   */
  extractTokenFromRequest(req) {
    let token = null;

    // Check Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Check cookies
    else if (req.cookies && req.cookies.jwt) {
      token = req.cookies.jwt;
    }

    return token;
  }

  /**
   * Get current user from token
   * @param {string} token - JWT token
   * @returns {Object} User object
   */
  async getCurrentUser(token) {
    try {
      // Verify token
      const verificationResult = this.verifyToken(token);
      
      if (!verificationResult.success) {
        throw new AppError('Invalid token', 401);
      }

      const decoded = verificationResult.payload;

      // Check if user still exists
      const currentUser = await User.findById(decoded.id).select('+password');
      if (!currentUser) {
        throw new AppError('The user belonging to this token does no longer exist', 401);
      }

      // Check if user is active
      if (!currentUser.isActive) {
        throw new AppError('Your account has been deactivated. Please contact support', 401);
      }

      // Check if user changed password after the token was issued
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        throw new AppError('User recently changed password! Please log in again', 401);
      }

      logger.debug('Current user retrieved from token', {
        userId: currentUser._id,
        username: currentUser.username,
        role: currentUser.role
      });

      return currentUser;
    } catch (error) {
      logger.error('Failed to get current user from token', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Check if user has required role
   * @param {Array} allowedRoles - Array of allowed roles
   * @returns {Function} Middleware function
   */
  restrictTo(...allowedRoles) {
    return (req, res, next) => {
      if (!allowedRoles.includes(req.user.role)) {
        logger.warn('Access denied - insufficient role', {
          userId: req.user._id,
          userRole: req.user.role,
          requiredRoles: allowedRoles
        });
        return next(new AppError('You do not have permission to perform this action', 403));
      }
      next();
    };
  }

  /**
   * Validate authentication service configuration
   * @returns {boolean} True if configuration is valid
   */
  validateConfiguration() {
    if (!this.jwtSecret) {
      logger.error('Authentication service configuration incomplete: JWT_SECRET is missing');
      return false;
    }
    return true;
  }

  /**
   * Get service configuration status
   * @returns {Object} Configuration status
   */
  getConfigStatus() {
    return {
      jwtSecret: !!this.jwtSecret,
      jwtExpiresIn: this.jwtExpiresIn,
      isValid: this.validateConfiguration()
    };
  }
}

// Create singleton instance
const authService = new AuthService();

export default authService;