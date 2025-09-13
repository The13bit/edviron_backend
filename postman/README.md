# Edviron Assessment API - Postman Collection

This directory contains the complete Postman collection and environment files for the Edviron Assessment API.

## Files Included

1. **Edviron_Assessment_API.postman_collection.json** - Main collection with all API endpoints
2. **Edviron_Assessment_Development.postman_environment.json** - Development environment variables

## Import Instructions

### Importing the Collection
1. Open Postman
2. Click "Import" button
3. Select "Upload Files" tab
4. Choose `Edviron_Assessment_API.postman_collection.json`
5. Click "Import"

### Importing the Environment
1. In Postman, click the gear icon (Environment quick look)
2. Click "Import" 
3. Select `Edviron_Assessment_Development.postman_environment.json`
4. Click "Import"
5. Select "Edviron Assessment - Development" environment from the dropdown

## Collection Structure

### 1. Authentication Endpoints
- **Register User** - Create new user account
- **Register Trustee** - Create trustee account with school association
- **Login** - Authenticate user and receive JWT token
- **Get Current User** - Retrieve logged-in user details
- **Update User Profile** - Modify user information
- **Update Password** - Change user password
- **Get All Users (Admin)** - Admin-only endpoint to list all users
- **Get User by ID (Admin)** - Admin-only endpoint to get specific user
- **Logout** - Logout current session
- **Delete Account** - Deactivate user account
- **Auth Health Check** - Verify authentication service

### 2. Payment Endpoints
- **Create Payment** - Initialize new payment request
- **Check Payment Status** - Get payment status by collect request ID
- **Get Order Details** - Retrieve order information
- **Get All Transactions** - List all transactions (with aggregation)
- **Get Transactions by School** - School-specific transaction history
- **Get Transaction Status** - Check status by order ID
- **Payment Health Check** - Verify payment service

### 3. System Endpoints
- **API Health Check** - Overall API health status
- **Server Health Check** - Server health and metrics
- **Test Endpoint** - Test async handling and logging
- **Error Test** - Test error handling middleware

## Environment Variables

The environment includes the following variables:

### Base Configuration
- `baseUrl`: API base URL (default: http://localhost:4000)

### Authentication
- `authToken`: JWT token (automatically set after login)

### Payment Data
- `orderId`: Order ID (automatically set after payment creation)
- `collectRequestId`: Payment gateway request ID
- `schoolId`: School identifier for testing
- `userId`: User ID for admin operations

### External API Configuration
- `paymentApiUrl`: Payment gateway API URL
- `paymentClientKey`: Payment gateway client key
- `paymentSecretKey`: Payment gateway secret key

## Authentication Flow

1. **Register or Login**: Use the authentication endpoints to create an account or login
2. **Auto Token Storage**: The login request automatically stores the JWT token in `authToken` environment variable
3. **Authenticated Requests**: All protected endpoints use `Bearer {{authToken}}` in the Authorization header

## Payment Flow

1. **Create Payment**: Use "Create Payment" endpoint - automatically stores `orderId` and `collectRequestId`
2. **Check Status**: Use stored IDs to check payment status
3. **Track Transactions**: View transaction history and details

## Role-Based Access

The API implements role-based access control:

- **admin**: Full access to all endpoints
- **trustee**: Access to school-specific data and payments
- **staff**: Limited access to assigned operations
- **user**: Basic user operations only

## Testing Recommendations

### Quick Start Test Sequence
1. Register a new admin user
2. Login to get authentication token
3. Create a payment request
4. Check payment status
5. View transactions

### Sample Data
The collection includes sample request bodies with realistic test data. Update the values as needed for your testing scenarios.

### Error Testing
Use the error test endpoints to verify proper error handling and logging functionality.

## Notes

- All authenticated endpoints require a valid JWT token
- Payment endpoints require appropriate role permissions
- The collection uses automatic token management for seamless testing
- Environment variables are automatically updated during API calls
- All routes include proper validation and error handling

## Support

For issues with the API or collection, refer to the application logs and error responses which include detailed information about validation failures and system errors.