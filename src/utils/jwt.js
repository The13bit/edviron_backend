import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { logger } from './logger.js';

/**
 * Generate JWT token for user authentication
 * @param {Object} payload - User data to encode in token
 * @returns {string} JWT token
 */
export const generateToken = (payload) => {
  try {
    return jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
      issuer: 'edviron-api'
    });
  } catch (error) {
    logger.error('Error generating JWT token:', error);
    throw new Error('Token generation failed');
  }
};

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    } else if (error.name === 'TokenExpiredError') {
      throw new Error('Token expired');
    } else {
      logger.error('Error verifying JWT token:', error);
      throw new Error('Token verification failed');
    }
  }
};

/**
 * Generate JWT for vendor API signing (using PG_JWT_SECRET)
 * @param {Object} payload - Data to sign
 * @returns {string} JWT signature
 */
export const signVendorPayload = (payload) => {
  try {
    return jwt.sign(payload, config.pgJwtSecret, {
      algorithm: 'HS256',
      noTimestamp: true // For consistent signatures
    });
  } catch (error) {
    logger.error('Error signing vendor payload:', error);
    throw new Error('Vendor payload signing failed');
  }
};

/**
 * Extract token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} Token or null
 */
export const extractToken = (authHeader) => {
  if (!authHeader) {
    return null;
  }
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
};