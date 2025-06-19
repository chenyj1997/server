// 用户管理相关路由
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const userController = require('../controllers/userController'); // 引入用户控制器
const jwt = require('jsonwebtoken'); // 引入jsonwebtoken
const config = require('../../config'); // 引入config
const { protect, restrictToAdmin } = require('../../middleware/auth');

// 认证中间件
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    console.log('authMiddleware: Authorization Header:', authHeader); // 添加日志

    if (!authHeader) {
        return res.status(401).json({ success: false, message: '未提供Token' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, config.jwtSecret); // 使用正确的密钥属性名
        req.user = decoded; // 将解码后的用户信息（包含userId等）附加到req对象上
        console.log('authMiddleware: Decoded user:', req.user); // 添加日志
        next();
    } catch (err) {
        return res.status(403).json({ success: false, message: '无效的Token' });
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

// 获取用户列表 (带分页和认证)
router.get('/list', authMiddleware, userController.getUserList); // 关联到控制器函数

// 获取用户详情
router.get('/detail/:id', authMiddleware, userController.getUserDetail); // 添加用户详情路由

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

// 获取当前登录用户的个人资料
router.get('/profile', authMiddleware, async (req, res) => {
    try {
        // 从认证中间件获取用户ID
        const userId = req.user.userId;
        
        // 根据用户ID查询数据库
        const user = await User.findById(userId).select('-password'); // 不返回密码字段
        
        if (!user) {
            // 理论上通过认证的用户ID应该能找到用户，但作为安全回退
            return res.status(404).json({ success: false, message: '用户未找到' });
        }
        
        res.json({ success: true, user });
    } catch (err) {
        console.error('获取用户个人资料错误:', err);
        res.status(500).json({ success: false, message: '获取个人资料失败', error: err.message });
    }
});

// 创建用户的路由 (添加)
router.post('/create', authMiddleware, userController.createUser); // 关联到控制器函数

// 删除用户的路由 (添加)
router.delete('/delete/:id', authMiddleware, userController.deleteUser); // 关联到控制器函数

// 重置用户密码的路由 (添加)
router.post('/reset-password/:id', authMiddleware, userController.resetUserPassword); // 关联到控制器函数

module.exports = router; 