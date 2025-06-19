// server/src/controllers/userController.js

// 用户控制器文件，包含处理用户相关请求的函数 
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const jwt = require('jsonwebtoken');
const config = require('../../config');

// 获取用户列表
exports.getUserList = async (req, res) => {
    try {
        console.log('后端：正在获取用户列表...'); // 添加日志
        const { page = 1, limit = 10, search, role, status } = req.query;
        const query = {};

        // 添加搜索条件
        if (search) {
            query.$or = [
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }

        // 添加角色筛选
        if (role) {
            query.roles = role;
        }

        // 添加状态筛选
        if (status) {
            query.status = status;
        }

        const options = {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            sort: { createdAt: -1 }, // 按创建时间降序排序
            select: '-password' // 不返回密码字段
        };

        // 使用 mongoose-paginate-v2 插件进行分页查询
        const users = await User.paginate(query, options);

        console.log('后端：获取用户列表成功，返回数据:', users); // 添加日志
        res.status(200).json({
            code: 0,
            message: '获取用户列表成功',
            list: users.docs, // 分页查询结果在 docs 字段中
            total: users.totalDocs,
            page: users.page,
            limit: users.limit
        });
    } catch (error) {
        console.error('后端：获取用户列表失败:', error); // 添加错误日志
        res.status(500).json({
            code: 1,
            message: '获取用户列表失败', // 返回错误信息给前端
            error: error.message // 包含详细错误信息
        });
    }
};

// 获取用户详情
exports.getUserDetail = async (req, res) => {
    try {
        console.log('后端：正在获取用户详情...', req.params.id); // 添加日志
        const user = await User.findById(req.params.id).select('-password');
        
        if (!user) {
            console.log('后端：用户不存在'); // 添加日志
            return res.status(404).json({
                code: 1,
                message: '用户不存在'
            });
        }

        console.log('后端：获取用户详情成功:', user); // 添加日志
        res.status(200).json({
            code: 0,
            message: '获取用户详情成功',
            user: user
        });
    } catch (error) {
        console.error('后端：获取用户详情失败:', error); // 添加错误日志
        res.status(500).json({
            code: 1,
            message: '获取用户详情失败',
            error: error.message
        });
    }
};

// 生成8位随机数ID
function generateUserId() {
    // 生成8位随机数
    const randomNum = Math.floor(10000000 + Math.random() * 90000000);
    return randomNum.toString();
}

// 生成随机密码
function generateRandomPassword(length = 8) {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        password += charset[randomIndex];
    }
    return password;
}

// 创建用户
exports.createUser = async (req, res) => {
    try {
        console.log('创建用户请求:', req.body);
        const { username, password, email, phone } = req.body;

        // 检查用户名是否已存在
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: '用户名已存在' });
        }

        // 生成8位随机ID
        const userId = generateUserId();
        
        // 检查ID是否已存在
        const existingId = await User.findOne({ _id: userId });
        if (existingId) {
            // 如果ID已存在，递归生成新ID
            return createUser(req, res);
        }

        // 创建新用户
        const user = new User({
            _id: userId,
            username,
            password,
            email,
            phone,
            roles: ['user'],
            status: 'active',
            balance: 0
        });

        await user.save();
        console.log('用户创建成功:', user);
        res.status(201).json({ message: '用户创建成功', user });
    } catch (error) {
        console.error('创建用户失败:', error);
        res.status(500).json({ message: '创建用户失败', error: error.message });
    }
};

// 删除用户
exports.deleteUser = async (req, res) => {
    try {
        console.log('后端：正在删除用户...', req.params.id); // 添加日志
        const user = await User.findByIdAndDelete(req.params.id);

        if (!user) {
            console.log('后端：删除失败，用户不存在'); // 添加日志
            return res.status(404).json({ code: 1, message: '用户不存在' });
        }

        console.log('后端：用户删除成功:', user);
        res.status(200).json({ code: 0, message: '用户删除成功' });

    } catch (error) {
        console.error('后端：删除用户失败:', error); // 添加错误日志
        res.status(500).json({ code: 1, message: '删除用户失败', error: error.message });
    }
};

// 重置用户密码
exports.resetUserPassword = async (req, res) => {
    try {
        console.log('后端：正在重置用户密码...', req.params.id); // 添加日志
        const userId = req.params.id;

        const user = await User.findById(userId);

        if (!user) {
            console.log('后端：重置密码失败，用户不存在'); // 添加日志
            return res.status(404).json({ code: 1, message: '用户不存在' });
        }

        // 生成新密码
        const newPassword = generateRandomPassword(10); // 生成一个10位的随机密码
        console.log('后端：为用户', userId, '生成新密码 (仅用于调试): ', newPassword); // **注意：实际生产环境不应打印密码！**

        // 哈希新密码
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // 更新用户密码
        user.password = hashedPassword;
        await user.save();

        console.log('后端：用户密码重置成功:', userId);
        // 实际应用中，你可能需要将新密码通过安全的方式通知用户 (如邮件)
        // 这里仅返回成功消息，前端会收到通知
        res.status(200).json({ code: 0, message: '用户密码重置成功' });

    } catch (error) {
        console.error('后端：重置用户密码失败:', error); // 添加错误日志
        res.status(500).json({ code: 1, message: '重置用户密码失败', error: error.message });
    }
};

// TODO: 实现更新用户和重置密码功能 