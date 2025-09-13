import { validationResult } from 'express-validator';
import { logger } from '../utils/logger.js';

/**
 * Middleware to handle express-validator validation results
 */
export const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));
    
    logger.warn('Validation failed:', { 
      path: req.path, 
      method: req.method, 
      errors: errorDetails 
    });
    
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      details: errorDetails,
      code: 'VALIDATION_ERROR'
    });
  }
  
  next();
};

/**
 * Wrapper function to combine validation rules with error handling
 * @param {Array} validations - Array of express-validator validation rules
 */
export const validate = (validations) => {
  return [
    ...validations,
    handleValidation
  ];
};