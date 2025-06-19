const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');

// 验证JWT令牌的中间件
exports.protect = async (req, res, next) => {
    try {
        let token;

        // 从请求头中获取令牌
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        // 检查令牌是否存在
        if (!token) {
            return res.status(401).json({
                success: false,
                message: '未提供认证令牌'
            });
        }

        try {
            // 验证令牌
            const decoded = jwt.verify(token, config.jwtSecret);

            // 查找用户
            const user = await User.findById(decoded.userId).select('-password');
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: '用户不存在'
                });
            }

            // 验证设备标识
            if (user.currentDeviceId !== decoded.deviceId) {
                return res.status(401).json({
                    success: false,
                    message: '您的账号已在其他设备登录，请重新登录'
                });
            }

            // 将用户信息添加到请求对象
            req.user = user;
            req.user._id = user._id; // 确保_id存在
            req.token = token;
            next();
        } catch (error) {
            return res.status(401).json({
                success: false,
                message: '无效的认证令牌'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '服务器认证错误'
        });
    }
};

// 生成JWT令牌
exports.generateToken = (id) => {
    return jwt.sign({ id }, config.jwtSecret, {
        expiresIn: config.jwtExpiresIn
    });
};

// 验证管理员权限的中间件
exports.restrictToAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: '需要管理员权限'
        });
    }
    next();
};

// 检查用户角色
exports.checkRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: '未认证'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: '没有权限执行此操作'
            });
        }

        next();
    };
}; 