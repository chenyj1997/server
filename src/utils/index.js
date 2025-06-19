// 工具类统一导出文件
const fileUtils = require('./fileUtils');
const notificationUtils = require('./notificationUtils');

// 初始化工具
async function initializeUtils() {
    try {
        // 确保上传目录存在
        await fileUtils.ensureDirectories();
        console.log('工具初始化完成');
    } catch (error) {
        console.error('工具初始化失败:', error);
        throw error;
    }
}

module.exports = {
    fileUtils,
    notificationUtils,
    initializeUtils
}; 