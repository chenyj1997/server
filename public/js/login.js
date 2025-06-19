// 登录页面脚本
document.addEventListener('DOMContentLoaded', function() {
    // 查找登录表单
    const loginForm = document.getElementById('login-form');
    if (!loginForm) {
        return;
    }
    
    // 修改页面标题和提示
    document.title = '永鑫资本系统 - 管理员登录';
    const cardHeader = document.querySelector('.card-header h5');
    if (cardHeader) {
        cardHeader.textContent = '管理员登录';
    }
    
    loginForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        // 查找用户名和密码输入框
        const usernameInput = document.getElementById('login-username');
        const passwordInput = document.getElementById('login-password');
        
        if (!usernameInput || !passwordInput) {
            showResult('页面元素错误，请刷新页面后重试', 'danger');
            return;
        }
        
        const username = usernameInput.value;
        const password = passwordInput.value;
        
        try {
            // 显示加载状态
            if (window.ui && window.ui.showLoading) {
                window.ui.showLoading('登录中...');
            } else {
                const loadingEl = document.getElementById('loading');
                if (loadingEl) loadingEl.style.display = 'flex';
            }
            
            // 发送登录请求
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username,
                    password
                })
            });
            
            const data = await response.json();
            
            if (response.status === 403 && data.code === 'DEVICE_CONFLICT') {
                // 显示设备冲突确认对话框
                const confirmLogout = confirm(
                    `您的账号已在其他设备登录（最后登录时间：${new Date(data.currentDevice.lastLoginAt).toLocaleString()}）。\n` +
                    '是否强制登出其他设备并继续登录？'
                );

                if (confirmLogout) {
                    // 重新发送登录请求，带上forceLogout参数
                    const retryResponse = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ username, password, forceLogout: true })
                    });

                    const retryData = await retryResponse.json();
                    if (retryResponse.ok) {
                        handleLoginSuccess(retryData);
                    } else {
                        showResult(retryData.message || '登录失败', 'danger');
                    }
                } else {
                    showResult('登录已取消', 'danger');
                }
                return;
            }
            
            if (response.ok) {
                handleLoginSuccess(data);
            } else {
                showResult(`登录失败: ${data.message || '未知错误'}`, 'danger');
            }
        } catch (error) {
            console.error('登录失败:', error);
            showResult('登录失败: ' + error.message, 'danger');
        } finally {
            // 隐藏加载状态
            if (window.ui && window.ui.hideLoading) {
                window.ui.hideLoading();
            } else {
                const loadingEl = document.getElementById('loading');
                if (loadingEl) loadingEl.style.display = 'none';
            }
        }
    });
});

// 显示结果消息
function showResult(message, type) {
    const resultDiv = document.getElementById('login-result');
    if (resultDiv) {
        resultDiv.className = `alert alert-${type}`;
        resultDiv.textContent = message;
        resultDiv.style.display = 'block';
    } else if (window.ui && window.ui.showSuccess && window.ui.showError) {
        if (type === 'success') {
            window.ui.showSuccess(message);
        } else {
            window.ui.showError(message);
        }
    }
}

// 处理登录成功
function handleLoginSuccess(data) {
    if (data.success && data.user && data.user.role === 'admin') {
        // 管理员登录成功
        showResult('登录成功，即将跳转到管理后台...', 'success');
        
        // 保存管理员信息
        localStorage.setItem('token', data.token);
        localStorage.setItem('userInfo', JSON.stringify(data.user));
        localStorage.setItem('userRole', 'admin');
        localStorage.setItem('isAdmin', 'true');
        
        // 延迟跳转，让用户看到成功消息
        setTimeout(() => {
            window.location.href = '/admin/';
        }, 1000);
    } else {
        // 非管理员用户
        showResult('非管理员用户，无权访问后台系统', 'danger');
    }
} 