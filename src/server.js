import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';

// Import local modules
import database from './config/database.js';
import logger from './utils/logger.js';
import {
  globalErrorHandler,
  notFoundHandler,
  uncaughtExceptionHandler,
  unhandledRejectionHandler,
  AppError
} from './middleware/errorHandler.js';
import { catchAsync } from './utils/asyncHelpers.js';
import paymentRoutes from './routes/paymentRoutes.js';
import authRoutes from './routes/authRoutes.js';

// Handle uncaught exceptions
uncaughtExceptionHandler();

// Create Express application
const app = express();

// Trust proxy (important for rate limiting and getting real IP addresses)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  type: 'application/json'
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));


// Compression middleware
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX || 100, // limit each IP to 100 requests per windowMs
  message: {
    status: 'error',
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/health';
  }
});

app.use('/api/', limiter);

// HTTP request logging
app.use(morgan('combined', { 
  stream: logger.stream,
  skip: (req, res) => {
    // Skip logging for health checks in production
    return process.env.NODE_ENV === 'production' && req.path === '/health';
  }
}));

// Health check endpoint
app.get('/health', catchAsync(async (req, res) => {
  const healthCheck = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: database.isConnected() ? 'connected' : 'disconnected',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100,
    },
    version: process.env.npm_package_version || '1.0.0'
  };

  logger.debug('Health check requested', healthCheck);
  res.status(200).json(healthCheck);
}));

// API routes
app.get('/api/health', catchAsync(async (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'API is running',
    timestamp: new Date().toISOString(),
    database: database.isConnected() ? 'connected' : 'disconnected'
  });
}));

// Example protected route with async handling
app.get('/api/test', catchAsync(async (req, res) => {
  // Simulate some async operation
  await new Promise(resolve => setTimeout(resolve, 100));
  
  logger.info('Test endpoint accessed', {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(200).json({
    status: 'success',
    message: 'Test endpoint working with async handling',
    timestamp: new Date().toISOString(),
    data: {
      asyncOperation: 'completed',
      logging: 'active',
      errorHandling: 'enabled'
    }
  });
}));

// Example error route for testing error handling
app.get('/api/error', catchAsync(async (req, res) => {
  // Simulate an error
  throw new AppError('This is a test error', 400);
}));

// Authentication routes
app.use('/api/auth', authRoutes);

// Payment routes
app.use('/api/payments', paymentRoutes);

// Handle undefined routes
// Global error handling middleware (must be last)
app.use(globalErrorHandler);

// Start server function
const startServer = async () => {
  try {
    // Connect to database
    await database.connect();
    
    // Get port from environment
    const port = process.env.PORT || 3000;
    
    // Start server
    const server = app.listen(port, () => {
      logger.info(`🚀 Server started successfully`, {
        port,
        environment: process.env.NODE_ENV || 'development',
        database: database.isConnected() ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
      });
    });

    // Handle unhandled promise rejections
    unhandledRejectionHandler(server);

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        try {
          await database.disconnect();
          logger.info('Database connection closed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during graceful shutdown:', error);
          process.exit(1);
        }
      });
    };

    // Handle process signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    return server;
  } catch (error) {
    logger.error('Failed to start server:', {
      message: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

// Start the server if this file is run directly


startServer();


export { app, startServer };
export default app;