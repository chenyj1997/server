const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    // 用户
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // 交易类型：recharge-充值，withdraw-提现，purchase-购买，repay-还款
    type: {
        type: String,
        enum: ['recharge', 'withdraw', 'purchase', 'repay', 'referral_reward', 'SALE_PROCEEDS', 'REFERRAL_COMMISSION'],
        required: true
    },
    // 交易金额
    amount: {
        type: Number,
        required: true
    },
    // 交易状态：pending-待审核，approved-已通过，rejected-已拒绝
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'completed'],
        default: 'pending'
    },
    // 支付方式
    paymentMethod: {
        type: String,
        enum: ['balance', 'alipay', 'wechatpay', 'bank', 'usdt', 'system', 'REFERRAL_BONUS', 'manual', 'INTERNAL_SETTLEMENT'],
        required: true
    },
    // 支付账号
    paymentAccount: {
        type: String,
        required: true
    },
    // 收款账号
    receiveAccount: {
        type: String,
        required: true
    },
    receiver: {
        type: String,
        default: ''
    },
    // 交易凭证
    proof: {
        type: String
    },
    // 二维码图片
    qrcode: {
        type: String
    },
    // 审核备注
    remark: {
        type: String
    },
    // 审核人
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    // 审核时间
    reviewedAt: {
        type: Date
    },
    // 创建时间
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date
    },
    // 变更前余额
    balanceBefore: {
        type: Number,
        required: true
    },
    // 变更后余额
    balanceAfter: {
        type: Number,
        required: true
    },
    // 关联的信息ID，用于购买/还款等场景
    infoId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Info'
    }
});

// 更新时自动更新 updatedAt 字段
transactionSchema.pre('save', async function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('Transaction', transactionSchema); 
