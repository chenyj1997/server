console.log(`[${new Date().toISOString()}] DEBUG: server/routes/users.js 文件正在加载...`);
// 用户管理相关路由
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const bcrypt = require('bcryptjs');
const BalanceLog = require('../models/BalanceLog');

// 用户控制器函数
const userController = {
    // 获取用户列表
    getUserList: async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;

            const total = await User.countDocuments();
            const users = await User.find().select('-password').skip(skip).limit(limit);

            res.json({
                success: true,
                list: users,
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            });
        } catch (error) {
            console.error('获取用户列表错误:', error);
            res.status(500).json({
                success: false,
                message: '获取用户列表失败'
            });
        }
    },

    // 获取用户详情
    getUserDetail: async (req, res) => {
        try {
            const user = await User.findById(req.params.id)
                                .select('username numericId email phone balance createdAt inviteCode referrer lastLoginAt updatedAt hasPayPassword payPasswordLockUntil')
                                .populate('referrer', 'username');
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: '用户不存在'
                });
            }

            console.log(`[${new Date().toISOString()}] DEBUG: User ID from users.js: ${req.params.id}`);
            console.log(`[${new Date().toISOString()}] DEBUG: hasPayPassword from users.js: ${user.hasPayPassword}`);
            console.log(`[${new Date().toISOString()}] DEBUG: payPasswordLockUntil from users.js: ${user.payPasswordLockUntil}`);

            // 计算支付密码状态
            let paymentPasswordStatus = '未设置';
            if (user.hasPayPassword) {
                paymentPasswordStatus = '已设置';
                const now = new Date();
                console.log(`[${new Date().toISOString()}] DEBUG: Current Date: ${now}`);
                console.log(`[${new Date().toISOString()}] DEBUG: Comparing payPasswordLockUntil (${user.payPasswordLockUntil}) with Current Date (${now})`);
                if (user.payPasswordLockUntil && user.payPasswordLockUntil > now) {
                    paymentPasswordStatus = '已锁定';
                }
            }

            // 返回用户数据，包含支付密码状态
            const userData = user.toObject();
            userData.paymentPasswordStatus = paymentPasswordStatus;
            
            res.json({
                success: true,
                data: userData
            });
        } catch (error) {
            console.error('获取用户详情错误:', error);
            res.status(500).json({
                success: false,
                message: '获取用户详情失败'
            });
        }
    },

    // 更新用户状态
    updateUserStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { status } = req.body;
            
            // 验证状态值
            if (status !== 'active' && status !== 'disabled') {
                return res.status(400).json({
                    success: false,
                    message: '无效的状态值，必须是active或disabled'
                });
            }
            
            // 更新用户状态
            const user = await User.findByIdAndUpdate(
                id,
                { status: status },
                { new: true }
            ).select('-password');
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: '用户不存在'
                });
            }
            
            res.json({
                success: true,
                message: '用户状态已更新',
                data: user
            });
        } catch (error) {
            console.error('更新用户状态错误:', error);
            res.status(500).json({
                success: false,
                message: '更新用户状态失败'
            });
        }
    },

    // 创建用户
    createUser: async (req, res) => {
        try {
            console.log('创建用户请求:', req.body);
            const { username, password, email, phone } = req.body;

            // 检查用户名是否已存在
            const existingUser = await User.findOne({ username });
            if (existingUser) {
                return res.status(400).json({ 
                    success: false,
                    message: '用户名已存在' 
                });
            }

            // 密码加密
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // 创建新用户
            const user = new User({
                username,
                password: hashedPassword,
                email,
                phone,
                role: 'user', // 默认为普通用户
                status: 'active',
                balance: 0
            });

            await user.save();
            console.log('用户创建成功:', user);
            
            // 不返回密码字段
            const userResponse = user.toObject();
            delete userResponse.password;
            
            res.status(201).json({ 
                success: true,
                message: '用户创建成功', 
                user: userResponse 
            });
        } catch (error) {
            console.error('创建用户失败:', error);
            res.status(500).json({ 
                success: false,
                message: '创建用户失败', 
                error: error.message 
            });
        }
    },

    // 删除用户
    deleteUser: async (req, res) => {
        try {
            const user = await User.findByIdAndDelete(req.params.id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: '用户不存在'
                });
            }

            res.json({
                success: true,
                message: '用户删除成功'
            });
        } catch (error) {
            console.error('删除用户错误:', error);
            res.status(500).json({
                success: false,
                message: '删除用户失败'
            });
        }
    },

    // 重置用户密码
    resetUserPassword: async (req, res) => {
        try {
            const { newPassword } = req.body;
            if (!newPassword) {
                return res.status(400).json({
                    success: false,
                    message: '新密码不能为空'
                });
            }

            // 密码加密
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            const user = await User.findByIdAndUpdate(
                req.params.id,
                { password: hashedPassword },
                { new: true }
            ).select('-password');

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: '用户不存在'
                });
            }

            res.json({
                success: true,
                message: '密码重置成功',
                user
            });
        } catch (error) {
            console.error('重置密码错误:', error);
            res.status(500).json({
                success: false,
                message: '重置密码失败'
            });
        }
    },

    // 获取用户资金变动记录
    getBalanceLogs: async (req, res) => {
        try {
            const { userId } = req.params;
            const { page = 1, limit = 10, type } = req.query;

            // 构建查询条件
            const query = { user: userId };
            if (type) {
                query.type = type;
            }

            // 查询资金变动记录
            const logs = await BalanceLog.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(parseInt(limit))
                .populate('operator', 'username')
                .populate('transaction');

            // 获取总记录数
            const total = await BalanceLog.countDocuments(query);

            res.json({
                success: true,
                data: {
                    logs,
                    pagination: {
                        total,
                        page: parseInt(page),
                        limit: parseInt(limit),
                        pages: Math.ceil(total / limit)
                    }
                }
            });
        } catch (error) {
            console.error('获取资金变动记录失败:', error);
            res.status(500).json({
                success: false,
                message: '获取资金变动记录失败',
                error: error.message
            });
        }
    },

    // 获取邀请用户列表
    getInvitedUsers: async (req, res) => {
        try {
            console.log(`[${new Date().toISOString()}] DEBUG: 尝试获取用户邀请列表...`);
            // req.user._id 应该由 protect 中间件提供
            const currentUserId = req.user._id;

            if (!currentUserId) {
                console.warn(`[${new Date().toISOString()}] DEBUG: req.user._id 不存在，无法获取邀请用户。`);
                return res.status(401).json({
                    success: false,
                    message: '未授权：无法识别用户身份'
                });
    }

            console.log(`[${new Date().toISOString()}] DEBUG: 查询用户 ${currentUserId} 邀请的用户...`);
            const invitedUsers = await User.find({ referrer: currentUserId }).select('-password');
            console.log(`[${new Date().toISOString()}] DEBUG: 找到 ${invitedUsers.length} 个邀请用户。`);

            res.json({
                success: true,
                message: '成功获取邀请用户列表',
                invitedUsers: invitedUsers // 返回 invitedUsers 数组
            });
        } catch (error) {
            console.error(`[${new Date().toISOString()}] 获取邀请用户列表错误:`, error);
            if (error.stack) {
                console.error(`[${new Date().toISOString()}] DEBUG: 错误堆栈:`, error.stack);
            }
            res.status(500).json({
                success: false,
                message: '获取邀请用户列表失败',
                error: error.message
            });
        }
    }
};

// 获取所有用户列表（仅管理员可用，实际项目应加权限校验）
router.get('/', async (req, res) => {
    try {
        const users = await User.find().select('-password'); // 不返回密码字段
        res.json({ success: true, users });
    } catch (err) {
        res.status(500).json({ success: false, message: '获取用户列表失败', error: err.message });
    }
});

// 获取用户列表 (带分页)
router.get('/list', userController.getUserList);

// 获取邀请用户列表
router.get('/invited-users', userController.getInvitedUsers);

// 获取用户详情
router.get('/detail/:id', userController.getUserDetail);

// 获取单个用户信息
router.get('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, message: '获取用户信息失败', error: err.message });
    }
});

// 创建用户
router.post('/create', userController.createUser);

// 删除用户
router.delete('/delete/:id', userController.deleteUser);

// 重置用户密码
router.post('/reset-password/:id', userController.resetUserPassword);

// 更新用户状态
router.put('/status/:id', userController.updateUserStatus);

// 获取用户资金变动记录
router.get('/balance-logs/:userId', userController.getBalanceLogs);

console.log(`[${new Date().toISOString()}] DEBUG: users.js - 定义 /invited-users 路由。`);
console.log(`[${new Date().toISOString()}] DEBUG: server/routes/users.js 文件加载并路由定义完毕。`);

module.exports = router; 