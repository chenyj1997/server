const express = require('express');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
const app = express();

// 中间件
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// 路由
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const infoRoutes = require('./routes/info');
const notificationRoutes = require('./routes/notifications');
const customerServiceRoutes = require('./routes/customerService');
const transactionRoutes = require('./routes/transactionRoutes');
const adRoutes = require('./routes/adRoutes');

// 注册路由
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/info', infoRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/customer-service', customerServiceRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api', adRoutes);

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({
        success: false,
        message: '服务器内部错误',
        error: err.message
    });
});

module.exports = app; 