const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');

// 获取通知列表
router.get('/list', async (req, res) => {
    try {
        const { page = 1, limit = 10, read } = req.query;
        const skip = (page - 1) * limit;

        // 构建查询条件
        const query = { user: req.user.id };
        if (read !== undefined) {
            query.read = read === 'true';
        }

        // 查询总记录数
        const total = await Notification.countDocuments(query);

        // 查询通知列表
        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        res.json({
            success: true,
            data: notifications,
            total,
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (error) {
        console.error('获取通知列表错误:', error);
        res.status(500).json({
            success: false,
            message: '获取通知列表失败'
        });
    }
});

// 标记通知为已读
router.put('/:id/read', async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            { read: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: '通知不存在'
            });
        }

        res.json({
            success: true,
            message: '标记已读成功',
            data: notification
        });
    } catch (error) {
        console.error('标记通知已读错误:', error);
        res.status(500).json({
            success: false,
            message: '标记已读失败'
        });
    }
});

// 标记所有通知为已读
router.put('/read-all', async (req, res) => {
    try {
        await Notification.updateMany(
            { user: req.user.id, read: false },
            { read: true }
        );

        res.json({
            success: true,
            message: '全部标记已读成功'
        });
    } catch (error) {
        console.error('标记所有通知已读错误:', error);
        res.status(500).json({
            success: false,
            message: '标记所有通知已读失败'
        });
    }
});

// 删除通知
router.delete('/:id', async (req, res) => {
    try {
        const notification = await Notification.findOneAndDelete({
            _id: req.params.id,
            user: req.user.id
        });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: '通知不存在'
            });
        }

        // 新增权限校验：管理员可以删除所有通知；普通用户只能删除自己的非SYSTEM类型通知
        if (req.user.role !== 'admin' && (notification.user.toString() !== req.user.id.toString() || notification.type === 'SYSTEM')) {
            return res.status(403).json({ success: false, message: '无权限删除此通知' });
        }

        res.json({
            success: true,
            message: '删除通知成功'
        });
    } catch (error) {
        console.error('删除通知错误:', error);
        res.status(500).json({
            success: false,
            message: '删除通知失败'
        });
    }
});

// 删除所有通知
router.delete('/all', async (req, res) => {
    try {
        await Notification.deleteMany({ user: req.user.id });

        res.json({
            success: true,
            message: '删除所有通知成功'
        });
    } catch (error) {
        console.error('删除所有通知错误:', error);
        res.status(500).json({
            success: false,
            message: '删除所有通知失败'
        });
    }
});

module.exports = router; 