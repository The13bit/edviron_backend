import express from 'express';
import { body } from 'express-validator';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../middlewares/error.js';
import { authenticate } from '../middlewares/auth.js';
import authController from '../controllers/auth.controller.js';

const router = express.Router();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@edviron.com
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     user:
 *                       type: object
 *                       properties:
 *                         email:
 *                           type: string
 *                           example: admin@edviron.com
 *                         role:
 *                           type: string
 *                           example: admin
 *                         school_id:
 *                           type: string
 *                           example: SCH001
 *       400:
 *         description: Validation error or invalid credentials
 *       429:
 *         description: Too many login attempts
 */
router.post('/login', 
  validate([
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long')
  ]),
  asyncHandler(authController.login)
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: User logout
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Logged out successfully
 */
router.post('/logout', 
  authenticate,
  asyncHandler(authController.logout)
);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: 507f1f77bcf86cd799439011
 *                         email:
 *                           type: string
 *                           example: admin@edviron.com
 *                         role:
 *                           type: string
 *                           example: admin
 *                         school_id:
 *                           type: string
 *                           example: SCH001
 *                         isActive:
 *                           type: boolean
 *                           example: true
 *                         lastLogin:
 *                           type: string
 *                           format: date-time
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get('/profile', 
  authenticate,
  asyncHandler(authController.getProfile)
);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - role
 *               - school_id
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@edviron.com
 *                 description: User's email address
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: password123
 *                 description: User's password (minimum 6 characters)
 *               role:
 *                 type: string
 *                 enum: [admin, user]
 *                 example: user
 *                 description: User's role in the system
 *               school_id:
 *                 type: string
 *                 example: SCH001
 *                 description: Associated school identifier
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: User registered successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 507f1f77bcf86cd799439011
 *                       description: Unique user identifier
 *                     email:
 *                       type: string
 *                       example: user@edviron.com
 *                       description: User's email address
 *                     role:
 *                       type: string
 *                       example: user
 *                       description: User's role
 *                     school_id:
 *                       type: string
 *                       example: SCH001
 *                       description: Associated school ID
 *       400:
 *         description: Bad request - Validation error or user already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: User with this email already exists
 *                 code:
 *                   type: string
 *                   example: USER_EXISTS
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Internal server error
 *                 code:
 *                   type: string
 *                   example: SERVER_ERROR
 */
router.post('/register',
  validate([
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
    body('role')
      .isIn(['admin', 'user'])
      .withMessage('Role must be either admin or user'),
    body('school_id')
      .isString()
      .withMessage('School ID must be a string')
  ]),
  asyncHandler(authController.register)
);

export default router;