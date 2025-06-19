/**
 * 为现有用户生成会员ID的脚本
 */
const mongoose = require('mongoose');
const User = require('../models/User');
const config = require('../config');

// 连接数据库
mongoose.connect(config.mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('数据库连接成功，开始生成会员ID...'))
.catch(err => {
  console.error('数据库连接失败:', err);
  process.exit(1);
});

// 为所有没有会员ID的用户生成ID
async function generateMemberIds() {
  try {
    // 查找所有没有会员ID的用户
    const users = await User.find({ memberId: { $exists: false } });
    
    console.log(`发现 ${users.length} 个用户需要生成会员ID`);
    
    let counter = 0;
    
    // 循环处理每个用户
    for (const user of users) {
      // 生成新的会员ID
      const memberId = await User.generateMemberId();
      
      // 更新用户
      await User.findByIdAndUpdate(user._id, { memberId });
      
      counter++;
      console.log(`[${counter}/${users.length}] 用户 ${user.username} 已生成会员ID: ${memberId}`);
    }
    
    console.log('所有用户会员ID生成完成！');
    process.exit(0);
  } catch (error) {
    console.error('生成会员ID失败:', error);
    process.exit(1);
  }
}

// 执行迁移
generateMemberIds(); 