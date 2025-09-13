import express from 'express';
import { asyncHandler } from '../middlewares/error.js';
import webhookController from '../controllers/webhook.controller.js';

const router = express.Router();

/**
 * @swagger
 * /api/webhook:
 *   post:
 *     summary: Receive webhook notifications from vendor
 *     tags: [Webhooks]
 *     description: Public endpoint to receive payment status updates from the vendor
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Webhook payload from vendor
 *             example:
 *               order_info:
 *                 order_id: "collect_id/transaction_id"
 *                 custom_order_id: "ORD-2023-001"
 *               payment_info:
 *                 status: "completed"
 *                 amount: 1000.50
 *                 payment_mode: "UPI"
 *                 transaction_id: "TXN123456789"
 *                 payment_time: "2023-12-01T10:30:00Z"
 *     responses:
 *       200:
 *         description: Webhook processed successfully
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
 *                   example: Webhook processed successfully
 *       400:
 *         description: Invalid webhook payload
 */
router.post('/webhook',
  asyncHandler(webhookController.processWebhook)
);

export default router;