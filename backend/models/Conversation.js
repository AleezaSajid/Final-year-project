const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true, unique: true, index: true, trim: true },
    orderId: { type: String, required: true, unique: true, index: true, trim: true },
    customerId: { type: String, required: true, index: true, trim: true },
    tailorId: { type: String, required: true, index: true, trim: true },
    customerName: { type: String, default: '', trim: true },
    tailorName: { type: String, default: '', trim: true },
    garmentType: { type: String, default: '', trim: true },
    lastMessage: { type: String, default: '', trim: true },
    lastMessageAt: { type: Date, default: null, index: true },
    unreadCustomer: { type: Number, default: 0 },
    unreadTailor: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'completed', 'archived'], default: 'active', index: true },
  },
  { timestamps: true }
);

conversationSchema.index({ customerId: 1, lastMessageAt: -1 });
conversationSchema.index({ tailorId: 1, lastMessageAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);

