const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const crypto = require('crypto');

// 测试路由
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Auth 路由正常工作',
        time: new Date().toISOString()
    });
});

// 用户注册
router.post('/register', async (req, res) => {
    try {
        const { username, password, email, phone, referrerCode } = req.body;

        // 验证必填字段
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: '用户名和密码不能为空'
            });
        }

        // 检查用户名是否已存在
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: '用户名已存在'
            });
        }

        // 检查邮箱是否已存在
        if (email) {
            const existingEmail = await User.findOne({ email });
            if (existingEmail) {
                return res.status(400).json({
                    success: false,
                    message: '邮箱已被注册'
                });
            }
        }

        // 检查手机号是否已存在
        if (phone) {
            const existingPhone = await User.findOne({ phone });
            if (existingPhone) {
                return res.status(400).json({
                    success: false,
                    message: '手机号已被注册'
                });
            }
        }

        // 校验邀请码
        if (!referrerCode) {
            return res.status(400).json({
                success: false,
                message: '邀请码不能为空'
            });
        }

        // 查找推荐人
        const referrerUser = await User.findOne({ inviteCode: referrerCode });

        if (!referrerUser) {
            return res.status(400).json({
                success: false,
                message: '邀请码无效，请输入有效的邀请码'
            });
        }

        // 创建新用户
        const user = new User({
            username,
            password, // 密码会在保存前自动加密
            email,
            phone,
            referrer: referrerUser._id,
            role: 'user'
        });

        // 保存用户
        await user.save();

        // 生成 JWT token
        const payload = { id: user._id, role: user.role };
        
        const token = jwt.sign(
            payload,
            config.jwtSecret,
            { expiresIn: config.jwtExpiresIn }
        );

        // 准备响应数据
        const responseData = {
            success: true,
            message: '注册成功',
            token,
            user: {
                id: user._id,
                username: user.username,
                role: user.role,
                email: user.email,
                phone: user.phone,
                inviteCode: user.inviteCode
            }
        };
        
        res.json(responseData);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '注册失败',
            error: error.message
        });
    }
});

// 用户登录
router.post('/login', async (req, res) => {
    try {
        const { username, password, forceLogout } = req.body;
        
        // DEBUG: 打印接收到的用户名和密码 - 临时日志，请勿用于生产环境！
        console.log('[DEBUG] 收到登录请求，用户名:', username, '密码:', password);

        // 查询时直接lean返回全部字段，避免select遗漏inviteCode
        const user = await User.findOne({ username }).lean();
        
        // DEBUG: 打印用户查找结果 - 临时日志
        console.log('[DEBUG] 用户查找结果:', user ? '找到用户' + user.username : '未找到用户');

        if (!user) return res.status(400).json({ success: false, message: '用户不存在' });
        
        // DEBUG: 打印数据库中存储的哈希密码和即将比较的明文密码 - 临时日志，极度敏感，严禁用于生产环境！
        console.log('[DEBUG] 数据库中哈希密码:', user.password);
        console.log('[DEBUG] 待比较明文密码:', password);

        const valid = await bcrypt.compare(password, user.password);

        // DEBUG: 打印密码比对结果 - 临时日志
        console.log('[DEBUG] 密码比对结果:', valid);

        if (!valid) return res.status(400).json({ success: false, message: '密码错误' });

        // 生成设备标识
        const deviceId = crypto.randomBytes(32).toString('hex');
        const userAgent = req.headers['user-agent'];
        const ipAddress = req.ip || req.connection.remoteAddress;

        // 检查用户是否在其他设备登录
        if (user.currentDeviceId && user.currentDeviceId !== deviceId) {
            if (!forceLogout) {
                return res.status(403).json({
                    success: false,
                    message: '您的账号已在其他设备登录，请先退出其他设备的登录',
                    code: 'DEVICE_CONFLICT',
                    currentDevice: {
                        deviceId: user.currentDeviceId,
                        lastLoginAt: user.lastLoginAt
                    }
                });
            }
            // 如果选择强制登出，继续执行
        }

        // 更新用户设备信息
        await User.findByIdAndUpdate(user._id, {
            currentDeviceId: deviceId,
            lastLoginAt: new Date(),
            $push: {
                deviceHistory: {
                    deviceId,
                    lastLoginAt: new Date(),
                    userAgent,
                    ipAddress
                }
            }
        });

        // 生成JWT
        const token = jwt.sign(
            { 
                userId: user._id, 
                role: user.role,
                deviceId // 将设备标识加入token
            }, 
            config.jwtSecret, 
            { expiresIn: config.jwtExpiresIn }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                username: user.username,
                role: user.role,
                email: user.email,
                phone: user.phone,
                inviteCode: user.inviteCode
            }
        });
    } catch (error) {
        console.error('登录失败:', error.message);
        res.status(500).json({ success: false, message: '登录失败' });
    }
});

// 用户登出
router.post('/logout', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({
                success: false,
                message: '未提供认证令牌'
            });
        }

        // 验证令牌
        const decoded = jwt.verify(token, config.jwtSecret);
        
        // 清除用户的设备标识
        await User.findByIdAndUpdate(decoded.userId, {
            currentDeviceId: null
        });

        res.json({
            success: true,
            message: '登出成功'
        });
    } catch (error) {
        console.error('登出失败:', error.message);
        res.status(500).json({ success: false, message: '登出失败' });
    }
});

module.exports = router; 
