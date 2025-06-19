/**
 * 认证相关函数
 */
import { showSuccess, showError, showLoading, hideLoading } from '../utils/ui.js';
import { getUserIdFromToken } from '../utils/common.js';

// 登录函数
export async function login(username, password) {
    try {
        showLoading('登录中...');
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || '登录失败');
        }

        // 检查用户角色
        if (data.user.role !== 'admin') {
            throw new Error('非管理员用户，无权访问后台系统');
        }

        // 保存管理员信息到localStorage
        localStorage.setItem('token', data.token);
        localStorage.setItem('userInfo', JSON.stringify(data.user));
        localStorage.setItem('userRole', data.user.role);
        localStorage.setItem('isAdmin', 'true');
        
        showSuccess('登录成功');
        
        // 跳转到管理员后台
        window.location.href = '/admin/';
        
        return data;
    } catch (error) {
        showError(error.message);
        throw error;
    } finally {
        hideLoading();
    }
}

// 登出函数
export function logout() {
    // 清除所有登录信息
    localStorage.removeItem('token');
    localStorage.removeItem('userInfo');
    localStorage.removeItem('user');
    localStorage.removeItem('userRole');
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('adminToken');
    
    // 强制跳转到登录页面
    window.location.href = '/login.html';
}

// 检查是否已登录
export function checkAuth() {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');
    const isAdmin = localStorage.getItem('isAdmin');
    
    // 如果没有token或不是管理员，强制跳转到登录页面
    if (!token || !isAdmin || userRole !== 'admin') {
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
}

// 获取当前用户信息
export async function getCurrentUser() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未登录');
        }

        const response = await fetch('/api/auth/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || '获取用户信息失败');
        }

        return data;
    } catch (error) {
        showError(error.message);
        throw error;
    }
}

// 更新用户信息
export async function updateUserInfo(userData) {
    try {
        showLoading('更新中...');
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未登录');
        }

        const response = await fetch('/api/auth/update', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(userData)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || '更新失败');
        }

        showSuccess('更新成功');
        return data;
    } catch (error) {
        showError(error.message);
        throw error;
    } finally {
        hideLoading();
    }
}

// 修改密码
export async function changePassword(oldPassword, newPassword) {
    try {
        showLoading('修改中...');
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未登录');
        }

        const response = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ oldPassword, newPassword })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || '修改失败');
        }

        showSuccess('密码修改成功');
        return data;
    } catch (error) {
        showError(error.message);
        throw error;
    } finally {
        hideLoading();
    }
} 