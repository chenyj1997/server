const express = require('express');
const router = express.Router();
const User = require('../models/User');
const CustomerServiceMessage = require('../models/CustomerServiceMessage');
const mongoose = require('mongoose');
const { protect, restrictToAdmin } = require('../middleware/auth');
const multer = require('multer');
const cloudinary = require('../utils/cloudinary');
const fs = require('fs');
const path = require('path');

// 配置multer用于文件上传
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../public/uploads/customer-service');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('只允许上传图片文件'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    }
});

// GET /api/customer-service/conversations - 获取所有与客服有消息往来的用户列表 (管理员)
router.get('/conversations', [protect, restrictToAdmin], async (req, res) => {
    console.log('收到获取客服会话列表请求');
    try {
        // Find distinct users who have sent or received customer service messages
        const conversations = await CustomerServiceMessage.aggregate([
            { $match: { isHidden: false } }, // 只获取未隐藏的消息
            { $group: { _id: '$user', lastMessageTime: { $max: '$createdAt' } } },
            { $sort: { lastMessageTime: -1 } },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'userInfo' } },
            { $unwind: '$userInfo' },
            { $project: { _id: 0, user: '$userInfo._id', username: '$userInfo.username', avatar: '$userInfo.avatar', lastMessageTime: 1 } }
        ]);

        // Optionally, fetch the last message or unread count for each conversation
        for (let conv of conversations) {
            const lastMessage = await CustomerServiceMessage.findOne({ user: conv.user, isHidden: false }).sort({ createdAt: -1 }).lean();
            conv.lastMessage = lastMessage ? lastMessage.content : '';
            // Count unread messages from user to this admin
            const unreadCount = await CustomerServiceMessage.countDocuments({ 
                user: conv.user, 
                isRead: false, 
                senderType: 'user',
                isHidden: false
            });
            conv.unreadCount = unreadCount;
        }

        console.log('获取客服会话列表成功', conversations.length);
        res.json({ success: true, data: conversations });

    } catch (error) {
        console.error('获取客服会话列表错误:', error);
        res.status(500).json({ success: false, message: '获取客服会话列表失败', error: error.message });
    }
});

// GET /api/customer-service/messages/:userId - 获取特定用户的客服消息历史 (管理员/用户)
router.get('/messages/:userId', [protect], async (req, res) => {
    const { userId } = req.params;
    const requestingUser = req.user; // From 'protect' middleware

    console.log(`收到获取用户 ${userId} 客服消息请求，请求者: ${requestingUser.id} (${requestingUser.role})`);

    try {
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: '无效的用户ID' });
        }

        // Admin can fetch any user's messages. Regular users can only fetch their own.
        if (requestingUser.role !== 'admin' && requestingUser.id !== userId) {
            return res.status(403).json({ success: false, message: '无权访问此用户的消息' });
        }
        
        const messages = await CustomerServiceMessage.find({ user: userId })
            .populate('sender', 'username avatar role') // Populate sender info
            .sort({ createdAt: 1 })
            .lean();

        // Mark messages as read when they are viewed by the receiving user
        // If the requesting user is the user, mark admin messages as read
        console.log(`Debug: requestingUser.role=${requestingUser.role}, requestingUser.id=${requestingUser.id}, userId=${userId}`);
        if (requestingUser.role === 'user' && requestingUser.id === userId) {
            const result = await CustomerServiceMessage.updateMany(
                { user: userId, senderType: 'admin', isRead: false },
                { $set: { isRead: true, readBy: requestingUser.id, readAt: new Date() } }
            );
            console.log(`Backend: User ${userId} marked ${result.modifiedCount} admin messages as read.`);
        }
        // If the requesting user is an admin, mark user messages as read for this conversation
        else if (requestingUser.role === 'admin') {
            // Debug: Log the conditions being used for the update
            console.log(`Backend Debug: Admin attempting to mark messages as read for user ${userId}.`);
            console.log(`Backend Debug: Query conditions: { user: '${userId}', senderType: 'user', isRead: false }`);
            
            // Debug: Fetch and log the messages that match the query *before* update
            const messagesToMark = await CustomerServiceMessage.find({
                user: userId,
                senderType: 'user',
                isRead: false
            }).lean();
            console.log(`Backend Debug: Found ${messagesToMark.length} user messages to mark as read for user ${userId}:`, JSON.stringify(messagesToMark, null, 2));

            const result = await CustomerServiceMessage.updateMany(
                { user: userId, senderType: 'user', isRead: false },
                { $set: { isRead: true, readBy: requestingUser.id, readAt: new Date() } }
            );
            console.log(`Backend: Admin marked ${result.modifiedCount} user messages as read for user ${userId}.`);
        }

        console.log(`获取用户 ${userId} 的客服消息成功`, messages.length);
        res.json({ success: true, data: messages });

    } catch (error) {
        console.error(`获取用户 ${userId} 客服消息错误:`, error);
        res.status(500).json({ success: false, message: '获取用户客服消息失败', error: error.message });
    }
});

// POST /api/customer-service/messages - 用户或管理员发送消息
router.post('/messages', [protect], async (req, res) => {
    console.log('Backend received POST /messages request. Body:', req.body);
    const { recipientId, content, messageType, imageUrl } = req.body;
    const sender = req.user;

    console.log(`收到发送消息请求: 发送者 ${sender.id} (${sender.role}), 接收者ID ${recipientId}, 类型 ${messageType}`);

    if (!content && messageType !== 'image') {
        return res.status(400).json({ success: false, message: '文本消息内容不能为空' });
    }
    if (messageType === 'image' && !imageUrl) {
        return res.status(400).json({ success: false, message: '图片消息必须包含图片URL' });
    }

    try {
        let targetUserId = null;
        let senderType = '';
        
        if (sender.role === 'admin') {
            if (!mongoose.Types.ObjectId.isValid(recipientId)) {
                 return res.status(400).json({ success: false, message: '无效的接收用户ID' });
            }
            const userExists = await User.findById(recipientId);
            if (!userExists) {
                return res.status(404).json({ success: false, message: '接收用户不存在' });
            }
            targetUserId = recipientId;
            senderType = 'admin';
        } else {
            targetUserId = sender.id;
            senderType = 'user';
            // 如果是用户发送消息，取消该对话的隐藏状态
            await CustomerServiceMessage.updateMany(
                { user: targetUserId },
                { $set: { isHidden: false } }
            );
        }

        const messageData = {
            user: targetUserId,
            sender: sender.id,
            senderType: senderType,
            content,
            isRead: false,
            isHidden: false
        };

        if (messageType) {
            messageData.messageType = messageType;
        }
        if (imageUrl) {
            messageData.imageUrl = imageUrl;
        }

        const newMessage = new CustomerServiceMessage(messageData);
        const message = await newMessage.save();
        const populatedMessage = await CustomerServiceMessage.findById(message._id)
                                    .populate('sender', 'username avatar role')
                                    .lean();

        console.log(`${senderType} ${sender.id} 发送消息给用户 ${targetUserId} 成功`);
        res.status(201).json({ success: true, data: populatedMessage });

    } catch (error) {
        console.error(`${sender.role} ${sender.id} 发送消息错误:`, error);
        res.status(500).json({ success: false, message: '发送消息失败', error: error.message });
    }
});


// PUT /api/customer-service/messages/:messageId/read - 标记单条消息为已读 (通用)
router.put('/messages/:messageId/read', [protect], async (req, res) => {
    const { messageId } = req.params;
    const requestingUser = req.user;
    console.log(`收到标记消息 ${messageId} 为已读请求，请求者: ${requestingUser.id}`);

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
        return res.status(400).json({ success: false, message: '无效的消息ID' });
    }
    
    try {
        const message = await CustomerServiceMessage.findById(messageId);
        if (!message) {
            return res.status(404).json({ success: false, message: '消息不存在' });
        }

        // Check if the requesting user is either the admin (if message from user) or the user (if message for them)
        // And ensure the message is not already read and was sent by the other party.
        let canMarkAsRead = false;
        if (requestingUser.role === 'admin' && message.senderType === 'user' && message.user.toString() === message.sender.toString()) { 
            // Admin reading a user's message to them (user field matches sender, sender is 'user')
            canMarkAsRead = true;
        } else if (requestingUser.id === message.user.toString() && message.senderType === 'admin') {
            // User reading an admin's message to them
            canMarkAsRead = true;
        }


        if (!canMarkAsRead) {
            return res.status(403).json({ success: false, message: '无权标记此消息为已读' });
        }
        
        if (message.isRead) {
            return res.status(200).json({ success: true, message: '消息已经为已读状态', alreadyRead: true, data: message });
        }

        message.isRead = true;
        message.readBy = requestingUser.id;
        message.readAt = new Date();
        await message.save();
        
        const populatedMessage = await CustomerServiceMessage.findById(message._id)
                                    .populate('sender', 'username avatar role')
                                    .populate('readBy', 'username avatar role')
                                    .lean();

        console.log(`消息 ${messageId} 已被 ${requestingUser.id} 标记为已读`);
        res.json({ success: true, message: '消息已标记为已读', data: populatedMessage });

    } catch (error) {
        console.error(`标记消息 ${messageId} 为已读错误:`, error);
        res.status(500).json({ success: false, message: '标记消息为已读失败', error: error.message });
    }
});

// POST /api/customer-service/messages/mark-all-as-read - 用户将所有收到的客服消息标记为已读
router.post('/messages/mark-all-as-read', [protect], async (req, res) => {
    const userId = req.user.id;
    console.log(`收到用户 ${userId} 标记所有客服消息为已读的请求`);

    try {
        const result = await CustomerServiceMessage.updateMany(
            { user: userId, senderType: 'admin', isRead: false },
            { $set: { isRead: true, readBy: userId, readAt: new Date() } }
        );

        console.log(`用户 ${userId} 的 ${result.modifiedCount} 条客服消息被标记为已读`);
        res.json({ success: true, message: '所有未读消息已标记为已读', modifiedCount: result.modifiedCount });

    } catch (error) {
        console.error(`标记用户 ${userId} 所有消息为已读时出错:`, error);
        res.status(500).json({ success: false, message: '操作失败', error: error.message });
    }
});

// GET /api/customer-service/unread-count - 获取当前用户/管理员的未读消息总数
router.get('/unread-count', [protect], async (req, res) => {
    const currentUser = req.user;

    try {
        let unreadCount = 0;
        if (currentUser.role === 'admin') {
            // Admin: count unread messages sent by 'user' type senders across all conversations
            // This requires a more complex aggregation if we want a count of distinct conversations with unread messages
            // For a simple total unread messages:
            const unreadMessages = await CustomerServiceMessage.find({
                senderType: 'user',
                isRead: false
            }).select('_id user content'); // Select relevant fields for debugging
            unreadCount = unreadMessages.length;

        } else { // Regular user
            // User: count unread messages sent by 'admin' type senders in their conversation
            unreadCount = await CustomerServiceMessage.countDocuments({
                user: currentUser.id,
                senderType: 'admin',
                isRead: false
            });
        }
        
        res.json({ success: true, data: { unreadCount } });

    } catch (error) {
        console.error(`获取用户 ${currentUser.id} (${currentUser.role}) 未读消息总数错误:`, error);
        res.status(500).json({ success: false, message: '获取未读消息总数失败', error: error.message });
    }
});

// PUT /api/customer-service/conversations/:userId/hide - 隐藏与特定用户的对话 (管理员)
router.put('/conversations/:userId/hide', [protect, restrictToAdmin], async (req, res) => {
    const { userId } = req.params;
    console.log(`收到隐藏用户 ${userId} 对话请求`);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: '无效的用户ID' });
    }

    try {
        // 将该用户的所有消息标记为隐藏
        const result = await CustomerServiceMessage.updateMany(
            { user: userId },
            { $set: { isHidden: true } }
        );

        console.log(`隐藏用户 ${userId} 对话成功`);
        res.json({ success: true, message: '对话已隐藏' });

    } catch (error) {
        console.error(`隐藏用户 ${userId} 对话错误:`, error);
        res.status(500).json({ success: false, message: '隐藏对话失败', error: error.message });
    }
});

// 客服图片上传接口
router.post('/upload/image', protect, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: '请选择要上传的图片' });
        }

        console.log('[客服图片上传] 收到文件:', req.file.originalname, '存储路径:', req.file.path);

        // 在Render上，我们直接使用本地存储，不上传Cloudinary
        // 构建相对URL路径，用于前端访问
        const relativePath = req.file.path.replace(path.join(__dirname, '../public'), '');
        const imageUrl = relativePath.replace(/\\/g, '/'); // 确保使用正斜杠

        console.log('[客服图片上传] 本地存储成功:', imageUrl);

        res.json({
            success: true,
            data: {
                url: imageUrl
            },
            url: imageUrl // 保持向后兼容
        });
    } catch (error) {
        console.error('[客服图片上传] 错误:', error);
        // 如果本地文件存在，删除它
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ success: false, message: error.message || '图片上传失败' });
    }
});

module.exports = router; 
