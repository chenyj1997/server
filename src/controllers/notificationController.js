// 通知控制器
const Notification = require('../models/Notification');

// 创建通知
exports.createNotification = async (userId, title, content, type = 'system') => {
    try {
        const notification = new Notification({
            userId,
            title,
            content,
            type
        });
        await notification.save();
        return notification;
    } catch (error) {
        console.error('创建通知失败:', error);
        throw error;
    }
};

// 获取用户通知列表
exports.getUserNotifications = async (userId, page = 1, limit = 10) => {
    try {
        const skip = (page - 1) * limit;
        const notifications = await Notification.find({ userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        return notifications;
    } catch (error) {
        console.error('获取通知列表失败:', error);
        throw error;
    }
};

// 标记通知为已读
exports.markAsRead = async (notificationId) => {
    try {
        const notification = await Notification.findByIdAndUpdate(
            notificationId,
            { isRead: true },
            { new: true }
        );
        return notification;
    } catch (error) {
        console.error('标记通知已读失败:', error);
        throw error;
    }
};

// 删除通知
exports.deleteNotification = async (notificationId) => {
    try {
        await Notification.findByIdAndDelete(notificationId);
        return true;
    } catch (error) {
        console.error('删除通知失败:', error);
        throw error;
    }
};

// 获取未读通知数量
exports.getUnreadCount = async (userId) => {
    try {
        const count = await Notification.countDocuments({
            userId,
            isRead: false
        });
        return count;
    } catch (error) {
        console.error('获取未读通知数量失败:', error);
        throw error;
    }
};

// 获取所有通知列表 (管理员用)
exports.getAllNotifications = async (page = 1, limit = 10) => {
    try {
        const skip = (page - 1) * limit;
        const notifications = await Notification.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        return notifications;
    } catch (error) {
        console.error('获取所有通知失败:', error);
        throw error;
    }
};

// 获取所有通知总数 (管理员用)
exports.countAllNotifications = async () => {
    try {
        const count = await Notification.countDocuments();
        return count;
    } catch (error) {
        console.error('获取所有通知总数失败:', error);
        throw error;
    }
}; 