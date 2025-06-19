// 钱包模型
const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
    user: { // 关联的用户
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // 引用 User 模型
        required: true,
        unique: true // 一个用户只有一个钱包
    },
    balance: { // 余额
        type: Number,
        default: 0
    },
    frozen: { // 冻结金额
        type: Number,
        default: 0
    },
    paymentPassword: { // 支付密码
        type: String,
        default: null
    },
    paymentPasswordSet: { // 是否已设置支付密码
        type: Boolean,
        default: false
    },
    // 可以根据需要添加其他字段，如交易记录引用等
}, {
    timestamps: true // 添加 createdAt 和 updatedAt 字段
});

const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet; 