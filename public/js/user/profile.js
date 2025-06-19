/**
 * 用户个人资料相关函数
 */
import { showSuccess, showError, showLoading, hideLoading } from '../utils/ui.js';

// 加载用户个人资料
export async function loadUserProfile() {
    try {
        showLoading('加载中...');
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未登录');
        }

        const response = await fetch('/api/users/profile', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || '获取个人资料失败');
        }

        return data;
    } catch (error) {
        showError(error.message);
        throw error;
    } finally {
        hideLoading();
    }
}

// 更新用户个人资料
export async function updateUserProfile(profileData) {
    try {
        showLoading('更新中...');
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未登录');
        }

        const response = await fetch('/api/users/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(profileData)
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

        const response = await fetch('/api/users/change-password', {
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

// 渲染个人资料表单
export function renderProfileForm(profile) {
    const form = document.getElementById('profile-form');
    if (!form) return;

    form.innerHTML = `
        <div class="mb-3">
            <label for="username" class="form-label">用户名</label>
            <input type="text" class="form-control" id="username" value="${profile.username}" readonly>
        </div>
        <div class="mb-3">
            <label for="email" class="form-label">邮箱</label>
            <input type="email" class="form-control" id="email" value="${profile.email}">
        </div>
        <div class="mb-3">
            <label for="phone" class="form-label">手机号</label>
            <input type="tel" class="form-control" id="phone" value="${profile.phone || ''}">
        </div>
        <button type="submit" class="btn btn-primary">保存修改</button>
    `;

    // 添加表单提交事件监听
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            const profileData = {
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value
            };
            await updateUserProfile(profileData);
        } catch (error) {
            console.error('更新个人资料失败:', error);
        }
    });
}

// 渲染修改密码表单
export function renderPasswordForm() {
    const form = document.getElementById('password-form');
    if (!form) return;

    form.innerHTML = `
        <div class="mb-3">
            <label for="oldPassword" class="form-label">当前密码</label>
            <input type="password" class="form-control" id="oldPassword" required>
        </div>
        <div class="mb-3">
            <label for="newPassword" class="form-label">新密码</label>
            <input type="password" class="form-control" id="newPassword" required>
        </div>
        <div class="mb-3">
            <label for="confirmPassword" class="form-label">确认新密码</label>
            <input type="password" class="form-control" id="confirmPassword" required>
        </div>
        <button type="submit" class="btn btn-primary">修改密码</button>
    `;

    // 添加表单提交事件监听
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const oldPassword = document.getElementById('oldPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword !== confirmPassword) {
            showError('两次输入的新密码不一致');
            return;
        }

        try {
            await changePassword(oldPassword, newPassword);
            form.reset();
        } catch (error) {
            console.error('修改密码失败:', error);
        }
    });
} 