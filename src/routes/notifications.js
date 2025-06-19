// 通知相关路由
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middleware/authMiddleware'); // 引入认证中间件
const { protect, restrictToAdmin } = require('../middleware/auth');
const Notification = require('../models/Notification');

// 获取所有通知列表 (管理员可用，带分页)
router.get('/list', protect, async (req, res) => {
    try {
        const { page = 1, limit = 10, type } = req.query;
        const query = {};
        
        // 如果指定了类型，添加到查询条件
        if (type) {
            query.type = type;
        }

        // 如果不是管理员，只显示已发布的通知
        if (req.user.role !== 'admin') {
            query.status = 'ACTIVE';
        }

        // 获取总数
        const total = await Notification.countDocuments(query);
        
        // 获取分页数据
        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        res.json({
            success: true,
            data: notifications,
            total,
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (error) {
        console.error('获取通知列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取通知列表失败'
        });
    }
});

// 获取用户通知列表
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const notifications = await notificationController.getUserNotifications(userId, Number(page), Number(limit));
        res.json({ success: true, notifications });
    } catch (err) {
        res.status(500).json({ success: false, message: '获取通知列表失败', error: err.message });
    }
});

// 标记通知为已读
router.post('/read/:id', async (req, res) => {
    try {
        const notification = await notificationController.markAsRead(req.params.id);
        res.json({ success: true, notification });
    } catch (err) {
        res.status(500).json({ success: false, message: '标记已读失败', error: err.message });
    }
});

// 删除通知
router.delete('/:id', protect, async (req, res) => {
    try {
        const { id } = req.params;

        const notification = await Notification.findById(id);
        if (!notification) {
            return res.status(404).json({
                success: false,
                message: '通知不存在'
            });
        }

        await notification.remove();

        res.json({
            success: true,
            message: '通知删除成功'
        });
    } catch (error) {
        console.error('删除通知失败:', error);
        res.status(500).json({
            success: false,
            message: '删除通知失败'
        });
    }
});

// 获取未读通知数量
router.get('/unread/count/:userId', async (req, res) => {
    try {
        const count = await notificationController.getUnreadCount(req.params.userId);
        res.json({ success: true, count });
    } catch (err) {
        res.status(500).json({ success: false, message: '获取未读数量失败', error: err.message });
    }
});

// 创建新通知
router.post('/', protect, async (req, res) => {
    try {
        const { title, content, type, status = 'DRAFT' } = req.body;

        // 验证必填字段
        if (!title || !content || !type) {
            return res.status(400).json({
                success: false,
                message: '请提供完整的通知信息'
            });
        }

        // REMOVE: Creating notification
        // const notification = new Notification({
        //     title,
        //     content,
        //     type,
        //     status,
        //     createdBy: req.user._id
        // });

        // await notification.save();

        res.status(201).json({
            success: true,
            // message: '通知创建成功',
            message: '通知功能已禁用，未创建通知。' // Updated message
            // data: notification
        });
    } catch (error) {
        console.error('创建通知失败:', error);
        res.status(500).json({
            success: false,
            message: error.message || '创建通知失败'
        });
    }
});

// 更新通知
router.put('/:id', protect, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, type, status } = req.body;

        const notification = await Notification.findById(id);
        if (!notification) {
            return res.status(404).json({
                success: false,
                message: '通知不存在'
            });
        }

        // 更新字段
        if (title) notification.title = title;
        if (content) notification.content = content;
        if (type) notification.type = type;
        if (status) notification.status = status;
        
        notification.updatedAt = new Date();
        notification.updatedBy = req.user._id;

        await notification.save();

        res.json({
            success: true,
            message: '通知更新成功',
            data: notification
        });
    } catch (error) {
        console.error('更新通知失败:', error);
        res.status(500).json({
            success: false,
            message: '更新通知失败'
        });
    }
});

// 发送通知
router.post('/:id/send', [protect, restrictToAdmin], async (req, res) => {
    try {
        const { id } = req.params;

        const notification = await Notification.findById(id);
        if (!notification) {
            return res.status(404).json({
                success: false,
                message: '通知不存在'
            });
        }

        // 更新通知状态为已发送
        notification.status = 'SENT';
        notification.sentAt = new Date();
        notification.sentBy = req.user._id;

        await notification.save();

        res.json({
            success: true,
            message: '通知发送成功',
            data: notification
        });
    } catch (error) {
        console.error('发送通知失败:', error);
        res.status(500).json({
            success: false,
            message: '发送通知失败'
        });
    }
});

// 获取单个通知详情
router.get('/:id', protect, async (req, res) => {
    try {
        const { id } = req.params;

        const notification = await Notification.findById(id);
        if (!notification) {
            return res.status(404).json({
                success: false,
                message: '通知不存在'
            });
        }

        res.json({
            success: true,
            data: notification
        });
    } catch (error) {
        console.error('获取通知详情失败:', error);
        res.status(500).json({
            success: false,
            message: '获取通知详情失败'
        });
    }
});

module.exports = router; 