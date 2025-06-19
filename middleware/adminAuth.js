const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');

module.exports = async (req, res, next) => {
    try {
        // 从请求头获取token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: '未提供认证令牌'
            });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({
                success: false,
                message: '未提供认证令牌'
            });
        }

        // 验证token
        const decoded = jwt.verify(token, config.jwtSecret);
        
        // 查找用户
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: '用户不存在'
            });
        }

        // 检查用户是否是管理员
        if (user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: '需要管理员权限'
            });
        }

        // 将用户信息添加到请求对象
        req.user = user;
        next();
    } catch (error) {
        console.error('管理员认证失败:', error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: '无效的认证令牌'
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: '认证令牌已过期'
            });
        }
        res.status(500).json({
            success: false,
            message: '服务器认证错误'
        });
    }
}; 