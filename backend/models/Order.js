const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    customerId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    tailorId: {
      type: String,
      default: '',
      index: true,
      trim: true,
    },
    customerName: {
      type: String,
      default: '',
      trim: true,
    },
    customerPhone: {
      type: String,
      default: '',
      trim: true,
    },
    garmentType: {
      type: String,
      default: '',
      trim: true,
    },
    garmentCategory: {
      type: String,
      default: '',
      trim: true,
    },
    measurements: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    style: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    notes: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    /** Full wizard structured payload (optional duplicate for APIs that store one blob) */
    orderPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    source: {
      type: String,
      default: '',
      trim: true,
    },
    clientOrderId: {
      type: String,
      default: '',
      trim: true,
    },
    price: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      default: 'order_placed',
      index: true,
      trim: true,
    },
    workflowStatus: {
      type: String,
      default: 'order_placed',
      index: true,
      trim: true,
    },
    /** Index in canonical workflow (0 = pending … 8 = completed); kept in sync with status on writes */
    currentStepIndex: {
      type: Number,
      default: 0,
    },
    /** Tailor “focused” order for customer Track Order mirror (one active per tailor). */
    isActive: {
      type: Boolean,
      default: false,
      index: true,
    },
    /** Customer↔tailor messaging allowed only after tailor accepts. */
    chatEnabled: {
      type: Boolean,
      default: false,
      index: true,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    review: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    customerReview: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Order', orderSchema);
