# Edviron Assessment API

A comprehensive payment management system built with Node.js, Express.js, and MongoDB, featuring JWT authentication, role-based access control, and external payment gateway integration.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Authentication](#authentication)
- [Payment Flow](#payment-flow)
- [Database Schema](#database-schema)
- [Error Handling](#error-handling)
- [Logging](#logging)
- [Security](#security)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)

## Overview

The Edviron Assessment API is a robust backend service designed for educational institutions to manage student payments, user authentication, and transaction tracking. The system provides secure payment processing through external gateway integration with comprehensive audit trails and role-based access control.

## Features

### Core Functionality
- **User Authentication & Authorization**: JWT-based authentication with role-based access control
- **Payment Processing**: Integration with external payment gateways for secure transactions
- **Transaction Management**: Comprehensive transaction tracking and reporting
- **School-Based Data Isolation**: Multi-tenant architecture with school-level data segregation
- **Audit Logging**: Detailed logging for all operations and API calls

### Security Features
- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access Control**: Admin, Trustee, Staff, and User roles
- **Request Validation**: Input sanitization and validation
- **Rate Limiting**: API rate limiting to prevent abuse
- **Security Headers**: Helmet.js for security headers
- **CORS Protection**: Configurable CORS policies

### Monitoring & Reliability
- **Health Checks**: Comprehensive system health monitoring
- **Error Handling**: Global error handling with custom error classes
- **Retry Logic**: Automatic retry for failed external API calls
- **Logging**: Structured logging with Winston
- **Database Connection Management**: Robust MongoDB connection handling

## Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JSON Web Tokens (JWT)
- **Password Hashing**: bcryptjs
- **HTTP Client**: Axios

### Security & Middleware
- **Helmet.js**: Security headers
- **CORS**: Cross-origin resource sharing
- **Express Rate Limit**: API rate limiting
- **Express Mongo Sanitize**: NoSQL injection prevention
- **Express Validator**: Request validation

### Utilities
- **Winston**: Logging
- **Day.js**: Date manipulation
- **Compression**: Response compression
- **Cookie Parser**: Cookie parsing middleware

## Prerequisites

- Node.js (v18.0.0 or higher)
- MongoDB (v5.0 or higher)
- npm or yarn package manager

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd edviron-assesment
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables** (see [Configuration](#configuration))

5. **Start the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## Configuration

Create a `.env` file in the root directory with the following variables:

### Database Configuration
```env
MONGO_URI=mongodb://localhost:27017/edviron_assessment
```

### JWT Configuration
```env
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
JWT_COOKIE_EXPIRES_IN=7
```

### Payment Gateway Configuration
```env
PAYMENT_API_BASE_URL=https://api.paymentgateway.com
PAYMENT_API_KEY=your-payment-api-key
PAYMENT_CLIENT_KEY=your-payment-client-key
PAYMENT_SECRET_KEY=your-payment-secret-key
SCHOOL_ID=your-school-id
```

### Server Configuration
```env
NODE_ENV=development
PORT=4000
```

### Logging Configuration
```env
LOG_LEVEL=info
```

## API Documentation

### Base URL
```
http://localhost:4000/api
```

### Authentication Endpoints

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "username": "user123",
  "email": "user@example.com",
  "password": "password123",
  "role": "user"
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Get Current User
```http
GET /auth/me
Authorization: Bearer <jwt-token>
```

#### Update Profile
```http
PATCH /auth/updateMe
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "username": "newusername",
  "email": "newemail@example.com"
}
```

#### Update Password
```http
PATCH /auth/updatePassword
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "passwordCurrent": "currentpassword",
  "password": "newpassword",
  "passwordConfirm": "newpassword"
}
```

### Payment Endpoints

#### Create Payment
```http
POST /payments/create-payment
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "amount": "1500",
  "callback_url": "https://yourapp.com/payment-success",
  "student_info": {
    "name": "John Doe",
    "id": "STU001",
    "email": "john.doe@email.com"
  },
  "gateway_name": "razorpay",
  "trustee_id": "65b0e552dd31950a9b41c5ba"
}
```

#### Check Payment Status
```http
GET /payments/status/{collect_request_id}?order_id={order_id}
Authorization: Bearer <jwt-token>
```

#### Get All Transactions
```http
GET /payments/transactions
Authorization: Bearer <jwt-token>
```

#### Get Transactions by School
```http
GET /payments/transactions/school/{school_id}
Authorization: Bearer <jwt-token>
```

### System Endpoints

#### Health Check
```http
GET /health
```

#### API Health Check
```http
GET /api/health
```

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. After successful login, a token is returned that must be included in the `Authorization` header for protected routes.

### Token Format
```
Authorization: Bearer <jwt-token>
```

### User Roles
- **admin**: Full system access
- **trustee**: School-specific data access
- **staff**: Limited operational access
- **user**: Basic user operations

### Token Lifecycle
- **Expiration**: 7 days (configurable)
- **Refresh**: Manual re-login required
- **Storage**: Secure HTTP-only cookies (optional)

## Payment Flow

### 1. Payment Creation
1. Client sends payment request with student details
2. System validates request and user permissions
3. External payment gateway request is created
4. Payment URL is returned to client

### 2. Payment Processing
1. User is redirected to payment gateway
2. Payment gateway processes the transaction
3. Gateway sends callback to configured URL
4. System updates payment status

### 3. Status Tracking
1. Payment status can be checked via API
2. Transaction history is maintained
3. Audit logs are created for all operations

## Database Schema

### User Schema
```javascript
{
  username: String (required, unique),
  email: String (required, unique),
  password: String (required, hashed),
  role: String (enum: ['admin', 'trustee', 'staff', 'user']),
  trustee_id: ObjectId (required for trustees),
  school_id: ObjectId (required for trustees),
  isActive: Boolean (default: true),
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Order Schema
```javascript
{
  order_id: String (required, unique),
  amount: Number (required),
  callback_url: String (required),
  student_info: {
    name: String (required),
    id: String (required),
    email: String (required)
  },
  gateway_name: String (required),
  school_id: String (required),
  trustee_id: String (required),
  payment_url: String,
  collect_request_id: String,
  status: String (enum: ['pending', 'processing', 'completed', 'failed']),
  createdAt: Date,
  updatedAt: Date
}
```

### OrderStatus Schema
```javascript
{
  order_id: String (required),
  collect_request_id: String (required),
  status: String (required),
  amount: Number,
  currency: String,
  payment_method: String,
  gateway_response: Object,
  error_details: Object,
  processed_at: Date,
  createdAt: Date,
  updatedAt: Date
}
```

## Error Handling

The API implements comprehensive error handling with custom error classes and global error middleware.

### Error Response Format
```json
{
  "status": "error",
  "message": "Error description",
  "statusCode": 400,
  "isOperational": true,
  "stack": "Error stack trace (development only)"
}
```

### Common Error Codes
- **400**: Bad Request - Invalid input data
- **401**: Unauthorized - Authentication required
- **403**: Forbidden - Insufficient permissions
- **404**: Not Found - Resource not found
- **429**: Too Many Requests - Rate limit exceeded
- **500**: Internal Server Error - System error

## Logging

The application uses Winston for structured logging with multiple log levels and outputs.

### Log Levels
- **error**: Error conditions
- **warn**: Warning conditions
- **info**: Informational messages
- **debug**: Debug-level messages

### Log Outputs
- **Console**: Development environment
- **File**: Production environment
- **Combined**: All log levels
- **Error**: Error-only logs

### Log Format
```json
{
  "timestamp": "2025-09-13T10:30:00.000Z",
  "level": "info",
  "message": "Request processed",
  "meta": {
    "method": "POST",
    "url": "/api/payments/create-payment",
    "statusCode": 201,
    "responseTime": "150ms"
  }
}
```

## Security

### Security Measures Implemented
- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcryptjs with salt rounds
- **Input Validation**: Express-validator for request validation
- **NoSQL Injection Prevention**: Express-mongo-sanitize
- **Rate Limiting**: Configurable rate limits per endpoint
- **Security Headers**: Helmet.js for security headers
- **CORS Configuration**: Configurable CORS policies
- **Environment Variables**: Sensitive data in environment variables

### Security Best Practices
- Regular password updates
- Strong JWT secrets
- HTTPS in production
- Regular security updates
- Audit logging
- Access control reviews

## Testing

### Manual Testing
Use the provided Postman collection in the `postman/` directory:
1. Import `Edviron_Assessment_API.postman_collection.json`
2. Import `Edviron_Assessment_Development.postman_environment.json`
3. Run the collection tests

### Testing Endpoints
- **Health Check**: Verify system status
- **Error Test**: Test error handling
- **Authentication Flow**: Complete auth workflow
- **Payment Flow**: End-to-end payment testing

## Deployment


### Environment Variables for Production
```env
NODE_ENV=production
PORT=4000
MONGO_URI=mongodb://production-host:27017/edviron_production
JWT_SECRET=strong-production-secret
PAYMENT_API_BASE_URL=https://api.paymentgateway.com
# ... other production configs
```

## API Scripts

### Available Scripts
```bash
# Start development server with hot reload
npm run dev

# Start production server
npm start

# Seed database with sample data
npm run seed
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

### Code Standards
- Use ES6+ features
- Follow ESLint configuration
- Write descriptive commit messages
- Add JSDoc comments for functions
- Maintain test coverage

## Support

For issues and questions:
1. Check the logs for error details
2. Verify environment configuration
3. Test with Postman collection
4. Review API documentation

## License

This project is licensed under the ISC License.

## Frontend Dashboard

The repository includes a React + Vite + Tailwind CSS dashboard under `../frontend` that provides:
- Transactions overview (pagination, search, multi-select status & school filters, date range filters, sorting, URL state persistence)
- School-specific transactions view
- Transaction status check interface
- Real-time visualization with polling, metrics, and distribution display
- Dark mode with persisted user preference

Optional environment variable for dashboard:
`VITE_API_BASE_URL` (defaults to http://localhost:4000/api if unset).

Run dashboard from the `frontend` directory with existing npm scripts.