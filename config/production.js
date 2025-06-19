module.exports = {
    // 生产环境配置
    port: process.env.PORT || 3000,
    mongoURI: process.env.MONGO_URI || 'mongodb://localhost:27017/infopublisher',
    jwtSecret: process.env.JWT_SECRET || 'your-production-secret-key',
    // 文件上传配置
    uploadDir: '/var/www/uploads',
    // 跨域配置
    corsOrigin: process.env.CORS_ORIGIN || '*',
    // 日志配置
    logLevel: 'info',
    // 安全配置
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15分钟
        max: 100 // 限制每个IP 15分钟内最多100个请求
    }
} 