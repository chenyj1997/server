const mongoose = require('mongoose');

// 定义信息模型
const infoSchema = new mongoose.Schema({
    title: { type: String, required: true },      // 信息标题
    content: { type: String, required: true },    // 信息内容
    category: { type: String, default: '资讯' },  // 信息分类
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },  // 发布人ID
    authorName: { type: String },                 // 发布人名称
    status: { type: String, default: 'PUBLISHED' }, // 信息状态
    readCount: { type: Number, default: 0 },      // 阅读次数
    imageUrls: [String],                          // 图片URL数组
    isTop: { type: Boolean, default: false },     // 是否置顶
    publishTime: { type: Date, default: Date.now }, // 发布时间
    createdAt: { type: Date, default: Date.now },  // 创建时间
    updatedAt: { type: Date, default: Date.now },   // 更新时间
    
    // 交易相关字段
    loanAmount: { type: Number, default: 0 },     // 借款金额
    period: { type: Number, default: 0 },         // 周期天数
    repaymentAmount: { type: Number, default: 0 }, // 还款金额
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // 购买者ID
    purchaseTime: { type: Date },                 // 购买时间
    expiryTime: { type: Date },                   // 到期时间
    isPaid: { type: Boolean, default: false },    // 是否已还款
    isPublic: { type: Boolean, default: false }   // 是否已公开
});

// 导出模型
module.exports = mongoose.model('Info', infoSchema); 