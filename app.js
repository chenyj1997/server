/**
 * 永鑫资本系统 - Node.js后端
 * 提供API服务，支持永鑫资本、用户管理和钱包功能
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const mongoose = require('mongoose');
const compression = require('compression');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const http = require('http');
const Info = require('./models/Info');
const User = require('./models/User');
const Transaction = require('./models/Transaction');
const cron = require('node-cron');
const { scheduleAutoRepayments, executeAutoRepayments } = require('./utils/autoRepaymentTasks');

// 导入路由
const authRoutes = require('./routes/auth');
const infoRoutes = require('./routes/info');
const walletRoutes = require('./routes/wallet');
const rechargeRoutes = require('./routes/recharge');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const rechargePathsRoutes = require('./routes/rechargePathsRoutes');
const userRouter = require('./routes/user');
const transactionRoutes = require('./src/routes/transactionRoutes');
const systemRoutes = require('./routes/systemRoutes');
const customerServiceRoutes = require('./routes/customerService');
const userRoutes = require('./routes/users');
const uploadRoutes = require('./routes/upload');

// 导入中间件
const adminAuth = require('./middleware/adminAuth');
const { protect } = require('./middleware/auth');

// 创建Express应用
const app = express();

// 配置 CORS
app.use(cors({
    origin: [
        'http://localhost:3000',
        'https://fw108ck86325.vicp.fun',
        'https://your-domain.com',
        'https://node-2kvt.onrender.com' // 允许Render前端服务访问
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
}));

// ========================

// 连接MongoDB数据库
mongoose.connect(config.mongoURI, {
    socketTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    serverSelectionTimeoutMS: 30000,
    heartbeatFrequencyMS: 10000,
    useNewUrlParser: true,
    useUnifiedTopology: true,
    retryWrites: true,
    w: 'majority'
})
.then(() => {
    console.log(`[${new Date().toISOString()}] 成功连接到MongoDB数据库`);
})
.catch(err => {
    console.error(`[${new Date().toISOString()}] 数据库连接失败:`, err);
    // 尝试连接本地数据库
    console.log(`[${new Date().toISOString()}] 尝试连接本地数据库...`);
    mongoose.connect('mongodb://localhost:27017/infopublisher', {
        socketTimeoutMS: 30000,
        connectTimeoutMS: 30000,
        serverSelectionTimeoutMS: 30000,
        heartbeatFrequencyMS: 10000,
        useNewUrlParser: true,
        useUnifiedTopology: true,
        retryWrites: true,
        w: 'majority'
    })
    .then(() => {
        console.log(`[${new Date().toISOString()}] 已成功连接本地数据库`);
    })
    .catch(e => console.error(`[${new Date().toISOString()}] 两次连接尝试均失败:`, e));
});

// 新增：设置定时自动还款任务
// 检查任务：每小时执行一次，检查是否有符合条件的信息需要安排自动还款
cron.schedule('0 * * * *', async () => {
    try {
        console.log(`[CRON_SCHEDULE] 开始执行自动还款检查任务 - ${new Date().toISOString()}`);
        await scheduleAutoRepayments();
        console.log(`[CRON_SCHEDULE] 自动还款检查任务完成 - ${new Date().toISOString()}`);
    } catch (error) {
        console.error(`[CRON_SCHEDULE] 自动还款检查任务失败:`, error);
    }
});

// 还款任务：每10分钟执行一次，从已安排的还款任务中取出一个执行
cron.schedule('*/10 * * * *', async () => {
    try {
        console.log(`[CRON_EXECUTE] 开始执行自动还款任务 - ${new Date().toISOString()}`);
        await executeAutoRepayments();
        console.log(`[CRON_EXECUTE] 自动还款任务完成 - ${new Date().toISOString()}`);
    } catch (error) {
        console.error(`[CRON_EXECUTE] 自动还款任务失败:`, error);
    }
});

// 自动修正所有历史数据的 loanAmount 字段（只执行一次即可，生产环境建议注释掉）
/*
(async () => {
    const infos = await Info.find();
    for (const info of infos) {
        const match = info.content && info.content.match(/借款[:：]\s*(\d+(?:\.\d+)?)/);
        const newAmount = match ? parseFloat(match[1]) : 0;
        if (info.loanAmount !== newAmount) {
            info.loanAmount = newAmount;
            await info.save();
        }
    }
    // 只需修正一次，修正后可注释掉本段代码
})();
*/


app.use(morgan('dev'));
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginIsolation: false,
    referrerPolicy: { policy: 'no-referrer-when-downgrade' }
}));
app.use(compression());

// 确保 bodyParser 在所有路由之前
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));



// 创建必要的目录
const publicDir = path.join(__dirname, 'public');
const uploadsDir = path.join(publicDir, 'uploads');
const imagesDir = path.join(uploadsDir, 'images');
const proofsDir = path.join(uploadsDir, 'proofs');
const iconsDir = path.join(uploadsDir, 'icons');
const qrcodesDir = path.join(uploadsDir, 'qrcodes');
const infoDir = path.join(uploadsDir, 'info');
const defaultImagesDir = path.join(publicDir, 'images');

// 确保所有必要的目录都存在
[publicDir, uploadsDir, imagesDir, proofsDir, iconsDir, qrcodesDir, infoDir, defaultImagesDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// 复制默认图片到正确的位置
const defaultIconPath = path.join(defaultImagesDir, 'default-icon.png');
const defaultPlaceholderPath = path.join(defaultImagesDir, 'placeholder.jpg');

// 创建默认图标
if (!fs.existsSync(defaultIconPath)) {
    const defaultIcon = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/4QAiRXhpZgAATU0AKgAAAAgAAQESAAMAAAABAAEAAAAAAAD/2wBDAAIBAQIBAQICAgICAgICAwUDAwMDAwYEBAMFBwYHBwcGBwcICQsJCAgKCAcHCg0KCgsMDAwMBwkODw0MDgsMDAz/2wBDAQICAgMDAwYDAwYMCAcIDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAz/wAARCAAyADIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD//2Q==', 'base64');
    fs.writeFileSync(defaultIconPath, defaultIcon);
}

// 创建默认占位图
if (!fs.existsSync(defaultPlaceholderPath)) {
    const defaultPlaceholder = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/4QAiRXhpZgAATU0AKgAAAAgAAQESAAMAAAABAAEAAAAAAAD/2wBDAAIBAQIBAQICAgICAgICAwUDAwMDAwYEBAMFBwYHBwcGBwcICQsJCAgKCAcHCg0KCgsMDAwMBwkODw0MDgsMDAz/2wBDAQICAgMDAwYDAwYMCAcIDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAz/wAARCAAyADIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD//2Q==', 'base64');
    fs.writeFileSync(defaultPlaceholderPath, defaultPlaceholder);
}

// 创建默认支付宝图标和二维码
const defaultAlipayIconPath = path.join(defaultImagesDir, 'default-alipay.png');
const defaultAlipayQrPath = path.join(defaultImagesDir, 'default-alipay-qr.png');

if (!fs.existsSync(defaultAlipayIconPath)) {
    const alipayIcon = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/4QAiRXhpZgAATU0AKgAAAAgAAQESAAMAAAABAAEAAAAAAAD/2wBDAAIBAQIBAQICAgICAgICAwUDAwMDAwYEBAMFBwYHBwcGBwcICQsJCAgKCAcHCg0KCgsMDAwMBwkODw0MDgsMDAz/2wBDAQICAgMDAwYDAwYMCAcIDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAz/wAARCAAyADIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD//2Q==', 'base64');
    fs.writeFileSync(defaultAlipayIconPath, alipayIcon);
}

if (!fs.existsSync(defaultAlipayQrPath)) {
    const alipayQr = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/4QAiRXhpZgAATU0AKgAAAAgAAQESAAMAAAABAAEAAAAAAAD/2wBDAAIBAQIBAQICAgICAgICAwUDAwMDAwYEBAMFBwYHBwcGBwcICQsJCAgKCAcHCg0KCgsMDAwMBwkODw0MDgsMDAz/2wBDAQICAgMDAwYDAwYMCAcIDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAz/wAARCAAyADIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD//2Q==', 'base64');
    fs.writeFileSync(defaultAlipayQrPath, alipayQr);
}

// 创建默认微信支付图标和二维码
const defaultWechatIconPath = path.join(defaultImagesDir, 'default-wechat.png');
const defaultWechatQrPath = path.join(defaultImagesDir, 'default-wechat-qr.png');

if (!fs.existsSync(defaultWechatIconPath)) {
    const wechatIcon = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/4QAiRXhpZgAATU0AKgAAAAgAAQESAAMAAAABAAEAAAAAAAD/2wBDAAIBAQIBAQICAgICAgICAwUDAwMDAwYEBAMFBwYHBwcGBwcICQsJCAgKCAcHCg0KCgsMDAwMBwkODw0MDgsMDAz/2wBDAQICAgMDAwYDAwYMCAcIDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAz/wAARCAAyADIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD//2Q==', 'base64');
    fs.writeFileSync(defaultWechatIconPath, wechatIcon);
}

if (!fs.existsSync(defaultWechatQrPath)) {
    const wechatQr = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/4QAiRXhpZgAATU0AKgAAAAgAAQESAAMAAAABAAEAAAAAAAD/2wBDAAIBAQIBAQICAgICAgICAwUDAwMDAwYEBAMFBwYHBwcGBwcICQsJCAgKCAcHCg0KCgsMDAwMBwkODw0MDgsMDAz/2wBDAQICAgMDAwYDAwYMCAcIDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAz/wAARCAAyADIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD//2Q==', 'base64');
    fs.writeFileSync(defaultWechatQrPath, wechatQr);
}

// 确保收款码的默认图片从images目录复制到uploads目录
const uploadsAlipayQrPath = path.join(qrcodesDir, 'default-alipay-qr.png');
const uploadsWechatQrPath = path.join(qrcodesDir, 'default-wechat-qr.png');
const uploadsAlipayIconPath = path.join(iconsDir, 'default-alipay.png');
const uploadsWechatIconPath = path.join(iconsDir, 'default-wechat.png');

// 复制支付宝二维码
if (!fs.existsSync(uploadsAlipayQrPath) && fs.existsSync(defaultAlipayQrPath)) {
    fs.copyFileSync(defaultAlipayQrPath, uploadsAlipayQrPath);
}

// 复制微信二维码
if (!fs.existsSync(uploadsWechatQrPath) && fs.existsSync(defaultWechatQrPath)) {
    fs.copyFileSync(defaultWechatQrPath, uploadsWechatQrPath);
}

// 复制支付宝图标
if (!fs.existsSync(uploadsAlipayIconPath) && fs.existsSync(defaultAlipayIconPath)) {
    fs.copyFileSync(defaultAlipayIconPath, uploadsAlipayIconPath);
}

// 复制微信图标
if (!fs.existsSync(uploadsWechatIconPath) && fs.existsSync(defaultWechatIconPath)) {
    fs.copyFileSync(defaultWechatIconPath, uploadsWechatIconPath);
}

// 直接强制创建默认图片文件
function forceCreateDefaultImages() {
  
  // 定义目录
  const publicDir = path.join(__dirname, 'public');
  const iconsDir = path.join(publicDir, 'uploads', 'icons');
  const qrcodesDir = path.join(publicDir, 'uploads', 'qrcodes');
  
  // 确保目录存在
  [iconsDir, qrcodesDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // 创建默认图片数据
  const imageData = Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/4QAiRXhpZgAATU0AKgAAAAgAAQESAAMAAAABAAEAAAAAAAD/2wBDAAIBAQIBAQICAgICAgICAwUDAwMDAwYEBAMFBwYHBwcGBwcICQsJCAgKCAcHCg0KCgsMDAwMBwkODw0MDgsMDAz/2wBDAQICAgMDAwYDAwYMCAcIDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAz/wAARCAAyADIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD//2Q==',
    'base64'
  );
  
  // 创建所有默认图片
  const files = [
    { path: path.join(iconsDir, 'default-alipay.png') },
    { path: path.join(iconsDir, 'default-wechat.png') },
    { path: path.join(qrcodesDir, 'default-alipay-qr.png') },
    { path: path.join(qrcodesDir, 'default-wechat-qr.png') }
  ];
  
  files.forEach(file => {
    try {
      // 强制写入文件，覆盖已存在的
      fs.writeFileSync(file.path, imageData);
      const stats = fs.statSync(file.path);
    } catch (err) {
    }
  });
  
  // 检查文件是否真的存在
  files.forEach(file => {
    const exists = fs.existsSync(file.path);
  });
  
}

// 在应用启动前调用强制创建默认图片
forceCreateDefaultImages();

// 6. 静态文件服务
// 为管理员界面添加静态文件服务
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));

// 设置正确的 MIME 类型
app.use('/css', express.static(path.join(__dirname, 'public/css'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
    }
}));

app.use('/uploads/info', express.static(path.join(__dirname, 'public', 'uploads', 'info')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/static', express.static(path.join(__dirname, 'public/static')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/vendor', express.static(path.join(__dirname, 'public/vendor')));

// 首先处理API请求
app.use('/api/auth', authRoutes);
app.use('/api/info', protect, infoRoutes);
app.use('/api/wallet', protect, walletRoutes);
app.use('/api/recharge', rechargeRoutes);
app.use('/api/notifications', protect, notificationRoutes);
app.use('/api/admin', adminAuth, adminRoutes);
app.use('/api/recharge-paths', protect, rechargePathsRoutes);
app.use('/api/transactions', protect, transactionRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/user', protect, userRouter);
app.use('/api/customer-service', customerServiceRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);

// 处理所有其他请求
app.get('*', (req, res, next) => {
    // 如果是API请求，返回404
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            success: false,
            message: 'API endpoint not found'
        });
    }
    
    // 如果是静态资源请求，继续处理
    if (req.path.startsWith('/static/') || 
        req.path.startsWith('/uploads/') || 
        req.path.startsWith('/images/') ||
        req.path.startsWith('/css/') ||
        req.path.startsWith('/js/') ||
        req.path.startsWith('/vendor/')) {
        return next();
    }

    // 检查是否是管理员页面请求
    if (req.path.startsWith('/admin/')) {
        const adminFile = path.join(__dirname, 'public', 'admin', 'index.html');
        if (fs.existsSync(adminFile)) {
            return res.sendFile(adminFile);
        }
    }

    // 检查请求的路径是否对应 public 目录下的 HTML 文件
    const requestedFile = path.join(__dirname, 'public', req.path);
    if (fs.existsSync(requestedFile) && requestedFile.endsWith('.html')) {
        return res.sendFile(requestedFile);
    }
    
    // 所有其他请求都返回前端应用
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error(`[${new Date().toISOString()}] 错误:`, err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || '服务器内部错误'
    });
});

// 创建HTTP服务器实例
const server = http.createServer(app);

// 设置服务器端口 - 本地测试使用3030
const PORT = process.env.PORT || 3030;

// 启动本地测试服务器
server.listen(PORT, () => {
    console.log(`        本地服务已启动!        `);
});

// 全局未捕获异常和未处理Promise拒绝处理
process.on('uncaughtException', (err) => {
    console.error(`[${new Date().toISOString()}] 未捕获的异常:`, err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error(`[${new Date().toISOString()}] 未处理的Promise拒绝:`, reason);
});

// 计算历史总盈利
async function calculateTotalProfit() {
    try {
        // 获取所有用户
        const users = await User.find({ role: { $ne: 'admin' } });

        let totalProfit = 0;

        // 计算每个用户的充值和提现差额
        for (const user of users) {
            // 获取用户的充值记录
            const recharges = await Transaction.find({
                user: user._id, 
                type: 'recharge',
                status: 'approved' 
            });
            const totalRecharge = recharges.reduce((sum, record) => sum + record.amount, 0);

            // 获取用户的提现记录
            const withdrawals = await Transaction.find({ 
                user: user._id, 
                type: 'withdraw',
                status: 'approved' 
            });
            const totalWithdrawal = withdrawals.reduce((sum, record) => sum + record.amount, 0);

            // 计算该用户的净收益（充值 - 提现）
            const userProfit = totalRecharge - totalWithdrawal;
            totalProfit += userProfit;
        }

        // 更新管理员余额
        const admin = await User.findOne({ username: 'admin' });
        if (admin) {
            const oldBalance = admin.balance;
            admin.balance = totalProfit;
            await admin.save();
        } else {
        }

        return totalProfit;
    } catch (error) {
        console.error(`[${new Date().toISOString()}] 计算历史总盈利失败:`, error);
        throw error;
    }
}

// 日志格式化函数
const formatLog = (message, type = 'INFO') => {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${type}] ${message}`;
};

// 安全地序列化对象
const safeStringify = (obj) => {
    try {
        if (obj === null || obj === undefined) {
            return String(obj);
        }
        if (typeof obj === 'object') {
            // 对于文件对象等复杂对象，只显示关键信息
            if (obj.constructor && obj.constructor.name === 'Object') {
                return JSON.stringify(obj, null, 2);
            } else {
                return `[${obj.constructor ? obj.constructor.name : 'Object'}]`;
            }
        }
        return String(obj);
    } catch (error) {
        return '[无法序列化的对象]';
    }
};

// 重写console.log方法
const originalConsoleLog = console.log;
console.log = function() {
    const args = Array.from(arguments);
    const message = args.map(arg => safeStringify(arg)).join(' ');
    originalConsoleLog.call(console, formatLog(message));
};

// 重写console.error方法
const originalConsoleError = console.error;
console.error = function() {
    const args = Array.from(arguments);
    const message = args.map(arg => safeStringify(arg)).join(' ');
    originalConsoleError.call(console, formatLog(message, 'ERROR'));
};

// 重写console.warn方法
const originalConsoleWarn = console.warn;
console.warn = function() {
    const args = Array.from(arguments);
    const message = args.map(arg => safeStringify(arg)).join(' ');
    originalConsoleWarn.call(console, formatLog(message, 'WARN'));
};

module.exports = app; 
