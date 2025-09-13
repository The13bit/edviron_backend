import express from "express";
import { body } from "express-validator";
import { validate } from "../middlewares/validate.js";
import {
  authenticate,
  authorize,
  authorizeSchool,
} from "../middlewares/auth.js";
import { asyncHandler } from "../middlewares/error.js";
import { logger } from "../utils/logger.js";
import Order from "../models/Order.js";
import OrderStatus from "../models/OrderStatus.js";
import vendorClient from "../services/vendorClient.js";

const router = express.Router();

/**
 * @swagger
 * /create-payment:
 *   post:
 *     summary: Create a new payment request
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - school_id
 *               - amount
 *               - callback_url
 *               - custom_order_id
 *               - student_info
 *             properties:
 *               school_id:
 *                 type: string
 *                 example: SCH001
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *                 example: 1000.50
 *               callback_url:
 *                 type: string
 *                 format: uri
 *                 example: https://school.edviron.com/payment/callback
 *               custom_order_id:
 *                 type: string
 *                 example: ORD-2023-001
 *               student_info:
 *                 type: object
 *                 required:
 *                   - name
 *                   - id
 *                   - email
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: John Doe
 *                   id:
 *                     type: string
 *                     example: STU001
 *                   email:
 *                     type: string
 *                     format: email
 *                     example: john.doe@student.com
 *               trustee_id:
 *                 type: string
 *                 example: TRU001
 *     responses:
 *       201:
 *         description: Payment request created successfully
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
 *                     payment_link:
 *                       type: string
 *                       example: https://pay.edviron.com/collect/abc123
 *                     collect_request_id:
 *                       type: string
 *                       example: CRQ123456789
 *                     order_id:
 *                       type: string
 *                       example: 507f1f77bcf86cd799439011
 *                     vendorData:
 *                       type: object
 *       400:
 *         description: Validation error or duplicate order
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.post(
  "/create-payment",
  authenticate,
  authorize(["admin", "school", "trustee"]),
  validate([
    body("school_id").notEmpty().trim().withMessage("School ID is required"),
    body("amount")
      .isFloat({ min: 0.01 })
      .withMessage("Amount must be greater than 0"),
    body("callback_url").isURL().withMessage("Valid callback URL is required"),
    body("custom_order_id")
      .notEmpty()
      .trim()
      .withMessage("Custom order ID is required"),
    body("student_info.name")
      .notEmpty()
      .trim()
      .withMessage("Student name is required"),
    body("student_info.id")
      .notEmpty()
      .trim()
      .withMessage("Student ID is required"),
    body("student_info.email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid student email is required"),
    body("trustee_id").optional().trim(),
  ]),
  authorizeSchool,
  asyncHandler(async (req, res) => {
    const {
      school_id,
      amount,
      callback_url,
      custom_order_id,
      student_info,
      trustee_id,
    } = req.body;

    logger.info("Creating payment request:", {
      school_id,
      amount,
      custom_order_id,
      user: req.user.email,
    });

    // Check if order with custom_order_id already exists
    const existingOrder = await Order.findByCustomOrderId(custom_order_id);
    if (existingOrder) {
      logger.warn("Duplicate order ID attempted:", { custom_order_id });
      return res.status(400).json({
        success: false,
        message: "Order with this custom order ID already exists",
        code: "DUPLICATE_ORDER_ID",
      });
    }

    try {
      // Create collect request with vendor (matching exact API spec)
      const vendorResponse = await vendorClient.createCollectRequest({
        school_id,
        amount: amount.toString(), // Ensure amount is string as per API spec
        callback_url,
      });

      // Create order in database
      const orderData = {
        school_id,
        trustee_id,
        student_info,
        custom_order_id,
        collect_request_id: vendorResponse.collect_request_id,
        amount,
        callback_url,
        status: "pending",
        vendor_response: vendorResponse,
      };

      const order = new Order(orderData);
      await order.save();

      // Create initial order status
      const initialStatus = {
        collect_id: order._id,
        order_amount: amount,
        status: "pending",
        payment_time: new Date(),
      };

      await OrderStatus.create(initialStatus);

      logger.info("Payment request created successfully:", {
        order_id: order._id,
        collect_request_id: vendorResponse.collect_request_id,
        collect_request_url: vendorResponse.Collect_request_url,
      });

      res.status(201).json({
        success: true,
        data: {
          collect_request_id: vendorResponse.collect_request_id,
          collect_request_url: vendorResponse.Collect_request_url,
          order_id: order._id,
          sign: vendorResponse.sign,
        },
      });
    } catch (error) {
      logger.error("Error creating payment request:", error);

      // Return appropriate error response
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
          code: error.code,
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to create payment request",
        code: "PAYMENT_CREATION_FAILED",
      });
    }
  })
);

export default router;
