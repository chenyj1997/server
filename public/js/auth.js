// 认证相关的工具函数

// 获取存储的令牌
const getToken = () => {
    return localStorage.getItem('token');
};

// 设置令牌
const setToken = (token) => {
    localStorage.setItem('token', token);
};

// 移除令牌
const removeToken = () => {
    localStorage.removeItem('token');
};

// 检查是否已登录
const isLoggedIn = () => {
    return !!getToken();
};

// 获取用户信息
const getUserInfo = () => {
    const userInfo = localStorage.getItem('userInfo');
    return userInfo ? JSON.parse(userInfo) : null;
};

// 设置用户信息
const setUserInfo = (userInfo) => {
    localStorage.setItem('userInfo', JSON.stringify(userInfo));
};

// 移除用户信息
const removeUserInfo = () => {
    localStorage.removeItem('userInfo');
};

// 登出
const logout = () => {
    removeToken();
    removeUserInfo();
    window.location.href = '/login.html';
};

// 添加认证头
const addAuthHeader = (headers = {}) => {
    const token = getToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
};

// 处理认证错误
const handleAuthError = (error) => {
    if (error.status === 401) {
        logout();
    }
    throw error;
};

// 导出工具函数
window.auth = {
    getToken,
    setToken,
    removeToken,
    isLoggedIn,
    getUserInfo,
    setUserInfo,
    removeUserInfo,
    logout,
    addAuthHeader,
    handleAuthError
}; 