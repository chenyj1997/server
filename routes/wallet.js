// ========== 钱包路由文件已加载 ========== //
// 本文件为唯一钱包路由，包含支付密码、余额、充值、提现、交易记录等所有功能
// 每个接口均有详细中文注释，便于维护
console.log('【钱包路由】server/routes/wallet.js 已加载');

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { protect: auth } = require('../middleware/auth');
const RechargePath = require('../models/RechargePath');
const Notification = require('../models/Notification');
const Info = require('../models/Info');
const cors = require('cors');
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
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'temp_' + uniqueName + ext);
    }
});

// 文件过滤器，只允许上传图片
const fileFilter = (req, file, cb) => {
    console.log('收到文件上传请求:', {
        fieldname: file.fieldname,
        originalname: file.originalname,
        encoding: file.encoding,
        mimetype: file.mimetype
    });

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        console.log('文件类型验证通过');
        cb(null, true);
    } else {
        console.error('文件类型验证失败:', file.mimetype);
        cb(new Error('只允许上传JPEG/PNG/GIF/WEBP图片!'), false);
    }
};

// 初始化multer
const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 限制5MB
    }
});

// 钱包模型定义
const Wallet = mongoose.model('Wallet', new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // 用户ID
    balance: { type: Number, default: 0 }, // 余额
    paymentPassword: { type: String, default: null }, // 支付密码（加密）
    paymentPasswordSet: { type: Boolean, default: false }, // 是否已设置支付密码
    transactions: [{ // 交易记录
        type: { type: String, enum: ['recharge', 'withdraw', 'consume'] }, // 交易类型
        amount: Number, // 金额
        status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' }, // 状态
        createdAt: { type: Date, default: Date.now } // 创建时间
    }]
}));

// 获取钱包信息
router.get('/', async (req, res) => {
    try {
        // 强制从数据库获取最新数据，不使用缓存
        const user = await User.findById(req.user.id)
            .select('balance username email phone avatar')
            .lean();
            
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }
        
        // 返回更多用户信息，方便客户端更新
        res.json({
            success: true,
            data: {
                balance: user.balance,
                userId: user._id,
                username: user.username,
                email: user.email || '',
                phone: user.phone || '',
                avatar: user.avatar || ''
            }
        });
    } catch (error) {
        console.error('获取钱包信息错误:', error);
        res.status(500).json({
            success: false,
            message: '获取钱包信息失败'
        });
    }
});

// 获取钱包余额接口
router.get('/balance/:userId', async (req, res) => {
    // ... existing code ...
});

// 设置支付密码接口
router.post('/payment-password', auth, async (req, res) => {
    try {
        const { password, currentPassword } = req.body;
        
        // 查找用户
        const user = await User.findById(req.user.id).select('+paymentPassword +paymentPasswordSet'); // Select payment password fields
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }

        // Check if payment password is already set
        if (user.paymentPasswordSet) {
            // Modification case: Verify current password
            if (!currentPassword) {
                 return res.status(400).json({
                    success: false,
                    message: '请输入原支付密码'
                });
            }
            const isMatch = await bcrypt.compare(currentPassword, user.paymentPassword);
            if (!isMatch) {
                return res.status(400).json({
                    success: false,
                    message: '原支付密码错误'
                });
            }
             // Validation for new password format
            if (!password || password.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: '新支付密码长度不能少于6位'
                });
            }
        } else {
            // Initial setting case: Validate new password format
             if (!password || password.length < 6) {
                 return res.status(400).json({
                    success: false,
                    message: '支付密码长度不能少于6位'
                 });
             }
             // In initial setting case, currentPassword should not be required or validated
        }
        
        // Encrypt the new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Update user's payment password and set the flag
        user.paymentPassword = hashedPassword;
        user.paymentPasswordSet = true;
        await user.save();
        
        res.json({
            success: true,
            message: user.paymentPasswordSet ? '支付密码修改成功' : '支付密码设置成功' // Dynamic message
        });
    } catch (error) {
        console.error('设置/修改支付密码错误:', error);
        res.status(500).json({
            success: false,
            message: '设置/修改支付密码失败'
        });
    }
});

// 验证支付密码接口
router.post('/verify-payment-password', async (req, res) => {
    // ... existing code ...
});

// 获取支付密码设置状态接口
router.get('/payment-password-status', auth, async (req, res) => {
    try {
        // 从认证中间件获取用户ID
        const userId = req.user.id;

        // 查找用户并只获取 paymentPasswordSet 字段
        const user = await User.findById(userId).select('paymentPasswordSet hasPayPassword');

        if (!user) {
             return res.status(404).json({
                success: false,
                message: '用户未找到'
            });
        }

        // 返回 paymentPasswordSet 状态
        res.json({
            success: true,
            data: {
                isSet: user.paymentPasswordSet || user.hasPayPassword || false // 兼容新老字段
            }
        });
    } catch (error) {
        console.error('获取支付密码设置状态错误:', error);
        res.status(500).json({
            success: false,
            message: '获取支付密码设置状态失败'
        });
    }
});

// 验证支付密码中间件
const verifyPayPassword = async (req, res, next) => {
    try {
        const { payPassword } = req.body;
        
        if (!payPassword) {
            return res.status(400).json({
                success: false,
                message: '请输入支付密码'
            });
        }

        const user = await User.findById(req.user.id).select('+payPassword');
        
        if (!user.hasPayPassword) {
            return res.status(400).json({
                success: false,
                message: '请先设置支付密码'
            });
        }

        const isMatch = await bcrypt.compare(payPassword, user.payPassword);
        
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: '支付密码错误'
            });
        }

        next();
    } catch (error) {
        console.error('验证支付密码失败:', error);
        res.status(500).json({
            success: false,
            message: '验证支付密码失败'
        });
    }
};

// 充值接口
router.post('/recharge', upload.single('proof'), async (req, res) => {
    try {
        console.log('收到充值请求:', req.body);
        console.log('上传的文件:', req.file);
        
        const { amount, pathId, userId } = req.body;
        
        if (!amount || isNaN(parseFloat(amount))) {
            return res.status(400).json({
                success: false,
                message: '请提供有效的充值金额'
            });
        }

        if (!pathId) {
            return res.status(400).json({
                success: false,
                message: '请选择充值方式'
            });
        }
        
        // 验证充值路径是否存在
        const rechargePath = await RechargePath.findById(pathId);
        if (!rechargePath) {
            return res.status(404).json({
                success: false,
                message: '充值方式不存在'
            });
        }
        
        // 提取上传的凭证文件路径
        let proofPath = null;
        if (req.file) {
            // 存储相对路径，方便前端访问
            proofPath = `/uploads/proofs/${req.file.filename}`;
            console.log('充值凭证路径:', proofPath);
        }

        // 创建充值交易前，查用户余额
        const user = await User.findById(req.user.id);
        
        // 映射充值路径类型到Transaction允许的paymentMethod
        const getPaymentMethod = (rechargePathType) => {
            const typeMapping = {
                'alipay': 'alipay',
                'wechat': 'wechatpay',
                'bank': 'bank',
                'other': 'manual' // 将'other'映射为'manual'
            };
            return typeMapping[rechargePathType] || 'manual';
        };
        
        const transaction = new Transaction({
            user: req.user.id,
            type: 'recharge',
            amount: parseFloat(amount),
            paymentMethod: getPaymentMethod(rechargePath.type),
            paymentAccount: rechargePath.account || 'default',
            receiveAccount: rechargePath.receiver || 'system',
            proof: proofPath,
            status: 'pending',
            rechargePath: pathId,
            balanceBefore: user.balance, // 变更前余额
            balanceAfter: user.balance + parseFloat(amount) // 变更后余额
        });

        await transaction.save();
        console.log('充值交易已创建:', transaction._id);

        res.status(200).json({
            success: true,
            message: '充值交易已创建',
            data: transaction
        });
    } catch (error) {
        console.error('充值接口错误:', error);
        res.status(500).json({
            success: false,
            message: '充值失败',
            error: error.message
        });
    }
});

// 提现接口
router.options('/withdraw', cors()); // 显式处理预检请求
router.post('/withdraw', auth, upload.single('qrcode'), verifyPayPassword, async (req, res) => {
    try {
        console.log('=== 提现请求开始处理 ===');
        console.log('DEBUG: req.body content:', req.body);
        console.log('请求体:', JSON.stringify(req.body, null, 2));
        console.log('用户信息:', JSON.stringify(req.user, null, 2));
        console.log('上传文件:', req.file ? JSON.stringify(req.file, null, 2) : '无文件');

        const { amount, receiveAccount, receiver } = req.body;
        
        // 验证必填字段
        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            console.log('金额验证失败');
            return res.status(400).json({
                success: false,
                message: '请提供有效的提现金额'
            });
        }

        if (!receiveAccount) {
            console.log('收款账号验证失败');
            return res.status(400).json({
                success: false,
                message: '请提供收款账号'
            });
        }

        if (!receiver) {
            console.log('收款人验证失败');
            return res.status(400).json({
                success: false,
                message: '请提供收款人姓名'
            });
        }
        
        // 验证提现二维码（选填，但如果上传了就要验证格式）
        if (req.file) {
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowedTypes.includes(req.file.mimetype)) {
                console.log('二维码文件类型验证失败:', req.file.mimetype);
                return res.status(400).json({
                    success: false,
                    message: '请上传支持的图片格式：JPG、PNG、GIF、WEBP'
                });
            }
        }

        // 获取用户信息
        const userForWithdraw = await User.findById(req.user._id);
        console.log('查询到的用户信息:', userForWithdraw ? JSON.stringify(userForWithdraw, null, 2) : '未找到');

        if (!userForWithdraw) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }

        // 验证余额（只校验，不扣款）
        if (userForWithdraw.balance < parseFloat(amount)) {
            console.log('余额不足');
            return res.status(400).json({
                success: false,
                message: '余额不足'
            });
        }

        // 上传二维码图片到Cloudinary（选填）
        let qrcodeUrl = null;
        if (req.file) {
            try {
                console.log('开始上传二维码到Cloudinary...');
                const cloudinaryResult = await cloudinary.uploader.upload(req.file.path, {
                    folder: 'withdraw-qrcodes',
                    public_id: `withdraw_${Date.now()}_${Math.round(Math.random() * 1E9)}`,
                    resource_type: 'image'
                });
                
                qrcodeUrl = cloudinaryResult.secure_url;
                console.log('Cloudinary上传成功:', qrcodeUrl);
                
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
                    message: '二维码上传失败，请重试'
                });
            }
        }

        console.log('准备创建提现交易...');
        const transactionData = {
            user: userForWithdraw._id,
            type: 'withdraw',
            amount: amount,
            paymentMethod: 'bank',
            paymentAccount: 'system',
            receiveAccount: receiveAccount,
            receiver: receiver,
            qrcode: qrcodeUrl, // 使用Cloudinary URL
            status: 'pending',
            balanceBefore: userForWithdraw.balance, // 记录当前余额
            balanceAfter: userForWithdraw.balance,  // 审核前余额不变
            createdAt: new Date()
        };
        console.log('交易数据:', transactionData);
        
        const transaction = new Transaction(transactionData);
        console.log('交易对象创建成功，准备保存...');
        await transaction.save();
        console.log('交易保存成功，ID:', transaction._id);
        
        // 创建余额变动记录（仅记录申请，余额不变）
        const BalanceLog = mongoose.model('BalanceLog');
        const balanceLog = new BalanceLog({
            user: userForWithdraw._id,
            type: 'withdraw',
            amount: amount,
            beforeBalance: userForWithdraw.balance,
            afterBalance: userForWithdraw.balance,
            transaction: transaction._id,
            remark: '提现申请待审核（未扣款）'
        });
        await balanceLog.save();
        console.log('余额变动记录已创建');

        res.status(201).json({
            success: true,
            message: '提现申请已提交，请等待审核',
            data: {
                transactionId: transaction._id,
                amount: transaction.amount,
                status: transaction.status,
                message: '您的提现申请已提交，请等待审核'
            }
        });
        console.log('=== 提现请求处理完成 ===');
    } catch (error) {
        console.error('=== 提现请求处理失败 ===');
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
            message: '创建提现交易失败: ' + error.message
        });
    }
});

// 获取交易记录
router.get('/transactions', async (req, res) => {
    try {
        const userId = req.user.id;
        // 使用 .populate('relatedInfo', 'title') 来关联查询信息的标题
        const allTransactions = await Transaction.find({ user: userId })
            .populate('relatedInfo', '_id') // 只需要关联的_id
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            success: true,
            data: allTransactions,
            total: allTransactions.length
        });
    } catch (error) {
        console.error('获取交易记录错误:', error);
        res.status(500).json({
            success: false,
            message: '获取交易记录失败'
        });
    }
});

// 审核交易
router.post('/review/:transactionId', upload.single('proof'), async (req, res) => {
    try {
        const { transactionId } = req.params;
        const { status, remark } = req.body;
        
        // 验证状态
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: '无效的审核状态'
            });
        }
        
        // 查找交易
        const transaction = await Transaction.findById(transactionId);
        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: '交易不存在'
            });
        }
        
        // 提取上传的凭证文件路径
        let proofPath = null;
        if (req.file) {
            proofPath = `/uploads/proofs/${req.file.filename}`;
            console.log('审核凭证路径:', proofPath);
        }
        
        // 审核通过时更新用户余额和交易余额字段
        if (status === 'approved' || status === 'completed') {
            try {
                console.log('=== 开始审核流程 ===');
                console.log('交易ID:', transactionId);
                console.log('交易类型:', transaction.type);
                console.log('交易金额:', transaction.amount);
                console.log('审核状态:', status);
                
                // 查询用户
                const user = await User.findById(transaction.user);
                console.log('查询到的用户信息:', user ? {
                    id: user._id,
                    balance: user.balance,
                    username: user.username
                } : '未找到用户');
                
                if (!user) {
                    console.error(`未找到用户 - 用户ID: ${transaction.user}`);
                    throw new Error('未找到相关用户');
                }

                // 记录更新前的余额
                const oldBalance = user.balance;
                console.log(`更新前用户余额: ${oldBalance}`);
                
                // 根据交易类型更新余额
                if (transaction.type === 'recharge') {
                    // 用户充值，余额增加
                    const newBalance = Number(oldBalance) + Number(transaction.amount);
                    user.balance = newBalance;
                    console.log(`用户充值: 余额从 ${oldBalance} 增加到 ${newBalance}`);
                    
                    // 立即保存用户余额更新
                    await user.save();
                    console.log('用户余额更新已保存');
                    
                    // 验证余额是否真的更新了
                    const updatedUser = await User.findById(user._id);
                    console.log('验证用户余额更新:', {
                        oldBalance,
                        newBalance: updatedUser.balance,
                        expectedBalance: user.balance
                    });
                    
                    if (updatedUser.balance !== user.balance) {
                        console.error('余额更新验证失败！');
                        throw new Error('余额更新失败，请重试');
                    }
                } else if (transaction.type === 'withdraw') {
                    // 审核通过时才真正扣款
                    if (Number(oldBalance) < Number(transaction.amount)) {
                        throw new Error(`用户余额不足，当前余额: ${oldBalance}, 提现金额: ${transaction.amount}`);
                    }
                    // 用户提现，余额减少
                    const newBalance = Number(oldBalance) - Number(transaction.amount);
                    user.balance = newBalance;
                    // 不再处理 user.frozen
                    console.log(`用户提现: 余额从 ${oldBalance} 减少到 ${newBalance}`);
                    await user.save();
                    console.log('用户余额更新已保存');
                }
                
                transaction.balanceAfter = user.balance;
                
                // 创建余额变动记录
                const BalanceLog = mongoose.model('BalanceLog');
                const balanceLog = new BalanceLog({
                    user: user._id,
                    type: transaction.type,
                    amount: transaction.amount,
                    beforeBalance: oldBalance,
                    afterBalance: user.balance,
                    transaction: transaction._id,
                    remark: `交易审核${status === 'approved' || status === 'completed' ? '通过' : '拒绝'}: ${remark || ''}`
                });
                await balanceLog.save();
                console.log('余额变动记录已创建');

                // 更新交易状态
                transaction.status = status;
                transaction.remark = remark || '';
                transaction.reviewedBy = req.user.id;
                transaction.reviewedAt = new Date();
                if (proofPath) {
                    transaction.proof = proofPath;
                }

                // 保存交易更新
                await transaction.save();
                console.log('交易记录已更新');
                
                // 再次验证余额更新是否持久化
                const finalUser = await User.findById(user._id);
                console.log('最终用户余额验证:', {
                    expectedBalance: user.balance,
                    actualBalance: finalUser.balance
                });
                
                if (finalUser.balance !== user.balance) {
                    console.error('最终余额验证失败！');
                    throw new Error('余额更新未持久化，请重试');
                }

                // 更新管理员余额
                const adminUser = await User.findOne({ role: 'admin' });
                if (adminUser) {
                    console.log('更新前管理员余额:', adminUser.balance);
                    const oldAdminBalance = adminUser.balance;
                    
                    if (transaction.type === 'recharge') {
                        // 用户充值，管理员余额增加
                        adminUser.balance = Number(oldAdminBalance) + Number(transaction.amount);
                        console.log(`管理员余额增加: ${oldAdminBalance} -> ${adminUser.balance}`);
                    } else if (transaction.type === 'withdraw') {
                        // 用户提现，管理员余额减少
                        adminUser.balance = Number(oldAdminBalance) - Number(transaction.amount);
                        console.log(`管理员余额减少: ${oldAdminBalance} -> ${adminUser.balance}`);
                    }
                    
                    // 保存管理员余额更新
                    await adminUser.save();
                    console.log('管理员余额更新已保存');
                    
                    // 验证管理员余额是否真的更新了
                    const updatedAdmin = await User.findOne({ role: 'admin' });
                    console.log('验证管理员余额更新:', {
                        oldBalance: oldAdminBalance,
                        newBalance: updatedAdmin.balance,
                        expectedBalance: adminUser.balance
                    });
                    
                    if (updatedAdmin.balance !== adminUser.balance) {
                        console.error('管理员余额更新验证失败！');
                        throw new Error('管理员余额更新失败，请重试');
                    }
                }
            } catch (error) {
                console.error('审核流程错误:', error);
                throw error;
            }
        } else {
            // 如果审核未通过，更新交易状态并解冻金额
            transaction.status = status;
            transaction.remark = remark || '';
            transaction.reviewedBy = req.user.id;
            transaction.reviewedAt = new Date();
            if (proofPath) {
                transaction.proof = proofPath;
            }
            
            // 解冻金额并返还余额
            if (transaction.type === 'withdraw') {
                // 审核拒绝时不做余额变动
                // 只更新状态，不返还余额
            }
            
            await transaction.save();
        }
        
        console.log('交易审核完成:', transaction._id);

        res.status(200).json({
            success: true,
            message: '审核完成',
            data: {
                transactionId: transaction._id,
                status: transaction.status,
                message: `交易已${status === 'approved' ? '通过' : '拒绝'}`,
                user: {
                    id: transaction.user,
                    email: transaction.user ? (await User.findById(transaction.user)).email : null,
                    phone: transaction.user ? (await User.findById(transaction.user)).phone : null
                }
            }
        });
    } catch (error) {
        console.error('审核交易错误:', error);
        res.status(500).json({
            success: false,
            message: '审核交易失败: ' + error.message
        });
    }
});

// 更新交易状态
router.put('/transaction/:id/status', auth, (req, res) => {
    const updateTransactionStatus = async () => {
        try {
            const { status } = req.body;
            const transaction = await Transaction.findById(req.params.id);
            
            if (!transaction) {
                return res.status(404).json({
                    success: false,
                    message: '交易记录不存在'
                });
            }

            // 更新交易状态
            transaction.status = status;
            await transaction.save();

            // 如果交易完成，重新计算系统盈利
            if (status === 'SUCCESS') {
                try {
                    const { calculateTotalProfit } = require('./infoRoutes');
                    await calculateTotalProfit();
                } catch (error) {
                    console.error('重新计算系统盈利失败:', error);
                }
            }

            res.json({
                success: true,
                message: '交易状态更新成功',
                data: transaction
            });
        } catch (error) {
            console.error('更新交易状态失败:', error);
            res.status(500).json({
                success: false,
                message: '更新交易状态失败'
            });
        }
    };

    updateTransactionStatus();
});

module.exports = router; 
