/**
 * 应用配置
 */
module.exports = {
  // JWT密钥，用于令牌签名
  jwtSecret: process.env.JWT_SECRET || 'your_jwt_secret_key',
  
  // JWT令牌过期时间
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
  
  // MongoDB连接字符串，默认绑定 infopublisher 数据库
  mongoURI: process.env.MONGO_URI || 'mongodb://localhost:27017/infopublisher',
  
  // 服务器端口
  port: process.env.PORT || 3000,
  
  // 日志级别
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // 环境
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // 默认管理员推荐码（用于创建第一个账户）
  defaultReferrerCode: process.env.DEFAULT_REFERRER_CODE || 'ADMIN8888'
}; 