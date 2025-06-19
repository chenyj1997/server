const mongoose = require('mongoose');

const SystemSettingSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    description: {
        type: String,
        trim: true
    }
}, { timestamps: true });

const SystemSetting = mongoose.model('SystemSetting', SystemSettingSchema);

module.exports = SystemSetting; 