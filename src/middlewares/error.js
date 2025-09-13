import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';

/**
 * Centralized error handling middleware
 */
export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error('Error caught by error handler:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Default error response
  let response = {
    success: false,
    message: 'Internal Server Error',
    code: 'INTERNAL_ERROR'
  };

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    response.message = 'Invalid ID format';
    response.code = 'INVALID_ID';
    return res.status(400).json(response);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    response.message = `Duplicate value for field: ${field}`;
    response.code = 'DUPLICATE_FIELD';
    return res.status(400).json(response);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(val => ({
      field: val.path,
      message: val.message
    }));
    
    response.message = 'Validation Error';
    response.details = errors;
    response.code = 'VALIDATION_ERROR';
    return res.status(400).json(response);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    response.message = 'Invalid token';
    response.code = 'INVALID_TOKEN';
    return res.status(401).json(response);
  }

  if (err.name === 'TokenExpiredError') {
    response.message = 'Token expired';
    response.code = 'TOKEN_EXPIRED';
    return res.status(401).json(response);
  }

  // Custom application errors
  if (err.statusCode) {
    response.message = err.message;
    response.code = err.code || 'APPLICATION_ERROR';
    return res.status(err.statusCode).json(response);
  }

  // Include error details in development
  if (config.nodeEnv === 'development') {
    response.details = {
      message: err.message,
      stack: err.stack
    };
  }

  res.status(500).json(response);
};

/**
 * Handle 404 routes
 */
export const notFound = (req, res, next) => {
  const error = new Error(`Route not found - ${req.originalUrl}`);
  error.statusCode = 404;
  error.code = 'ROUTE_NOT_FOUND';
  
  logger.warn('Route not found:', {
    path: req.originalUrl,
    method: req.method,
    ip: req.ip
  });
  
  next(error);
};

/**
 * Async error handler wrapper
 * Wraps async route handlers to catch errors automatically
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Custom error class for application-specific errors
 */
export class AppError extends Error {
  constructor(message, statusCode, code = 'APPLICATION_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}