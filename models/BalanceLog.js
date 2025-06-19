const mongoose = require('mongoose');

// 定义资金变动记录模型
const balanceLogSchema = new mongoose.Schema({
    // 用户ID，关联到用户模型
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // 变动类型：recharge-充值，withdraw-提现，consume-消费，refund-退款
    type: {
        type: String,
        enum: ['recharge', 'withdraw', 'consume', 'refund'],
        required: true
    },
    // 变动金额
    amount: {
        type: Number,
        required: true
    },
    // 变动前余额
    beforeBalance: {
        type: Number,
        required: true
    },
    // 变动后余额
    afterBalance: {
        type: Number,
        required: true
    },
    // 关联的交易ID（如果有）
    transaction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
    },
    // 备注说明
    remark: {
        type: String
    },
    // 操作人（管理员操作时记录）
    operator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    // 创建时间
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    // 启用虚拟字段
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// 创建索引
balanceLogSchema.index({ user: 1, createdAt: -1 });
balanceLogSchema.index({ type: 1, createdAt: -1 });

const BalanceLog = mongoose.model('BalanceLog', balanceLogSchema);

module.exports = BalanceLog; 