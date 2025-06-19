const multer = require('multer');
const path = require('path');

// 配置 multer 存储
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // 设置文件上传目录
        cb(null, './public/uploads/info/'); // 图片将保存在 server/public/uploads/info/ 目录下
    },
    filename: function (req, file, cb) {
        // 设置文件名，格式为 字段名-当前时间戳.文件后缀
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
    // 只允许上传图片文件
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('只允许上传图片文件！'), false);
    }
};

// 创建 multer 实例
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 限制文件大小为 5MB
    }
});

module.exports = upload; 