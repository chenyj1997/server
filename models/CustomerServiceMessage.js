const mongoose = require('mongoose');

const customerServiceMessageSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  senderType: {
    type: String,
    enum: ['user', 'admin'],
    required: true,
  },
  content: {
    type: String,
    trim: true,
  },
  messageType: {
    type: String,
    default: 'text', // 'text' or 'image'
    enum: ['text', 'image'],
  },
  imageUrl: {
    type: String,
    trim: true, // Optional, only for image messages
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  isHidden: {
    type: Boolean,
    default: false, // 标记对话是否被客服隐藏
  }
});

customerServiceMessageSchema.index({ user: 1, createdAt: 1 });

const CustomerServiceMessage = mongoose.model('CustomerServiceMessage', customerServiceMessageSchema);

module.exports = CustomerServiceMessage; 
