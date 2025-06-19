// 迁移管理员用户脚本：从 test 数据库迁移到 infopublisher 数据库
const mongoose = require('mongoose');
const User = require('../models/User'); // 假设 User 模型定义兼容两个数据库的用户结构
const config = require('../config');

async function migrateAdminUser() {
    let testDbConnection;
    let infoDbConnection;

    try {
        console.log('正在连接到源数据库 (test)...');
        // 连接到 test 数据库作为源
        testDbConnection = await mongoose.createConnection('mongodb://localhost:27017/test', { useNewUrlParser: true, useUnifiedTopology: true });
        const TestUser = testDbConnection.model('User', require('../models/User').schema); // 使用相同的 Schema 但不同的连接
        console.log('成功连接到源数据库 (test)。');

        // 在源数据库查找管理员用户
        console.log('正在源数据库 (test) 中查找管理员用户...');
        const adminUserInTest = await TestUser.findOne({ username: 'admin' });

        if (!adminUserInTest) {
            console.log('在源数据库 (test) 中未找到管理员用户，无需迁移。');
            return;
        }

        console.log('在源数据库 (test) 中找到管理员用户。');

        // 关闭源数据库连接
        await testDbConnection.close();
        console.log('源数据库连接已关闭。');

        console.log('正在连接到目标数据库 (infopublisher)...');
        // 连接到 infopublisher 数据库作为目标
        // 这里使用主 mongoose 连接，它应该已经配置为连接 infopublisher
         // 确保主 mongoose 连接已建立
        if (mongoose.connection.readyState !== 1) {
             console.log('主 mongoose 连接未建立，尝试使用配置连接。');
             await mongoose.connect(config.mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });
             console.log('主 mongoose 连接成功！');
        } else {
             console.log('主 mongoose 连接已建立。');
        }

        // 在目标数据库检查管理员用户是否已存在
        console.log('正在目标数据库 (infopublisher) 中检查管理员用户是否存在...');
        const adminUserInInfo = await User.findOne({ username: 'admin' });

        if (adminUserInInfo) {
            console.log('目标数据库 (infopublisher) 中已存在管理员用户，跳过创建。');
            // 可以选择更新现有用户，但为了简单起见，这里只跳过
             return;
        }

        console.log('目标数据库 (infopublisher) 中未找到管理员用户，正在创建...');
        // 在目标数据库创建新的管理员用户，复制源用户的数据（除了_id）
        const newAdminUser = new User({
            username: adminUserInTest.username,
            password: adminUserInTest.password, // 直接复制哈希后的密码
            email: adminUserInTest.email,
            phone: adminUserInTest.phone,
            roles: adminUserInTest.roles,
            status: adminUserInTest.status
            // 不复制 _id，让 MongoDB 生成新的
            // timestamp 会自动生成
        });

        await newAdminUser.save();
        console.log('管理员用户成功迁移并创建到目标数据库 (infopublisher)！');

    } catch (error) {
        console.error('迁移管理员用户失败:', error);
    } finally {
        // 确保所有连接都被关闭
        if (testDbConnection) {
             try { await testDbConnection.close(); console.log('源数据库连接已关闭 (finally)。'); } catch (e) { console.error('关闭源数据库连接失败:', e); }
        }
        // 注意：这里不关闭主 mongoose 连接，因为它可能被主应用使用
        // if (mongoose.connection.readyState === 1) {
        //      try { await mongoose.connection.close(); console.log('主数据库连接已关闭 (finally)。'); } catch (e) { console.error('关闭主数据库连接失败:', e); }
        // }
    }
}

migrateAdminUser(); 