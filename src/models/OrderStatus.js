import mongoose from 'mongoose';

const orderStatusSchema = new mongoose.Schema({
  collect_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: [true, 'Order reference (collect_id) is required'],
    index: true
  },
  order_amount: {
    type: Number,
    required: [true, 'Order amount is required'],
    min: [0, 'Order amount cannot be negative']
  },
  transaction_amount: {
    type: Number,
    required: [true, 'Transaction amount is required'],
    min: [0, 'Transaction amount cannot be negative']
  },
  payment_mode: {
    type: String,
    required: [true, 'Payment mode is required'],
    trim: true,
  },
  payment_details: {
    type: String,
    trim: true,
    default: ''
  },
  bank_reference: {
    type: String,
    trim: true,
    default: ''
  },
  payment_message: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    trim: true,
   
    default: 'pending'
  },
  error_message: {
    type: String,
    trim: true,
    default: ''
  },
  payment_time: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  versionKey: false
});

// Indexes for better query performance
orderStatusSchema.index({ collect_id: 1 });
orderStatusSchema.index({ status: 1 });
orderStatusSchema.index({ payment_time: -1 });
orderStatusSchema.index({ collect_id: 1, status: 1 });
orderStatusSchema.index({ createdAt: -1 });

// Pre-save middleware to update payment_time when status changes to completed
orderStatusSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'completed' && !this.payment_time) {
    this.payment_time = new Date();
  }
  next();
});

// Virtual to populate order details
orderStatusSchema.virtual('order', {
  ref: 'Order',
  localField: 'collect_id',
  foreignField: '_id',
  justOne: true
});

// Ensure virtual fields are serialized
orderStatusSchema.set('toJSON', { virtuals: true });
orderStatusSchema.set('toObject', { virtuals: true });

const OrderStatus = mongoose.model('OrderStatus', orderStatusSchema);

export default OrderStatus;