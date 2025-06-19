/**
 * 用户通知相关函数
 */
import { showSuccess, showError, showLoading, hideLoading } from '../utils/ui.js';
import { formatDate, getNotificationTypeText } from '../utils/common.js';

// 获取通知列表
export async function getNotificationList(page = 1, limit = 10) {
    try {
        showLoading('加载中...');
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未登录');
        }

        const response = await fetch(`/api/user/notifications?page=${page}&limit=${limit}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || '获取通知列表失败');
        }

        return data;
    } catch (error) {
        showError(error.message);
        throw error;
    } finally {
        hideLoading();
    }
}

// 标记通知为已读
export async function markNotificationAsRead(notificationId) {
    try {
        showLoading('处理中...');
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未登录');
        }

        const response = await fetch(`/api/user/notifications/${notificationId}/read`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || '标记通知已读失败');
        }

        showSuccess('已标记为已读');
        return data;
    } catch (error) {
        showError(error.message);
        throw error;
    } finally {
        hideLoading();
    }
}

// 删除通知
export async function deleteNotification(notificationId) {
    try {
        showLoading('处理中...');
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未登录');
        }

        const response = await fetch(`/api/user/notifications/${notificationId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || '删除通知失败');
        }

        showSuccess('通知已删除');
        return data;
    } catch (error) {
        showError(error.message);
        throw error;
    } finally {
        hideLoading();
    }
}

// 渲染通知列表
export function renderNotificationList(notifications) {
    const container = document.getElementById('notification-list');
    if (!container) return;

    if (notifications.length === 0) {
        container.innerHTML = '<div class="text-center text-muted">暂无通知</div>';
        return;
    }

    container.innerHTML = notifications.map(notification => `
        <div class="notification-item ${notification.isRead ? 'read' : 'unread'}" data-id="${notification._id}">
            <div class="notification-header">
                <span class="notification-type">${getNotificationTypeText(notification.type)}</span>
                <span class="notification-time">${formatDate(notification.createdAt)}</span>
            </div>
            <div class="notification-content">
                ${notification.content}
            </div>
            <div class="notification-actions">
                ${!notification.isRead ? `
                    <button class="btn btn-sm btn-primary" onclick="markAsRead('${notification._id}')">
                        标记已读
                    </button>
                ` : ''}
                <button class="btn btn-sm btn-danger" onclick="deleteNotification('${notification._id}')">
                    删除
                </button>
            </div>
        </div>
    `).join('');
}

// 渲染通知详情
export function renderNotificationDetail(notification) {
    const modal = document.getElementById('notificationDetailModal');
    if (!modal) return;

    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">${getNotificationTypeText(notification.type)}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="notification-time mb-3">
                        ${formatDate(notification.createdAt)}
                    </div>
                    <div class="notification-content">
                        ${notification.content}
                    </div>
                </div>
                <div class="modal-footer">
                    ${!notification.isRead ? `
                        <button type="button" class="btn btn-primary" onclick="markAsRead('${notification._id}')">
                            标记已读
                        </button>
                    ` : ''}
                    <button type="button" class="btn btn-danger" onclick="deleteNotification('${notification._id}')">
                        删除
                    </button>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        关闭
                    </button>
                </div>
            </div>
        </div>
    `;
}

// 更新未读通知数量
export function updateUnreadCount(count) {
    const badge = document.getElementById('unread-notification-badge');
    if (!badge) return;

    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline';
    } else {
        badge.style.display = 'none';
    }
} 