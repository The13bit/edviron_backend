import mongoose from 'mongoose';

const orderStatusSchema = new mongoose.Schema({
  collect_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: [true, 'Collect ID (Order reference) is required'],
    index: true
  },
  order_amount: {
    type: Number,
    required: [true, 'Order amount is required'],
    min: 0
  },
  transaction_amount: {
    type: Number,
    min: 0
  },
  payment_mode: {
    type: String,
    trim: true
  },
  payment_details: {
    type: mongoose.Schema.Types.Mixed
  },
  bank_reference: {
    type: String,
    trim: true
  },
  payment_message: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: ['created', 'pending', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'created'
  },
  error_message: {
    type: String,
    trim: true
  },
  payment_time: {
    type: Date,
    index: true
  },
  transaction_id: {
    type: String,
    trim: true,
    index: true
  },
  gateway: {
    type: String,
    trim: true,
    default: 'edviron'
  },
  vendor_data: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Compound indexes for efficient queries
orderStatusSchema.index({ collect_id: 1, payment_time: -1 });
orderStatusSchema.index({ collect_id: 1, createdAt: -1 });
orderStatusSchema.index({ status: 1, payment_time: -1 });
orderStatusSchema.index({ transaction_id: 1 });

// Static method to find latest status for an order
orderStatusSchema.statics.findLatestByOrderId = function(orderId) {
  return this.findOne({ collect_id: orderId })
    .sort({ payment_time: -1, createdAt: -1 })
    .populate('collect_id');
};

// Static method to find all statuses for an order
orderStatusSchema.statics.findAllByOrderId = function(orderId) {
  return this.find({ collect_id: orderId })
    .sort({ payment_time: -1, createdAt: -1 })
    .populate('collect_id');
};

// Static method to create or update order status
orderStatusSchema.statics.upsertStatus = async function(orderId, statusData) {
  // Check if we have a status with the same transaction_id
  if (statusData.transaction_id) {
    const existingStatus = await this.findOne({
      collect_id: orderId,
      transaction_id: statusData.transaction_id
    });
    
    if (existingStatus) {
      // Update existing status
      Object.assign(existingStatus, statusData);
      return existingStatus.save();
    }
  }
  
  // Create new status
  const newStatus = new this({
    collect_id: orderId,
    ...statusData
  });
  
  return newStatus.save();
};

// Method to check if payment is successful
orderStatusSchema.methods.isSuccessful = function() {
  return this.status === 'completed';
};

// Method to check if payment is pending
orderStatusSchema.methods.isPending = function() {
  return ['created', 'pending'].includes(this.status);
};

// Method to check if payment has failed
orderStatusSchema.methods.hasFailed = function() {
  return ['failed', 'cancelled'].includes(this.status);
};

const OrderStatus = mongoose.model('OrderStatus', orderStatusSchema);

export default OrderStatus;