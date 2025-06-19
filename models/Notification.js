const mongoose = require('mongoose');

// 定义通知模型
const notificationSchema = new mongoose.Schema({
    // 用户ID，关联到用户模型
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true,
    },
    // 通知标题
    title: {
        type: String,
        required: true,
    },
    // 通知内容
    content: {
        type: String,
        required: true,
    },
    // 通知类型：SYSTEM-系统通知，INFO-信息更新，WALLET-钱包通知，PROMOTION-促销通知，OTHER-其他
    type: {
        type: String,
        enum: ['PAYMENT', 'TRANSACTION', 'INCOME', 'SYSTEM'], // 全部大写
        default: 'SYSTEM',
    },
    // 通知状态：ACTIVE-已发布，ARCHIVED-已归档
    status: {
        type: String,
        enum: ['ACTIVE', 'ARCHIVED'],
        default: 'ACTIVE'
    },
    // 关联的ID（如交易ID、信息ID等）
    relatedEntity: { // 可以关联到信息、交易等
        type: mongoose.Schema.ObjectId,
        refPath: 'relatedEntityType',
    },
    relatedEntityType: {
        type: String,
        enum: ['Info', 'Transaction'], // 关联的实体类型
    },
    // 是否已读
    isRead: {
        type: Boolean,
        default: false,
    },
    // 创建时间
    createdAt: {
        type: Date,
        default: Date.now,
    },
    // 更新时间
    updatedAt: {
        type: Date
    },
    // 创建者
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // 更新者
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    // 发送者
    sentBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    // 发送时间
    sentAt: {
        type: Date
    },
    // 阅读记录
    readBy: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        readAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    // 启用虚拟字段
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// 创建索引
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ type: 1, status: 1 });
notificationSchema.index({ 'readBy.user': 1 });

// 创建模型
const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification; 