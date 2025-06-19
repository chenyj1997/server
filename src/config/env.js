// 环境配置文件
const path = require('path');
const dotenv = require('dotenv');

// 根据环境加载不同的.env文件
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
dotenv.config({ path: path.join(__dirname, '../../', envFile) });

// 环境变量配置
module.exports = {
    // 服务器环境
    NODE_ENV: process.env.NODE_ENV || 'development',
    
    // 数据库配置
    MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/infopublisher',
    
    // JWT配置
    JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    
    // 日志配置
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    LOG_FILE: process.env.LOG_FILE || 'app.log',
    
    // 文件上传配置
    UPLOAD_DIR: process.env.UPLOAD_DIR || 'public/uploads',
    MAX_FILE_SIZE: process.env.MAX_FILE_SIZE || '50mb',
    
    // 安全配置
    RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS || '900000', // 15分钟
    RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX || '100'
}; 