const notificationController = require('../controllers/notificationController');
const User = require('../models/User');

// 通知模板
const notificationTemplates = {
    WELCOME: {
        title: '欢迎加入',
        content: '欢迎 {username} 加入我们的平台！'
    },
    PASSWORD_CHANGED: {
        title: '密码已修改',
        content: '您的账号密码已成功修改，如果这不是您的操作，请立即联系管理员。'
    },
    ACCOUNT_DISABLED: {
        title: '账号已被禁用',
        content: '您的账号已被禁用，原因：{reason}。如有疑问，请联系管理员。'
    },
    ACCOUNT_ENABLED: {
        title: '账号已启用',
        content: '您的账号已被重新启用，现在可以正常使用了。'
    },
    MAINTENANCE: {
        title: '系统维护通知',
        content: '系统将于 {startTime} 至 {endTime} 进行维护，原因：{reason}。维护期间可能无法正常使用，请提前做好准备。'
    }
};

class NotificationUtils {
    // 创建系统通知
    async createSystemNotification(userIds, title, content, relatedId = null, onModel = null) {
        try {
            // 确保 userIds 是数组
            const userIdArray = Array.isArray(userIds) ? userIds : [userIds];

            // 为每个用户创建通知
            const notifications = await Promise.all(
                userIdArray.map(userId =>
                    notificationController.createNotification(
                        userId,
                        title,
                        content,
                        'SYSTEM',
                        relatedId,
                        onModel
                    )
                )
            );

            return notifications;
        } catch (error) {
            console.error('创建系统通知失败:', error);
            throw error;
        }
    }

    // 创建用户注册成功通知
    async createUserRegisteredNotification(userId, username) {
        const template = notificationTemplates.WELCOME;
        const content = template.content.replace('{username}', username);
        return this.createSystemNotification(userId, template.title, content);
    }

    // 创建密码修改通知
    async createPasswordChangedNotification(userId) {
        const template = notificationTemplates.PASSWORD_CHANGED;
        return this.createSystemNotification(userId, template.title, template.content);
    }

    // 创建账号被禁用通知
    async createAccountDisabledNotification(userId, reason) {
        const template = notificationTemplates.ACCOUNT_DISABLED;
        const content = template.content.replace('{reason}', reason || '无');
        return this.createSystemNotification(userId, template.title, content);
    }

    // 创建账号被启用通知
    async createAccountEnabledNotification(userId) {
        const template = notificationTemplates.ACCOUNT_ENABLED;
        return this.createSystemNotification(userId, template.title, template.content);
    }

    // 创建系统维护通知
    async createMaintenanceNotification(userIds, startTime, endTime, reason) {
        const template = notificationTemplates.MAINTENANCE;
        const content = template.content
            .replace('{startTime}', startTime)
            .replace('{endTime}', endTime)
            .replace('{reason}', reason || '系统升级');
        return this.createSystemNotification(userIds, template.title, content);
    }

    // 向所有用户发送通知
    async broadcastToAllUsers(title, content) {
        try {
            // 获取所有用户ID
            const users = await User.find({}, '_id');
            const userIds = users.map(user => user._id);
            
            // 发送通知
            return this.createSystemNotification(userIds, title, content);
        } catch (error) {
            console.error('广播通知失败:', error);
            throw error;
        }
    }
}

// 导出单例
module.exports = new NotificationUtils(); 