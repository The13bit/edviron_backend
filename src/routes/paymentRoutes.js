import express from 'express';
import { body, param, query } from 'express-validator';
import paymentController from '../controllers/paymentController.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';
import { validationResult } from 'express-validator';
import { protect, restrictTo, checkSchoolAccess } from '../middleware/authMiddleware.js';

const router = express.Router();

// Validation middleware for handling validation errors
const handleValidationErrors = (req, res, next) => {
  
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg).join(', ');
    logger.warn('Validation errors in payment route', {
      path: req.path,
      method: req.method,
      errors: errors.array()
    });
    throw new AppError(`Validation error: ${errorMessages}`, 400);
  }
  next();
};

// Create payment route
router.post('/create-payment',
  protect,
  restrictTo('admin', 'trustee', 'staff'),
  [
    body('amount')
      .notEmpty()
      .withMessage('Amount is required')
      .isNumeric()
      .withMessage('Amount must be a number')
      .custom(value => {
        if (parseFloat(value) <= 0) {
          throw new Error('Amount must be greater than 0');
        }
        return true;
      }),
    body('callback_url')
      .notEmpty()
      .withMessage('Callback URL is required')
      .isURL()
      .withMessage('Callback URL must be a valid URL'),
    body('student_info')
      .notEmpty()
      .withMessage('Student info is required')
      .isObject()
      .withMessage('Student info must be an object'),
    body('student_info.name')
      .notEmpty()
      .withMessage('Student name is required')
      .isLength({ min: 2, max: 100 })
      .withMessage('Student name must be between 2 and 100 characters'),
    body('student_info.id')
      .notEmpty()
      .withMessage('Student ID is required')
      .isLength({ min: 1, max: 50 })
      .withMessage('Student ID must be between 1 and 50 characters'),
    body('student_info.email')
      .notEmpty()
      .withMessage('Student email is required')
      .isEmail()
      .withMessage('Student email must be a valid email address'),
    body('gateway_name')
      .notEmpty()
      .withMessage('Gateway name is required')
      .isLength({ min: 2, max: 50 })
      .withMessage('Gateway name must be between 2 and 50 characters'),
    body('trustee_id')
      .optional()
      .isMongoId()
      .withMessage('Trustee ID must be a valid MongoDB ObjectId')
  ],
  handleValidationErrors,
  paymentController.createPayment
);

// Check payment status route
router.get('/status/:collect_request_id',
  protect,
  restrictTo('admin', 'trustee', 'staff'),
  [
    param('collect_request_id')
      .notEmpty()
      .withMessage('Collect request ID is required')
      .isLength({ min: 10, max: 50 })
      .withMessage('Collect request ID format is invalid'),
    query('order_id')
      .optional()
      .isMongoId()
      .withMessage('Order ID must be a valid MongoDB ObjectId')
  ],
  handleValidationErrors,
  paymentController.checkPaymentStatus
);

// Fetch all transactions route
router.get('/transactions',
  protect,
  restrictTo('admin', 'trustee'),
  paymentController.getAllTransactions
);

// Fetch transactions by school route
router.get('/transactions/school/:schoolId',
  protect,
  restrictTo('admin', 'trustee', 'staff'),
  checkSchoolAccess,
  [
    param('schoolId')
      .notEmpty()
      .withMessage('School ID is required')
      .isMongoId()
      .withMessage('School ID must be a valid MongoDB ObjectId')
  ],
  handleValidationErrors,
  paymentController.getTransactionsBySchool
);

// Check transaction status route
router.get('/transaction-status/:custom_order_id',
  protect,
  restrictTo('admin', 'trustee', 'staff'),
  [
    param('custom_order_id')
      .notEmpty()
      .withMessage('Custom order ID is required')
      .isMongoId()
      .withMessage('Custom order ID must be a valid MongoDB ObjectId')
  ],
  handleValidationErrors,
  paymentController.getTransactionStatus
);

export default router;