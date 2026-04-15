const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: String,
      required: true,
      index: true,
    },
    receiverId: {
      type: String,
      required: true,
      index: true,
    },
    conversationId: {
      type: String,
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    status: {
      type: String,
      default: 'sent',
    },
  },
  {
    timestamps: true,
  }
);

messageSchema.index({ conversationId: 1, timestamp: 1 });

module.exports = mongoose.model('Message', messageSchema);
