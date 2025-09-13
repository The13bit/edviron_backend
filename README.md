# Edviron Payment API

A production-ready Express.js REST microservice for managing payments, transactions, and webhook processing for educational institutions. Built with modern security practices, comprehensive validation, and vendor API integration.

## 🚀 Features

- **JWT Authentication** - Secure user authentication with role-based access control
- **Payment Processing** - Create and manage payment requests with vendor integration
- **Transaction Management** - Track payment status and transaction history
- **Webhook Processing** - Handle real-time payment notifications from vendors
- **Security** - Rate limiting, CORS, helmet, input sanitization, and XSS protection
- **Validation** - Comprehensive input validation and sanitization
- **Documentation** - Interactive Swagger API documentation
- **Database** - MongoDB with Mongoose ODM and proper indexing
- **Logging** - Structured logging with different levels
- **Testing** - Postman collection for API testing

## 📋 Prerequisites

- Node.js 18+ 
- MongoDB Atlas account or local MongoDB instance
- NPM or Yarn package manager

## 🛠️ Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd edviron-assessment
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment Setup**
```bash
# Copy the example environment file
cp .env.example .env
```

4. **Configure Environment Variables**
Edit `.env` file with your actual values:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/edviron?retryWrites=true&w=majority

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=1d

# CORS Configuration
CORS_ORIGIN=*

# Logging
LOG_LEVEL=info

# Vendor API Configuration
VENDOR_BASE_URL=https://dev-vanilla.edviron.com
VENDOR_API_KEY=your-vendor-api-key
PG_JWT_SECRET=your-payment-gateway-signing-secret
```

## 🗃️ Database Setup

1. **Seed the database** with sample data:
```bash
npm run seed
```

This creates:
- Admin user: `admin@edviron.com` / `admin123`
- School users: `school@demo.com` / `school123`
- Sample orders and transactions

## 🚀 Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on `http://localhost:3000`

## 📚 API Documentation

Once the server is running, visit:
- **Swagger Documentation**: `http://localhost:3000/docs`
- **Health Check**: `http://localhost:3000/health`

## 🔧 API Endpoints

### Authentication
- `POST /auth/login` - User login

### Payments
- `POST /create-payment` - Create new payment request

### Transactions
- `GET /transaction-status/:custom_order_id` - Get transaction status
- `GET /transactions` - List all transactions (paginated)
- `GET /transactions/school/:schoolId` - List school transactions

### Webhooks
- `POST /webhook` - Receive payment notifications (public endpoint)

### Utilities
- `GET /health` - API health check
- `GET /` - API information

## 🧪 Testing with Postman

1. **Import Collection**
   - Import `docs/Edviron.postman_collection.json` into Postman
   - Set the `baseUrl` variable to `http://localhost:3000`

2. **Authentication Flow**
   - Use the "Login" request to get JWT token
   - Token is automatically saved for subsequent requests

3. **Complete Payment Flow**
   - Run the "Complete Payment Flow" folder for end-to-end testing

## 🔐 Authentication & Authorization

### User Roles
- **Admin**: Full access to all endpoints and data
- **School**: Access to own school's data only
- **Trustee**: Access to own school's data only

### JWT Token
- Include in requests as `Authorization: Bearer <token>`
- Tokens expire in 1 day (configurable)
- Automatic token extraction and validation

## 📊 Database Models

### User
- Email, password (hashed), role, school_id
- Supports admin, school, and trustee roles

### Order
- School ID, student info, payment details
- Unique custom order ID, collect request ID
- Amount, callback URL, status tracking

### OrderStatus
- Links to Order, tracks payment progression
- Transaction amounts, payment modes, timestamps
- Bank references, error messages

### WebhookLog
- Raw and parsed webhook payloads
- Processing status and retry logic
- Automatic cleanup after 90 days

## 🛡️ Security Features

- **Rate Limiting**: 100 requests/15min general, 5 requests/15min for auth
- **CORS**: Configurable origin restrictions
- **Helmet**: Security headers protection
- **Input Sanitization**: MongoDB injection and XSS protection
- **JWT**: Secure authentication with configurable expiration
- **Password Hashing**: bcrypt with salt rounds

## 🔄 Vendor Integration

The service integrates with payment vendors through:

1. **Request Signing**: JWT-based payload signing for security
2. **Create Collect Request**: Initiates payment with vendor
3. **Status Polling**: Retrieves updated payment status
4. **Webhook Processing**: Handles real-time notifications

## 📝 Logging

Structured logging with different levels:
- **Error**: System errors and failures
- **Warn**: Warning conditions
- **Info**: General information (default)
- **Debug**: Detailed debugging information

## 🚀 Deployment

### Environment Variables
Ensure all required environment variables are set:
```bash
# Required in production
MONGODB_URI
JWT_SECRET
VENDOR_API_KEY
PG_JWT_SECRET
```

### Railway Deployment
```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy
railway login
railway link
railway up
```

### Render Deployment
1. Connect your GitHub repository
2. Set environment variables in dashboard
3. Deploy with build command: `npm install`
4. Start command: `npm start`

### Production Considerations
- Use strong, unique secrets for JWT and PG signing
- Configure CORS_ORIGIN for specific domains
- Set NODE_ENV=production
- Use MongoDB Atlas with proper network restrictions
- Enable database connection pooling
- Set up monitoring and error tracking

## 🏗️ Project Structure

```
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Route controllers (optional)
│   ├── docs/           # API documentation
│   ├── middlewares/    # Express middlewares
│   ├── models/         # Mongoose models
│   ├── routes/         # API routes
│   ├── services/       # Business logic services
│   ├── utils/          # Utility functions
│   ├── app.js          # Express application
│   └── server.js       # Server entry point
├── scripts/
│   └── seed.js         # Database seeding
├── docs/
│   └── Edviron.postman_collection.json
├── .env.example        # Environment template
├── .gitignore
└── package.json
```

## 🤝 Development

### Code Style
- ESM modules (import/export)
- Async/await for asynchronous operations
- Comprehensive error handling
- Input validation on all endpoints
- Structured logging throughout

### Adding New Features
1. Create appropriate models in `src/models/`
2. Add routes in `src/routes/`
3. Implement business logic in `src/services/`
4. Add validation middleware
5. Update Swagger documentation
6. Add Postman collection requests

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Verify MONGODB_URI is correct
   - Check network connectivity
   - Ensure MongoDB Atlas IP whitelist includes your IP

2. **Authentication Errors**
   - Verify JWT_SECRET is set
   - Check token expiration
   - Ensure proper Authorization header format

3. **Vendor API Errors**
   - Verify VENDOR_API_KEY and PG_JWT_SECRET
   - Check vendor API endpoint availability
   - Review request signing implementation

4. **Port Already in Use**
   - Change PORT in .env file
   - Kill existing process: `lsof -ti:3000 | xargs kill -9`

### Debug Mode
Set `LOG_LEVEL=debug` in `.env` for detailed logging.

## 📈 Performance

- Database indexes on frequently queried fields
- Connection pooling with MongoDB
- Request rate limiting
- Compression middleware
- Efficient aggregation queries for transactions

## 🔒 Security Checklist

- ✅ Environment variables for sensitive data
- ✅ JWT token-based authentication
- ✅ Password hashing with bcrypt
- ✅ Input validation and sanitization
- ✅ Rate limiting on sensitive endpoints
- ✅ CORS configuration
- ✅ Security headers with Helmet
- ✅ MongoDB injection protection
- ✅ XSS protection
- ✅ Error message sanitization

## 📄 License

MIT License - feel free to use this project for educational or commercial purposes.

## 🆘 Support

For issues and questions:
1. Check this README for common solutions
2. Review the API documentation at `/docs`
3. Test with the provided Postman collection
4. Check application logs for error details

---

**Built with ❤️ using Express.js, MongoDB, and modern security practices.**