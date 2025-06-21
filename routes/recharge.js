console.log("DEBUG: Loading server/routes/recharge.js");
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const RechargePath = require('../models/RechargePath');
const { protect } = require('../middleware/auth');
const mongoose = require('mongoose');
const cloudinary = require('../utils/cloudinary');

// 配置临时文件上传（用于Cloudinary）
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const tempDir = path.join(__dirname, '../temp_uploads');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        cb(null, tempDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'temp_' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('只允许上传JPEG/PNG/GIF/WEBP图片!'), false);
        }
    }
});

// 获取充值路径列表
router.get('/paths', async (req, res) => {
    try {
        // 从数据库获取充值路径
        const paths = await RechargePath.find({ active: true }).sort({ sort: 1 });
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

// 创建充值交易
router.post('/', protect, upload.single('proof'), async (req, res) => {
    try {
        console.log('=== 充值请求开始处理 ===');
        console.log('请求体:', JSON.stringify(req.body, null, 2));
        console.log('用户信息:', JSON.stringify(req.user, null, 2));
        console.log('上传文件:', req.file ? JSON.stringify(req.file, null, 2) : '无文件');
        
        const { amount, pathId } = req.body;
        
        // 验证必填字段
        if (!amount || isNaN(parseFloat(amount))) {
            console.log('金额验证失败');
            return res.status(400).json({
                success: false,
                message: '请提供有效的充值金额'
            });
        }

        if (!pathId) {
            console.log('路径ID验证失败');
            return res.status(400).json({
                success: false,
                message: '请选择充值方式'
            });
        }
        
        // 验证充值交易截图（必填）
        if (!req.file) {
            console.log('充值交易截图验证失败');
            return res.status(400).json({
                success: false,
                message: '请上传充值交易截图，此项目为必填项'
            });
        }
        
        // 验证文件类型
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(req.file.mimetype)) {
            console.log('文件类型验证失败:', req.file.mimetype);
            return res.status(400).json({
                success: false,
                message: '请上传支持的图片格式：JPG、PNG、GIF、WEBP'
            });
        }
        
        // 验证充值路径是否存在
        const rechargePath = await RechargePath.findById(pathId);
        console.log('查询到的充值路径:', rechargePath ? JSON.stringify(rechargePath, null, 2) : '未找到');
        
        if (!rechargePath) {
            return res.status(404).json({
                success: false,
                message: '充值方式不存在'
            });
        }
        
        // 上传图片到Cloudinary
        let proofUrl = null;
        try {
            console.log('开始上传图片到Cloudinary...');
            const cloudinaryResult = await cloudinary.uploader.upload(req.file.path, {
                folder: 'recharge-proofs',
                public_id: `recharge_${Date.now()}_${Math.round(Math.random() * 1E9)}`,
                resource_type: 'image'
            });
            
            proofUrl = cloudinaryResult.secure_url;
            console.log('Cloudinary上传成功:', proofUrl);
            
            // 删除临时文件
            fs.unlinkSync(req.file.path);
            console.log('临时文件已删除');
            
        } catch (uploadError) {
            console.error('Cloudinary上传失败:', uploadError);
            // 删除临时文件
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(500).json({
                success: false,
                message: '图片上传失败，请重试'
            });
        }

        // 获取用户当前余额
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }

        console.log('准备创建交易对象...');
        const transactionData = {
            user: new mongoose.Types.ObjectId(req.user._id),
            type: 'recharge',
            amount: parseFloat(amount),
            paymentMethod: rechargePath.type || 'online',
            paymentAccount: rechargePath.account || 'default',
            receiveAccount: rechargePath.receiver || 'system',
            proof: proofUrl, // 使用Cloudinary URL
            status: 'pending',
            rechargePath: pathId,
            balanceBefore: user.balance, // 变更前余额
            balanceAfter: user.balance + parseFloat(amount) // 变更后余额
        };
        console.log('交易数据:', JSON.stringify(transactionData, null, 2));

        // 创建充值交易
        const transaction = new Transaction(transactionData);
        console.log('交易对象创建成功，准备保存...');
        
        await transaction.save();
        console.log('交易保存成功，ID:', transaction._id);

        res.status(201).json({
            success: true,
            message: '充值申请已提交，请等待审核',
            data: {
                transactionId: transaction._id,
                amount: transaction.amount,
                status: transaction.status,
                message: '您的充值申请已提交，请等待审核'
            }
        });
        console.log('=== 充值请求处理完成 ===');
    } catch (error) {
        console.error('=== 充值请求处理失败 ===');
        console.error('错误详情:', error);
        console.error('错误堆栈:', error.stack);
        
        // 处理文件上传相关错误
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: '文件大小超过限制，请上传5MB以内的图片'
            });
        }
        
        if (error.message && error.message.includes('只允许上传')) {
            return res.status(400).json({
                success: false,
                message: '请上传支持的图片格式：JPG、PNG、GIF、WEBP'
            });
        }
        
        res.status(500).json({
            success: false,
            message: '创建充值交易失败: ' + error.message
        });
    }
});

// 获取充值记录
router.get('/records', protect, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        // 查询总记录数
        const total = await Transaction.countDocuments({
            user: req.user._id,
            type: 'recharge'
        });

        // 查询充值记录
        const records = await Transaction.find({
            user: req.user._id,
            type: 'recharge'
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

        res.json({
            success: true,
            data: records,
            total,
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (error) {
        console.error('获取充值记录错误:', error);
        res.status(500).json({
            success: false,
            message: '获取充值记录失败'
        });
    }
});

// 审核充值交易
router.post('/:id/review', protect, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, remark } = req.body;

        const transaction = await Transaction.findById(id);
        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: '交易不存在'
            });
        }

        if (transaction.type !== 'recharge') {
            return res.status(400).json({
                success: false,
                message: '不是充值交易'
            });
        }

        // 更新交易状态
        transaction.status = status;
        transaction.remark = remark;
        transaction.reviewedAt = new Date();
        transaction.reviewedBy = req.user._id;

        // 如果审核通过，更新用户余额
        if (status === 'completed') {
            const user = await User.findById(transaction.user);
            user.balance += transaction.amount;
            await user.save();
        }

        await transaction.save();

        res.json({
            success: true,
            message: '审核成功',
            data: transaction
        });
    } catch (error) {
        console.error('审核充值交易错误:', error);
        res.status(500).json({
            success: false,
            message: '审核失败'
        });
    }
});

module.exports = router; 
