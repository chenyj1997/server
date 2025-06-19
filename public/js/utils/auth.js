/**
 * 认证相关工具函数
 */

// 检查是否已登录
function isLoggedIn() {
    return !!localStorage.getItem('token');
}

// 获取当前用户信息
function getCurrentUser() {
    // 尝试从多个可能的存储键获取用户信息
    const userStr = localStorage.getItem('user') || localStorage.getItem('userInfo');
    
    if (!userStr) return null;
    
    try {
        return JSON.parse(userStr);
    } catch (e) {
        console.error('解析用户信息失败:', e);
        return null;
    }
}

// 保存用户信息
function saveUserInfo(user, token) {
    if (!user || !token) {
        console.error('保存用户信息失败：缺少用户或令牌');
        return;
    }
    
    try {
        console.log('保存用户信息:', user);
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('userInfo', JSON.stringify(user));
        localStorage.setItem('token', token);
        
        // 添加角色快速访问
        if (user.role) {
            localStorage.setItem('userRole', user.role);
        }
    } catch (e) {
        console.error('保存用户信息时出错:', e);
    }
}

// 清除用户信息
function clearUserInfo() {
    localStorage.removeItem('user');
    localStorage.removeItem('userInfo');
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('isAdmin');
}

// 检查是否是管理员
function isAdmin() {
    // 简化管理员检查逻辑
    const user = getCurrentUser();
    if (!user) return false;
    
    return user.role === 'admin';
}

// 检查是否是普通用户
function isUser() {
    const user = getCurrentUser();
    return user && user.role === 'user';
}

// 检查是否是VIP用户
const isVip = () => {
    const user = getCurrentUser();
    return user && user.role === 'vip';
};

// 简化的检查权限函数
const checkPermission = (requiredRole) => {
    const user = getCurrentUser();
    if (!user) return false;
    
    // 管理员拥有所有权限
    if (user.role === 'admin') return true;
    
    // 匹配角色
    return user.role === requiredRole;
};

// 检查并重定向
const checkAndRedirect = () => {
    if (!isLoggedIn()) {
        console.log('未登录，重定向到登录页');
        window.location.href = '/login.html';
        return false;
    }
    
    // 当前路径判断
    const path = window.location.pathname;
    const user = getCurrentUser();
    
    if (!user) {
        console.log('无法获取用户信息，重定向到登录页');
        clearUserInfo(); // 清除可能无效的令牌
        window.location.href = '/login.html';
        return false;
    }
    
    // 管理员页面检查
    if (path.startsWith('/admin')) {
        if (!isAdmin()) {
            console.log('非管理员访问管理页面，重定向到用户中心');
            window.location.href = '/user';
            return false;
        }
    }
    
    return true;
};

// 导出到全局
window.auth = {
    isLoggedIn,
    getCurrentUser,
    saveUserInfo,
    clearUserInfo,
    isAdmin,
    isUser,
    isVip,
    checkPermission,
    checkAndRedirect
}; 