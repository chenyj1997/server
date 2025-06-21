// 用户认证相关路由
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');

// 用户注册接口
router.post('/register', async (req, res) => {
    try {
        const { username, password, email, phone } = req.body;
        // 检查用户名是否已存在
        const exist = await User.findOne({ username });
        if (exist) return res.status(400).json({ success: false, message: '用户名已存在' });
        // 密码加密
        const hash = await bcrypt.hash(password, 10);
        const user = new User({ username, password: hash, email, phone });
        await user.save();
        res.json({ success: true, message: '注册成功' });
    } catch (err) {
        res.status(500).json({ success: false, message: '注册失败', error: err.message });
    }
});

// 检查用户是否存在接口 (临时用于调试)
// router.get('/check-user/:username', async (req, res) => {
//     try {
// ... existing code ...
//     }
// });

// 用户登录接口
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // 添加日志：打印接收到的用户名和密码
        console.log('收到登录请求，用户名:', username, '密码:', password);

        // 查询时直接lean返回全部字段，避免select遗漏inviteCode
        const user = await User.findOne({ username }).lean();
        
        // 添加日志：打印用户查找结果
        console.log('用户查找结果:', user ? '找到用户' + user.username : '未找到用户');

        if (!user) return res.status(400).json({ success: false, message: '用户不存在' });
        
        const valid = await bcrypt.compare(password, user.password);

        // 添加日志：打印密码比对结果
        console.log('密码比对结果:', valid);

        if (!valid) return res.status(400).json({ success: false, message: '密码错误' });

        // 添加日志：打印即将用于生成token的用户信息（不含密码）
        console.log('即将用于生成token的用户信息:', { userId: user._id, roles: user.roles });

        // 生成JWT
        const token = jwt.sign({ userId: user._id, roles: user.roles }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

        // 返回前打印user对象内容，便于调试
        console.log('user对象内容:', user);

        // 返回完整user信息
        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                username: user.username,
                role: user.role || (user.roles && user.roles[0]) || '',
                email: user.email,
                phone: user.phone,
                inviteCode: user.inviteCode || ''
            }
        });
    } catch (err) {
        console.error('登录接口错误:', err);
        res.status(500).json({ success: false, message: '登录失败', error: err.message });
    }
});

module.exports = router; 
