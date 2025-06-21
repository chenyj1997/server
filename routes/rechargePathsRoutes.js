console.log("DEBUG: Loading server/routes/rechargePathsRoutes.js");

// !!! 这是一行用于测试服务器是否加载此文件的代码，请在测试后删除 !!!
// throw new Error("TEST_ERROR: This file rechargePathsRoutes.js is being loaded!"); // 删除这行

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const RechargePath = require('../models/RechargePath');

// 配置multer用于文件上传
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // 根据字段名确定上传目录
        let targetDir;
        if (file.fieldname === 'icon') {
            targetDir = path.join(__dirname, '..', 'public', 'uploads', 'icons');
        } else if (file.fieldname === 'qrCode') {
            targetDir = path.join(__dirname, '..', 'public', 'uploads', 'qrcodes');
        } else {
            targetDir = path.join(__dirname, '..', 'public', 'uploads', 'icons');
        }
        
        // 确保上传目录存在
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        
        cb(null, targetDir);
    },
    filename: function (req, file, cb) {
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    // 暂时移除文件过滤器，让 Multer 接收所有文件类型，我们稍后在路由中手动检查
    // fileFilter: (req, file, cb) => {
    //     if (file.mimetype.startsWith('image/')) {
    //         cb(null, true);
    //     } else {
    //         cb(new Error('只允许上传图片文件'));
    //     }
    // }
});

// 将 Multer any() 中间件显式存储在变量中，接收所有字段的文件
const uploadAnyMiddleware = upload.any();

// 添加日志，确认 Multer 配置是否被加载
console.log('RechargePathsRoutes: Multer configured. Expected fields:', upload.fields ? upload.fields.length : 'N/A'); // 这行日志可能仍然显示旧状态，但我们会使用 upload.any()
console.log('RechargePathsRoutes: Checking upload.fields type and properties:', typeof upload.fields, Object.keys(upload.fields));
console.log('RechargePathsRoutes: Full upload object inspection:', upload);

// 获取充值路径列表
router.get('/paths', async (req, res) => {
    try {
        // 从数据库获取充值路径
        // const paths = await RechargePath.find({ active: true }).sort({ sort: 1 }); // 注释掉原始查询
        const paths = await RechargePath.find({}).sort({ sort: 1 }); // 暂时修改为查询所有数据
        console.log('DEBUG: 从数据库获取到的充值路径数据:', paths); // 添加日志
        res.json({
            success: true,
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

// 获取单个充值路径详情
router.get('/:id', async (req, res) => {
    console.log('DEBUG: GET /api/recharge-paths/:id 路由被触发'); // 添加日志
    console.log('DEBUG: 获取详情请求 ID:', req.params.id); // 添加日志
    try {
        const { id } = req.params;
        const path = await RechargePath.findById(id); // 根据ID从数据库查找

        if (!path) {
            console.log('DEBUG: 未找到 ID 为', id, '的充值路径'); // 添加日志
            return res.status(404).json({
                success: false,
                message: '充值路径不存在'
            });
        }

        console.log('DEBUG: 成功获取到充值路径详情:', path); // 添加日志
        res.json({
            success: true,
            data: path
        });
    } catch (error) {
        console.error('获取充值路径详情错误:', error); // 添加日志
        res.status(500).json({
            success: false,
            message: '获取充值路径详情失败',
            error: error.message
        });
    }
});

// 创建充值路径
router.post('/', uploadAnyMiddleware, async (req, res) => {
    try {
        console.log('DEBUG: POST /api/recharge-paths 路由被触发');
        console.log('DEBUG: req.body:', req.body);
        console.log('DEBUG: req.files:', req.files);

        // 手动区分 icon 和 qrCode 文件
        const iconFile = req.files && req.files.find(file => file.fieldname === 'icon');
        const qrcodeFile = req.files && req.files.find(file => file.fieldname === 'qrCode');

        const { name, account, receiver, sort, type } = req.body;
        const active = req.body.isActive === 'true' || req.body.isActive === true;
        
        // 添加详细的调试日志
        console.log('DEBUG: 解析的字段值:');
        console.log('  name:', name, '类型:', typeof name);
        console.log('  account:', account, '类型:', typeof account);
        console.log('  receiver:', receiver, '类型:', typeof receiver);
        console.log('  sort:', sort, '类型:', typeof sort);
        console.log('  type:', type, '类型:', typeof type);
        console.log('  active:', active, '类型:', typeof active);
        
        // 验证必填字段
        if (!name || !account) {
            return res.status(400).json({
                success: false,
                message: '充值名称和收款账号为必填项'
            });
        }
        
        // 创建新的充值路径对象
        const pathData = {
            name: String(name || ''),
            account: String(account || ''),
            receiver: String(receiver || ''),
            type: String(type || 'other'),
            icon: iconFile ? `/uploads/icons/${iconFile.filename}` : null,
            qrCode: qrcodeFile ? `/uploads/qrcodes/${qrcodeFile.filename}` : null,
            sort: sort ? parseInt(sort) : 0,
            active: Boolean(active)
        };
        
        console.log('DEBUG: 准备创建的充值路径数据:', pathData);
        
        // 创建新的充值路径
        const path = new RechargePath(pathData);
        
        await path.save();
        
        res.status(201).json({
            success: true,
            message: '充值路径创建成功',
            data: path
        });
    } catch (error) {
        console.error('创建充值路径错误:', error);
        res.status(500).json({
            success: false,
            message: '创建充值路径失败',
            error: error.message
        });
    }
});

// 更新充值路径
router.put('/:id', uploadAnyMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        // 手动区分 icon 和 qrCode 文件
        const iconFile = req.files && req.files.find(file => file.fieldname === 'icon');
        const qrcodeFile = req.files && req.files.find(file => file.fieldname === 'qrCode');

        const { name, account, receiver, sort } = req.body;
        const active = req.body.isActive === 'true' || req.body.isActive === true;
        
        // 验证必填字段
        if (!name || !account) {
            return res.status(400).json({
                success: false,
                message: '充值名称和收款账号为必填项'
            });
        }
        
        // 查找要更新的充值路径
        const path = await RechargePath.findById(id);
        if (!path) {
            return res.status(404).json({
                success: false,
                message: '充值路径不存在'
            });
        }
        
        // 更新字段
        path.name = name;
        path.account = account;
        path.receiver = receiver || '';
        if (iconFile) path.icon = `/uploads/icons/${iconFile.filename}`;
        if (qrcodeFile) path.qrCode = `/uploads/qrcodes/${qrcodeFile.filename}`;
        path.sort = sort ? parseInt(sort) : 0;
        path.active = active;
        
        await path.save();
        
        res.json({
            success: true,
            message: '充值路径更新成功',
            data: path
        });
    } catch (error) {
        console.error('更新充值路径错误:', error);
        res.status(500).json({
            success: false,
            message: '更新充值路径失败',
            error: error.message
        });
    }
});

// 删除充值路径
router.delete('/:id', async (req, res) => {
    console.log('DEBUG: DELETE /api/recharge-paths/:id 路由被触发');
    console.log('DEBUG: 删除请求 ID:', req.params.id);
    try {
        const { id } = req.params;
        const path = await RechargePath.findByIdAndDelete(id);
        if (!path) {
            return res.status(404).json({
                success: false,
                message: '充值路径不存在'
            });
        }
        res.json({
            success: true,
            message: '充值路径删除成功'
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

module.exports = router; 
