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
        default: 'alipay',
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
    },
    // 创建时间
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// 添加虚拟字段确保始终有图标URL
// rechargePathSchema.virtual('displayIcon').get(function() {
//     // 如果icon为null、undefined或空字符串，返回默认图标
//     if (!this.icon || typeof this.icon !== 'string') return '/uploads/icons/default-alipay.png';
    
//     // 如果icon是完整路径（以http或/开头），直接返回
//     if (this.icon.startsWith('http') || this.icon.startsWith('/')) return this.icon;
    
//     // 否则，拼接路径前缀
//     return `/uploads/icons/${this.icon}`;
// });

// 添加虚拟字段确保始终有二维码URL，兼容所有常见大小写写法和路径写法，强制修正 /admin/ 路径
// rechargePathSchema.virtual('displayQrCode').get(function() {
//     // 直接使用 this.qrCode，不再尝试获取其他字段
//     const code = this.qrCode;
//     if (!code || typeof code !== 'string') return '/uploads/qrcodes/default-alipay-qr.png';
//     // 如果是完整URL
//     if (code.startsWith('http')) return code;
//     // 如果是/admin/xxx.jpg，强制替换为                                                                                                 
//     if (code.startsWith('/admin/')) {
//         const filename = code.split('/').pop();
//         return `/uploads/qrcodes/${filename}`;
//     }
//     // 如果是/uploads/qrcodes/xxx.jpg，直接返回
//     if (code.startsWith('/uploads/qrcodes/')) return code;
//     // 如果是/xxx.jpg，补全前缀
//     if (code.startsWith('/')) return '/uploads/qrcodes' + code;
//     // 否则补全前缀
//     return `/uploads/qrcodes/${code}`;
// });

// 兼容前端调用，直接返回 displayQrCode
// rechargePathSchema.virtual('qrcode').get(function() {
//     return this.displayQrCode;
// });

// 兼容前端调用，直接返回 displayQrCode
// rechargePathSchema.virtual('qrCodeUrl').get(function() {
//     return this.displayQrCode;
// });

// rechargePathSchema.virtual('isActive').get(function() {
//     return Boolean(this.active);
// });

// 创建索引
rechargePathSchema.index({ sort: 1 });
rechargePathSchema.index({ active: 1 });

// 创建模型
const RechargePath = mongoose.model('RechargePath', rechargePathSchema);

module.exports = RechargePath; 
