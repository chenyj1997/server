const mongoose = require('mongoose');

// 信息模型
const infoSchema = new mongoose.Schema({
    // 标题 (必填)
    title: {
        type: String,
        required: true,
        trim: true,
        default: '未命名信息'
    },
    // 内容 (必填)
    content: {
        type: String,
        required: true,
        default: '暂无内容'
    },
    
    // 基本信息字段
    name: { type: String },
    age: { type: String },
    phone: { type: String },
    idCard: { type: String },
    job: { type: String },
    address: { type: String },
    // 借款信息字段
    loanAmount: { type: Number, default: 0 },
    period: { type: Number, default: 0 },
    repaymentAmount: { type: String },
    // 价格
    price: {
        type: Number,
        default: 0
    },
    // 购买者列表
    purchasers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],

    // 图片URL列表
    imageUrls: [{
        type: String
    }],
    // 作者
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // 作者名称
    authorName: {
        type: String,
        required: true
    },
    // 浏览量
    readCount: {
        type: Number,
        default: 0
    },
    // 是否置顶
    isTop: {
        type: Boolean,
        default: false
    },
    isPublic: { // 新增字段，标记信息是否公开
        type: Boolean,
        default: false,
    },
    isPaid: { // 新增字段，标记借贷信息是否已还款
        type: Boolean,
        default: false
    },
    // 状态
    status: {
        type: String,
        enum: ['draft', 'published', 'OFFLINE'],
        default: 'published'
    },
    // 发布时间
    publishTime: {
        type: Date
    },
    // 销售状态
    saleStatus: {
        type: String,
        enum: ['待售', '售出', '已下架'],
        default: '待售'
    },
    // 到期时间
    expiryTime: { // 新增字段，借贷信息到期时间
        type: Date
    },
    // 购买时间
    purchaseTime: {
        type: Date
    },
    isAutoRepaymentScheduled: { // 新增字段，标记是否已安排自动还款
        type: Boolean,
        default: false
    },
    autoRepaymentTime: { // 新增字段，预定的自动还款时间
        type: Date,
    },
}, {
    timestamps: true
});

// 创建索引
infoSchema.index({ title: 'text', content: 'text' });
infoSchema.index({ isTop: -1, createdAt: -1 });
infoSchema.index({ purchasers: 1 }); // 添加购买者索引

// 更新时自动更新 updatedAt 字段
infoSchema.pre('save', function(next) {
    // 自动解析借款金额
    if (this.content) {
        const match = this.content.match(/借款[:：]\s*(\d+(?:\.\d+)?)/);
        this.loanAmount = match ? parseFloat(match[1]) : 0;
    }

    // 确保 publishTime 是当前时间
    if (this.isNew) {
        this.publishTime = new Date();
        console.log('设置发布时间:', this.publishTime);
    }

    // 只有在购买时才设置 expiryTime
    if (this.isModified('purchasers') && this.purchasers.length > 0 && this.period > 0) {
        if (this.purchaseTime instanceof Date && !isNaN(this.purchaseTime.getTime())) {
            this.expiryTime = new Date(this.purchaseTime.getTime() + this.period * 24 * 60 * 60 * 1000);
            console.log('设置到期时间:', this.expiryTime);
        } else {
            console.warn('[Info pre-save] purchaseTime 无效，无法设置 expiryTime:', this.purchaseTime);
        }
    }

    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('Info', infoSchema); 