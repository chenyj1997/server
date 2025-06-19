const express = require('express');
const router = express.Router();
const ChatMessage = require('../models/ChatMessage');
const { protect } = require('../middleware/auth');

// 获取聊天记录
router.get('/messages', protect, async (req, res) => {
    try {
        const { limit = 50, before } = req.query;
        const userId = req.user._id;
        const isFromAdmin = req.user.role === 'admin';

        const messages = await ChatMessage.getMessages(userId, isFromAdmin, parseInt(limit), before);
        res.json({ success: true, data: messages });
    } catch (error) {
        res.status(500).json({ success: false, message: '获取聊天记录失败' });
    }
});

// 发送消息
router.post('/messages', protect, async (req, res) => {
    try {
        const { content, receiverId } = req.body;
        const senderId = req.user._id;
        const isFromAdmin = req.user.role === 'admin';

        const message = new ChatMessage({
            content,
            senderId,
            receiverId,
            isFromAdmin
        });

        await message.save();
        
        res.json({ success: true, data: message });
    } catch (error) {
        res.status(500).json({ success: false, message: '发送消息失败' });
    }
});

// 标记消息为已读
router.post('/messages/read', protect, async (req, res) => {
    try {
        const { senderId } = req.body;
        const receiverId = req.user._id;

        await ChatMessage.markAsRead(senderId, receiverId);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: '标记消息已读失败' });
    }
});

// 更新消息状态
router.put('/messages/:messageId/status', protect, async (req, res) => {
    try {
        const { messageId } = req.params;
        const { status } = req.body;

        const message = await ChatMessage.updateStatus(messageId, status);
        if (!message) {
            return res.status(404).json({ success: false, message: '消息不存在' });
        }

        res.json({ success: true, data: message });
    } catch (error) {
        res.status(500).json({ success: false, message: '更新消息状态失败' });
    }
});

// 获取未读消息数量
router.get('/messages/unread/count', protect, async (req, res) => {
    try {
        const userId = req.user._id;
        const count = await ChatMessage.getUnreadCount(userId);
        res.json({ success: true, data: count });
    } catch (error) {
        res.status(500).json({ success: false, message: '获取未读消息数量失败' });
    }
});

// 搜索消息
router.get('/messages/search', protect, async (req, res) => {
    try {
        const { keyword } = req.query;
        const userId = req.user._id;

        const messages = await ChatMessage.searchMessages(userId, keyword);
        res.json({ success: true, data: messages });
    } catch (error) {
        res.status(500).json({ success: false, message: '搜索消息失败' });
    }
});

// 撤回消息
router.post('/messages/:messageId/recall', protect, async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user._id;

        const message = await ChatMessage.findById(messageId);
        if (!message) {
            return res.status(404).json({ success: false, message: '消息不存在' });
        }

        // 检查权限
        if (message.senderId.toString() !== userId.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: '没有权限撤回此消息' });
        }

        // 检查时间限制（2分钟内）
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
        if (message.timestamp < twoMinutesAgo) {
            return res.status(400).json({ success: false, message: '只能撤回2分钟内的消息' });
        }

        const updatedMessage = await ChatMessage.recallMessage(messageId);
        
        res.json({ success: true, data: updatedMessage });
    } catch (error) {
        res.status(500).json({ success: false, message: '撤回消息失败' });
    }
});

module.exports = router; 