import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { setupSecurity } from './middlewares/security.js';
import { authenticate } from './middlewares/auth.js';
import { errorHandler, notFound } from './middlewares/error.js';
import { logger } from './utils/logger.js';
import swaggerSpecs from './docs/swagger.js';

// Import routes
import authRoutes from './routes/auth.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import transactionRoutes from './routes/transactions.routes.js';
import webhookRoutes from './routes/webhook.routes.js';

const app = express();

// Trust proxy for proper IP detection
app.set('trust proxy', 1);

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Setup security middleware
setupSecurity(app);

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     description: Check if the API is running and responsive
 *     responses:
 *       200:
 *         description: API is healthy
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
 *                   example: API is healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2023-12-01T10:30:00.000Z"
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 *                   example: 3600
 */
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Documentation
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Edviron Payment API Documentation',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true
  }
}));

// Public routes (no authentication required)
app.use('/api/auth', authRoutes);
app.use('/api/webhooks', webhookRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Edviron Payment API',
    version: '1.0.0',
    documentation: '/docs',
    health: '/health'
  });
});

// Apply authentication middleware to protected routes
app.use('/api', authenticate);

// Protected routes (authentication required)
app.use('/api', paymentRoutes);
app.use('/api', transactionRoutes);

// Handle 404 routes
app.use(notFound);

// Global error handler
app.use(errorHandler);

// Graceful shutdown handler
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

export default app;