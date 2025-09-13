import mongoose from 'mongoose';
import logger from '../utils/logger.js';

class Database {
  constructor() {
    this.connection = null;
  }

  async connect() {
    try {
    


      // Get MongoDB URI from environment variables
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/edviron_assignment';
      
      logger.info('Attempting to connect to MongoDB...', { uri: mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@') });

      this.connection = await mongoose.connect(mongoUri);

      logger.info('MongoDB connected successfully', {
        host: this.connection.connection.host,
        port: this.connection.connection.port,
        name: this.connection.connection.name
      });

      // Handle connection events
      mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error:', error);
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
      });

      return this.connection;
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', {
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.connection) {
        await mongoose.disconnect();
        logger.info('MongoDB disconnected successfully');
        this.connection = null;
      }
    } catch (error) {
      logger.error('Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  getConnection() {
    return this.connection;
  }

  isConnected() {
    return mongoose.connection.readyState === 1;
  }
}

// Create singleton instance
const database = new Database();

export default database;