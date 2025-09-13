import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

class PaymentJWTService {
  constructor() {
    this.pgKey = process.env.PG_KEY;
    this.jwtOptions = {
      algorithm: 'HS256',
      expiresIn: '1h'
    };
  }

  /**
   * Sign JWT for create collect request
   * @param {Object} payload - Payment data to sign
   * @param {string} payload.school_id - School ID
   * @param {string} payload.amount - Amount in INR
   * @param {string} payload.callback_url - Callback URL
   * @returns {string} Signed JWT token
   */
  signCreateCollectRequest(payload) {
    try {
      if (!this.pgKey) {
        throw new Error('PG_KEY is not configured');
      }

      const jwtPayload = {
        school_id: payload.school_id,
        amount: payload.amount,
        callback_url: payload.callback_url,
        iat: Math.floor(Date.now() / 1000)
      };

      const token = jwt.sign(jwtPayload, this.pgKey, this.jwtOptions);

      logger.debug('JWT signed for create collect request', {
        school_id: payload.school_id,
        amount: payload.amount,
        callback_url: payload.callback_url
      });

      return token;
    } catch (error) {
      logger.error('Failed to sign JWT for create collect request', {
        message: error.message,
        payload: {
          school_id: payload.school_id,
          amount: payload.amount,
          callback_url: payload.callback_url
        }
      });
      throw new Error(`JWT signing failed: ${error.message}`);
    }
  }

  /**
   * Sign JWT for payment status check
   * @param {Object} payload - Status check data to sign
   * @param {string} payload.school_id - School ID
   * @param {string} payload.collect_request_id - Collect request ID
   * @returns {string} Signed JWT token
   */
  signStatusCheck(payload) {
    try {
      if (!this.pgKey) {
        throw new Error('PG_KEY is not configured');
      }

      const jwtPayload = {
        school_id: payload.school_id,
        collect_request_id: payload.collect_request_id,
        iat: Math.floor(Date.now() / 1000)
      };

      const token = jwt.sign(jwtPayload, this.pgKey, this.jwtOptions);

      logger.debug('JWT signed for status check', {
        school_id: payload.school_id,
        collect_request_id: payload.collect_request_id
      });

      return token;
    } catch (error) {
      logger.error('Failed to sign JWT for status check', {
        message: error.message,
        payload: {
          school_id: payload.school_id,
          collect_request_id: payload.collect_request_id
        }
      });
      throw new Error(`JWT signing failed: ${error.message}`);
    }
  }

  /**
   * Verify JWT token
   * @param {string} token - JWT token to verify
   * @returns {Object} Decoded token payload
   */
  verifyToken(token) {
    try {
      if (!this.pgKey) {
        throw new Error('PG_KEY is not configured');
      }

      const decoded = jwt.verify(token, this.pgKey);

      logger.debug('JWT token verified successfully', {
        exp: decoded.exp,
        iat: decoded.iat
      });

      return {
        success: true,
        payload: decoded
      };
    } catch (error) {
      logger.error('JWT token verification failed', {
        message: error.message,
        name: error.name
      });

      return {
        success: false,
        error: {
          message: error.message,
          name: error.name
        }
      };
    }
  }

  /**
   * Decode JWT token without verification (for debugging)
   * @param {string} token - JWT token to decode
   * @returns {Object} Decoded token payload
   */
  decodeToken(token) {
    try {
      const decoded = jwt.decode(token, { complete: true });
      
      logger.debug('JWT token decoded', {
        header: decoded?.header,
        payload: decoded?.payload
      });

      return {
        success: true,
        decoded: decoded
      };
    } catch (error) {
      logger.error('JWT token decode failed', {
        message: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate JWT service configuration
   * @returns {boolean} True if configuration is valid
   */
  validateConfiguration() {
    if (!this.pgKey) {
      logger.error('Payment JWT service configuration incomplete: PG_KEY is missing');
      return false;
    }
    return true;
  }

  /**
   * Get service configuration status
   * @returns {Object} Configuration status
   */
  getConfigStatus() {
    return {
      pgKey: !!this.pgKey,
      isValid: this.validateConfiguration()
    };
  }
}

// Create singleton instance
const paymentJWTService = new PaymentJWTService();

export default paymentJWTService;