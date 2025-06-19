const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// 删除旧的索引
async function dropOldIndexes() {
    try {
        const collection = mongoose.connection.collection('users');
        const indexes = await collection.indexes();
        
        // 删除email、phone和referrerCode的唯一索引
        for (const index of indexes) {
            if (index.name === 'email_1' || index.name === 'phone_1' || index.name === 'referrerCode_1') {
                await collection.dropIndex(index.name);
                console.log(`已删除索引: ${index.name}`);
            }
        }
    } catch (error) {
        console.error('删除索引时出错:', error);
    }
}

// 在数据库连接成功后执行
mongoose.connection.on('connected', () => {
    console.log('MongoDB连接成功，准备删除旧索引...');
    dropOldIndexes();
});

const userSchema = new mongoose.Schema({
    // 用户数字ID（8位随机数）
    numericId: {
        type: String,
        unique: true,
        sparse: true
    },
    // 用户邀请码（8位数字）
    inviteCode: {
        type: String,
        unique: true,
        sparse: true
    },
    // 用户名
    username: {
        type: String,
        required: [true, '用户名不能为空'],
        unique: true,
        trim: true
    },
    // 密码
    password: {
        type: String,
        required: [true, '密码不能为空']
    },
    // 支付密码
    payPassword: {
        type: String,
        select: false,
        validate: {
            validator: function(v) {
                // 如果是加密后的密码（以$2a$开头），则跳过验证
                if (v && v.startsWith('$2a$')) {
                    return true;
                }
                // 否则验证原始密码格式
                if (v) {
                    return /^\d{6}$/.test(v);
                }
                return true;
            },
            message: '支付密码必须是6位数字'
        }
    },
    // 是否已设置支付密码
    hasPayPassword: {
        type: Boolean,
        default: false
    },
    // 支付密码错误尝试次数
    payPasswordAttempts: {
        type: Number,
        default: 0
    },
    // 支付密码锁定时间
    payPasswordLockUntil: {
        type: Date
    },
    // 电子邮箱
    email: {
        type: String,
        trim: true,
        lowercase: true
    },
    // 手机号
    phone: {
        type: String,
        trim: true,
        validate: {
            validator: function(v) {
                if (!v) return true; // 允许为空
                return /^1[3-9]\d{9}$/.test(v);
            },
            message: '请输入有效的11位手机号码'
        }
    },
    // 用户状态：active-正常，disabled-禁用
    status: {
        type: String,
        enum: ['active', 'disabled'],
        default: 'active'
    },
    // 用户角色：admin-管理员，user-普通用户
    role: {
        type: String,
        enum: ['admin', 'user', 'vip'],
        default: 'user'
    },
    // 推荐人
    referrer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    // 钱包余额
    balance: {
        type: Number,
        default: 0
    },
    // 创建时间
    createdAt: {
        type: Date,
        default: Date.now
    },
    // 最后登录时间
    lastLoginAt: {
        type: Date
    },
    // 当前登录设备标识
    currentDeviceId: {
        type: String,
        default: null
    },
    // 设备登录历史
    deviceHistory: [{
        deviceId: String,
        lastLoginAt: Date,
        userAgent: String,
        ipAddress: String
    }],
    // 更新时间
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// 生成8位随机数ID
function generateNumericId() {
    // 生成8位随机数（避免以0开头）
    const min = 10000000; // 最小7位数+1
    const max = 99999999; // 最大8位数
    return Math.floor(min + Math.random() * (max - min)).toString();
}

// 生成邀请码
function generateInviteCode() {
    // 生成8位随机数（避免以0开头）
    const min = 10000000; // 最小7位数+1
    const max = 99999999; // 最大8位数
    return Math.floor(min + Math.random() * (max - min)).toString();
}

// 保存前处理
userSchema.pre('save', async function(next) {
    // 如果密码被修改，则加密
    if (this.isModified('password')) {
        try {
            this.password = await bcrypt.hash(this.password, 10);
        } catch (error) {
            return next(error);
        }
    }
    
    // 如果用户没有数字ID，生成一个
    if (!this.numericId) {
        // 尝试生成不重复的ID
        let isUnique = false;
        let attempts = 0;
        let numericId;
        
        // 最多尝试10次生成不重复ID
        while (!isUnique && attempts < 10) {
            numericId = generateNumericId();
            attempts++;
            
            // 检查是否存在相同ID
            const existingUser = await mongoose.model('User').findOne({ numericId });
            if (!existingUser) {
                isUnique = true;
                this.numericId = numericId;
            }
        }
        
        // 如果10次尝试后仍未生成唯一ID，使用时间戳+随机数
        if (!isUnique) {
            this.numericId = Date.now().toString().substring(5) + Math.floor(Math.random() * 1000);
        }
    }
    
    // 如果用户没有邀请码，生成一个
    if (!this.inviteCode) {
        // 尝试生成不重复的邀请码
        let isUnique = false;
        let attempts = 0;
        let inviteCode;
        
        // 最多尝试10次生成不重复邀请码
        while (!isUnique && attempts < 10) {
            inviteCode = generateInviteCode();
            attempts++;
            
            // 检查是否存在相同邀请码
            const existingUser = await mongoose.model('User').findOne({ inviteCode });
            if (!existingUser) {
                isUnique = true;
                this.inviteCode = inviteCode;
            }
        }
        
        // 如果10次尝试后仍未生成唯一邀请码，使用时间戳+随机数
        if (!isUnique) {
            this.inviteCode = Date.now().toString().substring(5) + Math.floor(Math.random() * 1000);
        }
    }
    
    this.updatedAt = new Date();
    next();
});

// 比较密码
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw error;
    }
};

// 生成推荐码
userSchema.methods.generateReferrerCode = function() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
};

module.exports = mongoose.model('User', userSchema); 