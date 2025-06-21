const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const CustomerServiceMessage = require('../models/CustomerServiceMessage');
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const { protect, restrictToAdmin } = require('../middleware/auth'); // Add missing middleware imports
const SystemSetting = require('../models/SystemSetting'); // 引入SystemSetting模型
const { generateRandomInfo } = require('../utils/randomInfoGenerator'); // 新增：导入随机信息生成函数
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const RechargePath = require('../models/RechargePath');

// DELETE /api/admin/users/:id - 删除用户
router.delete('/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;

        // 查找用户
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }

        // 检查是否是管理员
        if (user.role === 'admin') {
            return res.status(403).json({
                success: false,
                message: '不能删除管理员账号'
            });
        }

        // 删除用户
        await User.findByIdAndDelete(userId);

        res.json({
            success: true,
            message: '用户删除成功'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '删除用户失败',
            error: error.message
        });
    }
});

// 获取所有用户 (支持分页和筛选)
router.get('/users', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const { search, role, status } = req.query;

        // 构建查询条件
        const query = {};
        if (search) {
            query.$or = [
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }
        if (role) {
            query.role = role;
        }
        if (status) {
            query.status = status;
        }

        // 查询总记录数
        const total = await User.countDocuments(query);

        // 查询用户列表
        const users = await User.find(query)
            .select('-password')
            .skip(skip)
            .limit(limit);

        res.json({
            success: true,
            data: users,
            total: total,
            page: page,
            limit: limit
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '获取用户列表失败',
            error: error.message
        });
    }
});

// 获取所有交易
router.get('/transactions', async (req, res) => {
    try {
        const transactions = await Transaction.find({
            type: { $nin: ['purchase', 'repay', 'REFERRAL_COMMISSION', 'SALE_PROCEEDS'] } // Added new types to exclude
        })
            .populate('user', 'username')
            .select('user type amount status paymentMethod paymentAccount receiveAccount proof qrcode remark createdAt')
            .sort({ createdAt: -1 });
        res.json({
            success: true,
            data: transactions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '获取交易列表失败'
        });
    }
});

// 审核交易
router.post('/transactions/:id/review', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, remark } = req.body;

        const transaction = await Transaction.findById(id).populate('user');
        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: '交易不存在'
            });
        }

        // 如果交易已经被审核，则不重复处理
        if (transaction.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: '该交易已经被审核'
            });
        }

        // 更新交易状态
        transaction.status = status;
        transaction.remark = remark;
        transaction.reviewedAt = new Date();
        transaction.reviewedBy = req.user.id;

        await transaction.save();

        // 新增：审核通过时同步管理员余额
        if (status === 'approved') {
            const adminUser = await User.findOne({ role: 'admin' });
            const txTypeOriginal = (transaction.type || '').toLowerCase();
            if (txTypeOriginal === 'recharge') {
                if (adminUser) {
                    adminUser.balance += transaction.amount;
                    await adminUser.save();
                }
            } else if (txTypeOriginal === 'withdraw') {
                if (adminUser) {
                    adminUser.balance -= transaction.amount;
                    await adminUser.save();
                }
            }
        }

        res.json({
            success: true,
            message: '审核成功',
            data: transaction
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '审核失败'
        });
    }
});

// PUT /api/admin/users/:id/role - 更新用户角色
router.put('/users/:id/role', async (req, res) => {
    try {
        const userId = req.params.id;
        const newRole = req.body.role;

        // 检查角色值是否合法 (可以根据实际业务添加更多校验)
        const validRoles = ['user', 'vip', 'admin'];
        if (!validRoles.includes(newRole)) {
            return res.status(400).json({
                success: false,
                message: '非法的角色值'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }

        // 更新用户角色
        user.role = newRole;
        await user.save();

        res.json({
            success: true,
            message: '用户角色更新成功',
            data: { userId: user._id, newRole: user.role }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '更新用户角色失败',
            error: error.message
        });
    }
});

// 获取交易通知（purchase和repay类型）
router.get('/transactions/notifications', async (req, res) => {
    try {
        const transactionsFromDB = await Transaction.find({
            type: { $in: ['purchase', 'repay', 'recharge', 'withdraw', 'REFERRAL_COMMISSION', 'SALE_PROCEEDS'] }
        })
            .populate('user', 'username')
            .select('user type amount status paymentMethod paymentAccount receiveAccount remark createdAt')
            .sort({ createdAt: -1 })
            .lean();

        const processedTransactions = await Promise.all(transactionsFromDB.map(async (tx) => {
            if (tx.type === 'repay') {
                if (tx.receiveAccount && mongoose.Types.ObjectId.isValid(tx.receiveAccount)) {
                    try {
                        const payee = await User.findById(tx.receiveAccount).select('username').lean();
                        tx.payeeUsername = payee ? payee.username : tx.receiveAccount; // Use ID if username not found
                    } catch (e) {
                        tx.payeeUsername = tx.receiveAccount; // Fallback to ID on error
                    }
                } else if (tx.receiveAccount) { // It's a string but not ObjectId, use as is
                    tx.payeeUsername = tx.receiveAccount;
                } else {
                    tx.payeeUsername = '未知收款方'; // If receiveAccount is empty or null
                }
            }
            return tx;
        }));

        res.json({
            success: true,
            data: processedTransactions
        });
    } catch (error) {
        res.status(500).json({ success: false, message: '获取交易通知失败' });
    }
});

// 新增：发送交易通知给关联用户
router.post('/transactions/:id/send-notification', protect, restrictToAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // 查找交易记录，并populate用户信息
        const transaction = await Transaction.findById(id).populate('user', 'username');

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: '交易记录未找到'
            });
        }

        if (!transaction.user) {
            return res.status(400).json({
                success: false,
                message: '交易记录未关联用户'
            });
        }

        // 根据交易类型自定义通知标题和内容
        let notificationTitle = '交易通知';
        let notificationContent = '关于您的交易的通知。';
        const transactionType = transaction.type || '未知';
        const amount = transaction.amount ? transaction.amount.toFixed(2) : '0.00';
        const username = transaction.user.username || '用户';

        switch (transactionType) {
            case 'purchase':
                notificationTitle = '购买交易完成';
                notificationContent = `您在 ${new Date(transaction.createdAt).toLocaleString()} 成功购买了一项信息，金额为 ¥${amount}。`;
                break;
            case 'repay':
                notificationTitle = '还款交易完成';
                notificationContent = `您在 ${new Date(transaction.createdAt).toLocaleString()} 成功完成了一笔还款，金额为 ¥${amount}。`;
                break;
            case 'recharge':
                notificationTitle = '充值审核通知';
                 notificationContent = `您的充值申请（金额 ¥${amount}）已由管理员处理，当前状态为：${transaction.status === 'approved' ? '已批准' : transaction.status === 'rejected' ? '已拒绝' : '待处理'}。`;
                break;
            case 'withdraw':
                notificationTitle = '提现审核通知';
                notificationContent = `您的提现申请（金额 ¥${amount}）已由管理员处理，当前状态为：${transaction.status === 'approved' ? '已批准' : transaction.status === 'rejected' ? '已拒绝' : '待处理'}。`;
                break;
            default:
                // 使用默认标题和内容
                break;
        }

        res.json({
            success: true,
            message: '通知功能已禁用，未发送通知。'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: '发送通知失败',
            error: error.message
        });
    }
});

// RESTORE: Customer service routes
router.get('/customer-service/conversations', async (req, res) => {
    try {
        // Find distinct users who have sent or received customer service messages
        const conversations = await CustomerServiceMessage.aggregate([
            { $group: { _id: '$user', lastMessageTime: { $max: '$createdAt' } } },
            { $sort: { lastMessageTime: -1 } },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'userInfo' } },
            { $unwind: '$userInfo' },
            { $project: { _id: 0, user: '$userInfo._id', username: '$userInfo.username', lastMessageTime: 1 } }
        ]);

        // Optionally, fetch the last message or unread count for each conversation
        for (let conv of conversations) {
            const lastMessage = await CustomerServiceMessage.findOne({ user: conv.user }).sort({ createdAt: -1 }).lean();
            conv.lastMessage = lastMessage ? lastMessage.content : '';
            const unreadCount = await CustomerServiceMessage.countDocuments({ user: conv.user, isRead: false, senderType: 'user' }); // Count unread messages from user
            conv.unreadCount = unreadCount;
        }

        res.json({ success: true, data: conversations });

    } catch (error) {
        res.status(500).json({ success: false, message: '获取客服会话列表失败', error: error.message });
    }
});

router.get('/customer-service/messages/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: '无效的用户ID' });
        }

        const messages = await CustomerServiceMessage.find({ user: userId })
            .sort({ createdAt: 1 })
            .lean();

        // Optionally mark messages from user as read when admin views them
        await CustomerServiceMessage.updateMany(
            { user: userId, isRead: false, senderType: 'user' },
            { $set: { isRead: true } }
        );

        res.json({ success: true, data: messages });

    } catch (error) {
        res.status(500).json({ success: false, message: '获取用户客服消息失败', error: error.message });
    }
});

router.post('/customer-service/messages/:userId', async (req, res) => {
    const { userId } = req.params;
    const { content } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: '无效的用户ID' });
    }

    if (!content) {
        return res.status(400).json({ success: false, message: '消息内容不能为空' });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: '用户不存在' });
        }

        const newMessage = new CustomerServiceMessage({
            user: userId,
            senderType: 'admin',
            content,
            isRead: false, // New message from admin is unread by user initially
        });

        const message = await newMessage.save();


        res.json({ success: true, data: message });

    } catch (error) {
        res.status(500).json({ success: false, message: '发送消息失败', error: error.message });
    }
});

router.put('/customer-service/conversations/:userId/read', async (req, res) => {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: '无效的用户ID' });
    }

    try {
        const result = await CustomerServiceMessage.updateMany(
            { user: userId, isRead: false, senderType: 'user' }, // Only mark user messages as read by admin
            { $set: { isRead: true } }
        );

        res.json({ success: true, message: '消息已标记为已读', modifiedCount: result.modifiedCount });

    } catch (error) {
        res.status(500).json({ success: false, message: '标记消息为已读失败', error: error.message });
    }
});
// END RESTORE: Customer service routes

// 管理员通知相关路由

// 获取所有通知列表 (管理员)
router.get('/notifications/list', [protect, restrictToAdmin], async (req, res) => {
    try {
        const { page = 1, limit = 10, type } = req.query;
        const query = {};
        
        if (type) {
            query.type = type;
        }

        const total = await Notification.countDocuments(query);
        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        res.json({
            success: true,
            data: notifications,
            total,
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '获取通知列表失败'
        });
    }
});

// 创建新通知 (管理员)
router.post('/notifications', [protect, restrictToAdmin], async (req, res) => {
    try {
        const { title, content, type, status = 'ACTIVE' } = req.body;

        if (!title || !content || type === undefined) {
            return res.status(400).json({
                success: false,
                message: '请提供完整的通知信息'
            });
        }

        res.status(201).json({
            success: true,
            message: '通知功能已禁用，未创建通知。'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || '创建通知失败'
        });
    }
});

// 更新通知 (管理员)
router.put('/notifications/:id', [protect, restrictToAdmin], async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, type, status } = req.body;

        const notification = await Notification.findById(id);
        if (!notification) {
            return res.status(404).json({
                success: false,
                message: '通知不存在'
            });
        }

        if (title) notification.title = title;
        if (content) notification.content = content;
        if (type) notification.type = type;
        if (status) notification.status = status;
        
        notification.updatedAt = new Date();
        notification.updatedBy = req.user._id;

        await notification.save();

        res.json({
            success: true,
            message: '通知更新成功',
            data: notification
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '更新通知失败'
        });
    }
});

// 删除通知 (管理员)
router.delete('/notifications/:id', [protect, restrictToAdmin], async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid notification ID' });
        }

        const notification = await Notification.findById(req.params.id);
        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        await notification.deleteOne();
        res.json({ success: true, message: 'Notification deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete notification' });
    }
});

// 发布多个通知 (管理员)
router.post('/notifications/:id/publish-multiple', [protect, restrictToAdmin], async (req, res) => {
    try {
        const { id } = req.params;
        const { count = 3 } = req.body;

        const notification = await Notification.findById(id);
        if (!notification) {
            return res.status(404).json({
                success: false,
                message: '通知不存在'
            });
        }

        const notificationCopies = [];
        for (let i = 0; i < count; i++) {
            const notificationCopy = new Notification({
                title: `${notification.title} (${i + 1}/${count})`,
                content: notification.content,
                type: notification.type,
                status: 'ACTIVE',
                createdBy: req.user._id,
                createdAt: new Date(),
                sentAt: new Date(),
                sentBy: req.user._id
            });
            notificationCopies.push(notificationCopy);
        }

        await Notification.insertMany(notificationCopies);

        notification.status = 'ARCHIVED';
        notification.updatedAt = new Date();
        notification.updatedBy = req.user._id;
        await notification.save();

        res.json({
            success: true,
            message: `成功发布${count}条通知`,
            data: notificationCopies
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '发布多个通知失败'
        });
    }
});

// 新增：管理员获取特定用户资金明细
router.get('/users/:userId/transactions', protect, restrictToAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10, type, status, startDate, endDate } = req.query;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: '无效的用户ID格式' });
        }

        const queryOptions = { user: userId };

        if (type) {
            queryOptions.type = type;
        }
        if (status) {
            queryOptions.status = status;
        }
        if (startDate || endDate) {
            queryOptions.createdAt = {};
            if (startDate) {
                queryOptions.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                // Ensure endDate includes the whole day
                const endOfDay = new Date(endDate);
                endOfDay.setHours(23, 59, 59, 999);
                queryOptions.createdAt.$lte = endOfDay;
            }
        }

        const transactions = await Transaction.find(queryOptions)
            .sort({ createdAt: -1 })
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit));

        const totalTransactions = await Transaction.countDocuments(queryOptions);

        res.json({
            success: true,
            data: transactions,
            total: totalTransactions,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(totalTransactions / parseInt(limit))
        });

    } catch (error) {
        res.status(500).json({ success: false, message: '获取用户资金明细失败', error: error.message });
    }
});

// PUT /api/admin/users/:id/status - 更新用户状态
router.put('/users/:id/status', async (req, res) => {
    try {
        const userId = req.params.id;
        const newStatus = req.body.status;

        // 检查状态值是否合法 (可以根据实际业务添加更多校验)
        const validStatuses = ['active', 'inactive'];
        if (!validStatuses.includes(newStatus)) {
            return res.status(400).json({
                success: false,
                message: '非法的状态值'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }

        // 更新用户状态
        user.status = newStatus;
        await user.save();

        res.json({
            success: true,
            message: '用户状态更新成功',
            data: { userId: user._id, newStatus: user.status }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '更新用户状态失败',
            error: error.message
        });
    }
});

// 新增：管理员获取指定用户邀请的用户列表
router.get('/users/:userId/invited-users', protect, restrictToAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: '无效的推荐人用户ID格式' });
        }

        const queryOptions = { referrer: userId };

        const invitedUsers = await User.find(queryOptions)
            .select('username inviteCode createdAt status email phone') // 选择需要的字段
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalInvitedUsers = await User.countDocuments(queryOptions);

        res.json({
            success: true,
            data: invitedUsers,
            total: totalInvitedUsers,
            page: page,
            limit: limit,
            totalPages: Math.ceil(totalInvitedUsers / limit)
        });

    } catch (error) {
        res.status(500).json({ success: false, message: '获取受邀用户列表失败', error: error.message });
    }
});

// 新增：管理员获取指定用户的购买记录 (查询 Purchase 模型)
router.get('/users/:userId/purchases', protect, restrictToAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20; // Default to 20 purchases
        const skip = (page - 1) * limit;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: '无效的用户ID格式' });
        }

        const queryOptions = { buyer: userId };

        const purchases = await mongoose.model('Purchase').find(queryOptions)
            .populate({
                path: 'info',
                select: 'title price authorName saleStatus',
                populate: { path: 'author', select: 'username' } // If you need original info author's username
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalPurchases = await mongoose.model('Purchase').countDocuments(queryOptions);
        
        // Clean up the data slightly for frontend, especially authorName vs author.username
        const dataToSend = purchases.map(p => {
            let authorDisplay = '';
            if (p.info && p.info.authorName) {
                authorDisplay = p.info.authorName;
            } else if (p.info && p.info.author && p.info.author.username) {
                authorDisplay = p.info.author.username;
            }

            return {
                _id: p._id,
                purchaseDate: p.createdAt,
                infoTitle: p.info ? p.info.title : '信息已删除或未知',
                infoPrice: p.info ? p.info.price : 0,
                infoAuthor: authorDisplay,
                infoSaleStatus: p.info ? p.info.saleStatus : '未知',
                infoId: p.info ? p.info._id : null
            };
        });

        res.json({
            success: true,
            data: dataToSend,
            total: totalPurchases,
            page: page,
            limit: limit,
            totalPages: Math.ceil(totalPurchases / limit)
        });

    } catch (error) {
        res.status(500).json({ success: false, message: '获取用户购买记录失败', error: error.message });
    }
});

// -- 系统设置相关API --

// 获取特定系统设置
router.get('/settings/:key', protect, restrictToAdmin, async (req, res) => {
    try {
        const { key } = req.params;
        const setting = await SystemSetting.findOne({ key });
        if (!setting) {
            // 如果特定key的设置不存在，可以返回一个默认值或404
            // 这里我们返回成功，但value为null，让前端处理默认值
            return res.json({ success: true, key, value: null, message: '设置项未找到，可能需要初始化。' });
        }
        res.json({ success: true, key: setting.key, value: setting.value });
    } catch (error) {
        res.status(500).json({ success: false, message: '获取设置失败' });
    }
});

// 创建或更新系统设置
router.post('/settings/:key', protect, restrictToAdmin, async (req, res) => {
    try {
        const { key } = req.params;
        const { value, description } = req.body;

        if (value === undefined || value === null) {
            return res.status(400).json({ success: false, message: '设置值不能为空' });
        }

        // 使用 upsert: 如果key存在则更新，不存在则创建
        const updatedSetting = await SystemSetting.findOneAndUpdate(
            { key },
            { value, description },
            { new: true, upsert: true, runValidators: true }
        );

        res.json({ 
            success: true, 
            message: '设置已保存', 
            key: updatedSetting.key, 
            value: updatedSetting.value 
        });
    } catch (error) {
        if (error.code === 11000) { // Duplicate key error, though upsert should handle this for updates
            return res.status(409).json({ success: false, message: '设置键名已存在 (理论上upsert会处理此情况)' });
        }
        res.status(500).json({ success: false, message: '保存设置失败' });
    }
});

// GET /api/admin/generate-random-info - 生成随机用户信息供管理员使用
router.get('/generate-random-info', (req, res) => {
    try {
        const randomInfo = generateRandomInfo();
        res.json({
            success: true,
            data: randomInfo,
            message: '随机信息生成成功'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '生成随机信息失败',
            error: error.message
        });
    }
});

// 图片文件夹管理相关API
router.post('/folder-settings', protect, restrictToAdmin, async (req, res) => {
    try {
        const { coverFolderPath, additionalFolderPath, autoDeleteUsedImages, randomSelectImages, coverImagesCount, additionalImagesCount } = req.body;
        
        // 保存设置到数据库或配置文件
        await SystemSetting.findOneAndUpdate(
            { key: 'folderSettings' },
            {
                key: 'folderSettings',
                value: {
                    coverFolderPath,
                    additionalFolderPath,
                    autoDeleteUsedImages,
                    randomSelectImages,
                    coverImagesCount: parseInt(coverImagesCount),
                    additionalImagesCount: parseInt(additionalImagesCount)
                }
            },
            { upsert: true, new: true }
        );

        res.json({ success: true, message: '文件夹设置已保存' });
    } catch (error) {
        console.error('保存文件夹设置失败:', error);
        res.status(500).json({ success: false, message: '保存设置失败' });
    }
});

router.post('/folder-image-count', protect, restrictToAdmin, async (req, res) => {
    try {
        const { folderPath } = req.body;
        
        if (!folderPath) {
            return res.status(400).json({ success: false, message: '文件夹路径不能为空' });
        }

        // 检查是否为部署环境（通过环境变量或域名判断）
        const isDeployed = process.env.NODE_ENV === 'production' || 
                          process.env.RENDER || 
                          process.env.VERCEL ||
                          process.env.HEROKU ||
                          req.get('host')?.includes('onrender.com') ||
                          req.get('host')?.includes('vercel.app') ||
                          req.get('host')?.includes('herokuapp.com');

        if (isDeployed) {
            // 在部署环境中返回模拟数据
            console.log('部署环境检测到，返回模拟图片数量');
            return res.json({ success: true, count: Math.floor(Math.random() * 50) + 10 }); // 返回10-60张图片的随机数量
        }

        // 本地环境：检查文件夹是否存在
        try {
            await fs.access(folderPath);
        } catch (error) {
            return res.status(400).json({ success: false, message: '文件夹不存在或无权限访问' });
        }

        // 获取文件夹中的图片文件
        const files = await fs.readdir(folderPath);
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
        const imageFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return imageExtensions.includes(ext);
        });

        res.json({ success: true, count: imageFiles.length });
    } catch (error) {
        console.error('获取图片数量失败:', error);
        res.status(500).json({ success: false, message: '获取图片数量失败' });
    }
});

router.post('/test-auto-select', protect, restrictToAdmin, async (req, res) => {
    try {
        const { coverFolderPath, additionalFolderPath, coverImagesCount, additionalImagesCount, randomSelect } = req.body;
        
        // 检查是否为部署环境
        const isDeployed = process.env.NODE_ENV === 'production' || 
                          process.env.RENDER || 
                          process.env.VERCEL ||
                          process.env.HEROKU ||
                          req.get('host')?.includes('onrender.com') ||
                          req.get('host')?.includes('vercel.app') ||
                          req.get('host')?.includes('herokuapp.com');

        if (isDeployed) {
            // 在部署环境中返回模拟数据
            console.log('部署环境检测到，返回模拟测试结果');
            const mockResult = {
                coverImages: coverFolderPath ? [`${coverFolderPath}/mock-cover-1.jpg`] : [],
                additionalImages: additionalFolderPath ? [`${additionalFolderPath}/mock-additional-1.jpg`] : []
            };
            return res.json({ success: true, ...mockResult });
        }
        
        const result = await selectImagesFromFolders(
            coverFolderPath, 
            additionalFolderPath, 
            parseInt(coverImagesCount), 
            parseInt(additionalImagesCount), 
            randomSelect,
            false // 测试模式不删除文件
        );

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('测试自动选择失败:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/auto-select-images', protect, restrictToAdmin, async (req, res) => {
    try {
        const { coverFolderPath, additionalFolderPath, coverImagesCount, additionalImagesCount, randomSelect, autoDelete } = req.body;
        
        // 检查是否为部署环境
        const isDeployed = process.env.NODE_ENV === 'production' || 
                          process.env.RENDER || 
                          process.env.VERCEL ||
                          process.env.HEROKU ||
                          req.get('host')?.includes('onrender.com') ||
                          req.get('host')?.includes('vercel.app') ||
                          req.get('host')?.includes('herokuapp.com');

        if (isDeployed) {
            // 在部署环境中返回模拟数据
            console.log('部署环境检测到，返回模拟自动选择结果');
            const mockResult = {
                coverImages: coverFolderPath ? [`${coverFolderPath}/mock-cover-1.jpg`] : [],
                additionalImages: additionalFolderPath ? [`${additionalFolderPath}/mock-additional-1.jpg`] : []
            };
            return res.json({ success: true, ...mockResult });
        }
        
        const result = await selectImagesFromFolders(
            coverFolderPath, 
            additionalFolderPath, 
            parseInt(coverImagesCount), 
            parseInt(additionalImagesCount), 
            randomSelect,
            autoDelete
        );

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('自动选择图片失败:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 辅助函数：从文件夹中选择图片
async function selectImagesFromFolders(coverFolderPath, additionalFolderPath, coverCount, additionalCount, randomSelect, autoDelete) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    const result = { coverImages: [], additionalImages: [] };

    // 选择封面图片
    if (coverFolderPath && coverCount > 0) {
        try {
            const files = await fs.readdir(coverFolderPath);
            const imageFiles = files.filter(file => {
                const ext = path.extname(file).toLowerCase();
                return imageExtensions.includes(ext);
            });

            if (imageFiles.length > 0) {
                let selectedFiles;
                if (randomSelect) {
                    // 随机选择
                    selectedFiles = [];
                    const shuffled = [...imageFiles].sort(() => 0.5 - Math.random());
                    selectedFiles = shuffled.slice(0, Math.min(coverCount, imageFiles.length));
                } else {
                    // 按文件名顺序选择
                    selectedFiles = imageFiles.slice(0, Math.min(coverCount, imageFiles.length));
                }

                result.coverImages = selectedFiles.map(file => path.join(coverFolderPath, file));

                // 如果启用自动删除，删除已选择的文件
                if (autoDelete) {
                    for (const file of selectedFiles) {
                        try {
                            await fs.unlink(path.join(coverFolderPath, file));
                        } catch (error) {
                            console.error(`删除文件失败: ${file}`, error);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('读取封面图片文件夹失败:', error);
        }
    }

    // 选择更多照片
    if (additionalFolderPath && additionalCount > 0) {
        try {
            const files = await fs.readdir(additionalFolderPath);
            const imageFiles = files.filter(file => {
                const ext = path.extname(file).toLowerCase();
                return imageExtensions.includes(ext);
            });

            if (imageFiles.length > 0) {
                let selectedFiles;
                if (randomSelect) {
                    // 随机选择
                    selectedFiles = [];
                    const shuffled = [...imageFiles].sort(() => 0.5 - Math.random());
                    selectedFiles = shuffled.slice(0, Math.min(additionalCount, imageFiles.length));
                } else {
                    // 按文件名顺序选择
                    selectedFiles = imageFiles.slice(0, Math.min(additionalCount, imageFiles.length));
                }

                result.additionalImages = selectedFiles.map(file => path.join(additionalFolderPath, file));

                // 如果启用自动删除，删除已选择的文件
                if (autoDelete) {
                    for (const file of selectedFiles) {
                        try {
                            await fs.unlink(path.join(additionalFolderPath, file));
                        } catch (error) {
                            console.error(`删除文件失败: ${file}`, error);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('读取更多照片文件夹失败:', error);
        }
    }

    return result;
}

module.exports = router; 
