/**
 * 通用工具函数
 */

// 格式化日期显示
function formatDate(dateString) {
    if (!dateString) return '未知时间';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return '无效日期';
        }
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch (error) {
        console.error('日期格式化出错:', error);
        return '日期错误';
    }
}

// HTML转义
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// 格式化图片URL
function formatImageUrl(url) {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.includes('uploads/')) {
        if (!url.startsWith('/')) url = '/' + url;
        return url;
    }
    if (url.startsWith('/')) {
        if (!url.includes('/api/') && url.startsWith('/uploads/')) {
            return url;
        }
        return url;
    }
    return '/' + url;
}

// 获取角色名称
function getRoleNames(roles) {
    if (!roles || roles.length === 0) return '普通用户';
    const roleMap = {
        'ROLE_ADMIN': '管理员',
        'ROLE_EDITOR': '编辑',
        'ROLE_USER': '用户',
        'ROLE_AGENT': '代理'
    };
    return roles.map(role => roleMap[role] || role).join(', ');
}

// 获取交易类型文本
function getTransactionType(type) {
    const typeMap = {
        'RECHARGE': '充值',
        'WITHDRAW': '提现',
        'PAYMENT': '支付',
        'REFUND': '退款',
        'OTHER': '其他'
    };
    return typeMap[type] || type;
}

// 获取交易状态文本
function getTransactionStatus(status) {
    const statusMap = {
        'COMPLETED': '已完成',
        'PENDING': '处理中',
        'FAILED': '失败',
        'CANCELLED': '已取消'
    };
    return statusMap[status] || status;
}

// 获取通知类型文本
function getNotificationTypeText(type) {
    const typeMap = {
        'SYSTEM': '系统通知',
        'ANNOUNCEMENT': '公告',
        'PROMOTION': '促销通知',
        'OTHER': '其他'
    };
    return typeMap[type] || type;
}

// 获取状态文本
function getStatusText(status) {
    switch (status) {
        case 'PUBLISHED': return '已发布';
        case 'DRAFT': return '草稿';
        case 'REVIEW': return '审核中';
        case 'REJECTED': return '已拒绝';
        default: return '未知状态';
    }
}

// 从令牌中获取用户ID
function getUserIdFromToken(token) {
    try {
        if (!token) return null;
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = JSON.parse(atob(parts[1]));
        return payload.user?.id || null;
    } catch (e) {
        console.error('从令牌中获取用户ID失败:', e);
        return null;
    }
}

// 导出到全局
window.common = {
    formatDate,
    escapeHtml,
    formatImageUrl,
    getRoleNames,
    getTransactionType,
    getTransactionStatus,
    getNotificationTypeText,
    getStatusText,
    getUserIdFromToken
}; 