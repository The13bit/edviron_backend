import { logger } from '../utils/logger.js';
import Order from '../models/Order.js';
import OrderStatus from '../models/OrderStatus.js';
import vendorClient from '../services/vendorClient.js';

/**
 * Transactions Controller
 * Handles all transaction-related business logic
 */
class TransactionsController {
  /**
   * Get transaction status by custom order ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getTransactionStatus(req, res) {
    const { custom_order_id } = req.params;

    logger.info('Getting transaction status:', { 
      custom_order_id, 
      user: req.user.email 
    });

    try {
      // Find order by custom order ID
      const order = await Order.findByCustomOrderId(custom_order_id);
      
      if (!order) {
        logger.warn('Order not found:', { custom_order_id });
        return res.status(404).json({
          success: false,
          message: 'Order not found',
          code: 'ORDER_NOT_FOUND'
        });
      }

      // Check school authorization for non-admin users
      if (req.user.role !== 'admin' && req.user.school_id !== order.school_id) {
        logger.warn('Unauthorized access to order:', {
          custom_order_id,
          user_school: req.user.school_id,
          order_school: order.school_id
        });
        return res.status(403).json({
          success: false,
          message: 'Access denied. Cannot access order for different school',
          code: 'SCHOOL_ACCESS_DENIED'
        });
      }

      // Get latest status from vendor if collect_request_id exists
      let vendorStatus = null;
      if (order.collect_request_id) {
        try {
          vendorStatus = await vendorClient.getCollectRequest({
            collect_request_id: order.collect_request_id,
            school_id: order.school_id
          });

          // Update order status based on vendor response
          if (vendorStatus) {
            const statusData = {
              order_amount: vendorStatus.order_amount || order.amount,
              transaction_amount: vendorStatus.transaction_amount,
              payment_mode: vendorStatus.payment_mode,
              payment_details: vendorStatus.payment_details,
              bank_reference: vendorStatus.bank_reference,
              payment_message: vendorStatus.payment_message,
              status: vendorStatus.status,
              error_message: vendorStatus.error_message,
              payment_time: vendorStatus.payment_time ? new Date(vendorStatus.payment_time) : new Date(),
              transaction_id: vendorStatus.transaction_id,
              gateway: vendorStatus.gateway || 'edviron',
              vendor_data: vendorStatus
            };

            await OrderStatus.upsertStatus(order._id, statusData);
          }
        } catch (vendorError) {
          logger.warn('Failed to get vendor status:', {
            custom_order_id,
            error: vendorError.message
          });
          // Continue with local status even if vendor call fails
        }
      }

      // Get latest local status
      const latestStatus = await OrderStatus.findLatestByOrderId(order._id);

      logger.info('Transaction status retrieved:', {
        custom_order_id,
        status: latestStatus?.status || 'unknown'
      });

      res.json({
        success: true,
        data: {
          order: {
            id: order._id,
            custom_order_id: order.custom_order_id,
            school_id: order.school_id,
            amount: order.amount,
            student_info: order.student_info,
            collect_request_id: order.collect_request_id,
            created_at: order.createdAt
          },
          latest_status: latestStatus,
          vendor_status: vendorStatus
        }
      });

    } catch (error) {
      logger.error('Error getting transaction status:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to get transaction status',
        code: 'STATUS_RETRIEVAL_FAILED'
      });
    }
  }

  /**
   * Get paginated list of transactions
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getTransactions(req, res) {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const sortField = req.query.sort || 'createdAt';
    const sortOrder = req.query.order === 'asc' ? 1 : -1;
    const skip = (page - 1) * limit;

    logger.info('Getting transactions:', {
      page,
      limit,
      sortField,
      sortOrder,
      user: req.user.email
    });

    try {
      // Build match criteria based on user role
      const matchCriteria = {};
      if (req.user.role !== 'admin') {
        matchCriteria.school_id = req.user.school_id;
      }

      // Aggregation pipeline to join Order with latest OrderStatus
      const pipeline = [
        { $match: matchCriteria },
        {
          $lookup: {
            from: 'orderstatuses',
            localField: '_id',
            foreignField: 'collect_id',
            as: 'statuses'
          }
        },
        {
          $addFields: {
            latest_status: {
              $arrayElemAt: [
                {
                  $sortArray: {
                    input: '$statuses',
                    sortBy: { payment_time: -1, createdAt: -1 }
                  }
                },
                0
              ]
            }
          }
        },
        {
          $project: {
            collect_id: '$_id',
            school_id: 1,
            gateway: '$gateway_name',
            order_amount: '$amount',
            transaction_amount: '$latest_status.transaction_amount',
            status: '$latest_status.status',
            custom_order_id: 1,
            payment_time: '$latest_status.payment_time',
            createdAt: 1,
            student_info: 1
          }
        },
        { $sort: { [sortField]: sortOrder } },
        { $skip: skip },
        { $limit: limit }
      ];

      // Count total documents
      const countPipeline = [
        { $match: matchCriteria },
        { $count: 'total' }
      ];

      const [transactions, countResult] = await Promise.all([
        Order.aggregate(pipeline),
        Order.aggregate(countPipeline)
      ]);

      const total = countResult[0]?.total || 0;
      const pages = Math.ceil(total / limit);

      logger.info('Transactions retrieved:', {
        count: transactions.length,
        total,
        page,
        pages
      });

      res.json({
        success: true,
        data: {
          items: transactions,
          meta: {
            page,
            limit,
            total,
            pages
          }
        }
      });

    } catch (error) {
      logger.error('Error getting transactions:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to get transactions',
        code: 'TRANSACTIONS_RETRIEVAL_FAILED'
      });
    }
  }

  /**
   * Get transactions for a specific school
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getSchoolTransactions(req, res) {
    const { schoolId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const sortField = req.query.sort || 'createdAt';
    const sortOrder = req.query.order === 'asc' ? 1 : -1;
    const skip = (page - 1) * limit;

    // Check school authorization for non-admin users
    if (req.user.role !== 'admin' && req.user.school_id !== schoolId) {
      logger.warn('Unauthorized access to school transactions:', {
        schoolId,
        user_school: req.user.school_id,
        user: req.user.email
      });
      return res.status(403).json({
        success: false,
        message: 'Access denied. Cannot access transactions for different school',
        code: 'SCHOOL_ACCESS_DENIED'
      });
    }

    logger.info('Getting school transactions:', {
      schoolId,
      page,
      limit,
      user: req.user.email
    });

    try {
      // Same aggregation pipeline but with specific school filter
      const pipeline = [
        { $match: { school_id: schoolId } },
        {
          $lookup: {
            from: 'orderstatuses',
            localField: '_id',
            foreignField: 'collect_id',
            as: 'statuses'
          }
        },
        {
          $addFields: {
            latest_status: {
              $arrayElemAt: [
                {
                  $sortArray: {
                    input: '$statuses',
                    sortBy: { payment_time: -1, createdAt: -1 }
                  }
                },
                0
              ]
            }
          }
        },
        {
          $project: {
            collect_id: '$_id',
            school_id: 1,
            gateway: '$gateway_name',
            order_amount: '$amount',
            transaction_amount: '$latest_status.transaction_amount',
            status: '$latest_status.status',
            custom_order_id: 1,
            payment_time: '$latest_status.payment_time',
            createdAt: 1,
            student_info: 1
          }
        },
        { $sort: { [sortField]: sortOrder } },
        { $skip: skip },
        { $limit: limit }
      ];

      // Count total documents for the school
      const countPipeline = [
        { $match: { school_id: schoolId } },
        { $count: 'total' }
      ];

      const [transactions, countResult] = await Promise.all([
        Order.aggregate(pipeline),
        Order.aggregate(countPipeline)
      ]);

      const total = countResult[0]?.total || 0;
      const pages = Math.ceil(total / limit);

      logger.info('School transactions retrieved:', {
        schoolId,
        count: transactions.length,
        total,
        page,
        pages
      });

      res.json({
        success: true,
        data: {
          items: transactions,
          meta: {
            page,
            limit,
            total,
            pages,
            school_id: schoolId
          }
        }
      });

    } catch (error) {
      logger.error('Error getting school transactions:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to get school transactions',
        code: 'SCHOOL_TRANSACTIONS_RETRIEVAL_FAILED'
      });
    }
  }
}

export default new TransactionsController();
