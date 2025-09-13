import 'dotenv/config';
import mongoose from 'mongoose';
import { Order, OrderStatus } from '../src/models/index.js';
import logger from '../src/utils/logger.js';

// Dummy data arrays
const gateways = ['razorpay', 'payu', 'ccavenue', 'instamojo', 'cashfree'];
const paymentModes = ['credit_card', 'debit_card', 'net_banking', 'upi', 'wallet'];
const statuses = ['pending', 'processing', 'completed', 'failed', 'cancelled'];

const schoolIds = [
  '65b0e6293e9f76a9694d84b4',
  '65b0e6293e9f76a9694d84b5',
  '65b0e6293e9f76a9694d84b6',
  '65b0e6293e9f76a9694d84b7',
  '65b0e6293e9f76a9694d84b8'
];

const trusteeIds = [
  '65b0e552dd31950a9b41c5ba',
  '65b0e552dd31950a9b41c5bb',
  '65b0e552dd31950a9b41c5bc',
  '65b0e552dd31950a9b41c5bd',
  '65b0e552dd31950a9b41c5be'
];

// Generate random student data
const generateStudentInfo = (index) => {
  const firstNames = ['John', 'Jane', 'Mike', 'Sarah', 'David', 'Lisa', 'Tom', 'Anna', 'Chris', 'Emma'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
  
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  
  return {
    name: `${firstName} ${lastName}`,
    id: `STU${String(index + 1).padStart(4, '0')}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index + 1}@school.edu`
  };
};

// Generate random amount between 500 and 50000
const generateAmount = () => {
  return Math.floor(Math.random() * (50000 - 500 + 1)) + 500;
};

// Generate random date within last 6 months
const generateRandomDate = () => {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getTime() - (6 * 30 * 24 * 60 * 60 * 1000));
  return new Date(sixMonthsAgo.getTime() + Math.random() * (now.getTime() - sixMonthsAgo.getTime()));
};

// Connect to database
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/edviron_assignment';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB for seeding');
  } catch (error) {
    logger.error('Database connection failed:', error);
    process.exit(1);
  }
};

// Clear existing data
const clearData = async () => {
  try {
    await OrderStatus.deleteMany({});
    await Order.deleteMany({});
    logger.info('Cleared existing data');
  } catch (error) {
    logger.error('Error clearing data:', error);
    throw error;
  }
};

// Create dummy orders
const createOrders = async (count = 50) => {
  const orders = [];
  
  for (let i = 0; i < count; i++) {
    const order = {
      school_id: new mongoose.Types.ObjectId(schoolIds[Math.floor(Math.random() * schoolIds.length)]),
      trustee_id: new mongoose.Types.ObjectId(trusteeIds[Math.floor(Math.random() * trusteeIds.length)]),
      student_info: generateStudentInfo(i),
      gateway_name: gateways[Math.floor(Math.random() * gateways.length)]
    };
    
    orders.push(order);
  }
  
  try {
    const createdOrders = await Order.insertMany(orders);
    logger.info(`Created ${createdOrders.length} orders`);
    return createdOrders;
  } catch (error) {
    logger.error('Error creating orders:', error);
    throw error;
  }
};

// Create dummy order statuses
const createOrderStatuses = async (orders) => {
  const orderStatuses = [];
  
  for (const order of orders) {
    const orderAmount = generateAmount();
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const transactionAmount = status === 'completed' ? orderAmount : 
                             status === 'failed' ? 0 : 
                             Math.floor(Math.random() * orderAmount);
    
    const orderStatus = {
      collect_id: order._id,
      order_amount: orderAmount,
      transaction_amount: transactionAmount,
      payment_mode: paymentModes[Math.floor(Math.random() * paymentModes.length)],
      payment_details: JSON.stringify({
        collect_request_id: `cr_${Math.random().toString(36).substring(2, 15)}`,
        gateway_name: order.gateway_name,
        transaction_id: `txn_${Math.random().toString(36).substring(2, 15)}`
      }),
      bank_reference: status === 'completed' ? `BNK${Math.random().toString(36).substring(2, 10).toUpperCase()}` : '',
      payment_message: status === 'completed' ? 'Payment successful' : 
                      status === 'failed' ? 'Payment failed due to insufficient funds' :
                      status === 'pending' ? 'Payment is being processed' :
                      'Payment processing',
      status: status,
      error_message: status === 'failed' ? 'Insufficient funds in account' : '',
      payment_time: generateRandomDate()
    };
    
    orderStatuses.push(orderStatus);
  }
  
  try {
    const createdOrderStatuses = await OrderStatus.insertMany(orderStatuses);
    logger.info(`Created ${createdOrderStatuses.length} order statuses`);
    return createdOrderStatuses;
  } catch (error) {
    logger.error('Error creating order statuses:', error);
    throw error;
  }
};

// Main seeding function
const seedDatabase = async () => {
  try {
    logger.info('Starting database seeding...');
    
    // Connect to database
    await connectDB();
    
    // Clear existing data
    await clearData();
    
    // Create orders
    const orders = await createOrders(50);
    
    // Create order statuses
    await createOrderStatuses(orders);
    
    logger.info('Database seeding completed successfully!');
    
    // Display summary
    const totalOrders = await Order.countDocuments();
    const totalOrderStatuses = await OrderStatus.countDocuments();
    const completedPayments = await OrderStatus.countDocuments({ status: 'completed' });
    const failedPayments = await OrderStatus.countDocuments({ status: 'failed' });
    const pendingPayments = await OrderStatus.countDocuments({ status: 'pending' });
    
    logger.info('Seeding Summary:', {
      totalOrders,
      totalOrderStatuses,
      completedPayments,
      failedPayments,
      pendingPayments
    });
    
  } catch (error) {
    logger.error('Database seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    logger.info('Database connection closed');
    process.exit(0);
  }
};


  seedDatabase();


export { seedDatabase, clearData, createOrders, createOrderStatuses };