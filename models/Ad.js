const mongoose = require('mongoose');

const adSchema = new mongoose.Schema({
    path: {
        type: String,
        required: [true, '广告跳转链接不能为空'],
        trim: true
    },
    imageUrl: {
        type: String,
        required: [true, '广告图片不能为空']
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Ad', adSchema); 