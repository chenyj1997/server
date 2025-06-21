const mongoose = require('mongoose');

// 定义充值路径模型
const rechargePathSchema = new mongoose.Schema({
    // 支付方式名称
    name: {
        type: String,
        required: false,
        trim: true
    },
    // 支付方式类型 (例如: alipay, wechat, bank)
    type: {
        type: String,
        default: 'other',
        enum: ['alipay', 'wechat', 'bank', 'other'],
        required: true
    },
    // 支付方式图标
    icon: {
        type: String,
        required: false,
        default: null
    },
    // 收款账号
    account: {
        type: String,
        required: false,
        trim: true
    },
    // 收款人姓名
    receiver: {
        type: String,
        default: '',
        trim: true
    },
    // 收款二维码
    qrCode: {
        type: String,
        required: false,
        default: null
    },
    // 是否启用
    active: {
        type: Boolean,
        default: true
    },
    // 排序
    sort: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// 创建索引
rechargePathSchema.index({ sort: 1 });
rechargePathSchema.index({ active: 1 });

// 创建模型
const RechargePath = mongoose.model('RechargePath', rechargePathSchema);

module.exports = RechargePath; 
