import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // Server
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 10,
  
  // Database
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/edviron',
  
  // JWT
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  
  // CORS
  corsOrigin: process.env.CORS_ORIGIN || '*',
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Vendor API
  vendorBaseUrl: process.env.PAYMENT_API_BASE_URL || 'https://dev-vanilla.edviron.com/erp',
  vendorApiKey: process.env.PAYMENT_API_KEY || '',
  pgJwtSecret: process.env.PG_KEY || 'fallback-pg-secret-change-in-production',
  schoolId: process.env.SCHOOL_ID || ''
};

// Validate required environment variables
const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET',
  'PAYMENT_API_KEY',
  'PG_KEY'
];

export const validateEnv = () => {
  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0 && config.nodeEnv === 'production') {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  if (missing.length > 0) {
    console.warn(`Warning: Missing environment variables: ${missing.join(', ')}`);
  }
};