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
      required: true,
      index: true,
      trim: true,
    },
    customerName: {
      type: String,
      default: '',
      trim: true,
    },
    garmentType: {
      type: String,
      default: '',
      trim: true,
    },
    measurements: {
      type: Object,
      default: {},
    },
    price: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      default: 'pending',
      enum: ['pending', 'in_progress', 'completed'],
      index: true,
    },
    dueDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Order', orderSchema);
