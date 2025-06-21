console.log('[info.js] __dirname:', __dirname, ' __filename:', __filename);
const express = require('express');
const router = express.Router();
const Info = require('../models/Info');
const { protect, restrictToAdmin } = require('../middleware/auth');
const cloudinary = require('../utils/cloudinary');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Purchase = require('../models/Purchase');
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const SystemSetting = require('../models/SystemSetting');
const { scheduleAutoRepayments, executeAutoRepayments } = require('../utils/autoRepaymentTasks');

// 确保上传目录存在
const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'info');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置存储
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // 生成唯一文件名
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
    try {
        // 检查文件类型
        if (!file.mimetype.startsWith('image/')) {
            console.error('文件类型错误:', file.mimetype);
            return cb(new Error('只允许上传图片文件！'), false);
        }
        
        // 检查文件扩展名
        const ext = path.extname(file.originalname).toLowerCase();
        const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        if (!allowedExts.includes(ext)) {
            console.error('文件扩展名错误:', ext);
            return cb(new Error('不支持的图片格式！'), false);
        }
        
        console.log('文件验证通过:', file.originalname);
        cb(null, true);
    } catch (error) {
        console.error('文件过滤错误:', error);
        cb(error);
    }
};

// 创建multer实例
const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    }
});

// 上传图片（用multer解析FormData）
router.post('/upload/image', protect, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: '请选择要上传的图片' });
        }
        // 调试日志：显示上传图片的文件名
        console.log('[图片上传] 收到文件:', req.file.originalname, '存储路径:', req.file.path);
        // 上传到 cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'uploads',
            public_id: Date.now() + '-' + req.file.originalname
        });
        // 删除本地临时文件
        fs.unlinkSync(req.file.path);
        res.json({
            success: true,
            data: result.secure_url,
            url: result.secure_url
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message || '图片上传失败' });
    }
});

// 工具函数：修正数字字段
function fixNumberFields(info) {
    if (!info) return info;
    // 需要修正的字段
    const fields = ['price', 'loanAmount', 'period', 'repaymentAmount'];
    fields.forEach(f => {
        if (info[f] === "" || info[f] === undefined || info[f] === null) {
            info[f] = 0;
        }
        // 如果是字符串数字也转为数字
        if (typeof info[f] === 'string' && /^\d+$/.test(info[f])) {
            info[f] = Number(info[f]);
        }
    });
    return info;
}

// 首页信息流接口：支持分页、分类、搜索和状态过滤
router.get('/list', protect, async (req, res) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    try {
        // 获取分页、分类、搜索、状态、日期参数
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const category = req.query.category;
        const search = req.query.search;
        const statusFilter = req.query.status; // 获取前端发送的状态过滤参数
        const startDate = req.query.startDate; // 获取开始日期参数
        const endDate = req.query.endDate;     // 获取结束日期参数

        // 查询条件
        let query = {
            // 默认只查已发布的信息，除非前端指定了过滤状态为 offline
            status: statusFilter === 'offline' ? 'OFFLINE' : 'published',
        };

        // 如果用户不是管理员，才应用默认的排除已售出信息的条件
        if (req.user.role !== 'admin' && statusFilter !== 'sold') {
             query.purchasers = { $exists: true, $size: 0 }; // 购买者数组存在且长度为0
        }

        // 根据前端的状态过滤参数调整查询条件
        if (statusFilter === 'published') { // 前端选择"待售"
            // 查询 status 是 published 并且 purchasers 数组为空的信息
            query.status = 'published';
            query.purchasers = { $exists: true, $size: 0 }; // 购买者数组存在且长度为0
        } else if (statusFilter === 'sold') { // 前端选择"已售出"
            // 查询 status 是 published 并且 purchasers 数组不为空的信息
            query.status = 'published';
            query.purchasers = { $exists: true, $not: { $size: 0 } }; // 购买者数组存在且长度不为0
        } else if (statusFilter === 'offline') { // 前端选择"已下架"
            // 只查询 status 是 OFFLINE 的信息
            query.status = 'OFFLINE';
            delete query.purchasers; // 移除 purchasers 条件
        } else { // 前端选择"所有状态"或未指定
            // 对于非管理员用户，在未指定状态过滤时，默认只显示待售信息
            // 对于管理员用户，在未指定状态过滤时，显示所有published信息（包括待售和已售出）
            if (req.user.role !== 'admin') {
                 query.status = 'published';
                 query.purchasers = { $exists: true, $size: 0 };
            } else {
                 query.status = 'published'; // Admin sees all published by default
                 delete query.purchasers; // Admin sees all published, regardless of purchasers array size
            }
        }

        // 搜索条件
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } }
            ];
        }
        
        // 日期范围过滤 (假设 publishTime 字段存在且是日期类型)
        if (startDate || endDate) {
            query.publishTime = {};
            if (startDate) {
                query.publishTime.$gte = new Date(startDate); // 大于等于开始日期
            }
            if (endDate) {
                // 结束日期通常是到当天的最后一刻，所以加一天减一毫秒
                const endDateObj = new Date(endDate);
                endDateObj.setDate(endDateObj.getDate() + 1);
                endDateObj.setMilliseconds(endDateObj.getMilliseconds() - 1);
                query.publishTime.$lte = endDateObj; // 小于等于结束日期（当天的最后一刻）
            }
        }


        // 查询总数和分页数据
        const total = await Info.countDocuments(query);
        const infos = await Info.find(query)
            .sort({ isTop: -1, createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('author', 'username')
            .populate('purchasers', 'username'); // 确保 populated purchasers 包含 username

        // 修正所有数字字段
        const fixedInfos = infos.map(info => fixNumberFields(info.toObject()));

        // 为每条信息添加是否待处理的标记
        const now = new Date();
        const eightHoursLater = new Date(Date.now() + 8 * 60 * 60 * 1000);

        const processedInfos = fixedInfos.map(info => {
            const isPending = !info.isPaid &&
                              ( (info.expiryTime && new Date(info.expiryTime) <= now) || 
                                info.isAutoRepaymentScheduled ||
                                (info.expiryTime && new Date(info.expiryTime) > now && new Date(info.expiryTime) <= eightHoursLater && !info.isAutoRepaymentScheduled)
                              );
            
            // 计算时间相关字段
            let purchaseTime = null;
            let expiryTime = null;
            let remainingTime = null;
            
            if (info.purchaseTime) {
                purchaseTime = new Date(info.purchaseTime).getTime();
                if (info.period) {
                    expiryTime = purchaseTime + (info.period * 24 * 60 * 60 * 1000);
                    remainingTime = Math.max(0, expiryTime - Date.now());
                }
            }
            
            return { 
                ...info, 
                isPendingAutoRepayment: isPending,
                purchaseTime,
                expiryTime,
                remainingTime
            };
        });

        // 在返回数据中手动添加 saleStatus 字段，方便前端判断
        const infosWithSaleStatusAndPendingMark = processedInfos.map(info => {
            // 如果信息已经设置了 saleStatus，直接使用
            if (info.saleStatus) {
                return { ...info, _id: info._id };
            }

            // 如果没有设置 saleStatus，则根据 purchasers 和 isPaid 动态判断
            let saleStatus;
            if (info.status === 'OFFLINE') {
                saleStatus = '已下架';
            } else if (info.isPaid) {
                saleStatus = '已还款'; // 优先显示已还款，即使它可能也符合已售出
            } else if (info.purchasers && info.purchasers.length > 0) {
                saleStatus = '售出';
            } else {
                saleStatus = '待售';
            }
            return { ...info, saleStatus, _id: info._id }; // 确保 _id 被正确传递
        });

        res.json({
            success: true,
            data: {
                list: infosWithSaleStatusAndPendingMark,
                currentPage: page,
                totalPages: Math.ceil(total / limit)
            },
            total // 返回总条数
        });
    } catch (error) {
        console.error('获取信息列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取信息列表失败'
        });
    }
});

// 获取服务器时间
router.get('/time', protect, (req, res) => {
    try {
        res.json({
            success: true,
            serverTime: new Date().toISOString()
        });
    } catch (error) {
        console.error('获取服务器时间失败:', error);
        res.status(500).json({
            success: false,
            message: '获取服务器时间失败'
        });
    }
});

// 新增：获取用户已购买信息（通知页）
router.get('/purchased', protect, async (req, res) => {
    try {
        console.log('获取已购信息请求，用户ID:', req.user._id);
        const infos = await Info.find({
            purchasers: { $in: [req.user._id] },
            status: 'published'
        })
        .sort({ createdAt: -1 })
        .populate('author', 'username');
        
        console.log('查询到的已购信息数量:', infos.length);
        console.log('第一条信息示例:', infos[0] ? {
            id: infos[0]._id,
            title: infos[0].title,
            status: infos[0].status,
            purchasers: infos[0].purchasers,
            saleStatus: infos[0].saleStatus
        } : null);
        
        // 修正所有数字字段
        const fixedInfos = infos.map(info => fixNumberFields(info.toObject()));
        res.json({
            success: true,
            data: fixedInfos
        });
    } catch (error) {
        console.error('获取已购信息失败:', error);
        res.status(500).json({
            success: false,
            message: '获取已购信息失败',
            error: error.message
        });
    }
});

// Temporary route to manually trigger scheduling and execution for testing
router.get('/trigger-auto-repayment-tasks', protect, restrictToAdmin, async (req, res) => {
    await scheduleAutoRepayments();
    await executeAutoRepayments();
    res.json({ success: true, message: 'Auto-repayment scheduling and execution triggered.' });
});

// 获取单个信息
router.get('/:id', protect, async (req, res) => {
    try {
        // 添加缓存控制头
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        // 查询信息，并populate author 和 purchasers
        const info = await Info.findById(req.params.id)
            .populate('author', 'username')
            .populate('purchasers', 'username'); // 添加 populate purchasers

        if (!info) {
            return res.status(404).json({
                success: false,
                message: '信息不存在'
            });
        }

        // 添加调试日志
        console.log('数据库查询结果:', {
            id: info._id,
            period: info.period,
            loanPeriod: info.loanPeriod, // 检查是否有 loanPeriod 字段
            rawInfo: info.toObject() // 输出完整的原始数据
        });
        
        // 修正数字字段
        const fixedInfo = fixNumberFields(info.toObject());

        // 添加调试日志
        console.log('修正后的数据:', {
            id: fixedInfo._id,
            period: fixedInfo.period,
            loanPeriod: fixedInfo.loanPeriod
        });

        // 计算并添加 saleStatus 字段，与 /list 接口逻辑一致
        let saleStatus = '待售'; // 默认待售
        if (fixedInfo.status === 'OFFLINE') {
            saleStatus = '已下架';
        } else if (fixedInfo.status === 'published') {
            if (fixedInfo.purchasers && fixedInfo.purchasers.length > 0) {
                saleStatus = '售出';
            }
        }
        fixedInfo.saleStatus = saleStatus; // 将计算出的 saleStatus 添加到返回对象

        // 判断当前用户是否是管理员 或 已购买
        let isPurchasedOrAdmin = false;
        if (req.user) {
            isPurchasedOrAdmin = req.user.role === 'admin' || info.purchasers.some(purchaser => purchaser && purchaser._id && purchaser._id.equals(req.user._id));
        }

        // 构建返回数据
        let responseInfo = {
            _id: fixedInfo._id,
            title: fixedInfo.title, // 标题（通常包含姓名）
            authorName: fixedInfo.authorName || (fixedInfo.author ? fixedInfo.author.username : ''), // 作者姓名
            loanAmount: fixedInfo.loanAmount || 0, // 借款金额
            imageUrls: fixedInfo.imageUrls || [], // 封面图
            saleStatus: fixedInfo.saleStatus,
            isPurchased: isPurchasedOrAdmin // 返回给前端的字段名仍然使用 isPurchased 方便前端判断是否显示完整详情
        };

        if (isPurchasedOrAdmin) {
            // 如果是管理员 或 已购买，返回所有详细信息
            responseInfo = {
                ...fixedInfo,
                price: fixedInfo.price || 0,
                isPurchased: isPurchasedOrAdmin,
                // 确保 populated fields (如 author, purchasers) 在详细信息中
                author: info.author,
                purchasers: info.purchasers
            };
             // 如果有 expiryTime 也包含
            if (info.expiryTime) {
                responseInfo.expiryTime = info.expiryTime;
            }
        } else {
             // 如果未购买且不是管理员，只返回部分信息
             // 确保只包含公开字段，并清除敏感信息
            responseInfo.content = '需要购买后查看详情'; // 隐藏详细内容
            // 清除其他敏感字段 (这里只列举一些可能的，需要根据实际Info model确定)
            // 例如：联系方式、详细地址、其他私密信息等
            delete responseInfo.contactInfo; // 假设有联系方式字段
            delete responseInfo.privateNotes; // 假设有私密笔记字段
            // ... 添加其他需要隐藏的字段

            // 确保返回周期和还款金额
            responseInfo.period = fixedInfo.period || 0;
            responseInfo.repaymentAmount = fixedInfo.repaymentAmount || '';

            // 在未购买时，只返回第一张图片URL
            responseInfo.imageUrls = fixedInfo.imageUrls && fixedInfo.imageUrls.length > 0 
                                ? [fixedInfo.imageUrls[0]] 
                                : [];

        }

        res.json({
            success: true,
            data: responseInfo
        });
    } catch (error) {
        console.error('获取信息详情失败:', error);
        res.status(500).json({
            success: false,
            message: '获取信息详情失败'
        });
    }
});

// 创建信息
router.post('/', protect, async (req, res) => {
    try {
        // 添加日志，打印完整的 req.body 对象
        console.log('创建信息 - 接收到的完整请求体:', req.body);

        console.log('收到创建信息请求:', {
            body: req.body,
            user: req.user,
            headers: req.headers
        });

        // 添加详细日志，检查接收到的周期相关字段
        console.log('创建信息 - 接收到的周期相关字段:', {
            reqBodyPeriod: req.body.period,
            reqBodyLoanPeriod: req.body.loanPeriod, // 检查是否接收到 loanPeriod (即使前端已改，以防万一)
            reqBodyContent: req.body.content // 检查content，看周期是否在里面
        });
        
        // 验证必要字段
        if (!req.body.title || !req.body.content) {
            return res.status(400).json({
                success: false,
                message: '标题和内容不能为空'
            });
        }

        // 构建信息数据
        const infoData = {
            title: req.body.title.trim(), // 使用姓名作为标题，如果姓名为空则使用默认标题
            content: req.body.content.trim(),
            category: req.body.category || '资讯',
            author: req.user._id,
            authorName: req.user.username,
            status: 'published', // 状态直接设置为 published
            imageUrls: req.body.imageUrls || [],
            isTop: req.body.isTop || false,
            loanAmount: req.body.loanAmount ? parseFloat(req.body.loanAmount) : 0,
            repaymentAmount: req.body.repaymentAmount || '', // 还款金额保持字符串或空
            expiryTime: req.body.expiryTime ? new Date(req.body.expiryTime) : undefined,
        };

        // 从content中提取周期值
        const periodMatch = req.body.content.match(/周期: (\d+)/);
        if (periodMatch && periodMatch[1]) {
            infoData.period = parseInt(periodMatch[1]);
        } else {
            // 如果content中没有周期值，则使用req.body.period
            infoData.period = req.body.period ? parseInt(req.body.period) : 0;
        }
        
        console.log('准备创建的信息数据:', infoData);
        
        // 创建信息
        const info = await Info.create(infoData);
        console.log('信息创建成功:', info);
        
        // 返回成功响应
        res.status(201).json({
            success: true,
            data: info
        });
    } catch (error) {
        console.error('创建信息失败:', error);
        console.error('错误堆栈:', error.stack);
        
        // 返回详细的错误信息
        res.status(500).json({
            success: false,
            message: '创建信息失败',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// 更新信息
router.put('/:id', protect, async (req, res) => {
    try {
        const info = await Info.findById(req.params.id);
        if (!info) {
            return res.status(404).json({
                success: false,
                message: '信息不存在'
            });
        }
        
        if (info.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: '没有权限修改此信息'
            });
        }

        const updatedInfo = await Info.findByIdAndUpdate(
            req.params.id,
            { ...req.body, status: 'published' }, // 使用小写的published
            { new: true }
        );
        
        res.json({
            success: true,
            data: updatedInfo
        });
    } catch (error) {
        console.error('更新信息失败:', error);
        res.status(500).json({
            success: false,
            message: '更新信息失败'
        });
    }
});

// 删除信息
router.delete('/:id', protect, async (req, res) => {
    try {
        const info = await Info.findById(req.params.id);
        if (!info) {
            return res.status(404).json({
                success: false,
                message: '信息不存在'
            });
        }
        
        // 检查权限：无论管理员还是普通用户，已售出信息一律禁止删除
        if (info.purchasers && info.purchasers.length > 0) {
            return res.status(400).json({
                success: false,
                message: '已售出的信息无法删除'
            });
        }

        await info.deleteOne();
        res.json({
            success: true,
            message: '删除成功'
        });
    } catch (error) {
        console.error('删除信息失败:', error);
        res.status(500).json({
            success: false,
            message: '删除信息失败'
        });
    }
});

// Renamed and refactored function for distributing sale funds and commission (NEW)
async function distributeSaleFundsAsync(infoId, buyerUserId, totalAmountPaid) {
    try {
        // 获取返利设置
        const rebateSettings = await SystemSetting.findOne({ key: 'rebate_settings' });
        if (!rebateSettings) {
            console.warn('[DistributeFunds] No rebate settings found, skipping referral commission.');
            return;
        }

        const { inviteRebatePercentage, minRebateAmount } = rebateSettings.value;
        console.log(`[DistributeFunds] Rebate settings - Percentage: ${inviteRebatePercentage}%, Min Amount: ${minRebateAmount}`);

        // 计算返利金额
        const referralCommissionAmount = (totalAmountPaid * inviteRebatePercentage / 100);
        console.log(`[DistributeFunds] Calculated commission amount: ${referralCommissionAmount}`);

        // 检查是否达到最低返利金额
        if (referralCommissionAmount < minRebateAmount) {
            console.log(`[DistributeFunds] Commission amount ${referralCommissionAmount} is below minimum ${minRebateAmount}, skipping.`);
            return;
        }

        // 获取买家和推荐人信息
        const [info, buyerUser] = await Promise.all([
            Info.findById(infoId),
            User.findById(buyerUserId)
        ]);

        if (!info || !buyerUser) {
            console.error('[DistributeFunds] Info or buyer user not found');
            return;
        }

        let referrerUser = null;
        if (buyerUser.referrer) {
            referrerUser = await User.findById(buyerUser.referrer);
            if (!referrerUser) {
                console.warn(`[DistributeFunds] Referrer user ID ${buyerUser.referrer} found in buyer but user not found.`);
            }
        }

        // 计算推荐人返利（如有）
        let rebateAmount = 0;
        let referrer = null;
        if (buyerUser && buyerUser.referrer) {
            // 获取返利设置
            const rebateSettings = await SystemSetting.findOne({ key: 'rebate_settings' });
            if (rebateSettings) {
                const { inviteRebatePercentage, minRebateAmount } = rebateSettings.value;
                
                // 计算返利金额 - 使用loanAmount（购买价格）而不是repaymentAmount（还款金额）
                const calculatedRebateAmount = (Number(info.loanAmount) * inviteRebatePercentage / 100);
                
                // 检查是否达到最低返利金额
                if (calculatedRebateAmount >= minRebateAmount) {
                    referrer = await User.findById(buyerUser.referrer);
                    if (referrer) {
                        rebateAmount = Math.floor(calculatedRebateAmount);
                        if (rebateAmount > 0) {
                            const referrerBalanceBefore = referrer.balance;
                            referrer.balance += rebateAmount;
                            await referrer.save();
                            const referrerBalanceAfter = referrer.balance;
                            await Transaction.create({
                                user: referrer._id,
                                type: 'REFERRAL_COMMISSION',
                                amount: rebateAmount,
                                status: 'approved',
                                paymentMethod: 'INTERNAL_SETTLEMENT',
                                paymentAccount: user ? user._id.toString() : null,
                                receiveAccount: referrer._id.toString(),
                                remark: `获得推荐返利，${user ? user.username : ''}还款`,
                                infoId: info._id,
                                createdAt: new Date(),
                                balanceBefore: referrerBalanceBefore,
                                balanceAfter: referrerBalanceAfter
                            });
                        }
                    }
                }
            }
        }

        // 只为收款方（买家）创建还款流水，到账金额为还款金额-返利
        const buyerReceiveAmount = Number(totalAmountPaid) - rebateAmount;
        let buyerBalanceBefore = 0;
        let buyerBalanceAfter = 0;
        if (buyerUser) {
            buyerBalanceBefore = buyerUser.balance;
            // 注意：这里不应该增加买家余额，因为还款时已经处理过了
            // buyerUser.balance += buyerReceiveAmount;
            // await buyerUser.save();
            buyerBalanceAfter = buyerUser.balance;
        }
        const repayTransaction = {
            user: buyerUser ? buyerUser._id : null,
            type: 'repay',
            amount: buyerReceiveAmount,
            status: 'approved',
            paymentMethod: 'balance',
            paymentAccount: buyerUser ? buyerUser._id.toString() : null,
            receiveAccount: buyerUser ? buyerUser._id.toString() : '',
            remark: buyerUser ? `收到 ${buyerUser.username} 的还款` : '收到还款',
            infoId: info._id,
            createdAt: new Date(),
            balanceBefore: buyerBalanceBefore,
            balanceAfter: buyerBalanceAfter
        };
        await Transaction.create(repayTransaction);

        // 更新发布者余额
        if (buyerReceiveAmount > 0 && info.author) {
            const author = await User.findById(info.author);
            if (author) {
                // 注意：这里不应该增加发布者余额，因为还款时已经处理过了
                // author.balance += buyerReceiveAmount;
                // await author.save();
                // 不再为卖家创建 SALE_PROCEEDS 记录
            }
        }

        // Respond to the user immediately
        res.json({ success: true, message: '购买成功' });

        // Asynchronously distribute funds
        distributeSaleFundsAsync(infoId, buyerUserId, totalAmountPaid)
            .then(() => {
                console.log(`[DistributeFunds] Background processing for tx ${repayTransaction._id} finished or handled internally.`);
            })
            .catch(err => {
                console.error(`[DistributeFunds] Unhandled error from distributeSaleFundsAsync promise for tx ${repayTransaction._id}:`, err);
            });

    } catch (error) {
        console.error('购买信息接口错误:', error.message, error.stack ? error.stack : '');
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: error.message || '购买操作失败' });
        }
    }
};

// 更新信息销售状态
router.put('/:id/sale-status', protect, async (req, res) => {
    try {
        const { saleStatus } = req.body;
        
        // 验证状态值
        if (!['待售', '售出'].includes(saleStatus)) {
            return res.status(400).json({
                success: false,
                message: '无效的销售状态'
            });
        }

        // 查找并更新信息
        const info = await Info.findById(req.params.id);
        if (!info) {
            return res.status(404).json({
                success: false,
                message: '信息不存在'
            });
        }

        // 检查权限（只有作者可以更新状态）
        if (info.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: '没有权限更新此信息'
            });
        }

        // 更新状态
        info.saleStatus = saleStatus;
        await info.save();

        res.json({
            success: true,
            data: info
        });
    } catch (error) {
        console.error('更新信息状态失败:', error);
        res.status(500).json({
            success: false,
            message: '更新信息状态失败',
            error: error.message
        });
    }
});

// 还款
router.post('/:id/repay', protect, restrictToAdmin, async (req, res) => {
    try {
        const info = await Info.findById(req.params.id);
        if (!info) {
            return res.status(404).json({
                success: false,
                message: '信息不存在'
            });
        }

        // 检查是否是永鑫资本者
        if (info.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: '只有永鑫资本者可以还款'
            });
        }

        // 检查是否已购买
        if (!info.purchasers || info.purchasers.length === 0) {
            return res.status(400).json({
                success: false,
                message: '该信息未被购买'
            });
        }

        // 幂等校验：如果已还款，直接返回
        if (info.isPaid) {
            return res.status(400).json({
                success: false,
                message: '该信息已还款，不能重复还款'
            });
        }

        // 检查是否已到期
        if (new Date() > info.expiryTime) {
            return res.status(400).json({
                success: false,
                message: '该信息已到期，无法还款'
            });
        }

        // 检查用户余额
        const user = await User.findById(req.user._id);
        if (user.balance < info.repaymentAmount) {
            // 余额不足，公开信息
            info.isPublic = true;
            await info.save();
            return res.status(400).json({
                success: false,
                message: '余额不足，信息已公开'
            });
        }

        // 还款方扣钱（只扣还款金额）
        const authorBalanceBefore = user.balance;
        user.balance -= Number(info.repaymentAmount);
        await user.save();
        const authorBalanceAfter = user.balance;

        // 购买者加钱（只加还款金额）
        const buyer = await User.findById(info.purchasers[0]);
        if (!buyer) {
            return res.status(400).json({
                success: false,
                message: '购买者信息不存在'
            });
        }
        let buyerBalanceBefore = 0;
        let buyerBalanceAfter = 0;
        
        // 计算推荐人返利（如有）
        let rebateAmount = 0;
        let referrer = null;
        if (buyer && buyer.referrer) {
            // 获取返利设置
            const rebateSettings = await SystemSetting.findOne({ key: 'rebate_settings' });
            if (rebateSettings) {
                const { inviteRebatePercentage, minRebateAmount } = rebateSettings.value;
                
                // 计算返利金额 - 使用loanAmount（购买价格）而不是repaymentAmount（还款金额）
                const calculatedRebateAmount = (Number(info.loanAmount) * inviteRebatePercentage / 100);
                
                // 检查是否达到最低返利金额
                if (calculatedRebateAmount >= minRebateAmount) {
                    referrer = await User.findById(buyer.referrer);
                    if (referrer) {
                        rebateAmount = Math.floor(calculatedRebateAmount);
                        if (rebateAmount > 0) {
                            const referrerBalanceBefore = referrer.balance;
                            referrer.balance += rebateAmount;
                            await referrer.save();
                            const referrerBalanceAfter = referrer.balance;
                            await Transaction.create({
                                user: referrer._id,
                                type: 'REFERRAL_COMMISSION',
                                amount: rebateAmount,
                                status: 'approved',
                                paymentMethod: 'INTERNAL_SETTLEMENT',
                                paymentAccount: user ? user._id.toString() : null,
                                receiveAccount: referrer._id.toString(),
                                remark: `获得推荐返利，${user ? user.username : ''}还款`,
                                infoId: info._id,
                                createdAt: new Date(),
                                balanceBefore: referrerBalanceBefore,
                                balanceAfter: referrerBalanceAfter
                            });
                        }
                    }
                }
            }
        }

        // 只为收款方（买家）创建还款流水，到账金额为还款金额-返利
        const buyerReceiveAmount = Number(info.repaymentAmount) - rebateAmount;
        buyerBalanceBefore = buyer.balance;
        buyer.balance += buyerReceiveAmount;
        await buyer.save();
        buyerBalanceAfter = buyer.balance;
        const repayTransaction = {
            user: buyer ? buyer._id : null,
            type: 'repay',
            amount: buyerReceiveAmount,
            status: 'approved',
            paymentMethod: 'balance',
            paymentAccount: user ? user._id.toString() : null,
            receiveAccount: buyer ? buyer._id.toString() : '',
            remark: user ? `收到 ${user.username} 的还款` : '收到还款',
            infoId: info._id,
            createdAt: new Date(),
            balanceBefore: buyerBalanceBefore,
            balanceAfter: buyerBalanceAfter
        };
        await Transaction.create(repayTransaction);

        // 删除信息，结束交易
        console.log(`准备删除信息: ${info._id}`); // Added log before delete
        await info.deleteOne();
        console.log(`信息 ${info._id} 已还款并删除`); // Added log after delete

        res.json({
            success: true,
            message: '还款成功，交易已结束',
            data: {
                repaymentAmount: info.repaymentAmount,
                totalAmount: Number(info.repaymentAmount)
            }
        });
    } catch (error) {
        console.error('还款错误:', error);
        res.status(500).json({
            success: false,
            message: '还款失败'
        });
    }
});

// 查看所有管理员账户
router.get('/list-admins', async (req, res) => {
    try {
        const admins = await User.find({ role: 'admin' });
        res.json({
            success: true,
            data: admins.map(admin => ({
                username: admin.username,
                balance: admin.balance,
                role: admin.role,
                createdAt: admin.createdAt
            }))
        });
    } catch (error) {
        console.error('获取管理员列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取管理员列表失败'
        });
    }
});

// 检查管理员账户
router.get('/check-admin', protect, async (req, res) => {
    try {
        const admin = await User.findOne({ role: 'admin' });
        if (admin) {
            res.json({
                success: true,
                data: {
                    username: admin.username,
                    balance: admin.balance,
                    role: admin.role
                }
            });
        } else {
            res.status(404).json({
                success: false,
                message: '未找到管理员账户'
            });
        }
    } catch (error) {
        console.error('检查管理员账户失败:', error);
        res.status(500).json({
            success: false,
            message: '检查管理员账户失败'
        });
    }
});

// 创建管理员账户
router.post('/create-admin', protect, async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // 检查是否已存在管理员
        const existingAdmin = await User.findOne({ role: 'admin' });
        if (existingAdmin) {
            return res.status(400).json({
                success: false,
                message: '管理员账户已存在'
            });
        }
        
        // 创建管理员账户
        const admin = await User.create({
            username,
            password,
            role: 'admin',
            status: 'active'
        });
        
        res.status(201).json({
            success: true,
            message: '管理员账户创建成功',
            data: {
                username: admin.username,
                role: admin.role
            }
        });
    } catch (error) {
        console.error('创建管理员账户失败:', error);
        res.status(500).json({
            success: false,
            message: '创建管理员账户失败'
        });
    }
});

// 获取盈利统计
router.get('/profit', protect, restrictToAdmin, async (req, res) => {
    try {
        const result = await calculateTotalProfit();
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('获取盈利统计失败:', error);
        res.status(500).json({
            success: false,
            message: '获取盈利统计失败'
        });
    }
});

// 重新计算盈利
router.post('/calculate-profit', protect, restrictToAdmin, async (req, res) => {
    try {
        const result = await calculateTotalProfit();
        res.json({
            success: true,
            message: '盈利重新计算完成',
            data: result
        });
    } catch (error) {
        console.error('重新计算盈利失败:', error);
        res.status(500).json({
            success: false,
            message: '重新计算盈利失败'
        });
    }
});

// 获取交易记录
router.get('/transactions', async (req, res) => {
    try {
        const userId = req.user.id;
        // 只查收益类且收款人为自己的流水
        const incomeTypes = ['repay', 'SALE_PROCEEDS', 'REFERRAL_COMMISSION'];
        const allTransactions = await Transaction.find({
            type: { $in: incomeTypes },
            receiveAccount: userId
        }).sort({ createdAt: 1 }).lean();
        const reversedTransactions = allTransactions.reverse();
        res.json({
            success: true,
            data: reversedTransactions,
            total: reversedTransactions.length
        });
    } catch (err) {
        res.status(500).json({ success: false, message: '获取交易记录失败' });
    }
});

// 用户购买信息接口
router.post('/:id/purchase', protect, async (req, res) => {
  try {
    const infoId = req.params.id;
    const userId = req.user._id;
    const { paymentPassword } = req.body;
    console.log('[购买接口] 请求参数:', { infoId, userId, paymentPassword });

    // 校验信息是否存在
    const info = await Info.findById(infoId);
    console.log('[购买接口] 查询到的信息:', info);
    if (!info) {
      console.error('[购买接口] 信息不存在:', infoId);
      return res.status(404).json({ success: false, message: '信息不存在' });
    }
    // 校验是否已被购买
    if (info.purchasers && info.purchasers.length > 0) {
      console.warn('[购买接口] 信息已被购买:', infoId);
      return res.status(400).json({ success: false, message: '该信息已被购买' });
    }
    // 校验用户余额和支付密码
    const user = await User.findById(userId).select('+payPassword +hasPayPassword');
    console.log('[购买接口] 查询到的用户:', user);
    const price = Number(info.loanAmount) || 0; // 只用 loanAmount
    console.log('[购买接口] 价格:', price, '用户余额:', user.balance);
    if (user.balance < price) {
      console.warn('[购买接口] 余额不足:', user.balance, '<', price);
      return res.status(400).json({ success: false, message: '余额不足' });
    }
    
    // 使用备份文件中的安全验证逻辑
    const realPayPassword = user.payPassword;
    if (!realPayPassword) {
      console.warn('[购买接口] 用户未设置支付密码');
      return res.status(400).json({ success: false, message: '请先设置支付密码' });
    }
    const isMatch = await bcrypt.compare(paymentPassword, realPayPassword);
    if (!isMatch) {
      console.warn('[购买接口] 支付密码错误');
      return res.status(400).json({ success: false, message: '支付密码错误' });
    }
    
    // 记录购买
    info.purchasers.push(userId);
    info.purchaseTime = new Date();
    await info.save();
    console.log('[购买接口] 信息保存后 purchasers:', info.purchasers);
    // 记录购买表
    await Purchase.create({ info: infoId, buyer: userId, createdAt: new Date() });
    console.log('[购买接口] Purchase 记录已创建');
    
    // 1. **买家扣款**
    const buyerBalanceBefore = user.balance;
    user.balance -= price;
    await user.save();
    const buyerBalanceAfter = user.balance;
    console.log('[购买接口] 扣款后用户余额:', user.balance);
    
    // 2. **记录买家交易**
    await Transaction.create({
      user: userId,
      type: 'purchase',
      amount: -price,
      status: 'approved',
      paymentMethod: 'INTERNAL_SETTLEMENT',
      paymentAccount: userId.toString(),
      receiveAccount: info.author ? info.author.toString() : '',
      remark: `购买信息: ${info.title}`,
      balanceBefore: buyerBalanceBefore,
      balanceAfter: buyerBalanceAfter
    });
    console.log('[购买接口] 买家 Transaction 记录已创建');
    
    // 3. **卖家收款**
    if (info.author) {
        const author = await User.findById(info.author);
        if (author) {
            const authorBalanceBefore = author.balance;
            author.balance += price;
            await author.save();
            const authorBalanceAfter = author.balance;

            // 4. **记录卖家交易**
            await Transaction.create({
                user: author._id,
                type: 'SALE_PROCEEDS',
                amount: price,
                status: 'approved',
                paymentMethod: 'INTERNAL_SETTLEMENT',
                remark: `出售信息获得收入: ${info.title}`,
                infoId: info._id,
                balanceBefore: authorBalanceBefore,
                balanceAfter: authorBalanceAfter,
                paymentAccount: userId.toString(),
                receiveAccount: author._id.toString(),
            });
            console.log(`[购买接口] 卖家 ${author.username} 已收款，新余额: ${authorBalanceAfter}`);
        } else {
            console.error(`[购买接口] 未找到ID为 ${info.author} 的卖家`);
        }
    } else {
        console.error(`[购买接口] 信息 ${info._id} 没有作者`);
    }

    // 5. **最后响应**
    res.json({ success: true, message: '购买成功' });
  } catch (error) {
    console.error('[购买接口] 购买信息接口错误:', error);
    if (error && error.stack) {
      console.error('[购买接口] 错误堆栈:', error.stack);
    }
    res.status(500).json({ success: false, message: error.message || '购买操作失败' });
  }
});

module.exports = router; 
