import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  school_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'School ID is required'],
    index: true
  },
  trustee_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'Trustee ID is required'],
    index: true
  },
  student_info: {
    name: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true
    },
    id: {
      type: String,
      required: [true, 'Student ID is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Student email is required'],
      trim: true,
      lowercase: true,
      validate: {
        validator: function(email) {
          return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email);
        },
        message: 'Please enter a valid email address'
      }
    }
  },
  gateway_name: {
    type: String,
    required: [true, 'Gateway name is required'],
    trim: true
  }
}, {
  timestamps: true,
  versionKey: false
});

// Indexes for better query performance
orderSchema.index({ school_id: 1, trustee_id: 1 });
orderSchema.index({ 'student_info.email': 1 });
orderSchema.index({ createdAt: -1 });

// Virtual for order status
orderSchema.virtual('orderStatus', {
  ref: 'OrderStatus',
  localField: '_id',
  foreignField: 'collect_id',
  justOne: false
});

// Ensure virtual fields are serialized
orderSchema.set('toJSON', { virtuals: true });
orderSchema.set('toObject', { virtuals: true });

const Order = mongoose.model('Order', orderSchema);

export default Order;