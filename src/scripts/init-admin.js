// 初始化管理员用户脚本
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const config = require('../config');

async function initAdmin() {
    try {
        // 连接数据库
        console.log('正在连接数据库...');
        await mongoose.connect(config.mongoURI);
        console.log('数据库连接成功！');

        // 检查是否已存在管理员用户
        const adminExists = await User.findOne({ username: 'admin' });
        if (adminExists) {
            console.log('管理员用户已存在，跳过创建');
            return;
        }

        // 创建管理员用户
        const adminPassword = await bcrypt.hash('admin123', 10);
        const admin = new User({
            username: 'admin',
            password: adminPassword,
            email: 'admin@example.com',
            roles: ['admin', 'user'],
            status: 'active'
        });

        await admin.save();
        console.log('管理员用户创建成功！');
    } catch (error) {
        console.error('初始化管理员用户失败:', error);
    } finally {
        // 关闭数据库连接
        await mongoose.connection.close();
        console.log('数据库连接已关闭');
    }
}

// 执行初始化
initAdmin(); 