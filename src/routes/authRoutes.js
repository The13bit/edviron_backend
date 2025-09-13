import express from 'express';
import { body, param } from 'express-validator';
import authController from '../controllers/authController.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';
import { validationResult } from 'express-validator';

const router = express.Router();

// Validation middleware for handling validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg).join(', ');
    logger.warn('Validation errors in auth route', {
      path: req.path,
      method: req.method,
      errors: errors.array()
    });
    throw new AppError(`Validation error: ${errorMessages}`, 400);
  }
  next();
};

// Public routes (no authentication required)

// Register route
router.post('/register',
  [
    body('username')
      .notEmpty()
      .withMessage('Username is required')
      .isLength({ min: 3, max: 50 })
      .withMessage('Username must be between 3 and 50 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscores'),
    body('email')
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
    body('role')
      .optional()
      .isIn(['admin', 'trustee', 'staff', 'user'])
      .withMessage('Role must be one of: admin, trustee, staff, user'),
    body('trustee_id')
      .optional()
      .isMongoId()
      .withMessage('Trustee ID must be a valid MongoDB ObjectId'),
    body('school_id')
      .optional()
      .isMongoId()
      .withMessage('School ID must be a valid MongoDB ObjectId')
  ],
  handleValidationErrors,
  authController.register
);

// Login route
router.post('/login',
  [
    body('email')
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ],
  handleValidationErrors,
  authController.login
);

// Auth service health check
router.get('/health',
  authController.healthCheck
);

// Protected routes (authentication required)

// Logout route
router.post('/logout',
  protect,
  authController.logout
);

// Get current user
router.get('/me',
  protect,
  authController.getMe
);

// Update current user data
router.patch('/updateMe',
  protect,
  [
    body('username')
      .optional()
      .isLength({ min: 3, max: 50 })
      .withMessage('Username must be between 3 and 50 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscores'),
    body('email')
      .optional()
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail()
  ],
  handleValidationErrors,
  authController.updateMe
);

// Update current user password
router.patch('/updatePassword',
  protect,
  [
    body('passwordCurrent')
      .notEmpty()
      .withMessage('Current password is required'),
    body('password')
      .notEmpty()
      .withMessage('New password is required')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters long'),
    body('passwordConfirm')
      .notEmpty()
      .withMessage('Password confirmation is required')
  ],
  handleValidationErrors,
  authController.updatePassword
);

// Delete current user account
router.delete('/deleteMe',
  protect,
  authController.deleteMe
);

// Admin only routes

// Get all users
router.get('/users',
  protect,
  restrictTo('admin'),
  authController.getAllUsers
);

// Get user by ID
router.get('/users/:id',
  protect,
  restrictTo('admin'),
  [
    param('id')
      .notEmpty()
      .withMessage('User ID is required')
      .isMongoId()
      .withMessage('User ID must be a valid MongoDB ObjectId')
  ],
  handleValidationErrors,
  authController.getUser
);

export default router;