import mongoose from 'mongoose';

const studentInfoSchema = new mongoose.Schema({
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
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  school_id: {
    type: String,
    required: [true, 'School ID is required'],
    trim: true,
    index: true
  },
  trustee_id: {
    type: String,
    trim: true
  },
  student_info: {
    type: studentInfoSchema,
    required: [true, 'Student information is required']
  },
  gateway_name: {
    type: String,
    default: 'edviron',
    trim: true
  },
  custom_order_id: {
    type: String,
    required: [true, 'Custom order ID is required'],
    unique: true,
    trim: true,
    index: true
  },
  collect_request_id: {
    type: String,
    trim: true,
    index: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be greater than 0']
  },
  callback_url: {
    type: String,
    required: [true, 'Callback URL is required'],
    trim: true
  },
  status: {
    type: String,
    enum: ['created', 'pending', 'completed', 'failed', 'cancelled'],
    default: 'created'
  },
  vendor_response: {
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

// Indexes
orderSchema.index({ custom_order_id: 1 }, { unique: true });
orderSchema.index({ school_id: 1 });
orderSchema.index({ collect_request_id: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ school_id: 1, createdAt: -1 });

// Static method to find order by custom_order_id
orderSchema.statics.findByCustomOrderId = function(customOrderId) {
  return this.findOne({ custom_order_id: customOrderId });
};

// Static method to find orders by school
orderSchema.statics.findBySchool = function(schoolId, options = {}) {
  const query = { school_id: schoolId };
  
  if (options.status) {
    query.status = options.status;
  }
  
  return this.find(query).sort({ createdAt: -1 });
};

// Method to update status
orderSchema.methods.updateStatus = function(status, vendorResponse = null) {
  this.status = status;
  if (vendorResponse) {
    this.vendor_response = vendorResponse;
  }
  return this.save();
};

const Order = mongoose.model('Order', orderSchema);

export default Order;