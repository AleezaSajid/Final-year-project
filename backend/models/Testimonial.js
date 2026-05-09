const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    feedback: { type: String, required: true, trim: true },
    avatar: { type: String, default: '', trim: true },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    /** Canonical Mongo order id string */
    orderId: { type: String, required: true, trim: true, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Testimonial', testimonialSchema);
