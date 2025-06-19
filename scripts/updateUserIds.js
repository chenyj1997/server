/**
 * 为现有用户添加随机8位数字ID的脚本
 */
const mongoose = require('mongoose');
const User = require('../models/User');
const config = require('../config');

// 生成8位随机数ID
function generateNumericId() {
    // 生成8位随机数（避免以0开头）
    const min = 10000000; // 最小7位数+1
    const max = 99999999; // 最大8位数
    return Math.floor(min + Math.random() * (max - min)).toString();
}

// 连接数据库
mongoose.connect(config.mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('数据库连接成功，开始更新用户ID...'))
.catch(err => {
    console.error('数据库连接失败:', err);
    process.exit(1);
});

// 更新用户数字ID
async function updateUserIds() {
    try {
        // 获取所有没有数字ID的用户
        const users = await User.find({ numericId: { $exists: false } });
        console.log(`找到 ${users.length} 个需要更新的用户`);

        // 更新每个用户
        for (const user of users) {
            let isUnique = false;
            let attempts = 0;
            let numericId;
            
            // 尝试生成不重复的ID
            while (!isUnique && attempts < 10) {
                numericId = generateNumericId();
                attempts++;
                
                // 检查是否存在相同ID
                const existingUser = await User.findOne({ numericId });
                if (!existingUser) {
                    isUnique = true;
                    user.numericId = numericId;
                    await user.save();
                    console.log(`用户 ${user.username} 的数字ID已更新为 ${numericId}`);
                }
            }
            
            // 如果10次尝试后仍未生成唯一ID，使用时间戳+随机数
            if (!isUnique) {
                numericId = Date.now().toString().substring(5) + Math.floor(Math.random() * 1000);
                user.numericId = numericId;
                await user.save();
                console.log(`用户 ${user.username} 的数字ID已更新为 ${numericId} (备用方案)`);
            }
        }
        
        console.log('所有用户ID更新完成！');
        process.exit(0);
    } catch (error) {
        console.error('更新用户ID时出错:', error);
        process.exit(1);
    }
}

// 执行更新
updateUserIds(); 