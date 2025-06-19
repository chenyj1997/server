// 永鑫资本相关路由
const express = require('express');
const router = express.Router();
const infoController = require('../controllers/infoController');
const upload = require('../middleware/uploadMiddleware');

// 获取信息列表
router.get('/', infoController.getAllInformation);

// 获取单个信息详情
router.get('/:id', infoController.getInformationById);

// 创建新信息
router.post('/', upload.array('images', 10), (req, res, next) => {
    console.log("后端接收到创建信息的请求:"); // 后端接收到创建信息的请求日志
    console.log("req.body:", req.body); // 打印请求体内容
    console.log("req.files:", req.files); // 打印文件信息
    next();
}, infoController.createInformation);

// 更新信息
router.put('/:id', upload.array('images', 10), infoController.updateInformation);

// 删除信息
router.delete('/:id', infoController.deleteInformation);

// 图片上传路由 - 新增
router.post('/upload/image', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: '没有上传文件或文件上传失败'
            });
        }
        
        // 生成文件URL
        const fileUrl = `/uploads/info/${req.file.filename}`;
        console.log('图片上传成功:', fileUrl);
        
        // 返回文件路径
        res.json({
            success: true,
            message: '文件上传成功',
            data: fileUrl,
            url: fileUrl
        });
    } catch (error) {
        console.error('图片上传出错:', error);
        res.status(500).json({
            success: false,
            message: '图片上传失败',
            error: error.message
        });
    }
});

module.exports = router; 