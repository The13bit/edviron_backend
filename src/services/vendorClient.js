import axios from 'axios';
import { config } from '../config/env.js';
import { signVendorPayload } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middlewares/error.js';

class VendorClient {
  constructor() {
    this.baseURL = config.vendorBaseUrl;
    this.apiKey = config.vendorApiKey;
    
    // Create axios instance with default config
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000, // 30 seconds
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('Vendor API Request:', {
          method: config.method,
          url: config.url,
          data: config.data
        });
        return config;
      },
      (error) => {
        logger.error('Vendor API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Vendor API Response:', {
          status: response.status,
          data: response.data
        });
        return response;
      },
      (error) => {
        logger.error('Vendor API Response Error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Sign payload using PG JWT secret
   * @param {Object} payload - Data to sign
   * @returns {string} JWT signature
   */
  sign(payload) {
    try {
      return signVendorPayload(payload);
    } catch (error) {
      logger.error('Error signing vendor payload:', error);
      throw new AppError('Failed to sign vendor payload', 500, 'VENDOR_SIGN_ERROR');
    }
  }

  /**
   * Create collect request with vendor
   * @param {Object} requestData - Collect request data
   * @returns {Promise<Object>} Vendor response
   */
  async createCollectRequest(requestData) {
    try {
      const { school_id, amount, callback_url } = requestData;

      // Create sign payload for vendor authentication (exactly as per API spec)
      const signPayload = {
        school_id,
        amount,
        callback_url
      };
      
      const sign = this.sign(signPayload);

      // Prepare request body for vendor API (exactly as per API spec)
      const requestBody = {
        school_id,
        amount,
        callback_url,
        sign
      };

      logger.info('Creating collect request with vendor:', {
        school_id,
        amount
      });

      const response = await this.client.post('/erp/create-collect-request', requestBody);

      if (!response.data) {
        throw new AppError('Invalid response from vendor API', 502, 'VENDOR_INVALID_RESPONSE');
      }

      logger.info('Collect request created successfully:', {
        collect_request_id: response.data.collect_request_id,
        collect_request_url: response.data.Collect_request_url
      });

      return response.data;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error.response) {
        // Vendor API returned an error response
        const statusCode = error.response.status;
        const errorData = error.response.data;
        
        logger.error('Vendor API error response:', {
          status: statusCode,
          data: errorData
        });

        throw new AppError(
          errorData?.message || 'Vendor API request failed',
          statusCode >= 500 ? 502 : 400,
          'VENDOR_API_ERROR'
        );
      } else if (error.request) {
        // Network error
        logger.error('Network error calling vendor API:', error.message);
        throw new AppError('Network error connecting to vendor API', 502, 'VENDOR_NETWORK_ERROR');
      } else {
        // Other error
        logger.error('Unexpected error calling vendor API:', error);
        throw new AppError('Unexpected error with vendor API', 500, 'VENDOR_UNEXPECTED_ERROR');
      }
    }
  }

  /**
   * Get collect request status from vendor
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} Vendor response
   */
  async getCollectRequest({ collect_request_id, school_id }) {
    try {
      // Create sign payload for vendor authentication
      const signPayload = {
        school_id,
        collect_request_id
      };
      
      const sign = this.sign(signPayload);

      const params = {
        school_id,
        sign
      };

      logger.info('Getting collect request status from vendor:', {
        collect_request_id,
        school_id
      });

      const response = await this.client.get(`/erp/collect-request/${collect_request_id}`, {
        params
      });

      if (!response.data) {
        throw new AppError('Invalid response from vendor API', 502, 'VENDOR_INVALID_RESPONSE');
      }

      logger.debug('Collect request status retrieved:', {
        collect_request_id,
        status: response.data.status
      });

      return response.data;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error.response) {
        // Vendor API returned an error response
        const statusCode = error.response.status;
        const errorData = error.response.data;
        
        logger.error('Vendor API error response:', {
          status: statusCode,
          data: errorData
        });

        throw new AppError(
          errorData?.message || 'Failed to get collect request status',
          statusCode >= 500 ? 502 : 400,
          'VENDOR_API_ERROR'
        );
      } else if (error.request) {
        // Network error
        logger.error('Network error calling vendor API:', error.message);
        throw new AppError('Network error connecting to vendor API', 502, 'VENDOR_NETWORK_ERROR');
      } else {
        // Other error
        logger.error('Unexpected error calling vendor API:', error);
        throw new AppError('Unexpected error with vendor API', 500, 'VENDOR_UNEXPECTED_ERROR');
      }
    }
  }
}

// Export singleton instance
export default new VendorClient();