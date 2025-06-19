// 环境设置脚本入口文件
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readdir = promisify(fs.readdir);

// 设置脚本目录
const setupDir = path.join(__dirname);

// 运行所有设置脚本
async function runSetup() {
    try {
        // 读取设置脚本目录
        const files = await readdir(setupDir);
        
        // 过滤出.js文件并按名称排序
        const setupFiles = files
            .filter(file => file.endsWith('.js') && file !== 'index.js')
            .sort();
        
        console.log('开始执行环境设置脚本...');
        
        // 依次执行每个设置脚本
        for (const file of setupFiles) {
            const setup = require(path.join(setupDir, file));
            console.log(`执行设置脚本: ${file}`);
            await setup();
            console.log(`设置脚本 ${file} 执行完成`);
        }
        
        console.log('所有环境设置脚本执行完成');
    } catch (error) {
        console.error('执行环境设置脚本失败:', error);
        process.exit(1);
    }
}

// 执行设置
runSetup(); 