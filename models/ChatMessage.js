const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
    content: {
        type: String,
        required: true,
        trim: true
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    receiverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    isFromAdmin: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'RECALLED'],
        default: 'SENDING'
    },
    isRead: {
        type: Boolean,
        default: false
    },
    isRecalled: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// 创建索引
chatMessageSchema.index({ senderId: 1, receiverId: 1, timestamp: -1 });
chatMessageSchema.index({ content: 'text' });
chatMessageSchema.index({ isRead: 1 });
chatMessageSchema.index({ isRecalled: 1 });

// 获取聊天记录
chatMessageSchema.statics.getMessages = async function(userId, isFromAdmin, limit = 50, before = null) {
    const query = {
        $or: [
            { senderId: userId },
            { receiverId: userId }
        ]
    };

    if (before) {
        query.timestamp = { $lt: before };
    }

    const messages = await this.find(query)
        .sort({ timestamp: -1 })
        .limit(limit)
        .populate('senderId', 'username')
        .populate('receiverId', 'username')
        .lean(); // 使用 lean() 获取普通 JS 对象，以便修改

    return messages.map(message => {
        let isImage = false;
        let content = message.content;
        // 判断是否为图片（可根据后缀名判断）
        if (typeof content === 'string' && /\.(jpg|jpeg|png|gif|webp)$/i.test(content)) {
            isImage = true;
            // 如果不是完整路径，自动补全
            if (!content.startsWith('/uploads/info/')) {
                content = '/uploads/info/' + content;
            }
        }
        return {
            ...message,
            isImage,
            content
        };
    });
};

// 获取未读消息数量
chatMessageSchema.statics.getUnreadCount = async function(userId) {
    return this.countDocuments({
        receiverId: userId,
        isRead: false
    });
};

// 标记消息为已读
chatMessageSchema.statics.markAsRead = async function(senderId, receiverId) {
    return this.updateMany(
        {
            senderId,
            receiverId,
            isRead: false
        },
        {
            $set: {
                isRead: true,
                status: 'READ'
            }
        }
    );
};

// 更新消息状态
chatMessageSchema.statics.updateStatus = async function(messageId, status) {
    return this.findByIdAndUpdate(
        messageId,
        { status },
        { new: true }
    );
};

// 搜索消息
chatMessageSchema.statics.searchMessages = async function(userId, keyword) {
    return this.find({
        $or: [
            { senderId: userId },
            { receiverId: userId }
        ],
        content: { $regex: keyword, $options: 'i' }
    })
    .sort({ timestamp: -1 })
    .populate('senderId', 'username')
    .populate('receiverId', 'username');
};

// 撤回消息
chatMessageSchema.statics.recallMessage = async function(messageId) {
    return this.findByIdAndUpdate(
        messageId,
        {
            $set: {
                content: '此消息已撤回',
                isRecalled: true,
                status: 'RECALLED'
            }
        },
        { new: true }
    );
};

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

module.exports = ChatMessage; 