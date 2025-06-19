console.log('[Purchase.js] __dirname:', __dirname, ' __filename:', __filename);
const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
    info: { type: mongoose.Schema.Types.ObjectId, ref: 'Info', required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
    expiryTime: { type: Date }
});

console.log('[Purchase model] loaded');

// 在保存前计算过期时间
purchaseSchema.pre('save', async function(next) {
  try {
    if (this.isNew) {
      console.log('[Purchase pre-save] this:', this);
      console.log('[Purchase pre-save] this.createdAt:', this.createdAt, 'type:', typeof this.createdAt);
      // 类型检查与兜底
      if (!(this.createdAt instanceof Date)) {
        console.warn('[Purchase pre-save] createdAt不是Date类型，自动赋值为当前时间');
        this.createdAt = new Date();
      }
      const Info = mongoose.model('Info');
      const info = await Info.findById(this.info);
      console.log('[Purchase pre-save] info:', info);
      if (!info) {
        console.error('[Purchase pre-save] 未查到对应的Info，无法计算expiryTime，this.info:', this.info);
        return next();
      }
      if (typeof info.period !== 'number' || isNaN(info.period)) {
        console.warn('[Purchase pre-save] info.period无效，无法计算expiryTime，info.period:', info.period);
        return next();
      }
      const created = this.createdAt;
      console.log('[Purchase pre-save] created:', created);
      this.expiryTime = new Date(created.getTime() + (info.period * 24 * 60 * 60 * 1000));
      console.log('[Purchase pre-save] expiryTime:', this.expiryTime);
    }
    next();
  } catch (error) {
    console.error('[Purchase pre-save] error:', error);
    next(error);
  }
});

module.exports = mongoose.model('Purchase', purchaseSchema); 