import swaggerJSDoc from 'swagger-jsdoc';
import { config } from '../config/env.js';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Edviron Payment API',
      version: '1.0.0',
      description: 'A comprehensive REST API for managing payments, transactions, and webhook processing for educational institutions',
      contact: {
        name: 'Edviron API Support',
        email: 'support@edviron.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server'
      },
      {
        url: 'https://api.edviron.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token obtained from /auth/login'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Error message'
            },
            code: {
              type: 'string',
              example: 'ERROR_CODE'
            },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: {
                    type: 'string'
                  },
                  message: {
                    type: 'string'
                  }
                }
              }
            }
          }
        },
        StudentInfo: {
          type: 'object',
          required: ['name', 'id', 'email'],
          properties: {
            name: {
              type: 'string',
              description: 'Student full name',
              example: 'John Doe'
            },
            id: {
              type: 'string',
              description: 'Student ID',
              example: 'STU001'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Student email address',
              example: 'john.doe@student.com'
            }
          }
        },
        Order: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Order ID',
              example: '507f1f77bcf86cd799439011'
            },
            school_id: {
              type: 'string',
              description: 'School identifier',
              example: 'SCH001'
            },
            trustee_id: {
              type: 'string',
              description: 'Trustee identifier',
              example: 'TRU001'
            },
            student_info: {
              $ref: '#/components/schemas/StudentInfo'
            },
            gateway_name: {
              type: 'string',
              description: 'Payment gateway name',
              example: 'edviron'
            },
            custom_order_id: {
              type: 'string',
              description: 'Custom order identifier',
              example: 'ORD-2023-001'
            },
            collect_request_id: {
              type: 'string',
              description: 'Vendor collect request ID',
              example: 'CRQ123456789'
            },
            amount: {
              type: 'number',
              description: 'Order amount',
              example: 1000.50
            },
            callback_url: {
              type: 'string',
              format: 'uri',
              description: 'Payment callback URL',
              example: 'https://school.edviron.com/payment/callback'
            },
            status: {
              type: 'string',
              enum: ['created', 'pending', 'completed', 'failed', 'cancelled'],
              description: 'Order status',
              example: 'pending'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Order creation timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Order last update timestamp'
            }
          }
        },
        OrderStatus: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439012'
            },
            collect_id: {
              type: 'string',
              description: 'Reference to Order ID',
              example: '507f1f77bcf86cd799439011'
            },
            order_amount: {
              type: 'number',
              description: 'Original order amount',
              example: 1000.50
            },
            transaction_amount: {
              type: 'number',
              description: 'Actual transaction amount',
              example: 1000.50
            },
            payment_mode: {
              type: 'string',
              description: 'Payment method used',
              example: 'UPI'
            },
            payment_details: {
              type: 'object',
              description: 'Additional payment details'
            },
            bank_reference: {
              type: 'string',
              description: 'Bank reference number',
              example: 'BNK123456789'
            },
            payment_message: {
              type: 'string',
              description: 'Payment status message',
              example: 'Payment successful'
            },
            status: {
              type: 'string',
              enum: ['created', 'pending', 'completed', 'failed', 'cancelled', 'refunded'],
              description: 'Payment status',
              example: 'completed'
            },
            error_message: {
              type: 'string',
              description: 'Error message if payment failed'
            },
            payment_time: {
              type: 'string',
              format: 'date-time',
              description: 'Payment completion time'
            },
            transaction_id: {
              type: 'string',
              description: 'Transaction ID from payment gateway',
              example: 'TXN123456789'
            },
            gateway: {
              type: 'string',
              description: 'Payment gateway used',
              example: 'edviron'
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439013'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
              example: 'admin@edviron.com'
            },
            role: {
              type: 'string',
              enum: ['admin', 'school', 'trustee'],
              description: 'User role',
              example: 'admin'
            },
            school_id: {
              type: 'string',
              description: 'School ID (required for school and trustee roles)',
              example: 'SCH001'
            },
            isActive: {
              type: 'boolean',
              description: 'User active status',
              example: true
            },
            lastLogin: {
              type: 'string',
              format: 'date-time',
              description: 'Last login timestamp'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'User creation timestamp'
            }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication information is missing or invalid',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: 'Access denied. No token provided',
                code: 'NO_TOKEN'
              }
            }
          }
        },
        ForbiddenError: {
          description: 'Access denied due to insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: 'Access denied. Insufficient permissions',
                code: 'INSUFFICIENT_PERMISSIONS'
              }
            }
          }
        },
        ValidationError: {
          description: 'Validation error in request data',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: 'Validation failed',
                code: 'VALIDATION_ERROR',
                details: [
                  {
                    field: 'email',
                    message: 'Please provide a valid email'
                  }
                ]
              }
            }
          }
        },
        NotFoundError: {
          description: 'The requested resource was not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: 'Resource not found',
                code: 'NOT_FOUND'
              }
            }
          }
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: 'Internal Server Error',
                code: 'INTERNAL_ERROR'
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization'
      },
      {
        name: 'Payments',
        description: 'Payment creation and management'
      },
      {
        name: 'Transactions',
        description: 'Transaction status and listing'
      },
      {
        name: 'Webhooks',
        description: 'Webhook processing for payment notifications'
      },
      {
        name: 'Health',
        description: 'API health check endpoints'
      }
    ]
  },
  apis: [
    './src/routes/*.js',
    './src/app.js'
  ]
};

const specs = swaggerJSDoc(options);
export default specs;