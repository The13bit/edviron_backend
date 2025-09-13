import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { config } from '../src/config/env.js';
import { logger } from '../src/utils/logger.js';
import User from '../src/models/User.js';
import Order from '../src/models/Order.js';
import OrderStatus from '../src/models/OrderStatus.js';

const seedData = {
  users: [
    {
      email: 'admin@edviron.com',
      passwordHash: 'admin123',
      role: 'admin',
      isActive: true
    },
    {
      email: 'school@demo.com',
      passwordHash: 'school123',
      role: 'school',
      school_id: 'SCH001',
      isActive: true
    },
    {
      email: 'trustee@demo.com',
      passwordHash: 'trustee123',
      role: 'trustee',
      school_id: 'SCH001',
      isActive: true
    },
    {
      email: 'school2@demo.com',
      passwordHash: 'school123',
      role: 'school',
      school_id: 'SCH002',
      isActive: true
    }
  ],
  orders: [
    {
      school_id: 'SCH001',
      trustee_id: 'TRU001',
      student_info: {
        name: 'John Doe',
        id: 'STU001',
        email: 'john.doe@student.com'
      },
      gateway_name: 'edviron',
      custom_order_id: 'ORD-SEED-001',
      collect_request_id: 'CRQ123456789',
      amount: 1500.00,
      callback_url: 'https://school.edviron.com/payment/callback',
      status: 'completed'
    },
    {
      school_id: 'SCH001',
      student_info: {
        name: 'Jane Smith',
        id: 'STU002',
        email: 'jane.smith@student.com'
      },
      gateway_name: 'edviron',
      custom_order_id: 'ORD-SEED-002',
      collect_request_id: 'CRQ123456790',
      amount: 2000.50,
      callback_url: 'https://school.edviron.com/payment/callback',
      status: 'pending'
    },
    {
      school_id: 'SCH002',
      student_info: {
        name: 'Bob Johnson',
        id: 'STU003',
        email: 'bob.johnson@student.com'
      },
      gateway_name: 'edviron',
      custom_order_id: 'ORD-SEED-003',
      collect_request_id: 'CRQ123456791',
      amount: 1200.75,
      callback_url: 'https://school2.edviron.com/payment/callback',
      status: 'failed'
    }
  ]
};

async function createUsers() {
  logger.info('Creating users...');
  
  for (const userData of seedData.users) {
    try {
      // Check if user already exists
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        logger.info(`User ${userData.email} already exists, skipping...`);
        continue;
      }

      // Create new user
      const user = new User(userData);
      await user.save();
      
      logger.info(`Created user: ${userData.email} (${userData.role})`);
    } catch (error) {
      logger.error(`Error creating user ${userData.email}:`, error.message);
    }
  }
}

async function createOrders() {
  logger.info('Creating orders...');
  
  for (const orderData of seedData.orders) {
    try {
      // Check if order already exists
      const existingOrder = await Order.findOne({ custom_order_id: orderData.custom_order_id });
      if (existingOrder) {
        logger.info(`Order ${orderData.custom_order_id} already exists, skipping...`);
        continue;
      }

      // Create new order
      const order = new Order(orderData);
      await order.save();
      
      // Create initial order status
      const statusData = {
        collect_id: order._id,
        order_amount: orderData.amount,
        status: orderData.status,
        payment_time: new Date()
      };

      // Add additional status data based on order status
      if (orderData.status === 'completed') {
        statusData.transaction_amount = orderData.amount;
        statusData.payment_mode = 'UPI';
        statusData.payment_details = {
          upi_id: 'student@paytm',
          bank: 'PAYTM'
        };
        statusData.bank_reference = `BNK${Date.now()}`;
        statusData.payment_message = 'Payment successful';
        statusData.transaction_id = `TXN${Date.now()}`;
        statusData.gateway = 'edviron';
      } else if (orderData.status === 'failed') {
        statusData.transaction_amount = 0;
        statusData.payment_mode = 'NET_BANKING';
        statusData.error_message = 'Payment failed due to insufficient funds';
        statusData.payment_message = 'Payment failed';
        statusData.transaction_id = `TXN${Date.now()}`;
        statusData.gateway = 'edviron';
      } else if (orderData.status === 'pending') {
        statusData.payment_message = 'Payment initiated';
        statusData.gateway = 'edviron';
      }

      const orderStatus = new OrderStatus(statusData);
      await orderStatus.save();
      
      logger.info(`Created order: ${orderData.custom_order_id} (${orderData.status})`);
    } catch (error) {
      logger.error(`Error creating order ${orderData.custom_order_id}:`, error.message);
    }
  }
}

async function clearExistingData() {
  logger.info('Clearing existing seed data...');
  
  try {
    // Remove seed users (except admin if it has different email)
    const seedEmails = seedData.users.map(u => u.email);
    const deletedUsers = await User.deleteMany({ email: { $in: seedEmails } });
    logger.info(`Deleted ${deletedUsers.deletedCount} existing users`);

    // Remove seed orders
    const seedOrderIds = seedData.orders.map(o => o.custom_order_id);
    const seedOrders = await Order.find({ custom_order_id: { $in: seedOrderIds } });
    const seedOrderObjectIds = seedOrders.map(o => o._id);
    
    // Delete related order statuses first
    const deletedStatuses = await OrderStatus.deleteMany({ collect_id: { $in: seedOrderObjectIds } });
    logger.info(`Deleted ${deletedStatuses.deletedCount} existing order statuses`);
    
    // Delete orders
    const deletedOrders = await Order.deleteMany({ custom_order_id: { $in: seedOrderIds } });
    logger.info(`Deleted ${deletedOrders.deletedCount} existing orders`);
    
  } catch (error) {
    logger.error('Error clearing existing data:', error.message);
  }
}

async function seed() {
  try {
    logger.info('Starting database seeding...');
    
    // Connect to database
    await connectDB();
    
    // Clear existing seed data
    await clearExistingData();
    
    // Create new seed data
    await createUsers();
    await createOrders();
    
    logger.info('Database seeding completed successfully!');
    logger.info('\nSeed Data Summary:');
    logger.info('=================');
    logger.info('Users created:');
    logger.info('- admin@edviron.com (password: admin123) - Admin user');
    logger.info('- school@demo.com (password: school123) - School user (SCH001)');
    logger.info('- trustee@demo.com (password: trustee123) - Trustee user (SCH001)');
    logger.info('- school2@demo.com (password: school123) - School user (SCH002)');
    logger.info('\nOrders created:');
    logger.info('- ORD-SEED-001: Completed payment (₹1500.00)');
    logger.info('- ORD-SEED-002: Pending payment (₹2000.50)');
    logger.info('- ORD-SEED-003: Failed payment (₹1200.75)');
    logger.info('\nYou can now:');
    logger.info('1. Start the server: npm run dev');
    logger.info('2. Login with any of the created users');
    logger.info('3. Test the API endpoints with the seeded data');
    logger.info('4. View API docs at: http://localhost:3000/docs');
    
  } catch (error) {
    logger.error('Database seeding failed:', error);
    process.exit(1);
  } finally {
    await disconnectDB();
  }
}

// Handle script arguments
const args = process.argv.slice(2);
const forceMode = args.includes('--force') || args.includes('-f');

if (forceMode) {
  logger.info('Force mode enabled - will recreate all seed data');
}

// Run seeding
seed();