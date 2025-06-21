const express = require('express'); // 引入 Express 框架
const router = express.Router(); // 创建 Express 路由实例
const Transaction = require('../../models/Transaction'); // 引入 Transaction 模型
const { protect, restrictToAdmin } = require('../../middleware/auth'); // 引入认证中间件
const adminMiddleware = require('../../middleware/adminAuth'); // 引入管理员认证中间件 (如果需要，根据您的项目结构)
const User = require('../../models/User'); // 引入 User 模型
const Notification = require('../../models/Notification'); // 引入 Notification 模型
const RechargePath = require('../../models/RechargePath'); // 引入 RechargePath 模型
const mongoose = require('mongoose'); // 引入 mongoose 模块
const CustomerServiceMessage = require('../../models/CustomerServiceMessage');

// 获取交易统计概览（如今日、昨日、本周、本月收入支出）的路由
router.get('/summary', [protect, restrictToAdmin], async (req, res) => {
    try {
        // 获取当前时间
        const now = new Date();
        // 设置今天的开始时间（0点0分0秒）
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        // 设置昨天的开始时间
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        // 设置本周的开始时间（周一）
        const thisWeek = new Date(today);
        // 计算本周第一天 (周一) 的日期，getDay() 周日是0，周一是1
        thisWeek.setDate(thisWeek.getDate() - thisWeek.getDay() + (thisWeek.getDay() === 0 ? -6 : 1));
        // 设置本月的开始时间（1号）
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // 通用的聚合查询函数，用于统计指定时间范围内的收入和支出
        const getTransactionSummary = async (startDate, endDate) => {
            const result = await Transaction.aggregate([
                {
                    $match: {
                        status: 'approved', // 只统计已批准的交易（根据您现有代码保留此状态）
                        createdAt: { $gte: startDate, $lt: endDate } // 筛选在指定时间范围内的交易
                    }
                },
                {
                    $group: {
                        _id: null, // 不按任何字段分组，对所有匹配的文档进行聚合
                        income: { // 计算总收入
                            $sum: {
                                $cond: [
                                    { $eq: ['$type', 'recharge'] }, // 如果交易类型是 'recharge'
                                    '$amount', // 则累加金额到收入
                                    0 // 否则收入为 0
                                ]
                            }
                        },
                        expense: { // 计算总支出
                            $sum: {
                                $cond: [
                                    { $eq: ['$type', 'withdraw'] }, // 如果交易类型是 'withdraw'
                                    '$amount', // 则累加金额到支出
                                    0 // 否则支出为 0
                                ]
                            }
                        }
                    }
                }
            ]);
            // 如果没有找到匹配的交易，聚合结果会是空数组，这里返回收入和支出都为0的对象
            return result[0] || { income: 0, expense: 0 };
        };

        // 获取今日统计数据
        const todaySummary = await getTransactionSummary(today, now);

        // 获取昨日统计数据
        const yesterdaySummary = await getTransactionSummary(yesterday, today);

        // 获取本周统计数据
        const thisWeekSummary = await getTransactionSummary(thisWeek, now);

        // 获取本月统计数据
        const thisMonthSummary = await getTransactionSummary(thisMonth, now);

        // 返回统计结果
        res.json({
            success: true,
            data: {
                today: todaySummary, // 今日统计结果
                yesterday: yesterdaySummary, // 昨日统计结果
                thisWeek: thisWeekSummary, // 本周统计结果
                thisMonth: thisMonthSummary // 本月统计结果
            }
        });

    } catch (error) {
        console.error('获取交易统计概览错误:', error); // 记录错误日志
        res.status(500).json({ success: false, message: '获取交易统计概览失败', error: error.message }); // 返回服务器错误响应
    }
});

// 获取交易列表（管理员接口）
router.get('/list', [protect, restrictToAdmin], async (req, res) => {
    try {
        // 从请求查询参数中获取分页、过滤和搜索条件
        const { page = 1, limit = 20, type, status, startDate, endDate, search, excludeTypes } = req.query;
        const skip = (page - 1) * limit; // 计算需要跳过的记录数

        // 构建查询条件
        const query = {};
        
        // 处理要排除的交易类型
        if (excludeTypes) {
            const typesToExclude = excludeTypes.split(',').filter(Boolean);
            if (typesToExclude.length > 0) {
                query.type = { $nin: typesToExclude };
            }
        }
        
        // 如果同时指定了type和excludeTypes，type优先
        if (type) {
            query.type = type;
        }
        
        if (status) query.status = status; // 添加状态过滤条件
        if (startDate || endDate) { // 添加日期范围过滤条件
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }
        
        // 如果search是有效的ObjectId，则按ID查询
        if (search && /^[0-9a-fA-F]{24}$/.test(search)) {
            query._id = search;
        }


        // 查询符合条件的交易总记录数
        const total = await Transaction.countDocuments(query);

        // 查询符合条件的交易记录列表
        const transactions = await Transaction.find(query)
            .populate('user', 'username')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        res.json({
            success: true,
            data: transactions,
            total,
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (error) {
        console.error('获取交易列表错误:', error);
        res.status(500).json({ success: false, message: '获取交易列表失败', error: error.message });
    }
});

// 审核交易（管理员接口）
router.post('/:id/review', [protect, restrictToAdmin], async (req, res) => {
    try {
        const { id } = req.params; // 从路由参数中获取交易ID
        const { status, remark } = req.body; // 从请求体中获取审核状态和备注

        const transaction = await Transaction.findById(id).populate('user');
        if (!transaction) { // 如果交易不存在
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

        // 更新交易状态、备注、审核时间和审核人
        transaction.status = status;
        transaction.reviewRemark = remark;
        transaction.reviewedAt = new Date();
        transaction.reviewedBy = req.user._id;

        // 如果审核通过，更新用户余额
        if (status === 'approved' || status === 'completed') {
            const user = await User.findById(transaction.user);
            if (!user) {
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
            } else if (transaction.type === 'withdraw') {
                // 再次验证余额是否足够
                if (Number(oldBalance) < Number(transaction.amount)) {
                    throw new Error(`用户余额不足，当前余额: ${oldBalance}, 提现金额: ${transaction.amount}`);
                }
                // 用户提现，余额减少并解冻
                const newBalance = Number(oldBalance) - Number(transaction.amount);
                user.balance = newBalance;
                user.frozen = Math.max(0, (user.frozen || 0) - Number(transaction.amount));
                console.log(`用户提现: 余额从 ${oldBalance} 减少到 ${newBalance}, 解冻金额: ${transaction.amount}`);
            } else if (transaction.type === 'repayment') {
                // 还款时处理返利 - 注意：这里不应该增加用户余额，因为还款时已经处理过了
                // const newBalance = Number(oldBalance) + Number(transaction.amount);
                // user.balance = newBalance;
                // console.log(`用户还款: 余额从 ${oldBalance} 增加到 ${newBalance}`);

                // 只处理返利，不重复增加用户余额
                console.log(`处理还款返利，用户余额保持不变: ${oldBalance}`);

                // 计算并发放返利
                if (user.referrer) {
                    const referrer = await User.findById(user.referrer);
                    if (referrer) {
                        // 获取返利设置
                        const SystemSetting = mongoose.model('SystemSetting');
                        const rebateSettings = await SystemSetting.findOne({ key: 'rebate_settings' });
                        
                        if (rebateSettings) {
                            const { inviteRebatePercentage, minRebateAmount } = rebateSettings.value;
                            
                            // 计算返利金额 - 需要获取原始购买信息中的loanAmount
                            // 注意：这里需要根据实际情况获取loanAmount，可能需要从关联的信息中获取
                            let loanAmount = 0;
                            if (transaction.infoId) {
                                const Info = mongoose.model('Info');
                                const info = await Info.findById(transaction.infoId);
                                if (info) {
                                    loanAmount = Number(info.loanAmount) || 0;
                                }
                            }
                            
                            // 如果无法获取loanAmount，则使用transaction.amount作为备选
                            if (loanAmount === 0) {
                                loanAmount = Number(transaction.amount);
                            }
                            
                            const calculatedRebateAmount = (loanAmount * inviteRebatePercentage / 100);
                            
                            // 检查是否达到最低返利金额
                            if (calculatedRebateAmount >= minRebateAmount) {
                                const rebateAmount = Math.floor(calculatedRebateAmount);
                                const referrerOldBalance = referrer.balance;
                                referrer.balance = Number(referrerOldBalance) + rebateAmount;
                                await referrer.save();
                                console.log(`返利发放: 推荐人 ${referrer.username} 获得返利 ${rebateAmount}, 余额从 ${referrerOldBalance} 增加到 ${referrer.balance}`);

                                // 创建返利记录
                                const rebateTransaction = new Transaction({
                                    user: referrer._id,
                                    type: 'rebate',
                                    amount: rebateAmount,
                                    status: 'completed',
                                    paymentMethod: 'INTERNAL_SETTLEMENT',
                                    paymentAccount: 'SYSTEM',
                                    receiveAccount: referrer._id.toString(),
                                    remark: `来自用户 ${user.username} 的还款返利`,
                                    relatedTransaction: transaction._id,
                                    balanceBefore: referrerOldBalance,
                                    balanceAfter: referrer.balance
                                });
                                await rebateTransaction.save();
                                console.log('返利交易记录已创建');

                                // 创建返利余额变动记录
                                const BalanceLog = mongoose.model('BalanceLog');
                                const balanceLog = new BalanceLog({
                                    user: referrer._id,
                                    type: 'rebate',
                                    amount: rebateAmount,
                                    beforeBalance: referrerOldBalance,
                                    afterBalance: referrer.balance,
                                    transaction: rebateTransaction._id,
                                    remark: `来自用户 ${user.username} 的还款返利`
                                });
                                await balanceLog.save();
                                console.log('返利余额变动记录已创建');
                            } else {
                                console.log(`返利金额 ${calculatedRebateAmount} 低于最低返利金额 ${minRebateAmount}，跳过返利发放`);
                            }
                        } else {
                            console.log('未找到返利设置，跳过返利发放');
                        }
                    }
                }
            }

            // 保存用户余额更新
            await user.save();
            console.log('用户余额更新已保存');

            // 更新交易记录的余额字段
            transaction.balanceBefore = oldBalance;
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
        }

        await transaction.save();

        // --- BEGIN: Admin Balance Synchronization Logic ---
        if (status === 'approved' || status === 'completed') { // Also consider 'completed' if that's a final state
            const adminUser = await User.findOne({ role: 'admin' }); // Ensure User model is imported
            if (adminUser) {
                const txType = (transaction.type || '').toLowerCase();
                const amount = parseFloat(transaction.amount); // Ensure amount is a number

                if (txType === 'recharge') {
                    adminUser.balance += amount;
                    await adminUser.save();
                    console.log(`[transactionRoutes.js] Admin balance increased by ${amount} for recharge. New balance: ${adminUser.balance}`);
                } else if (txType === 'withdraw') {
                    // For withdrawals, the user's balance is typically reduced when the transaction is approved.
                    // The admin/system account might see an outflow if it's managing a central pool.
                    // Or, if the admin account is just a general ledger, its balance might decrease.
                    // Assuming admin's balance decreases for a user withdrawal from the system.
                    adminUser.balance -= amount;
                    await adminUser.save();
                    console.log(`[transactionRoutes.js] Admin balance decreased by ${amount} for withdrawal. New balance: ${adminUser.balance}`);
                }
            } else {
                console.warn("[transactionRoutes.js] Admin user with role 'admin' not found for balance synchronization.");
            }
        }
        // --- END: Admin Balance Synchronization Logic ---

        res.json({ // 返回成功响应
            success: true,
            message: '审核成功',
            data: {
                transaction, // 更新后的交易信息
                user: transaction.user // 返回关联的用户信息
            }
        });
    } catch (error) {
        console.error('审核交易错误:', error); // 记录错误日志
        res.status(500).json({ // 返回服务器错误响应
            success: false,
            message: '审核失败',
            error: error.message
        });
    }
});

// ** 获取用户余额（放在通用 /:id 路由之前）**
router.get('/balance', protect, async (req, res) => {
    if (!req.user || !req.user._id) {
        console.error('BALANCE ROUTE: 用户未认证或_id缺失');
        return res.status(401).json({ success: false, message: '用户未认证或ID缺失' });
    }
    const userId = req.user._id;
    console.log('BALANCE ROUTE: User ID from token:', userId);
    try {
        console.log('BALANCE ROUTE: Attempting to find user with ID:', userId); // 记录尝试查询的用户ID
        const user = await User.findById(userId).select('balance');
        console.log('BALANCE ROUTE: User found result:', user ? 'Found' : 'Not Found'); // 记录查询结果

        if (!user) {
            console.error('BALANCE ROUTE: User not found in DB for ID:', userId);
            return res.status(404).json({ success: false, message: '用户未找到' });
        }
        console.log('BALANCE ROUTE: User balance fetched:', user.balance); // 记录获取到的余额
        res.json({ success: true, data: { balance: user.balance } });
    } catch (error) {
        console.error('BALANCE ROUTE: Error fetching user balance:', error); // 记录详细错误信息
        res.status(500).json({ success: false, message: '获取用户余额失败', error: error.message });
    }
});

// 获取单个交易详情 (通用接口)，现在放在 /balance 之后
router.get('/:id', protect, async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id)
            .populate('user', 'username'); // 填充user字段，只返回username

        if (!transaction) { // 如果交易不存在
            return res.status(404).json({ message: '交易记录不存在' }); // 返回404响应
        }

        res.json({ success: true, data: transaction }); // 返回标准格式
    } catch (error) {
        console.error('获取交易详情错误:', error); // 记录错误日志
        res.status(500).json({ message: '获取交易详情失败' }); // 返回服务器错误响应
    }
});

// 获取用户交易信息
router.get('/user/:userId', protect, async (req, res) => {
    try {
        const { userId } = req.params;
        
        // 验证当前用户是否有权限查看该用户的交易信息
        const currentUser = await User.findById(req.user._id);
        console.log('当前用户信息:', {
            found: !!currentUser,
            role: currentUser?.role,
            id: currentUser?._id
        });

        if (!currentUser || currentUser.role !== 'vip') {
            console.log('权限验证失败: 当前用户不是VIP');
            return res.status(403).json({
                success: false,
                message: '没有权限查看该用户的交易信息'
            });
        }

        // 验证被查看的用户是否存在且是被当前用户邀请的
        const targetUser = await User.findById(userId);
        console.log('目标用户信息:', {
            found: !!targetUser,
            id: targetUser?._id,
            referrer: targetUser?.referrer
        });

        if (!targetUser) {
            console.log('目标用户不存在');
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }

        // 验证目标用户是否是被当前用户邀请的
        const isInvitedByCurrentUser = targetUser.referrer?.toString() === currentUser._id.toString();
        console.log('邀请关系验证:', {
            targetUserReferrer: targetUser.referrer?.toString(),
            currentUserId: currentUser._id.toString(),
            isInvitedByCurrentUser
        });

        if (!isInvitedByCurrentUser) {
            console.log('权限验证失败: 目标用户不是被当前用户邀请的');
            return res.status(403).json({
                success: false,
                message: '没有权限查看该用户的交易信息'
            });
        }

        // 获取用户的交易记录
        const transactions = await Transaction.find({ user: userId, type: 'purchase' })
            .sort({ createdAt: -1 });

        console.log('成功获取交易记录:', { count: transactions.length });

        res.json({
            success: true,
            transactions
        });
    } catch (error) {
        console.error('获取用户交易信息错误:', error);
        res.status(500).json({
            success: false,
            message: '获取用户交易信息失败',
            error: error.message
        });
    }
});

// 获取充值路径列表
router.get('/recharge-paths', protect, async (req, res) => {
    try {
        const rechargePaths = await RechargePath.find({ active: true })
            .sort({ sort: 1, createdAt: -1 });
        
        res.json({
            success: true,
            data: rechargePaths
        });
    } catch (error) {
        console.error('获取充值路径错误:', error);
        res.status(500).json({
            success: false,
            message: '获取充值路径失败',
            error: error.message
        });
    }
});

// 获取待审核交易数量和客服未读消息数量
router.get('/pending/count', [protect, restrictToAdmin], async (req, res) => {
    try {
        // 获取待审核的交易数量
        const pendingCount = await Transaction.countDocuments({ status: 'pending' });
        
        // 获取客服未读消息数量
        const unreadCSCount = await CustomerServiceMessage.countDocuments({
            senderType: 'user',
            isRead: false
        });

        res.json({
            success: true,
            count: pendingCount,
            unreadCSCount: unreadCSCount
        });
    } catch (error) {
        console.error('获取待审核数量错误:', error);
        res.status(500).json({ success: false, message: '获取待审核数量失败', error: error.message });
    }
});

module.exports = router; // 导出路由模块
