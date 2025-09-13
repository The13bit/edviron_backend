import express from 'express';
import { param, query } from 'express-validator';
import { validate } from '../middlewares/validate.js';
import { authenticate, authorize, authorizeSchool } from '../middlewares/auth.js';
import { asyncHandler } from '../middlewares/error.js';
import transactionsController from '../controllers/transactions.controller.js';

const router = express.Router();

/**
 * @swagger
 * /api/transaction-status/{custom_order_id}:
 *   get:
 *     summary: Get transaction status by custom order ID
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: custom_order_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Custom order ID
 *         example: ORD-SEED-003
 *     responses:
 *       200:
 *         description: Transaction status retrieved successfully
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
 *                     order:
 *                       type: object
 *                     latest_status:
 *                       type: object
 *                     vendor_status:
 *                       type: object
 *       404:
 *         description: Order not found
 *       401:
 *         description: Unauthorized
 */
router.get('/transaction-status/:custom_order_id',
  authenticate,
  authorize(['admin', 'school', 'trustee']),
  validate([
    param('custom_order_id')
      .notEmpty()
      .trim()
      .withMessage('Custom order ID is required')
  ]),
  asyncHandler(transactionsController.getTransactionStatus)
);

/**
 * @swagger
 * /api/transactions:
 *   get:
 *     summary: Get paginated list of transactions
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [payment_time, createdAt]
 *           default: createdAt
 *         description: Sort field
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Transactions retrieved successfully
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
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                     meta:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         pages:
 *                           type: integer
 */
router.get('/transactions',
  authenticate,
  authorize(['admin', 'school', 'trustee']),
  validate([
    query('page')
      .optional()
      .isInt({ min: 1 })
      .toInt()
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .toInt()
      .withMessage('Limit must be between 1 and 100'),
    query('sort')
      .optional()
      .isIn(['payment_time', 'createdAt'])
      .withMessage('Sort must be payment_time or createdAt'),
    query('order')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Order must be asc or desc')
  ]),
  asyncHandler(transactionsController.getTransactions)
);

/**
 * @swagger
 * /api/transactions/school/{schoolId}:
 *   get:
 *     summary: Get transactions for a specific school
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: schoolId
 *         required: true
 *         schema:
 *           type: string
 *         description: School ID
 *         example: SCH001
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [payment_time, createdAt]
 *           default: createdAt
 *         description: Sort field
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: School transactions retrieved successfully
 *       403:
 *         description: Access denied for different school
 */
router.get('/transactions/school/:schoolId',
  authenticate,
  authorize(['admin', 'school', 'trustee']),
  validate([
    param('schoolId')
      .notEmpty()
      .trim()
      .withMessage('School ID is required'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .toInt()
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .toInt()
      .withMessage('Limit must be between 1 and 100'),
    query('sort')
      .optional()
      .isIn(['payment_time', 'createdAt'])
      .withMessage('Sort must be payment_time or createdAt'),
    query('order')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Order must be asc or desc')
  ]),
  asyncHandler(transactionsController.getSchoolTransactions)
);

export default router;