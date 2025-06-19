const User = require('../models/User');
const Transaction = require('../models/Transaction');

// 计算历史总盈利和真实管理员余额
async function calculateTotalProfit() {
    try {
        console.log('开始计算历史总盈利...');
        // 用正则表达式忽略大小写匹配 status 字段
        const transactions = await Transaction.find({
            status: { $regex: /^success$|^approved$/i }
        }).sort({ createdAt: 1 });

        console.log(`找到 ${transactions.length} 条成功/已审核交易记录`);

        let totalProfit = 0;
        let totalRecharge = 0;
        let totalWithdrawal = 0;

        for (const transaction of transactions) {
            const type = (transaction.type || '').toLowerCase();
            if (type === 'recharge') {
                totalRecharge += transaction.amount;
                totalProfit += transaction.amount;
                console.log(`充值: ${transaction.amount}, 当前总盈利: ${totalProfit}`);
            } else if (type === 'withdraw' || type === 'withdrawal') {
                totalWithdrawal += transaction.amount;
                totalProfit -= transaction.amount;
                console.log(`提现: ${transaction.amount}, 当前总盈利: ${totalProfit}`);
            }
        }

        // 统计管理员相关交易流水
        const admin = await User.findOne({ username: 'admin' });
        let adminBalance = totalProfit;
        if (admin) {
            // 查找所有管理员相关的交易流水
            const adminTxs = await Transaction.find({ user: admin._id, status: { $regex: /^success$|^approved$/i } });
            let adminTxSum = 0;
            for (const tx of adminTxs) {
                // 支出类型（如奖励、转账、消费等）可根据实际业务扩展
                const type = (tx.type || '').toLowerCase();
                // 这里假设管理员所有流水都计入余额（支出为负，收入为正）
                // 如果有特殊类型可在此细分
                if (type === 'recharge') {
                    // 管理员充值，视为收入
                    adminTxSum += tx.amount;
                } else if (type === 'withdraw' || type === 'withdrawal') {
                    // 管理员提现，视为支出
                    adminTxSum -= tx.amount;
                } else if (type === 'transfer' || type === 'reward' || type === 'expense') {
                    // 其它支出类型
                    adminTxSum -= Math.abs(tx.amount);
                } else if (type === 'income') {
                    // 其它收入类型
                    adminTxSum += Math.abs(tx.amount);
                } else {
                    // 其它类型默认计入
                    adminTxSum += tx.amount;
                }
            }
            adminBalance = totalProfit + adminTxSum;
            const oldBalance = admin.balance;
            admin.balance = adminBalance;
            await admin.save();
            console.log(`管理员余额更新: ${oldBalance} -> ${adminBalance}`);
        } else {
            console.error('未找到管理员账户！请确保存在用户名为admin的管理员账户');
        }

        return {
            totalProfit,
            totalRecharge,
            totalWithdrawal,
            transactionCount: transactions.length,
            adminBalance
        };
    } catch (error) {
        console.error('计算历史总盈利失败:', error);
        throw error;
    }
}

module.exports = {
    calculateTotalProfit
}; 