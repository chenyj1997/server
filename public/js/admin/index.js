// admin 模块入口文件
// 集成和初始化各个 admin 功能模块

// 简化的管理员权限检查
const checkAdminAuth = () => {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');
    const isAdmin = localStorage.getItem('isAdmin');
    
    // 严格检查管理员权限
    if (!token || !isAdmin || userRole !== 'admin') {
        console.log('权限验证失败，跳转到登录页面');
        // 清除所有登录信息
        localStorage.removeItem('token');
        localStorage.removeItem('userInfo');
        localStorage.removeItem('user');
        localStorage.removeItem('userRole');
        localStorage.removeItem('isAdmin');
        localStorage.removeItem('adminToken');
        
        // 强制跳转到登录页面
        window.location.href = '/login.html';
        return false;
    }
    return true;
};


// 页面路由映射
const routes = {
    '#info': async () => {
        if (window.infoManager) {
            await window.infoManager.initInfoPage();
        }
    },
    '#users': async () => {
        if (window.userManager) {
            await window.userManager.initUserPage();
        }
    },
    '#wallet': async () => {
        if (window.walletManager) {
            await window.walletManager.initWalletPage();
        }
    },
    '#notification': async () => {
        if (window.notificationManager) {
            await window.notificationManager.initNotificationPage();
        }
    },
    '#transactions': async () => {
        if (window.transactionManager) {
            await window.transactionManager.initTransactionPage();
        }
    },
    // 移除客服管理页面路由，改为模态框显示
    // '#customer-service': async () => {
    //     console.log('初始化客服管理页面...');
    //     const customerServiceSection = document.getElementById('customer-service-section');
    //     if (customerServiceSection && customerServiceSection.innerHTML.trim() === '') {
    //         try {
    //             const response = await fetch('/admin_customer_service.html');
    //             if (response.ok) {
    //                 const html = await response.text();
    //                 customerServiceSection.innerHTML = html;
    //                 console.log('客服管理页面内容加载成功');
    //             } else {
    //                 customerServiceSection.innerHTML = '<p>加载客服管理页面失败。</p>';
    //                 console.error('加载客服管理页面失败:', response.status);
    //             }
    //         } catch (error) {
    //             customerServiceSection.innerHTML = '<p>加载客服管理页面出错。</p>';
    //             console.error('加载客服管理页面出错:', error);
    //         }
    //     }
    // }
};

// 检查登录状态
const checkLoginStatus = () => {
    
    // 获取令牌和角色信息
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');
    const isAdmin = localStorage.getItem('isAdmin');
    
    
    // 如果没有token或不是管理员，强制跳转到登录页面
    if (!token || !isAdmin || userRole !== 'admin') {
        console.log('未登录或不是管理员，跳转到登录页面');
        // 清除所有登录信息
        localStorage.removeItem('token');
        localStorage.removeItem('userInfo');
        localStorage.removeItem('user');
        localStorage.removeItem('userRole');
        localStorage.removeItem('isAdmin');
        localStorage.removeItem('adminToken');
        
        // 强制跳转到登录页面
        window.location.href = '/login.html';
        return false;
    }
    
    // 获取用户信息
    let userInfo = {};
    const storedUserInfo = localStorage.getItem('userInfo') || localStorage.getItem('user');
    
    if (storedUserInfo) {
        try {
            userInfo = JSON.parse(storedUserInfo);
        } catch (error) {
            console.error('解析用户信息失败:', error);
        }
    }
    
    // 显示主界面
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        mainContent.style.display = 'block';
    } else {
        console.error('找不到主内容区域元素 #main-content');
    }
    
    // 显示用户信息
    const userInfoElement = document.getElementById('user-info');
    if (userInfoElement && userInfo.username) {
        userInfoElement.textContent = `${userInfo.username}${userInfo.role ? ' (' + userInfo.role + ')' : ''}`;
    }
    
    return true;
};

// 处理退出登录
const handleLogout = () => {
    // 清除登录信息
    localStorage.removeItem('token');
    localStorage.removeItem('userInfo');
    localStorage.removeItem('user');
    localStorage.removeItem('userRole');
    localStorage.removeItem('isAdmin');
    
    // 重定向到登录页面
    window.location.href = '/login.html';
};

// 显示指定页面
const showPage = (pageId) => {
    // 只在没有 ?reloaded=1 时才刷新，避免死循环
    const url = new URL(window.location.href);
    if ((pageId === 'users' || pageId === 'transactions') && !url.searchParams.get('reloaded')) {
        url.searchParams.set('reloaded', '1');
        window.location.replace(url.toString());
        return;
    }
    // 如果带了 reloaded 参数，切换到别的 tab 时自动去掉
    if (url.searchParams.get('reloaded') && !(pageId === 'users' || pageId === 'transactions')) {
        url.searchParams.delete('reloaded');
        window.history.replaceState({}, '', url.pathname + url.hash);
    }
    
    // 更新导航状态
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.substring(1) === pageId) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
    
    // 隐藏所有页面
    const sections = document.querySelectorAll('#main-content > div:not(#admin-customer-chat-modal)');
    sections.forEach(page => {
        page.style.display = 'none';
    });
    
    // 显示指定页面
    const page = document.querySelector(`#${pageId}-section`);
    if (page) {
        page.style.display = 'block';
        
        // 初始化页面
        const managerMap = {
            'info': window.infoManager,
            'users': window.userManager,
            'wallet': window.walletManager,
            'notification': window.notificationManager,
            'transactions': window.transactionManager,
            'system': window.systemManager
        };
        
        const manager = managerMap[pageId];
        if (manager && typeof manager[`init${pageId.charAt(0).toUpperCase() + pageId.slice(1)}Page`] === 'function') {
            manager[`init${pageId.charAt(0).toUpperCase() + pageId.slice(1)}Page`]();
        }
    } else {
        console.warn('找不到页面元素:', pageId);
    }
};

// 根据URL哈希值显示对应页面
const showPageByHash = () => {
    const hash = window.location.hash.substring(1) || 'info';
    showPage(hash);
};

// 绑定导航事件
const bindNavEvents = () => {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = link.getAttribute('href').substring(1);
            window.location.hash = pageId;
        });
    });
};

// 统一初始化函数
const initAdmin = async () => {
    // 检查登录状态和管理员权限
    if (!checkLoginStatus() || !checkAdminAuth()) {
        return;
    }

    // 显示主界面
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        mainContent.style.display = 'block';
    }

    // 绑定导航链接事件
    bindNavEvents();

    // 绑定退出按钮事件
    const logoutButton = document.getElementById('btn-logout');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    // 根据当前URL哈希显示页面
    showPageByHash();

    // 监听URL哈希变化事件
    window.addEventListener('hashchange', showPageByHash);

    // 绑定客服图标点击事件
    const customerServiceIcon = document.getElementById('customer-service-icon-container');
    if (customerServiceIcon) {
        customerServiceIcon.addEventListener('click', () => {
            if (window.showCustomerChatModal) {
                window.showCustomerChatModal();
            }
        });
    }

    // 初始化客服系统
    if (window.customerServiceManager && typeof window.customerServiceManager.initializeAdminChat === 'function') {
        window.customerServiceManager.initializeAdminChat();
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initAdmin);

// 导出到全局
window.adminManager = {
    checkLoginStatus,
    handleLogout,
    showPage,
    showPageByHash,
    bindNavEvents,
    initAdmin,
    checkAdminAuth
}; 

// 显示管理员客服对话模态框
async function showCustomerChatModal() { // Made async to await loadAdminConversations
    const modalElement = document.getElementById('admin-customer-chat-modal');
    if (!modalElement) {
        console.error('未找到管理员客服对话模态框元素 #admin-customer-chat-modal');
        const allModals = document.querySelectorAll('.modal');
        console.log('页面上找到的所有模态框元素:', allModals);
        return;
    }

    // Load conversations before showing the modal
    if (window.customerServiceManager && typeof window.customerServiceManager.loadAdminConversations === 'function') {
        await window.customerServiceManager.loadAdminConversations();
    } else {
        console.error('customerServiceManager.loadAdminConversations is not defined');
        // Still show the modal but log error, or handle error more gracefully
    }

    const modal = new bootstrap.Modal(modalElement);
    modal.show();
}

// 将 showCustomerChatModal 函数添加到 window 对象，使其可以在全局访问
window.showCustomerChatModal = showCustomerChatModal; 