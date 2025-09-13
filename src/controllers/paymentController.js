import { Order, OrderStatus } from '../models/index.js';
import paymentService from '../services/paymentService.js';
import paymentJWTService from '../utils/paymentJWT.js';
import logger from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/asyncHelpers.js';
import mongoose from 'mongoose';

class PaymentController {
  /**
   * Create a new payment request
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  createPayment = catchAsync(async (req, res) => {
    const { amount, callback_url, student_info, gateway_name } = req.body;

    // Validate required fields
    if (!amount || !callback_url || !student_info || !gateway_name) {
      throw new AppError('Missing required fields: amount, callback_url, student_info, gateway_name', 400);
    }

    // Validate student_info structure
    if (!student_info.name || !student_info.id || !student_info.email) {
      throw new AppError('Student info must include name, id, and email', 400);
    }

    // Validate amount is positive number
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      throw new AppError('Amount must be a positive number', 400);
    }

    // Get school_id and trustee_id from environment or request
    const school_id = process.env.SCHOOL_ID;
    const trustee_id = req.body.trustee_id || req.user?.trustee_id;

    if (!school_id) {
      throw new AppError('School ID not configured', 500);
    }

    if (!trustee_id) {
      throw new AppError('Trustee ID is required', 400);
    }

    logger.info('Creating payment request', {
      amount,
      school_id,
      trustee_id,
      student_info: {
        name: student_info.name,
        id: student_info.id,
        email: student_info.email
      },
      gateway_name
    });

    try {
      // Create order in database first
      const order = new Order({
        school_id,
        trustee_id,
        student_info: {
          name: student_info.name,
          id: student_info.id,
          email: student_info.email
        },
        gateway_name
      });

      await order.save();

      logger.info('Order created in database', {
        orderId: order._id,
        school_id,
        student_email: student_info.email
      });

      // Create JWT signature for payment API
      const jwtPayload = {
        school_id,
        amount: amount.toString(),
        callback_url
      };

      const sign = paymentJWTService.signCreateCollectRequest(jwtPayload);

      // Call payment service to create collect request
      const paymentData = {
        school_id,
        amount: amount.toString(),
        callback_url,
        sign
      };

      const paymentResult = await paymentService.createCollectRequest(paymentData);
      //console.log(paymentR)

      if (!paymentResult.success) {
        // If payment API fails, we should log but not delete the order
        logger.error('Payment API failed but order created', {
          orderId: order._id,
          error: paymentResult.error
        });

        throw new AppError(
          paymentResult.error.message || 'Failed to create payment request',
          paymentResult.error.status || 500
        );
      }

      // Create initial order status record
      const orderStatus = new OrderStatus({
        collect_id: order._id,
        order_amount: numericAmount,
        transaction_amount: 0, // Will be updated when payment is processed
        payment_mode: 'online', // Default for API payments
        status: 'pending',
        payment_details: JSON.stringify({
          collect_request_id: paymentResult.data.collect_request_id,
          gateway_name
        })
      });

      await orderStatus.save();

      logger.info('Payment request created successfully', {
        orderId: order._id,
        collect_request_id: paymentResult.data.collect_request_id,
        payment_url: paymentResult.data.payment_url
      });

      // Return success response with payment URL for redirect
      res.status(201).json({
        status: 'success',
        message: 'Payment request created successfully',
        data: {
          order_id: order._id,
          collect_request_id: paymentResult.data.collect_request_id,
          payment_url: paymentResult.data.payment_url,
          amount: numericAmount,
          student_info: {
            name: student_info.name,
            id: student_info.id,
            email: student_info.email
          },
        }
      });

    } catch (error) {
      logger.error('Payment creation failed', {
        message: error.message,
        stack: error.stack,
        student_email: student_info?.email
      });

      // Re-throw AppError as-is, wrap others
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError('Failed to create payment request', 500);
    }
  });

  /**
   * Check payment status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  checkPaymentStatus = catchAsync(async (req, res) => {
    const { collect_request_id } = req.params;
    const { order_id } = req.query;

    if (!collect_request_id) {
      throw new AppError('Collect request ID is required', 400);
    }

    logger.info('Checking payment status', {
      collect_request_id,
      order_id
    });

    // Get school_id from environment
    const school_id = process.env.SCHOOL_ID;
    if (!school_id) {
      throw new AppError('School ID not configured', 500);
    }

    // Create JWT signature for status check
    const jwtPayload = {
      school_id,
      collect_request_id
    };

    const sign = paymentJWTService.signStatusCheck(jwtPayload);

    // Call payment service to check status
    const statusResult = await paymentService.checkPaymentStatus(
      collect_request_id,
      school_id,
      sign
    );

    if (!statusResult.success) {
      logger.error('Payment status check failed', {
        collect_request_id,
        error: statusResult.error
      });

      throw new AppError(
        statusResult.error.message || 'Failed to check payment status',
        statusResult.error.status || 500
      );
    }

    // If order_id is provided, update the order status in database
    if (order_id) {
      try {
        const orderStatus = await OrderStatus.findOne({ collect_id: order_id });
        
        if (orderStatus) {
          // Map API status to our status enum
          let dbStatus = 'pending';
          if (statusResult.data.status === 'SUCCESS') {
            dbStatus = 'completed';
          } else if (statusResult.data.status === 'FAILED') {
            dbStatus = 'failed';
          }

          // Update order status
          orderStatus.status = dbStatus;
          orderStatus.transaction_amount = statusResult.data.amount || orderStatus.order_amount;
          orderStatus.payment_message = `Payment ${statusResult.data.status}`;
          
          if (dbStatus === 'completed') {
            orderStatus.payment_time = new Date();
          }

          await orderStatus.save();

          logger.info('Order status updated in database', {
            order_id,
            collect_request_id,
            status: dbStatus,
            amount: statusResult.data.amount
          });
        }
      } catch (dbError) {
        logger.error('Failed to update order status in database', {
          order_id,
          collect_request_id,
          error: dbError.message
        });
        // Don't throw error here, still return API status
      }
    }

    logger.info('Payment status retrieved successfully', {
      collect_request_id,
      status: statusResult.data.status,
      amount: statusResult.data.amount
    });

    res.status(200).json({
      status: 'success',
      message: 'Payment status retrieved successfully',
      data: {
        collect_request_id,
        payment_status: statusResult.data.status,
        amount: statusResult.data.amount,
        details: statusResult.data.details,
        order_id: order_id || null
      }
    });
  });

  /**
   * Fetch all transactions using MongoDB aggregation
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getAllTransactions = catchAsync(async (req, res) => {
    const { page = 1, limit = 20, q = '', status = '', schools = '', from = '', to = '', sort = 'createdAt', dir = 'desc' } = req.query;

    logger.info('Fetching all transactions', {
      page: parseInt(page),
      limit: parseInt(limit),
      search: q,
      status,
      schools,
      dateFrom: from,
      dateTo: to,
      sortField: sort,
      sortDir: dir
    });

    // Build match conditions
    const matchConditions = {};

    // Add date range filter
    if (from || to) {
      matchConditions.createdAt = {};
      if (from) matchConditions.createdAt.$gte = new Date(from);
      if (to) matchConditions.createdAt.$lte = new Date(to + 'T23:59:59.999Z');
    }

    // Build aggregation pipeline
    const pipeline = [
      {
        $lookup: {
          from: 'orders',
          localField: 'collect_id',
          foreignField: '_id',
          as: 'order_details'
        }
      },
      {
        $unwind: '$order_details'
      },
      {
        $project: {
          collect_id: 1,
          collect_request_id: '$collect_id',
          school_id: '$order_details.school_id',
          gateway: '$order_details.gateway_name',
          gateway_name: '$order_details.gateway_name',
          order_amount: 1,
          transaction_amount: 1,
          status: 1,
          custom_order_id: '$collect_id',
          order_id: '$collect_id',
          payment_time: 1,
          createdAt: 1,
          updatedAt: 1
        }
      }
    ];

    // Add match stage if we have conditions
    if (Object.keys(matchConditions).length > 0) {
      pipeline.push({ $match: matchConditions });
    }

    // Add status filter
    if (status) {
      const statusArray = status.split(',').filter(Boolean);
      if (statusArray.length > 0) {
        pipeline.push({
          $match: {
            status: { $in: statusArray }
          }
        });
      }
    }

    // Add schools filter
    if (schools) {
      const schoolsArray = schools.split(',').filter(Boolean);
      if (schoolsArray.length > 0) {
        pipeline.push({
          $match: {
            school_id: { $in: schoolsArray.map(id => {
              // Handle both ObjectId and string school IDs
              try {
                return new mongoose.Types.ObjectId(id);
              } catch {
                return id;
              }
            }) }
          }
        });
      }
    }

    // Add search filter
    if (q) {
      pipeline.push({
        $match: {
          $or: [
            { status: { $regex: q, $options: 'i' } },
            { gateway: { $regex: q, $options: 'i' } },
            { school_id: { $regex: q, $options: 'i' } }
          ]
        }
      });
    }

    // Get total count before pagination
    const countPipeline = [...pipeline, { $count: "total" }];
    const totalResult = await OrderStatus.aggregate(countPipeline);
    const total_count = totalResult.length > 0 ? totalResult[0].total : 0;

    // Add sorting
    const sortField = sort === 'collect_request_id' ? 'collect_id' : sort;
    const sortOrder = dir === 'asc' ? 1 : -1;
    pipeline.push({
      $sort: { [sortField]: sortOrder }
    });

    // Add pagination only if limit is not -1
    if (parseInt(limit) !== -1) {
      const skip = (parseInt(page) - 1) * parseInt(limit);
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: parseInt(limit) });
    }

    const transactions = await OrderStatus.aggregate(pipeline);

    logger.info('All transactions fetched successfully', {
      count: transactions.length,
      total_count,
      page: parseInt(page),
      limit: parseInt(limit),
      isAllEntries: parseInt(limit) === -1
    });

    res.status(200).json({
      status: 'success',
      message: 'All transactions retrieved successfully',
      data: {
        transactions,
        total_count,
        page: parseInt(limit) === -1 ? 1 : parseInt(page),
        limit: parseInt(limit) === -1 ? total_count : parseInt(limit),
        total_pages: parseInt(limit) === -1 ? 1 : Math.ceil(total_count / parseInt(limit))
      }
    });
  });

  /**
   * Fetch transactions by school ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getTransactionsBySchool = catchAsync(async (req, res) => {
    const { schoolId } = req.params;
    const { page = 1, limit = 20, q = '', status = '', from = '', to = '', sort = 'createdAt', dir = 'desc' } = req.query;

    if (!schoolId) {
      throw new AppError('School ID is required', 400);
    }

    logger.info('Fetching transactions by school', { 
      schoolId,
      page: parseInt(page),
      limit: parseInt(limit),
      search: q,
      status,
      dateFrom: from,
      dateTo: to,
      sortField: sort,
      sortDir: dir
    });

    // Build match conditions
    const matchConditions = {};

    // Add date range filter
    if (from || to) {
      matchConditions.createdAt = {};
      if (from) matchConditions.createdAt.$gte = new Date(from);
      if (to) matchConditions.createdAt.$lte = new Date(to + 'T23:59:59.999Z');
    }

    const pipeline = [
      {
        $lookup: {
          from: 'orders',
          localField: 'collect_id',
          foreignField: '_id',
          as: 'order_details'
        }
      },
      {
        $unwind: '$order_details'
      },
      {
        $match: {
          'order_details.school_id': schoolId.length === 24 ? new mongoose.Types.ObjectId(schoolId) : schoolId
        }
      },
      {
        $project: {
          collect_id: 1,
          collect_request_id: '$collect_id',
          school_id: '$order_details.school_id',
          gateway: '$order_details.gateway_name',
          gateway_name: '$order_details.gateway_name',
          order_amount: 1,
          transaction_amount: 1,
          status: 1,
          custom_order_id: '$collect_id',
          order_id: '$collect_id',
          payment_time: 1,
          createdAt: 1,
          updatedAt: 1
        }
      }
    ];

    // Add match stage if we have conditions
    if (Object.keys(matchConditions).length > 0) {
      pipeline.push({ $match: matchConditions });
    }

    // Add status filter
    if (status) {
      const statusArray = status.split(',').filter(Boolean);
      if (statusArray.length > 0) {
        pipeline.push({
          $match: {
            status: { $in: statusArray }
          }
        });
      }
    }

    // Add search filter
    if (q) {
      pipeline.push({
        $match: {
          $or: [
            { status: { $regex: q, $options: 'i' } },
            { gateway: { $regex: q, $options: 'i' } }
          ]
        }
      });
    }

    // Get total count before pagination
    const countPipeline = [...pipeline, { $count: "total" }];
    const totalResult = await OrderStatus.aggregate(countPipeline);
    const total_count = totalResult.length > 0 ? totalResult[0].total : 0;

    // Add sorting
    const sortField = sort === 'collect_request_id' ? 'collect_id' : sort;
    const sortOrder = dir === 'asc' ? 1 : -1;
    pipeline.push({
      $sort: { [sortField]: sortOrder }
    });

    // Add pagination only if limit is not -1
    if (parseInt(limit) !== -1) {
      const skip = (parseInt(page) - 1) * parseInt(limit);
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: parseInt(limit) });
    }

    const transactions = await OrderStatus.aggregate(pipeline);

    logger.info('Transactions by school fetched successfully', {
      schoolId,
      count: transactions.length,
      total_count,
      page: parseInt(page),
      limit: parseInt(limit),
      isAllEntries: parseInt(limit) === -1
    });

    res.status(200).json({
      status: 'success',
      message: 'School transactions retrieved successfully',
      data: {
        school_id: schoolId,
        transactions,
        total_count,
        page: parseInt(limit) === -1 ? 1 : parseInt(page),
        limit: parseInt(limit) === -1 ? total_count : parseInt(limit),
        total_pages: parseInt(limit) === -1 ? 1 : Math.ceil(total_count / parseInt(limit))
      }
    });
  });

  /**
   * Check transaction status by custom order ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getTransactionStatus = catchAsync(async (req, res) => {
    const { custom_order_id } = req.params;

    if (!custom_order_id) {
      throw new AppError('Custom order ID is required', 400);
    }

    logger.info('Checking transaction status', { custom_order_id });

    const pipeline = [
      {
        $match: {
          collect_id: new mongoose.Types.ObjectId(custom_order_id)
        }
      },
      {
        $lookup: {
          from: 'orders',
          localField: 'collect_id',
          foreignField: '_id',
          as: 'order_details'
        }
      },
      {
        $unwind: '$order_details'
      },
      {
        $project: {
          collect_id: 1,
          school_id: '$order_details.school_id',
          gateway: '$order_details.gateway_name',
          order_amount: 1,
          transaction_amount: 1,
          status: 1,
          custom_order_id: '$collect_id',
          payment_time: 1,
          payment_details: 1,
          payment_message: 1,
          error_message: 1,
          createdAt: 1,
          updatedAt: 1
        }
      }
    ];

    const transactionStatus = await OrderStatus.aggregate(pipeline);

    if (!transactionStatus || transactionStatus.length === 0) {
      throw new AppError('Transaction not found', 404);
    }

    const transaction = transactionStatus[0];

    logger.info('Transaction status retrieved successfully', {
      custom_order_id,
      status: transaction.status
    });

    res.status(200).json({
      status: 'success',
      message: 'Transaction status retrieved successfully',
      data: transaction
    });
  });

}

export default new PaymentController();