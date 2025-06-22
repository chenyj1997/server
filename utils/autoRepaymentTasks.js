const Info = require('../models/Info');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const SystemSetting = require('../models/SystemSetting');

// 添加监控和告警机制
const monitoring = {
    stats: {
        totalScheduled: 0,
        totalExecuted: 0,
        totalFailed: 0,
        totalRetries: 0,
        lastRun: null,
        errors: []
    },
    
    logError: (error, context) => {
        const errorLog = {
            timestamp: new Date(),
            error: error.message,
            stack: error.stack,
            context
        };
        monitoring.stats.errors.push(errorLog);
        console.error(`[AUTO_REPAYMENT_ERROR] ${context}:`, error);
        
        // 如果错误过多，发送告警
        if (monitoring.stats.errors.length > 10) {
            console.warn(`[AUTO_REPAYMENT_ALERT] 错误数量过多: ${monitoring.stats.errors.length}`);
        }
    },
    
    resetStats: () => {
        monitoring.stats = {
            totalScheduled: 0,
            totalExecuted: 0,
            totalFailed: 0,
            totalRetries: 0,
            lastRun: new Date(),
            errors: []
        };
    }
};

// 重试机制配置
const RETRY_CONFIG = {
    maxRetries: 3,
    retryDelay: 5000, // 5秒
    backoffMultiplier: 2
};

// 并发控制配置
const CONCURRENCY_CONFIG = {
    maxConcurrent: 5,
    batchSize: 10
};

// 重试函数
const retryOperation = async (operation, operationName, maxRetries = RETRY_CONFIG.maxRetries) => {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await operation();
            if (attempt > 1) {
                console.log(`[AUTO_REPAYMENT_RETRY] ${operationName} 重试成功 (第${attempt}次尝试)`);
                monitoring.stats.totalRetries++;
            }
            return result;
        } catch (error) {
            lastError = error;
            console.warn(`[AUTO_REPAYMENT_RETRY] ${operationName} 第${attempt}次尝试失败:`, error.message);
            
            if (attempt < maxRetries) {
                const delay = RETRY_CONFIG.retryDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1);
                console.log(`[AUTO_REPAYMENT_RETRY] ${operationName} ${delay}ms后重试...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    monitoring.logError(lastError, `${operationName} 重试${maxRetries}次后失败`);
    throw lastError;
};

// 并发控制函数
const processBatch = async (items, processor, batchSize = CONCURRENCY_CONFIG.batchSize) => {
    const results = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchPromises = batch.map(item => 
            retryOperation(() => processor(item), `处理信息 ${item._id}`)
        );
        
        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults);
        
        // 添加小延迟避免数据库压力
        if (i + batchSize < items.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    return results;
};

// Helper function to schedule automatic repayments
const scheduleAutoRepayments = async () => {
    const startTime = new Date();
    console.log(`[AUTO_REPAYMENT_SCHEDULE] 开始调度自动还款任务 - ${startTime.toISOString()}`);
    
    try {
        const now = new Date();
        // 修改时间窗口：剩余8小时到2小时为自动任务
        const schedulingWindowStart = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2小时后
        const schedulingWindowEnd = new Date(now.getTime() + 8 * 60 * 60 * 1000); // 8小时后

        console.log(`[AUTO_REPAYMENT_SCHEDULE] 调度时间窗口: ${schedulingWindowStart.toISOString()} - ${schedulingWindowEnd.toISOString()}`);

        const infosToSchedule = await Info.find({
            purchasers: { $exists: true, $not: { $size: 0 } },
            isPaid: false,
            expiryTime: { 
                $exists: true, 
                $gte: schedulingWindowStart, 
                $lte: schedulingWindowEnd 
            },
            isAutoRepaymentScheduled: false,
            period: { $gt: 0 }
        }).lean();

        console.log(`[AUTO_REPAYMENT_SCHEDULE] 找到 ${infosToSchedule.length} 个信息需要调度`);

        if (infosToSchedule.length === 0) {
            console.log(`[AUTO_REPAYMENT_SCHEDULE] 没有需要调度的信息`);
            return;
        }

        // 批量处理调度
        const scheduleProcessor = async (info) => {
            const randomTimeWindowStart = now.getTime();
            const randomTimeWindowEnd = info.expiryTime.getTime();
            const randomRepaymentTime = new Date(randomTimeWindowStart + Math.random() * (randomTimeWindowEnd - randomTimeWindowStart));

            await Info.findByIdAndUpdate(info._id, {
                isAutoRepaymentScheduled: true,
                autoRepaymentTime: randomRepaymentTime
            });

            console.log(`[AUTO_REPAYMENT_SCHEDULE] 信息 ${info._id} 已调度，还款时间: ${randomRepaymentTime.toISOString()}`);
            return { infoId: info._id, scheduledTime: randomRepaymentTime };
        };

        const results = await processBatch(infosToSchedule, scheduleProcessor);
        
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const failureCount = results.filter(r => r.status === 'rejected').length;
        
        monitoring.stats.totalScheduled += successCount;
        
        console.log(`[AUTO_REPAYMENT_SCHEDULE] 调度完成 - 成功: ${successCount}, 失败: ${failureCount}`);
        
        if (failureCount > 0) {
            console.warn(`[AUTO_REPAYMENT_SCHEDULE] 有 ${failureCount} 个信息调度失败`);
        }

    } catch (error) {
        monitoring.logError(error, 'scheduleAutoRepayments');
        throw error;
    } finally {
        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();
        console.log(`[AUTO_REPAYMENT_SCHEDULE] 调度任务完成，耗时: ${duration}ms`);
    }
};

// Helper function to execute scheduled automatic repayments
const executeAutoRepayments = async () => {
    const startTime = new Date();
    console.log(`[AUTO_REPAYMENT_EXECUTE] 开始执行自动还款任务 - ${startTime.toISOString()}`);

    try {
        const now = new Date();

        // 查找需要还款的信息
        const infosToRepay = await Info.find({
            $or: [
                {
                    isAutoRepaymentScheduled: true,
                    autoRepaymentTime: { $lte: now }
                },
                {
                    expiryTime: { $lte: now },
                    isAutoRepaymentScheduled: false
                }
            ],
            isPaid: false,
            purchasers: { $exists: true, $not: { $size: 0 } },
            period: { $gt: 0 }
        }).populate('purchasers', '_id').populate('author', '_id');

        console.log(`[AUTO_REPAYMENT_EXECUTE] 找到 ${infosToRepay.length} 个信息需要还款`);

        if (infosToRepay.length === 0) {
            console.log(`[AUTO_REPAYMENT_EXECUTE] 没有需要还款的信息`);
            return;
        }

        // 批量处理还款
        const repaymentProcessor = async (info) => {
            console.log(`[AUTO_REPAYMENT_EXECUTE] 开始处理信息 ${info._id}`);
            
            const buyerId = info.purchasers[0]?._id;
            const authorId = info.author?._id;
            const repaymentAmount = Number(info.repaymentAmount);

            if (!buyerId || !authorId || repaymentAmount <= 0) {
                console.error(`[AUTO_REPAYMENT_EXECUTE] 信息 ${info._id} 数据无效: buyerId=${buyerId}, authorId=${authorId}, amount=${repaymentAmount}`);
                await Info.findByIdAndUpdate(info._id, { isAutoRepaymentScheduled: false });
                return { status: 'failed', reason: 'invalid_data', infoId: info._id };
            }

            // 使用数据库事务确保数据一致性
            const session = await Info.startSession();
            try {
                await session.withTransaction(async () => {
                    const [buyer, author] = await Promise.all([
                        User.findById(buyerId).select('balance referrer username').session(session),
                        User.findById(authorId).select('balance username').session(session)
                    ]);

                    if (!buyer || !author) {
                        throw new Error(`用户不存在: buyer=${!!buyer}, author=${!!author}`);
                    }

                    console.log(`[AUTO_REPAYMENT_EXECUTE] 信息 ${info._id} - 发布者余额: ${author.balance}, 需要还款: ${repaymentAmount}`);

                    if (author.balance < repaymentAmount) {
                        console.warn(`[AUTO_REPAYMENT_EXECUTE] 信息 ${info._id} 发布者余额不足，标记为公开`);
                        await Info.findByIdAndUpdate(info._id, { 
                            isPublic: true, 
                            isAutoRepaymentScheduled: false 
                        }).session(session);
                        return { status: 'insufficient_balance', infoId: info._id };
                    }

                    // 扣除发布者余额
                    author.balance -= repaymentAmount;
                    await author.save({ session });
                    console.log(`[AUTO_REPAYMENT_EXECUTE] 信息 ${info._id} - 已扣除发布者余额，新余额: ${author.balance}`);

                    // 计算推荐人返利
                    let rebateAmount = 0;
                    let referrer = null;
                    if (buyer.referrer) {
                        const rebateSettings = await SystemSetting.findOne({ key: 'rebate_settings' }).session(session);
                        if (rebateSettings) {
                            const { inviteRebatePercentage, minRebateAmount } = rebateSettings.value;
                            const calculatedRebateAmount = (Number(info.loanAmount) * inviteRebatePercentage / 100);
                            
                            if (calculatedRebateAmount >= minRebateAmount) {
                                referrer = await User.findById(buyer.referrer).session(session);
                                if (referrer) {
                                    rebateAmount = Math.floor(calculatedRebateAmount);
                                    if (rebateAmount > 0) {
                                        const referrerBalanceBefore = referrer.balance;
                                        referrer.balance += rebateAmount;
                                        await referrer.save({ session });
                                        
                                        await Transaction.create([{
                                            user: referrer._id,
                                            type: 'REFERRAL_COMMISSION',
                                            amount: rebateAmount,
                                            status: 'approved',
                                            paymentMethod: 'INTERNAL_SETTLEMENT',
                                            paymentAccount: authorId.toString(),
                                            receiveAccount: referrer._id.toString(),
                                            remark: `获得推荐返利，${author.username || '系统'}自动还款`,
                                            infoId: info._id,
                                            createdAt: new Date(),
                                            balanceBefore: referrerBalanceBefore,
                                            balanceAfter: referrer.balance
                                        }], { session });
                                        
                                        console.log(`[AUTO_REPAYMENT_EXECUTE] 信息 ${info._id} - 推荐人 ${referrer.username} 获得返利 ${rebateAmount}`);
                                    }
                                }
                            }
                        }
                    }

                    // 计算买家实际收款金额
                    const buyerReceiveAmount = repaymentAmount - rebateAmount;
                    
                    // 给买家增加余额
                    const buyerBalanceBefore = buyer.balance;
                    buyer.balance += buyerReceiveAmount;
                    await buyer.save({ session });
                    console.log(`[AUTO_REPAYMENT_EXECUTE] 信息 ${info._id} - 买家余额从 ${buyerBalanceBefore} 增加到 ${buyer.balance}`);

                    // 创建还款交易记录
                    await Transaction.create([{
                        user: buyerId,
                        type: 'repay',
                        amount: buyerReceiveAmount,
                        status: 'approved',
                        paymentMethod: 'balance',
                        paymentAccount: authorId.toString(),
                        receiveAccount: buyerId.toString(),
                        remark: `信息到期自动还款: ${info.title || info._id}`,
                        infoId: info._id,
                        createdAt: new Date(),
                        balanceBefore: buyerBalanceBefore,
                        balanceAfter: buyer.balance
                    }], { session });

                    // 删除信息
                    await Info.findByIdAndDelete(info._id).session(session);
                    console.log(`[AUTO_REPAYMENT_EXECUTE] 信息 ${info._id} 自动还款完成并删除`);
                });

                return { status: 'success', infoId: info._id };
            } finally {
                await session.endSession();
            }
        };

        const results = await processBatch(infosToRepay, repaymentProcessor);
        
        const successCount = results.filter(r => r.status === 'fulfilled' && r.value?.status === 'success').length;
        const failureCount = results.filter(r => r.status === 'rejected').length;
        const insufficientBalanceCount = results.filter(r => r.status === 'fulfilled' && r.value?.status === 'insufficient_balance').length;
        
        monitoring.stats.totalExecuted += successCount;
        monitoring.stats.totalFailed += failureCount;
        
        console.log(`[AUTO_REPAYMENT_EXECUTE] 执行完成 - 成功: ${successCount}, 失败: ${failureCount}, 余额不足: ${insufficientBalanceCount}`);
        
        // 如果有余额不足的情况，发送告警
        if (insufficientBalanceCount > 0) {
            console.warn(`[AUTO_REPAYMENT_ALERT] 有 ${insufficientBalanceCount} 个信息因发布者余额不足而公开`);
        }

    } catch (error) {
        monitoring.logError(error, 'executeAutoRepayments');
        throw error;
    } finally {
        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();
        console.log(`[AUTO_REPAYMENT_EXECUTE] 执行任务完成，耗时: ${duration}ms`);
    }
};

// 获取监控统计信息
const getMonitoringStats = () => {
    return {
        ...monitoring.stats,
        uptime: monitoring.stats.lastRun ? new Date().getTime() - monitoring.stats.lastRun.getTime() : 0
    };
};

// 重置监控统计
const resetMonitoringStats = () => {
    monitoring.resetStats();
};

module.exports = {
    scheduleAutoRepayments,
    executeAutoRepayments,
    getMonitoringStats,
    resetMonitoringStats
}; 
