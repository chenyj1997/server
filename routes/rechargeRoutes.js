const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const RechargePath = require('../models/RechargePath'); // 直接导入已定义的模型
const Transaction = require('../models/Transaction'); // 假设 Transaction 模型已经定义

// 添加检测图片是否为二维码的函数
const isQRCode = (file) => {
    // 这里我们简单根据文件名判断
    // 在实际应用中，可以使用专门的二维码检测库
    return file.originalname.toLowerCase().includes('qr') || 
           file.originalname.toLowerCase().includes('qrcode');
};

// 配置multer用于文件上传
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // 根据字段名确定上传目录
        let targetDir;
        if (file.fieldname === 'icon') {
            targetDir = path.join(__dirname, '..', 'public', 'uploads', 'icons');
        } else if (file.fieldname === 'qrcode') {
            targetDir = path.join(__dirname, '..', 'public', 'uploads', 'qrcodes');
        } else if (isQRCode(file)) {
            targetDir = path.join(__dirname, '..', 'public', 'uploads', 'qrcodes');
        } else {
            targetDir = path.join(__dirname, '..', 'public', 'uploads', 'icons');
        }
        
        // 确保上传目录存在
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
            console.log('创建上传目录:', targetDir);
        }
        
        // 检查目录权限
        try {
            fs.accessSync(targetDir, fs.constants.W_OK);
            console.log(`目录权限检查通过: ${targetDir}`);
        } catch (err) {
            console.error(`目录权限检查失败: ${targetDir}`, err);
            // 尝试修复权限
            try {
                fs.chmodSync(targetDir, 0o777);
                console.log(`已修复目录权限: ${targetDir}`);
            } catch (chmodErr) {
                console.error(`修复目录权限失败: ${targetDir}`, chmodErr);
            }
        }
        
        cb(null, targetDir);
    },
    filename: function (req, file, cb) {
        // 生成更简单的唯一文件名
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}${path.extname(file.originalname)}`;
        console.log(`生成文件名: ${uniqueName} 用于 ${file.fieldname}`);
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 增加文件大小限制到10MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('只允许上传图片文件'));
        }
    }
});

// 添加一个创建默认图片的函数
async function createDefaultImages() {
    console.log('==================== 创建默认图片 ====================');
    
    // 定义路径
    const publicDir = path.join(__dirname, '..', 'public');
    const imagesDir = path.join(publicDir, 'images');
    const uploadsDir = path.join(publicDir, 'uploads');
    const iconsDir = path.join(uploadsDir, 'icons');
    const qrcodesDir = path.join(uploadsDir, 'qrcodes');
    
    // 确保目录存在
    [publicDir, imagesDir, uploadsDir, iconsDir, qrcodesDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`创建目录: ${dir}`);
        }
    });
    
    // 创建一个简单的图片Buffer
    const createImageBuffer = () => {
        return Buffer.from(
            '/9j/4AAQSkZJRgABAQEASABIAAD/4QAiRXhpZgAATU0AKgAAAAgAAQESAAMAAAABAAEAAAAAAAD/2wBDAAIBAQIBAQICAgICAgICAwUDAwMDAwYEBAMFBwYHBwcGBwcICQsJCAgKCAcHCg0KCgsMDAwMBwkODw0MDgsMDAz/2wBDAQICAgMDAwYDAwYMCAcIDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAz/wAARCAAyADIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD//2Q==',
            'base64'
        );
    };
    
    // 定义要创建的图片文件
    const imagesToCreate = [
        { name: 'default-alipay.png', dir: iconsDir },
        { name: 'default-wechat.png', dir: iconsDir },
        { name: 'default-alipay-qr.png', dir: qrcodesDir },
        { name: 'default-wechat-qr.png', dir: qrcodesDir },
    ];
    
    // 创建图片文件
    for (const img of imagesToCreate) {
        const filePath = path.join(img.dir, img.name);
        if (!fs.existsSync(filePath)) {
            try {
                fs.writeFileSync(filePath, createImageBuffer());
                console.log(`创建图片文件: ${filePath}`);
            } catch (err) {
                console.error(`创建图片文件失败: ${filePath}`, err);
            }
        }
    }
    
    console.log('检查创建的文件:');
    imagesToCreate.forEach(img => {
        const filePath = path.join(img.dir, img.name);
        console.log(`- ${filePath}: ${fs.existsSync(filePath) ? '存在' : '不存在'}`);
    });
    
    console.log('==================== 默认图片创建完成 ====================');
}

// 确保文件存在后再运行服务
createDefaultImages();

// 添加复制默认图片的函数
function copyDefaultImages() {
    // 定义默认图片路径
    const defaultImagesDir = path.join(__dirname, '..', 'public', 'images');
    const iconsDir = path.join(__dirname, '..', 'public', 'uploads', 'icons');
    const qrcodesDir = path.join(__dirname, '..', 'public', 'uploads', 'qrcodes');
    
    // 确保目录存在
    [iconsDir, qrcodesDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
    
    // 复制支付宝图标
    const defaultAlipayIcon = path.join(defaultImagesDir, 'default-alipay.png');
    const targetAlipayIcon = path.join(iconsDir, 'default-alipay.png');
    if (fs.existsSync(defaultAlipayIcon) && !fs.existsSync(targetAlipayIcon)) {
        fs.copyFileSync(defaultAlipayIcon, targetAlipayIcon);
        console.log('已复制支付宝图标到icons目录:', targetAlipayIcon);
    }
    
    // 复制微信图标
    const defaultWechatIcon = path.join(defaultImagesDir, 'default-wechat.png');
    const targetWechatIcon = path.join(iconsDir, 'default-wechat.png');
    if (fs.existsSync(defaultWechatIcon) && !fs.existsSync(targetWechatIcon)) {
        fs.copyFileSync(defaultWechatIcon, targetWechatIcon);
        console.log('已复制微信图标到icons目录:', targetWechatIcon);
    }
    
    // 复制支付宝二维码
    const defaultAlipayQr = path.join(defaultImagesDir, 'default-alipay-qr.png');
    const targetAlipayQr = path.join(qrcodesDir, 'default-alipay-qr.png');
    if (fs.existsSync(defaultAlipayQr) && !fs.existsSync(targetAlipayQr)) {
        fs.copyFileSync(defaultAlipayQr, targetAlipayQr);
        console.log('已复制支付宝二维码到qrcodes目录:', targetAlipayQr);
    }
    
    // 复制微信二维码
    const defaultWechatQr = path.join(defaultImagesDir, 'default-wechat-qr.png');
    const targetWechatQr = path.join(qrcodesDir, 'default-wechat-qr.png');
    if (fs.existsSync(defaultWechatQr) && !fs.existsSync(targetWechatQr)) {
        fs.copyFileSync(defaultWechatQr, targetWechatQr);
        console.log('已复制微信二维码到qrcodes目录:', targetWechatQr);
    }
}

// 调用复制默认图片函数
copyDefaultImages();

// 确保数据库有初始数据
async function ensureDefaultPaths() {
    try {
        const count = await RechargePath.countDocuments();
        if (count === 0) {
            console.log('创建默认充值路径...');
            // 添加默认的支付宝和微信支付充值路径
            await RechargePath.create([
                {
                    name: '支付宝',
                    account: 'example@alipay.com',
                    receiver: '支付宝收款人',
                    icon: '/uploads/icons/default-alipay.png',
                    qrCode: '/uploads/qrcodes/default-alipay-qr.png',
                    active: true
                },
                {
                    name: '微信支付',
                    account: 'example',
                    receiver: '微信收款人',
                    icon: '/uploads/icons/default-wechat.png',
                    qrCode: '/uploads/qrcodes/default-wechat-qr.png',
                    active: true
                }
            ]);
            console.log('默认充值路径创建完成');
        }
    } catch (error) {
        console.error('创建默认充值路径失败:', error);
    }
}

// 初始化默认数据
ensureDefaultPaths();

// 获取充值路径列表
router.get('/paths', async (req, res) => {
    try {
        // 按照sort字段排序，而不是createdAt
        const paths = await RechargePath.find().sort({ sort: 1 });
        res.json({
            success: true,
            message: '获取充值路径列表成功',
            data: paths
        });
    } catch (error) {
        console.error('获取充值路径列表错误:', error);
        res.status(500).json({
            success: false,
            message: '获取充值路径列表失败',
            error: error.message
        });
    }
});

// 添加文件检查函数 - 用于验证文件路径是否有效
function checkFileExists(filePath) {
    const fullPath = path.join(__dirname, '..', 'public', filePath.replace(/^\//, ''));
    const exists = fs.existsSync(fullPath);
    console.log(`检查文件 ${filePath} (${fullPath}): ${exists ? '存在' : '不存在'}`);
    return exists;
}

// 修改上传处理函数
router.post('/paths', upload.fields([
    { name: 'icon', maxCount: 1 },
    { name: 'qrcode', maxCount: 1 }
]), async (req, res) => {
    try {
        console.log('==================== 开始处理充值路径添加 ====================');
        console.log('收到添加充值路径请求:', req.body);
        console.log('收到的文件:', req.files);
        
        const { name, account, receiver, sort } = req.body;
        const active = req.body.isActive === 'true' || req.body.isActive === true || req.body.active === 'true' || req.body.active === true;
        
        // 验证必填字段
        if (!name || !account) {
            console.log('缺少必要字段:', { name, account });
            return res.status(400).json({
                success: false,
                message: '充值名称和收款账号为必填项'
            });
        }
        
        // 打印请求数据
        console.log('表单数据:', {
            name,
            account,
            receiver,
            sort,
            active
        });
        
        // 处理上传的文件并添加详细日志
        const iconFile = req.files && req.files.icon && req.files.icon.length > 0 ? req.files.icon[0] : null;
        const qrcodeFile = req.files && req.files.qrcode && req.files.qrcode.length > 0 ? req.files.qrcode[0] : null;
        
        // 打印文件信息
        console.log('图标文件:', iconFile ? {
            fieldname: iconFile.fieldname,
            originalname: iconFile.originalname,
            encoding: iconFile.encoding,
            mimetype: iconFile.mimetype,
            destination: iconFile.destination,
            filename: iconFile.filename,
            path: iconFile.path,
            size: iconFile.size
        } : '未上传');
        
        console.log('二维码文件:', qrcodeFile ? {
            fieldname: qrcodeFile.fieldname,
            originalname: qrcodeFile.originalname,
            encoding: qrcodeFile.encoding,
            mimetype: qrcodeFile.mimetype,
            destination: qrcodeFile.destination,
            filename: qrcodeFile.filename,
            path: qrcodeFile.path,
            size: qrcodeFile.size
        } : '未上传');
        
        // 确定图标URL
        let iconUrl = null;
        if (iconFile) {
            // 检查文件是否已经存在于目标目录
            const iconTargetPath = path.join(__dirname, '..', 'public', 'uploads', 'icons', iconFile.filename);
            const iconExists = fs.existsSync(iconTargetPath);
            
            if (!iconExists && iconFile.path) {
                // 检查原始上传文件是否存在
                const uploadedFileExists = fs.existsSync(iconFile.path);
                console.log(`原始上传图标文件(${iconFile.path})${uploadedFileExists ? '存在' : '不存在'}`);
                
                if (uploadedFileExists) {
                    // 确保目标目录存在
                    const iconDir = path.join(__dirname, '..', 'public', 'uploads', 'icons');
                    if (!fs.existsSync(iconDir)) {
                        fs.mkdirSync(iconDir, { recursive: true });
                        console.log(`创建图标目录: ${iconDir}`);
                    }
                    
                    // 手动复制文件到正确位置
                    try {
                        fs.copyFileSync(iconFile.path, iconTargetPath);
                        console.log(`复制图标文件从 ${iconFile.path} 到 ${iconTargetPath}`);
                    } catch (err) {
                        console.error(`复制图标文件失败:`, err);
                    }
                }
            }
            
            // 设置URL路径（无论复制是否成功都设置，让虚拟字段处理默认值）
            iconUrl = iconFile.filename;
            console.log('图标文件名:', iconUrl);
        } else {
            // 使用默认图标
            iconUrl = null; // 让虚拟字段处理默认值
            console.log('未上传图标，将使用默认图标');
        }
        
        // 确定二维码URL
        let qrCodeUrl = null;
        if (qrcodeFile) {
            // 检查文件是否已经存在于目标目录
            const qrTargetPath = path.join(__dirname, '..', 'public', 'uploads', 'qrcodes', qrcodeFile.filename);
            const qrExists = fs.existsSync(qrTargetPath);
            
            if (!qrExists && qrcodeFile.path) {
                // 检查原始上传文件是否存在
                const uploadedFileExists = fs.existsSync(qrcodeFile.path);
                console.log(`原始上传二维码文件(${qrcodeFile.path})${uploadedFileExists ? '存在' : '不存在'}`);
                
                if (uploadedFileExists) {
                    // 确保目标目录存在
                    const qrDir = path.join(__dirname, '..', 'public', 'uploads', 'qrcodes');
                    if (!fs.existsSync(qrDir)) {
                        fs.mkdirSync(qrDir, { recursive: true });
                        console.log(`创建二维码目录: ${qrDir}`);
                    }
                    
                    // 手动复制文件到正确位置
                    try {
                        fs.copyFileSync(qrcodeFile.path, qrTargetPath);
                        console.log(`复制二维码文件从 ${qrcodeFile.path} 到 ${qrTargetPath}`);
                    } catch (err) {
                        console.error(`复制二维码文件失败:`, err);
                    }
                }
            }
            
            // 设置URL路径
            qrCodeUrl = qrcodeFile.filename;
            console.log('二维码文件名:', qrCodeUrl);
        } else {
            // 使用默认二维码
            qrCodeUrl = null; // 让虚拟字段处理默认值
            console.log('未上传二维码，将使用默认二维码');
        }
        
        // 创建新的充值路径
        const newPath = new RechargePath({
            name,
            account,
            receiver: receiver || '',
            icon: iconUrl,
            qrCode: qrCodeUrl,
            sort: sort ? parseInt(sort) : 0,
            active: active
        });
        
        // 保存到数据库
        await newPath.save();
        
        console.log('创建的新充值路径:', JSON.stringify(newPath, null, 2));
        console.log('==================== 充值路径添加完成 ====================');
        
        res.json({
            success: true,
            message: '添加充值路径成功',
            data: newPath
        });
    } catch (error) {
        console.error('添加充值路径错误:', error);
        res.status(500).json({
            success: false,
            message: '添加充值路径失败',
            error: error.message,
            stack: error.stack
        });
    }
});

// 更新充值路径
router.put('/paths/:id', upload.fields([
    { name: 'icon', maxCount: 1 },
    { name: 'qrcode', maxCount: 1 }
]), async (req, res) => {
    try {
        console.log('==================== 开始处理充值路径更新 ====================');
        console.log('收到更新充值路径请求:', req.body);
        console.log('收到的文件:', req.files);
        
        const { id } = req.params;
        const { name, account, receiver, sort } = req.body;
        const active = req.body.isActive === 'true' || req.body.isActive === true || req.body.active === 'true' || req.body.active === true;
        
        // 验证必填字段
        if (!name || !account) {
            console.log('缺少必要字段:', { name, account });
            return res.status(400).json({
                success: false,
                message: '充值名称和收款账号为必填项'
            });
        }
        
        // 打印请求数据
        console.log('表单数据:', {
            id,
            name,
            account,
            receiver,
            sort,
            active
        });
        
        // 查找要更新的充值路径
        const path = await RechargePath.findById(id);
        if (!path) {
            return res.status(404).json({
                success: false,
                message: '充值路径不存在'
            });
        }
        
        // 处理上传的文件并添加详细日志
        const iconFile = req.files && req.files.icon && req.files.icon.length > 0 ? req.files.icon[0] : null;
        const qrcodeFile = req.files && req.files.qrcode && req.files.qrcode.length > 0 ? req.files.qrcode[0] : null;
        
        // 打印文件信息
        console.log('图标文件:', iconFile ? {
            fieldname: iconFile.fieldname,
            originalname: iconFile.originalname,
            encoding: iconFile.encoding,
            mimetype: iconFile.mimetype,
            destination: iconFile.destination,
            filename: iconFile.filename,
            path: iconFile.path,
            size: iconFile.size
        } : '未上传');
        
        console.log('二维码文件:', qrcodeFile ? {
            fieldname: qrcodeFile.fieldname,
            originalname: qrcodeFile.originalname,
            encoding: qrcodeFile.encoding,
            mimetype: qrcodeFile.mimetype,
            destination: qrcodeFile.destination,
            filename: qrcodeFile.filename,
            path: qrcodeFile.path,
            size: qrcodeFile.size
        } : '未上传');
        
        // 确定图标URL
        let iconUrl = null;
        if (iconFile) {
            // 检查文件是否已经存在于目标目录
            const iconTargetPath = path.join(__dirname, '..', 'public', 'uploads', 'icons', iconFile.filename);
            const iconExists = fs.existsSync(iconTargetPath);
            
            if (!iconExists && iconFile.path) {
                // 检查原始上传文件是否存在
                const uploadedFileExists = fs.existsSync(iconFile.path);
                console.log(`原始上传图标文件(${iconFile.path})${uploadedFileExists ? '存在' : '不存在'}`);
                
                if (uploadedFileExists) {
                    // 确保目标目录存在
                    const iconDir = path.join(__dirname, '..', 'public', 'uploads', 'icons');
                    if (!fs.existsSync(iconDir)) {
                        fs.mkdirSync(iconDir, { recursive: true });
                        console.log(`创建图标目录: ${iconDir}`);
                    }
                    
                    // 手动复制文件到正确位置
                    try {
                        fs.copyFileSync(iconFile.path, iconTargetPath);
                        console.log(`复制图标文件从 ${iconFile.path} 到 ${iconTargetPath}`);
                    } catch (err) {
                        console.error(`复制图标文件失败:`, err);
                    }
                }
            }
            
            // 设置URL路径（无论复制是否成功都设置，让虚拟字段处理默认值）
            iconUrl = iconFile.filename;
            console.log('图标文件名:', iconUrl);
        } else {
            // 使用默认图标
            iconUrl = null; // 让虚拟字段处理默认值
            console.log('未上传图标，将使用默认图标');
        }
        
        // 确定二维码URL
        let qrCodeUrl = null;
        if (qrcodeFile) {
            // 检查文件是否已经存在于目标目录
            const qrTargetPath = path.join(__dirname, '..', 'public', 'uploads', 'qrcodes', qrcodeFile.filename);
            const qrExists = fs.existsSync(qrTargetPath);
            
            if (!qrExists && qrcodeFile.path) {
                // 检查原始上传文件是否存在
                const uploadedFileExists = fs.existsSync(qrcodeFile.path);
                console.log(`原始上传二维码文件(${qrcodeFile.path})${uploadedFileExists ? '存在' : '不存在'}`);
                
                if (uploadedFileExists) {
                    // 确保目标目录存在
                    const qrDir = path.join(__dirname, '..', 'public', 'uploads', 'qrcodes');
                    if (!fs.existsSync(qrDir)) {
                        fs.mkdirSync(qrDir, { recursive: true });
                        console.log(`创建二维码目录: ${qrDir}`);
                    }
                    
                    // 手动复制文件到正确位置
                    try {
                        fs.copyFileSync(qrcodeFile.path, qrTargetPath);
                        console.log(`复制二维码文件从 ${qrcodeFile.path} 到 ${qrTargetPath}`);
                    } catch (err) {
                        console.error(`复制二维码文件失败:`, err);
                    }
                }
            }
            
            // 设置URL路径
            qrCodeUrl = qrcodeFile.filename;
            console.log('二维码文件名:', qrCodeUrl);
        } else {
            // 使用默认二维码
            qrCodeUrl = null; // 让虚拟字段处理默认值
            console.log('未上传二维码，将使用默认二维码');
        }
        
        // 更新字段
        path.name = name;
        path.account = account;
        path.receiver = receiver || '';
        if (iconUrl) path.icon = iconUrl;
        if (qrCodeUrl) path.qrCode = qrCodeUrl;
        path.sort = sort ? parseInt(sort) : 0;
        path.active = active;
        
        // 保存到数据库
        await path.save();
        
        console.log('更新的充值路径:', JSON.stringify(path, null, 2));
        console.log('==================== 充值路径更新完成 ====================');
        
        res.json({
            success: true,
            message: '更新充值路径成功',
            data: path
        });
    } catch (error) {
        console.error('更新充值路径错误:', error);
        res.status(500).json({
            success: false,
            message: '更新充值路径失败',
            error: error.message,
            stack: error.stack
        });
    }
});

// 删除充值路径
router.delete('/paths/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // 查找要删除的充值路径
        const path = await RechargePath.findByIdAndDelete(id);
        if (!path) {
            return res.status(404).json({
                success: false,
                message: '充值路径不存在'
            });
        }
        
        res.json({
            success: true,
            message: '删除充值路径成功'
        });
    } catch (error) {
        console.error('删除充值路径错误:', error);
        res.status(500).json({
            success: false,
            message: '删除充值路径失败',
            error: error.message
        });
    }
});

// ==================== 充值订单提交路由 ====================
// 处理用户提交的充值订单
// 路由路径相对于挂载点 /api/app/recharge，所以这里是 POST / 
router.post('/', upload.single('proof'), async (req, res) => {
    try {
        console.log('DEBUG: POST /api/app/recharge 路由被触发 (充值订单提交)');
        console.log('DEBUG: req.body:', req.body);
        console.log('DEBUG: req.file (proof):', req.file);

        // 从请求体中获取数据
        const { amount, pathId, description } = req.body;

        // 从 req 对象中获取用户信息 (protect 中间件会添加 user)
        const userId = req.user ? req.user.id : null; 

        // 验证必要数据
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: '用户未认证'
            });
        }
        if (!amount || !pathId) {
            // 如果使用multipart/form-data，即使是数字字段，req.body.amount 也可能是字符串
            const parsedAmount = parseFloat(amount);
            if (isNaN(parsedAmount) || parsedAmount <= 0) {
                 return res.status(400).json({
                    success: false,
                    message: '充值金额无效'
                });
            }
             if (!pathId) {
                return res.status(400).json({
                    success: false,
                    message: '充值方式ID不能为空'
                });
            }
        }
         const parsedAmount = parseFloat(amount);

        // 查找对应的充值路径，确保其存在且激活
        const rechargePath = await RechargePath.findById(pathId);
        if (!rechargePath || !rechargePath.active) {
             console.log('DEBUG: 找不到充值路径或路径未激活', { pathId, rechargePath });
            return res.status(400).json({
                success: false,
                message: '无效的充值方式'
            });
        }

        // 处理上传的凭证图片
        const proofImageUrl = req.file ? `/uploads/${req.file.filename}` : null; // 根据 Multer 配置调整路径

        // 创建新的充值交易记录
        const newTransaction = new Transaction({
            user: userId,
            type: 'recharge',
            amount: parsedAmount, // 使用解析后的金额
            status: 'pending', // 初始状态为待审核
            rechargePath: pathId,
            description: description || '',
            proofImage: proofImageUrl,
            // 可以根据需要添加其他字段，如交易号等
        });

        await newTransaction.save();

        res.status(201).json({
            success: true,
            message: '充值申请已提交，请等待审核',
            data: { transactionId: newTransaction._id, status: newTransaction.status }
        });

    } catch (error) {
        console.error('处理充值订单提交错误:', error);
        // 处理 Multer 错误
        if (error instanceof multer.MulterError) {
            console.error('Multer错误详情:', error.code);
            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    success: false,
                    message: '文件大小超出限制'
                });
            }
             if (error.code === 'LIMIT_UNEXPECTED_FILE') {
                return res.status(400).json({
                    success: false,
                    message: '文件字段名错误或文件数量超出限制'
                });
            }
             return res.status(400).json({
                success: false,
                message: `文件上传错误: ${error.message}`
            });
        }
         // 处理其他错误
        res.status(500).json({
            success: false,
            message: '提交充值申请失败',
            error: error.message
        });
    }
});

// =========================================================

module.exports = router; 