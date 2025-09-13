import axios from 'axios';
import logger from '../utils/logger.js';
import { retryWithBackoff } from '../utils/asyncHelpers.js';

class PaymentService {
  constructor() {
    this.baseURL = process.env.PAYMENT_API_BASE_URL;
    this.apiKey = process.env.PAYMENT_API_KEY;
    this.schoolId = process.env.SCHOOL_ID;
    
    // Create axios instance with default configuration
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.info('Payment API request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          headers: {
            ...config.headers,
            Authorization: '***' // Hide sensitive data
          }
        });
        return config;
      },
      (error) => {
        logger.error('Payment API request error', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.info('Payment API response', {
          status: response.status,
          url: response.config.url,
          data: response.data
        });
        return response;
      },
      (error) => {
        logger.error('Payment API response error', {
          status: error.response?.status,
          url: error.config?.url,
          message: error.message,
          data: error.response?.data
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Create a collect request (payment order)
   * @param {Object} paymentData - Payment request data
   * @param {string} paymentData.school_id - School ID
   * @param {string} paymentData.amount - Amount in INR
   * @param {string} paymentData.callback_url - Callback URL after payment
   * @param {string} paymentData.sign - JWT signed payload
   * @returns {Promise<Object>} Payment response with collect_request_id and payment URL
   */
  async createCollectRequest(paymentData) {
    try {
      logger.info('Creating collect request', {
        school_id: paymentData.school_id,
        amount: paymentData.amount,
        callback_url: paymentData.callback_url
      });

      const response = await retryWithBackoff(
        async () => {
          return await this.client.post('/create-collect-request', paymentData);
        },
        3, // max retries
        1000, // base delay
        5000 // max delay
      );

      logger.info('Collect request created successfully', {
        collect_request_id: response.data.collect_request_id,
        payment_url: response.data.collect_request_url
      });

      return {
        success: true,
        data: {
          collect_request_id: response.data.collect_request_id,
          payment_url: response.data.collect_request_url,
          sign: response.data.sign
        }
      };
    } catch (error) {
      logger.error('Failed to create collect request', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      return {
        success: false,
        error: {
          message: error.response?.data?.message || error.message,
          status: error.response?.status || 500,
          code: error.response?.data?.code || 'PAYMENT_API_ERROR'
        }
      };
    }
  }

  /**
   * Check payment status
   * @param {string} collectRequestId - The collect request ID
   * @param {string} schoolId - School ID
   * @param {string} sign - JWT signed payload
   * @returns {Promise<Object>} Payment status response
   */
  async checkPaymentStatus(collectRequestId, schoolId, sign) {
    try {
      logger.info('Checking payment status', {
        collect_request_id: collectRequestId,
        school_id: schoolId
      });

      const response = await retryWithBackoff(
        async () => {
          return await this.client.get(`/collect-request/${collectRequestId}`, {
            params: {
              school_id: schoolId,
              sign: sign
            }
          });
        },
        3, // max retries
        1000, // base delay
        5000 // max delay
      );

      logger.info('Payment status retrieved successfully', {
        collect_request_id: collectRequestId,
        status: response.data.status,
        amount: response.data.amount
      });

      return {
        success: true,
        data: {
          status: response.data.status,
          amount: response.data.amount,
          details: response.data.details,
          jwt: response.data.jwt
        }
      };
    } catch (error) {
      logger.error('Failed to check payment status', {
        collect_request_id: collectRequestId,
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      return {
        success: false,
        error: {
          message: error.response?.data?.message || error.message,
          status: error.response?.status || 500,
          code: error.response?.data?.code || 'PAYMENT_STATUS_ERROR'
        }
      };
    }
  }

  /**
   * Validate payment service configuration
   * @returns {boolean} True if configuration is valid
   */
  validateConfiguration() {
    const requiredConfig = {
      baseURL: this.baseURL,
      apiKey: this.apiKey,
      schoolId: this.schoolId
    };

    const missingConfig = Object.entries(requiredConfig)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missingConfig.length > 0) {
      logger.error('Payment service configuration incomplete', {
        missing: missingConfig
      });
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
      baseURL: !!this.baseURL,
      apiKey: !!this.apiKey,
      schoolId: !!this.schoolId,
      isValid: this.validateConfiguration()
    };
  }
}

// Create singleton instance
const paymentService = new PaymentService();

export default paymentService;