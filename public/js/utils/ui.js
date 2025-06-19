/**
 * UI相关函数
 */

// 检查bootstrap是否可用
const checkBootstrap = () => {
    if (typeof bootstrap === 'undefined') {
        return false;
    }
    return true;
};

// 转义HTML特殊字符
const escapeHtml = (text) => {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

// 格式化日期
const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// 显示成功提示
const showSuccess = (message) => {
    const toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        return;
    }
    
    if (!checkBootstrap()) {
        return;
    }
    
    try {
        const toast = document.createElement('div');
        toast.className = 'toast align-items-center text-white bg-success border-0';
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        `;
        
        toastContainer.appendChild(toast);
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        
        // 自动移除
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    } catch (error) {
        console.error('显示Toast失败:', error);
    }
};

// 显示警告提示
const showWarning = (message) => {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-warning alert-dismissible fade show position-fixed';
    alertDiv.style.top = '20px';
    alertDiv.style.right = '20px';
    alertDiv.style.zIndex = '9999';
    alertDiv.style.minWidth = '300px';
    alertDiv.innerHTML = `
        <i class="fas fa-exclamation-triangle me-2"></i>${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    document.body.appendChild(alertDiv);
    setTimeout(() => {
        alertDiv.classList.add('fade-out');
        setTimeout(() => alertDiv.remove(), 500);
    }, 5000);
};

// 显示错误提示
const showError = (message) => {
    const toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        return;
    }
    
    if (!checkBootstrap()) {
        return;
    }
    
    try {
        const toast = document.createElement('div');
        toast.className = 'toast align-items-center text-white bg-danger border-0';
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    ❌ ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        `;
        
        toastContainer.appendChild(toast);
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        
        // 自动移除
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    } catch (error) {
        console.error('显示Toast失败:', error);
    }
};

// 显示加载中提示
const showLoading = (message) => {
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
};

// 隐藏加载中提示
const hideLoading = () => {
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
};

// 添加CSS样式
const addStyles = () => {
    const style = document.createElement('style');
    style.textContent = `
        .alert.position-fixed {
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transition: opacity 0.5s, transform 0.3s;
            transform: translateX(0);
        }
        .alert.fade-out {
            opacity: 0;
            transform: translateX(50px);
        }
    `;
    document.head.appendChild(style);
};

// 导出工具函数
window.ui = {
    showSuccess,
    showError,
    showWarning,
    showLoading,
    hideLoading,
    escapeHtml,
    formatDate,
    addStyles
}; 