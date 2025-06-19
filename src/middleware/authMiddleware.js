// 认证中间件
const jwt = require('jsonwebtoken');
const config = require('../config');

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(401).json({ success: false, message: '未提供Token' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, config.jwtSecret);
        req.user = decoded; // 将解码后的用户信息附加到req对象上
        next();
    } catch (err) {
        // Token 无效或过期
        return res.status(403).json({ success: false, message: '无效的Token' });
    }
};

module.exports = authMiddleware; 