const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const textParser = bodyParser.text({ type: '*/*' }); // 添加text解析器
const jsonBodyParser = bodyParser.json();
const urlencodedParser = bodyParser.urlencoded({ extended: true }); // 添加urlencoded解析器
const bcrypt = require('bcryptjs'); // 密码加密库
const User = require('../models/User'); // 用户模型
const { protect } = require('../middleware/auth'); // 鉴权中间件
const mongoose = require('mongoose'); // 引入mongoose

// 修改支付密码
router.post('/pay-password', protect, jsonBodyParser, async (req, res) => {
    try {
        console.log('收到修改支付密码请求，req.body:', req.body);
        let payPassword = null;
        
        payPassword = req.body.payPassword || req.body.password;

        if (!payPassword) {
            return res.status(400).json({
                success: false,
                message: '支付密码不能为空'
            });
        }

        if (!/^\d{6}$/.test(payPassword)) {
            return res.status(400).json({
                success: false,
                message: '支付密码必须是6位数字'
            });
        }

        const user = await User.findById(req.user.id).select('+payPassword +hasPayPassword'); // Select hasPayPassword as well
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }

        const { currentPassword } = req.body;
        if (!currentPassword) {
            return res.status(400).json({
                success: false,
                message: '原支付密码不能为空'
            });
        }

        if (!user.hasPayPassword || !user.payPassword) {
             return res.status(400).json({
                 success: false,
                 message: '您尚未设置支付密码，请先设置'
             });
        }

        const isCurrentPasswordMatch = await bcrypt.compare(currentPassword, user.payPassword);
        console.log('DEBUG: Stored payPassword (from DB): ', user.payPassword ? '存在' : '不存在');
        console.log('DEBUG: Received currentPassword (from frontend): ', currentPassword);
        console.log('DEBUG: bcrypt.compare result: ', isCurrentPasswordMatch);
        if (!isCurrentPasswordMatch) {
            return res.status(400).json({
                success: false,
                message: '原支付密码不正确'
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPayPassword = await bcrypt.hash(payPassword, salt);

        user.payPassword = hashedPayPassword;
        user.hasPayPassword = true;
        user.payPasswordAttempts = 0;
        user.payPasswordLockUntil = null;

        console.log(`[${new Date().toISOString()}] DEBUG: Before save (modify pay password): hasPayPassword=${user.hasPayPassword}, payPassword=${user.payPassword ? '已填充' : '未填充'}`);
        await user.save();
        console.log(`[${new Date().toISOString()}] DEBUG: After save (modify pay password): hasPayPassword=${user.hasPayPassword}, payPassword=${user.payPassword ? '已填充' : '未填充'}`);

        res.json({
            success: true,
            message: '支付密码修改成功'
        });
    } catch (error) {
        console.error('修改支付密码失败:', error);
        res.status(500).json({
            success: false,
            message: '修改支付密码失败'
        });
    }
});

// 首次设置支付密码
router.post('/set-pay-password', protect, jsonBodyParser, async (req, res) => {
    try {
        console.log('收到设置支付密码请求，原始body:', req.body);
        let payPassword = null;
        
        payPassword = req.body.payPassword || req.body.password;

        if (!payPassword) {
            return res.status(400).json({
                success: false,
                message: '支付密码不能为空'
            });
        }

        if (!/^\d{6}$/.test(payPassword)) {
            return res.status(400).json({
                success: false,
                message: '支付密码必须是6位数字'
            });
        }

        const user = await User.findById(req.user.id).select('+hasPayPassword'); // Select hasPayPassword as well
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }

        if (user.hasPayPassword) {
            return res.status(400).json({
                success: false,
                message: '已设置过支付密码，请使用修改密码功能'
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPayPassword = await bcrypt.hash(payPassword, salt);

        user.payPassword = hashedPayPassword;
        user.hasPayPassword = true;
        user.payPasswordAttempts = 0;
        user.payPasswordLockUntil = null;

        console.log(`[${new Date().toISOString()}] DEBUG: Before save (set pay password): hasPayPassword=${user.hasPayPassword}, payPassword=${user.payPassword ? '已填充' : '未填充'}`);
        await user.save();
        console.log(`[${new Date().toISOString()}] DEBUG: After save (set pay password): hasPayPassword=${user.hasPayPassword}, payPassword=${user.payPassword ? '已填充' : '未填充'}`);

        res.json({
            success: true,
            message: '支付密码设置成功'
        });
    } catch (error) {
        console.error('设置支付密码失败:', error);
        res.status(500).json({
            success: false,
            message: '设置支付密码失败'
        });
    }
});

// 验证支付密码
router.post('/verify-pay-password', protect, jsonBodyParser, async (req, res) => {
    try {
        const { payPassword } = req.body;
        
        if (!payPassword) {
            return res.status(400).json({
                success: false,
                message: '支付密码不能为空'
            });
        }

        // 获取用户信息（包含支付密码）
        const user = await User.findById(req.user.id).select('+payPassword +payPasswordAttempts +payPasswordLockUntil');
        
        if (!user.hasPayPassword) {
            return res.status(400).json({
                success: false,
                message: '未设置支付密码'
            });
        }

        // 检查是否被锁定
        if (user.payPasswordLockUntil && user.payPasswordLockUntil > Date.now()) {
            return res.status(403).json({
                success: false,
                message: `支付密码已被锁定，请${Math.ceil((user.payPasswordLockUntil - Date.now()) / 1000 / 60)}分钟后再试`
            });
        }

        // 验证支付密码
        const isMatch = await bcrypt.compare(payPassword, user.payPassword);
        
        if (!isMatch) {
            // 增加错误尝试次数
            user.payPasswordAttempts = (user.payPasswordAttempts || 0) + 1;
            
            // 如果错误次数达到5次，锁定30分钟
            if (user.payPasswordAttempts >= 5) {
                user.payPasswordLockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30分钟
                await user.save();
                return res.status(403).json({
                    success: false,
                    message: '支付密码错误次数过多，账户已被锁定30分钟'
                });
            }
            
            await user.save();
            return res.status(400).json({
                success: false,
                message: `支付密码错误，还剩${5 - user.payPasswordAttempts}次尝试机会`
            });
        }

        // 验证成功，重置错误次数
        user.payPasswordAttempts = 0;
        user.payPasswordLockUntil = null;
        await user.save();

        res.json({
            success: true,
            message: '支付密码验证成功'
        });
    } catch (error) {
        console.error('验证支付密码失败:', error);
        res.status(500).json({
            success: false,
            message: '验证支付密码失败'
        });
    }
});

// 检查是否已设置支付密码
router.get('/check-pay-password', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('hasPayPassword');
        
        res.json({
            success: true,
            data: {
                hasPayPassword: user.hasPayPassword
            }
        });
    } catch (error) {
        console.error('检查支付密码状态失败:', error);
        res.status(500).json({
            success: false,
            message: '检查支付密码状态失败'
        });
    }
});

// 获取当前用户的资金明细 (分页)
router.get('/transactions', protect, async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: '用户未认证' });
        }

        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10; // 默认每页10条
        const skip = (page - 1) * limit;

        const userTransactions = await mongoose.model('Transaction')
            .find({ user: userId })
            .sort({ createdAt: -1 }) // 按创建时间降序
            .skip(skip)
            .limit(limit)
            .lean(); // 使用 .lean() 获取普通JS对象，可能更高效

        const totalTransactions = await mongoose.model('Transaction').countDocuments({ user: userId });
        const totalPages = Math.ceil(totalTransactions / limit);

        res.json({
            success: true,
            message: '用户资金明细获取成功',
            data: userTransactions,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalItems: totalTransactions,
                itemsPerPage: limit
            }
        });

    } catch (error) {
        console.error('获取用户资金明细失败:', error);
        res.status(500).json({
            success: false,
            message: '获取用户资金明细失败',
            error: error.message
        });
    }
});

// 获取邀请用户列表
router.get('/invited-users', protect, async (req, res) => {
    try {
        console.log(`[${new Date().toISOString()}] DEBUG: 尝试获取用户邀请列表...`);
        const currentUserId = req.user._id;

        if (!currentUserId) {
            console.warn(`[${new Date().toISOString()}] DEBUG: req.user._id 不存在，无法获取邀请用户。`);
            return res.status(401).json({
                success: false,
                message: '未授权：无法识别用户身份'
            });
        }

        console.log(`[${new Date().toISOString()}] DEBUG: 查询用户 ${currentUserId} 邀请的用户...`);
        const invitedUsers = await User.find({ referrer: currentUserId }).select('-password');
        console.log(`[${new Date().toISOString()}] DEBUG: 找到 ${invitedUsers.length} 个邀请用户。`);

        res.json({
            success: true,
            message: '成功获取邀请用户列表',
            invitedUsers: invitedUsers
        });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] 获取邀请用户列表错误:`, error);
        if (error.stack) {
            console.error(`[${new Date().toISOString()}] DEBUG: 错误堆栈:`, error.stack);
        }
        res.status(500).json({
            success: false,
            message: '获取邀请用户列表失败',
            error: error.message
        });
    }
});

// 获取单个用户信息
router.get('/:id', protect, async (req, res) => {
    try {
        const userId = req.params.id;
        
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: '无效的用户ID格式'
            });
        }

        const user = await User.findById(userId)
            .select('-password -payPassword hasPayPassword payPasswordLockUntil') // 显式选择支付密码状态相关字段
            .populate('referrer', 'username numericId'); // 填充推荐人信息

        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }

        console.log(`[${new Date().toISOString()}] DEBUG: User ID: ${userId}`);
        console.log(`[${new Date().toISOString()}] DEBUG: hasPayPassword: ${user.hasPayPassword}`);
        console.log(`[${new Date().toISOString()}] DEBUG: payPasswordLockUntil: ${user.payPasswordLockUntil}`);

        // 计算支付密码状态
        let paymentPasswordStatus = '未设置';
        if (user.hasPayPassword) {
            paymentPasswordStatus = '已设置';
            if (user.payPasswordLockUntil && user.payPasswordLockUntil > new Date()) {
                paymentPasswordStatus = '已锁定';
            }
        }

        // 返回用户数据，包含支付密码状态
        const userData = user.toObject();
        userData.paymentPasswordStatus = paymentPasswordStatus;

        res.json({
            success: true,
            message: '获取用户信息成功',
            data: userData
        });
    } catch (error) {
        console.error('获取用户信息失败:', error);
        res.status(500).json({
            success: false,
            message: '获取用户信息失败',
            error: error.message
        });
    }
});

module.exports = router; 