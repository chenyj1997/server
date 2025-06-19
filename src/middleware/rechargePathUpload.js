const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 充值路径文件上传配置
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // 文件上传目录
        const uploadPath = path.join(__dirname, '..', '..', 'public', 'uploads', 'rechargePaths');
        // 确保目录存在
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // 生成唯一的文件名，保留原始文件扩展名
        const ext = path.extname(file.originalname);
        const filename = file.fieldname + '-' + Date.now() + ext;
        cb(null, filename);
    }
});

// 文件过滤，只允许图片类型
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('只允许上传图片文件'), false);
    }
};

// 创建 multer 上传实例
const rechargePathUpload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 限制文件大小为 5MB
    }
}).fields([
    { name: 'icon', maxCount: 1 }, // 允许上传一个名为 'icon' 的文件
    { name: 'qrcode', maxCount: 1 } // 允许上传一个名为 'qrcode' 的文件
]);

module.exports = rechargePathUpload; 