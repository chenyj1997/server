const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');
const User = require('../models/User');

// @desc    Get all notifications for a user
// @route   GET /api/notifications
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const notifications = await Notification.find({ 
            user: req.user._id,
            type: 'SYSTEM' // 新的逻辑：只获取系统公告
        })
            .sort({ createdAt: -1 });
        res.json({ success: true, data: notifications });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
    }
});

// @desc    Mark a notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
router.put('/:id/read', protect, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid notification ID' });
        }

        const notification = await Notification.findOne({
            _id: req.params.id,
            user: req.user._id,
        });

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found or not authorized' });
        }

        notification.isRead = true;
        await notification.save();

        res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ success: false, message: 'Failed to mark notification as read' });
    }
});

// @desc    Delete a notification
// @route   DELETE /api/notifications/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid notification ID' });
        }

        const notification = await Notification.findById(req.params.id);
        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        // 管理员可以删除任何通知，普通用户只能删除自己的通知
        if (req.user.role !== 'admin' && notification.user.toString() !== req.user._id.toString()) {
            console.error(`用户 ${req.user._id} 尝试删除不属于自己的通知 ${req.params.id}. 通知用户ID: ${notification.user}`);
            return res.status(403).json({ success: false, message: 'Not authorized to delete this notification' });
        }

        await notification.deleteOne();
        res.json({ success: true, message: 'Notification deleted successfully' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ success: false, message: 'Failed to delete notification' });
    }
});

// @desc    Create a test system notification
// @route   POST /api/notifications/test
// @access  Private
router.post('/test', protect, async (req, res) => {
    try {
        console.log('创建测试公告');
        const testNotification = new Notification({
            title: '测试公告',
            content: '这是一个测试公告的内容。\n请检查显示效果！',
            type: 'SYSTEM',
            status: 'ACTIVE',
            createdBy: req.user._id
        });

        await testNotification.save();
        console.log('测试公告创建成功:', testNotification);

        res.status(201).json({
            success: true,
            message: '测试公告创建成功',
            data: testNotification
        });
    } catch (error) {
        console.error('创建测试公告失败:', error);
        res.status(500).json({
            success: false,
            message: '创建测试公告失败'
        });
    }
});

// @desc    获取未读通知数量
// @route   GET /api/notifications/unread/count
// @access  Private
router.get('/unread/count', protect, async (req, res) => {
    try {
        const count = await Notification.countDocuments({
            type: 'SYSTEM', // 只计算系统公告的未读数
            status: 'ACTIVE' // 只计算活跃状态的通知
        });
        res.json({ success: true, data: count });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch unread count' });
    }
});

// @desc    管理员发布公告
// @route   POST /api/notifications
// @access  Admin
router.post('/', protect, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: '无权限' });
    }
    try {
        const { title, content, status = 'ACTIVE' } = req.body;
        // 检查是否已存在相同内容的公告
        const existingNotification = await Notification.findOne({ 
            title, 
            content, 
            type: 'SYSTEM',
            createdBy: req.user._id,
            createdAt: { 
                $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24小时内的公告
            }
        });
        
        if (existingNotification) {
            return res.status(400).json({ success: false, message: '24小时内已发布过相同内容的公告' });
        }

        // RESTORE: Creating notification for system announcements
        const notification = await Notification.create({
            user: req.user._id, // 使用当前管理员ID作为系统公告的用户ID
            title,
            content,
            type: 'SYSTEM',
            status,
            createdBy: req.user._id
        });

        res.status(201).json({ 
            success: true, 
            message: '公告发布成功', // RESTORED original message
            data: notification 
        });
    } catch (error) {
        console.error('公告发布失败:', error);
        res.status(500).json({ success: false, message: '公告发布失败', error: error.message });
    }
});

// 获取通知列表（支持 type/status/limit/sortBy/sortOrder 查询参数）
router.get('/list', protect, async (req, res) => {
    try {
        const { type, status, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
        const query = {};
        
        // 如果是系统通知，所有用户都可以看到
        if (type === 'SYSTEM') {
            query.type = 'SYSTEM';
            // 不限制用户ID，让所有用户都能看到系统通知
        } else {
            // 对于其他类型的通知，只查询当前用户的通知
            query.user = req.user._id;
            if (type) query.type = type;
        }
        
        if (status) query.status = status;
        
        const notifications = await Notification.find(query)
            .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
            .limit(parseInt(limit));
        res.json({ success: true, data: notifications });
    } catch (error) {
        res.status(500).json({ success: false, message: '获取通知列表失败' });
    }
});

module.exports = router; 
