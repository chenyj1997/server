/**
 * 用户模块主文件
 * 整合所有用户相关功能模块
 */
import * as Profile from './profile.js';
import * as Wallet from './wallet.js';
import * as Notification from './notification.js';
import { showError } from '../utils/ui.js';
import * as UserChat from './chat.js'; // 引入用户端聊天模块

// 页面路由映射
const routes = {
    'profile': loadProfilePage,
    'wallet': loadWalletPage,
    'notifications': loadNotificationsPage
};

// 初始化页面
export async function init() {
    try {
        // 检查登录状态
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/login.html';
            return;
        }

        // 绑定导航事件
        bindNavigationEvents();
        
        // 加载默认页面
        const defaultRoute = window.location.hash.slice(1) || 'profile';
        await loadPage(defaultRoute);

        // 初始化用户端聊天模块
        UserChat.initUserChat();

    } catch (error) {
        showError('页面初始化失败：' + error.message);
    }
}

// 绑定导航事件
function bindNavigationEvents() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const href = e.target.getAttribute('href');
            // 检查 href 是否存在且不是 null
            if (href) {
                const route = href.slice(1);
                await loadPage(route);
            }
        });
    });

    // 监听 hash 变化
    window.addEventListener('hashchange', async () => {
        const route = window.location.hash.slice(1);
        await loadPage(route);
    });
}

// 加载页面
async function loadPage(route) {
    try {
        // 更新导航状态
        updateNavigation(route);
        
        // 加载对应页面内容
        if (routes[route]) {
            await routes[route]();
        } else {
            throw new Error('未知的页面路由');
        }
    } catch (error) {
        showError('加载页面失败：' + error.message);
    }
}

// 更新导航状态
function updateNavigation(activeRoute) {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        // 检查 href 是否存在且不是 null
        if (href) {
            const route = href.slice(1);
            if (route === activeRoute) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        }
    });
}

// 加载个人资料页面
async function loadProfilePage() {
    try {
        const profileData = await Profile.loadUserProfile();
        Profile.renderProfileForm(profileData);
        Profile.renderPasswordForm();
    } catch (error) {
        showError('加载个人资料失败：' + error.message);
    }
}

// 加载钱包页面
async function loadWalletPage() {
    try {
        const walletData = await Wallet.getWalletInfo();
        Wallet.renderWalletInfo(walletData);
        
        const transactions = await Wallet.getTransactionList();
        Wallet.renderTransactionList(transactions);
        
        // 渲染模态框
        Wallet.renderRechargeModal();
        Wallet.renderWithdrawModal();
    } catch (error) {
        showError('加载钱包信息失败：' + error.message);
    }
}

// 加载通知页面
async function loadNotificationsPage() {
    try {
        const notifications = await Notification.getNotificationList();
        Notification.renderNotificationList(notifications);
        
        // 更新未读通知数量
        const unreadCount = notifications.filter(n => !n.isRead).length;
        Notification.updateUnreadCount(unreadCount);
    } catch (error) {
        showError('加载通知列表失败：' + error.message);
    }
}

// 导出全局函数
window.handleRecharge = async () => {
    const amount = document.getElementById('rechargeAmount').value;
    if (!amount || amount <= 0) {
        showError('请输入有效的充值金额');
        return;
    }
    
    try {
        await Wallet.createRecharge(parseFloat(amount));
        const modal = bootstrap.Modal.getInstance(document.getElementById('rechargeModal'));
        modal.hide();
        await loadWalletPage();
    } catch (error) {
        showError('充值失败：' + error.message);
    }
};

window.handleWithdraw = async () => {
    const amount = document.getElementById('withdrawAmount').value;
    if (!amount || amount <= 0) {
        showError('请输入有效的提现金额');
        return;
    }
    
    try {
        await Wallet.createWithdraw(parseFloat(amount));
        const modal = bootstrap.Modal.getInstance(document.getElementById('withdrawModal'));
        modal.hide();
        await loadWalletPage();
    } catch (error) {
        showError('提现失败：' + error.message);
    }
};

window.markAsRead = async (notificationId) => {
    try {
        await Notification.markNotificationAsRead(notificationId);
        await loadNotificationsPage();
    } catch (error) {
        showError('标记已读失败：' + error.message);
    }
};

window.deleteNotification = async (notificationId) => {
    try {
        await Notification.deleteNotification(notificationId);
        await loadNotificationsPage();
    } catch (error) {
        showError('删除通知失败：' + error.message);
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init); 