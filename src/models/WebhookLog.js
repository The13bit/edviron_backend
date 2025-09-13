import mongoose from 'mongoose';

const webhookLogSchema = new mongoose.Schema({
  raw_payload: {
    type: mongoose.Schema.Types.Mixed,
    required: [true, 'Raw payload is required']
  },
  parsed: {
    type: mongoose.Schema.Types.Mixed
  },
  received_at: {
    type: Date,
    default: Date.now,
    index: true
  },
  signature_valid: {
    type: Boolean,
    default: null
  },
  processing_status: {
    type: String,
    enum: ['queued', 'processed', 'failed'],
    default: 'queued',
    index: true
  },
  processing_message: {
    type: String,
    trim: true
  },
  order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    index: true
  },
  custom_order_id: {
    type: String,
    trim: true,
    index: true
  },
  collect_request_id: {
    type: String,
    trim: true,
    index: true
  },
  transaction_id: {
    type: String,
    trim: true,
    index: true
  },
  source_ip: {
    type: String,
    trim: true
  },
  user_agent: {
    type: String,
    trim: true
  },
  headers: {
    type: mongoose.Schema.Types.Mixed
  },
  retries: {
    type: Number,
    default: 0,
    min: 0
  },
  last_retry_at: {
    type: Date
  },
  processed_at: {
    type: Date
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

// Indexes for efficient queries
webhookLogSchema.index({ received_at: -1 });
webhookLogSchema.index({ processing_status: 1, received_at: -1 });
webhookLogSchema.index({ custom_order_id: 1, received_at: -1 });
webhookLogSchema.index({ collect_request_id: 1, received_at: -1 });
webhookLogSchema.index({ transaction_id: 1 });

// TTL index to automatically delete old webhook logs after 90 days
webhookLogSchema.index({ received_at: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

// Static method to create webhook log
webhookLogSchema.statics.createLog = function(logData) {
  const webhookLog = new this(logData);
  return webhookLog.save();
};

// Static method to find logs by status
webhookLogSchema.statics.findByStatus = function(status, limit = 100) {
  return this.find({ processing_status: status })
    .sort({ received_at: -1 })
    .limit(limit);
};

// Static method to find logs for an order
webhookLogSchema.statics.findByOrderId = function(orderId) {
  return this.find({ order_id: orderId })
    .sort({ received_at: -1 });
};

// Static method to find logs by custom order ID
webhookLogSchema.statics.findByCustomOrderId = function(customOrderId) {
  return this.find({ custom_order_id: customOrderId })
    .sort({ received_at: -1 });
};

// Method to mark as processed
webhookLogSchema.methods.markAsProcessed = function(message = null) {
  this.processing_status = 'processed';
  this.processed_at = new Date();
  if (message) {
    this.processing_message = message;
  }
  return this.save();
};

// Method to mark as failed
webhookLogSchema.methods.markAsFailed = function(errorMessage) {
  this.processing_status = 'failed';
  this.processing_message = errorMessage;
  this.retries += 1;
  this.last_retry_at = new Date();
  return this.save();
};

// Method to retry processing
webhookLogSchema.methods.retryProcessing = function() {
  this.processing_status = 'queued';
  this.retries += 1;
  this.last_retry_at = new Date();
  return this.save();
};

// Method to check if max retries reached
webhookLogSchema.methods.hasMaxRetriesReached = function(maxRetries = 3) {
  return this.retries >= maxRetries;
};

const WebhookLog = mongoose.model('WebhookLog', webhookLogSchema);

export default WebhookLog;