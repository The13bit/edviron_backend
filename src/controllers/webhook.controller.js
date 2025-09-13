import { logger } from '../utils/logger.js';
import Order from '../models/Order.js';
import OrderStatus from '../models/OrderStatus.js';
import WebhookLog from '../models/WebhookLog.js';

/**
 * Webhook Controller
 * Handles all webhook-related business logic
 */
class WebhookController {
  /**
   * Process incoming webhook notifications from vendor
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async processWebhook(req, res) {
    const rawPayload = req.body;
    const sourceIp = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    const headers = req.headers;

    logger.info('Webhook received:', {
      sourceIp,
      userAgent,
      payloadKeys: Object.keys(rawPayload)
    });

    // Create webhook log entry
    const webhookLogData = {
      raw_payload: rawPayload,
      received_at: new Date(),
      source_ip: sourceIp,
      user_agent: userAgent,
      headers: headers,
      processing_status: 'queued'
    };

    try {
      // Parse webhook payload
      const parsed = this.parseWebhookPayload(rawPayload);
      webhookLogData.parsed = parsed;

      // Extract identifiers
      if (parsed.custom_order_id) {
        webhookLogData.custom_order_id = parsed.custom_order_id;
      }
      if (parsed.collect_request_id) {
        webhookLogData.collect_request_id = parsed.collect_request_id;
      }
      if (parsed.transaction_id) {
        webhookLogData.transaction_id = parsed.transaction_id;
      }

      // Create webhook log
      const webhookLog = await WebhookLog.createLog(webhookLogData);

      // Process the webhook
      await this.processWebhookData(parsed, webhookLog);

      // Mark as processed
      await webhookLog.markAsProcessed('Webhook processed successfully');

      logger.info('Webhook processed successfully:', {
        webhookLogId: webhookLog._id,
        custom_order_id: parsed.custom_order_id
      });

      res.json({
        success: true,
        message: 'Webhook processed successfully'
      });

    } catch (error) {
      logger.error('Webhook processing failed:', error);

      // Try to mark webhook log as failed if we have it
      if (webhookLogData._id) {
        try {
          const webhookLog = await WebhookLog.findById(webhookLogData._id);
          if (webhookLog) {
            await webhookLog.markAsFailed(error.message);
          }
        } catch (logError) {
          logger.error('Failed to update webhook log:', logError);
        }
      } else {
        // Create failed webhook log
        webhookLogData.processing_status = 'failed';
        webhookLogData.processing_message = error.message;
        await WebhookLog.createLog(webhookLogData);
      }

      res.status(400).json({
        success: false,
        message: 'Webhook processing failed',
        code: 'WEBHOOK_PROCESSING_FAILED'
      });
    }
  }

  /**
   * Parse webhook payload to extract relevant information
   * @param {Object} payload - Raw webhook payload
   * @returns {Object} Parsed webhook data
   */
  parseWebhookPayload(payload) {
    const parsed = {
      custom_order_id: null,
      collect_request_id: null,
      transaction_id: null,
      order_amount: null,
      transaction_amount: null,
      payment_mode: null,
      payment_details: null,
      bank_reference: null,
      payment_message: null,
      status: null,
      error_message: null,
      payment_time: null,
      gateway: 'edviron'
    };

    try {
      // Extract order information
      if (payload.order_info) {
        parsed.custom_order_id = payload.order_info.custom_order_id;
        
        // Parse order_id which might be in format "collect_id/transaction_id"
        if (payload.order_info.order_id) {
          const orderIdParts = payload.order_info.order_id.split('/');
          if (orderIdParts.length === 2) {
            parsed.collect_request_id = orderIdParts[0];
            parsed.transaction_id = orderIdParts[1];
          } else {
            parsed.collect_request_id = payload.order_info.order_id;
          }
        }
      }

      // Extract payment information
      if (payload.payment_info) {
        parsed.order_amount = payload.payment_info.order_amount;
        parsed.transaction_amount = payload.payment_info.transaction_amount || payload.payment_info.amount;
        parsed.payment_mode = payload.payment_info.payment_mode;
        parsed.payment_details = payload.payment_info.payment_details;
        parsed.bank_reference = payload.payment_info.bank_reference;
        parsed.payment_message = payload.payment_info.payment_message || payload.payment_info.message;
        parsed.status = payload.payment_info.status;
        parsed.error_message = payload.payment_info.error_message;
        parsed.gateway = payload.payment_info.gateway || 'edviron';
        
        if (payload.payment_info.payment_time) {
          parsed.payment_time = new Date(payload.payment_info.payment_time);
        }
        
        if (payload.payment_info.transaction_id) {
          parsed.transaction_id = payload.payment_info.transaction_id;
        }
      }

      // Handle flat structure (fallback)
      if (!payload.order_info && !payload.payment_info) {
        parsed.custom_order_id = payload.custom_order_id;
        parsed.collect_request_id = payload.collect_request_id;
        parsed.transaction_id = payload.transaction_id;
        parsed.order_amount = payload.order_amount;
        parsed.transaction_amount = payload.transaction_amount || payload.amount;
        parsed.payment_mode = payload.payment_mode;
        parsed.payment_details = payload.payment_details;
        parsed.bank_reference = payload.bank_reference;
        parsed.payment_message = payload.payment_message || payload.message;
        parsed.status = payload.status;
        parsed.error_message = payload.error_message;
        parsed.gateway = payload.gateway || 'edviron';
        
        if (payload.payment_time) {
          parsed.payment_time = new Date(payload.payment_time);
        }
      }

      // Set default payment time if not provided
      if (!parsed.payment_time) {
        parsed.payment_time = new Date();
      }

      return parsed;
    } catch (error) {
      logger.error('Error parsing webhook payload:', error);
      throw new Error('Invalid webhook payload format');
    }
  }

  /**
   * Process the parsed webhook data
   * @param {Object} parsed - Parsed webhook data
   * @param {Object} webhookLog - Webhook log document
   */
  async processWebhookData(parsed, webhookLog) {
    if (!parsed.custom_order_id && !parsed.collect_request_id) {
      throw new Error('No order identifier found in webhook payload');
    }

    // Find the order
    let order = null;
    
    if (parsed.custom_order_id) {
      order = await Order.findByCustomOrderId(parsed.custom_order_id);
    } else if (parsed.collect_request_id) {
      order = await Order.findOne({ collect_request_id: parsed.collect_request_id });
    }

    if (!order) {
      throw new Error(`Order not found for identifiers: custom_order_id=${parsed.custom_order_id}, collect_request_id=${parsed.collect_request_id}`);
    }

    // Update webhook log with order reference
    webhookLog.order_id = order._id;
    webhookLog.custom_order_id = order.custom_order_id;
    webhookLog.collect_request_id = order.collect_request_id;
    await webhookLog.save();

    // Prepare order status data
    const statusData = {
      order_amount: parsed.order_amount || order.amount,
      transaction_amount: parsed.transaction_amount,
      payment_mode: parsed.payment_mode,
      payment_details: parsed.payment_details,
      bank_reference: parsed.bank_reference,
      payment_message: parsed.payment_message,
      status: parsed.status,
      error_message: parsed.error_message,
      payment_time: parsed.payment_time,
      transaction_id: parsed.transaction_id,
      gateway: parsed.gateway,
      vendor_data: parsed
    };

    // Create or update order status
    await OrderStatus.upsertStatus(order._id, statusData);

    // Update order status if it's a final status
    if (['completed', 'failed', 'cancelled'].includes(parsed.status)) {
      await order.updateStatus(parsed.status);
    }

    logger.info('Webhook processing completed:', {
      order_id: order._id,
      custom_order_id: order.custom_order_id,
      status: parsed.status,
      transaction_id: parsed.transaction_id
    });
  }
}

export default new WebhookController();
