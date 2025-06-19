/**
 * 管理员后台主文件
 */



// 初始化
async function init() {

    // 检查登录状态
    if (window.auth && !window.auth.isAdmin()) {
        console.log('未登录或不是管理员，跳转到登录页面');
        window.location.href = '/login.html';
        return;
    }

    // 根据当前页面加载相应的模块
    const path = window.location.pathname;
    console.log('当前路径:', path);
    
    if (path.includes('/info')) {
        await loadInfoModule();
    } else if (path.includes('/user')) {
        await loadUserModule();
    } else if (path.includes('/wallet')) {
        await loadWalletModule();
    } else if (path.includes('/notification')) {
        await loadNotificationModule();
    } else {
        // 默认加载信息模块
        await loadInfoModule();
    }
}

// 加载信息管理模块
async function loadInfoModule() {
    console.log('加载信息管理模块...');
    try {
        if (window.infoManager && window.infoManager.initInfoPage) {
            await window.infoManager.initInfoPage();
        } else {
            console.error('找不到信息管理模块');
            if (window.ui) window.ui.showError('无法加载信息管理模块');
        }
    } catch (error) {
        console.error('加载信息列表失败:', error);
        if (window.ui) window.ui.showError('加载信息列表失败');
    }
}

// 加载用户管理模块
async function loadUserModule() {
    console.log('加载用户管理模块...');
    try {
        if (window.userManager && window.userManager.initUserPage) {
            await window.userManager.initUserPage();
        } else {
            console.error('找不到用户管理模块');
            if (window.ui) window.ui.showError('无法加载用户管理模块');
        }
    } catch (error) {
        console.error('加载用户列表失败:', error);
        if (window.ui) window.ui.showError('加载用户列表失败');
    }
}

// 加载钱包管理模块
async function loadWalletModule() {
    console.log('加载钱包管理模块...');
    try {
        if (window.walletManager && window.walletManager.initWalletPage) {
            await window.walletManager.initWalletPage();
    } else {
            console.error('找不到钱包管理模块');
            if (window.ui) window.ui.showError('无法加载钱包管理模块');
        }
    } catch (error) {
        console.error('加载钱包列表失败:', error);
        if (window.ui) window.ui.showError('加载钱包列表失败');
    }
}

// 加载通知管理模块
async function loadNotificationModule() {
    console.log('加载通知管理模块...');
    try {
        if (window.notificationManager && window.notificationManager.initNotificationPage) {
            await window.notificationManager.initNotificationPage();
        } else {
            console.error('找不到通知管理模块');
            if (window.ui) window.ui.showError('无法加载通知管理模块');
        }
    } catch (error) {
        console.error('加载通知列表失败:', error);
        if (window.ui) window.ui.showError('加载通知列表失败');
    }
}

// 导出全局函数
window.adminFunctions = {
    init,
    loadInfoModule,
    loadUserModule,
    loadWalletModule,
    loadNotificationModule,
    
    // 信息管理
    editInfo: async (id) => {
        console.log('编辑信息:', id);
        try {
            if (window.infoManager && window.infoManager.editInfo) {
                await window.infoManager.editInfo(id);
            }
    } catch (error) {
            console.error('获取信息详情失败:', error);
            if (window.ui) window.ui.showError('获取信息详情失败');
        }
    },
    
    deleteInfo: async (id) => {
        console.log('删除信息:', id);
        if (confirm('确定要删除这条信息吗？')) {
            try {
                if (window.infoManager && window.infoManager.deleteInfo) {
                    await window.infoManager.deleteInfo(id);
                    await loadInfoModule();
        }
    } catch (error) {
                console.error('删除信息失败:', error);
                if (window.ui) window.ui.showError('删除信息失败');
            }
        }
    },
    
    // 用户管理
    editUser: async (id) => {
        console.log('编辑用户:', id);
        try {
            if (window.userManager && window.userManager.editUser) {
                await window.userManager.editUser(id);
                }
            } catch (error) {
            console.error('获取用户详情失败:', error);
            if (window.ui) window.ui.showError('获取用户详情失败');
        }
    },
    
    resetPassword: async (id) => {
        console.log('重置密码:', id);
        if (confirm('确定要重置该用户的密码吗？')) {
            try {
                if (window.userManager && window.userManager.resetUserPassword) {
                    await window.userManager.resetUserPassword(id);
        }
    } catch (error) {
                console.error('重置密码失败:', error);
                if (window.ui) window.ui.showError('重置密码失败');
            }
        }
    },
    
    deleteUser: async (id) => {
        console.log('删除用户:', id);
        if (confirm('确定要删除这个用户吗？')) {
            try {
                if (window.userManager && window.userManager.deleteUser) {
                    await window.userManager.deleteUser(id);
                    await loadUserModule();
        }
    } catch (error) {
                console.error('删除用户失败:', error);
                if (window.ui) window.ui.showError('删除用户失败');
            }
        }
    }
};

// 兼容旧版全局函数
window.editInfo = window.adminFunctions.editInfo;
window.deleteInfo = window.adminFunctions.deleteInfo;
window.editUser = window.adminFunctions.editUser;
window.resetPassword = window.adminFunctions.resetPassword;
window.deleteUser = window.adminFunctions.deleteUser;

window.viewWallet = async (id) => {
    try {
        const wallet = await walletModule.getWalletDetail(id);
        // TODO: 显示钱包详情
    } catch (error) {
        console.error('获取钱包详情失败:', error);
        }
};

window.createTransaction = async (walletId) => {
    // TODO: 显示创建交易表单
};

window.viewTransaction = async (id) => {
    // TODO: 显示交易详情
};

window.approveTransaction = async (id) => {
    if (confirm('确定要通过这笔交易吗？')) {
        try {
            await walletModule.updateTransactionStatus(id, 'approved');
            await loadWalletModule();
    } catch (error) {
            console.error('通过交易失败:', error);
        }
    }
};

window.rejectTransaction = async (id) => {
    if (confirm('确定要拒绝这笔交易吗？')) {
        try {
            await walletModule.updateTransactionStatus(id, 'rejected');
            await loadWalletModule();
    } catch (error) {
            console.error('拒绝交易失败:', error);
        }
    }
};

window.editNotification = async (id) => {
    try {
        const notification = await notificationModule.getNotificationDetail(id);
        // TODO: 显示编辑表单
    } catch (error) {
        console.error('获取通知详情失败:', error);
    }
};

window.sendNotification = async (id) => {
    if (confirm('确定要发送这条通知吗？')) {
        try {
            await notificationModule.sendNotification(id);
    } catch (error) {
            console.error('发送通知失败:', error);
        }
    }
};

window.deleteNotification = async (id) => {
    if (confirm('确定要删除这条通知吗？')) {
        try {
            await notificationModule.deleteNotification(id);
            await loadNotificationModule();
    } catch (error) {
            console.error('删除通知失败:', error);
        }
    }
};

// 播放通知声音
function playNotificationSound() {
    const audio = new Audio('/sounds/notification.mp3');
    audio.play().catch(error => console.log('无法播放通知声音:', error));
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);