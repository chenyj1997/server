/**
 * 通知管理相关函数
 */
import { showSuccess, showError, showLoading, hideLoading } from '../utils/ui.js';
import { formatDate, escapeHtml, getNotificationTypeText } from '../utils/common.js';

// 获取通知列表
export async function getNotificationList(page = 1, limit = 10) {
    try {
        showLoading('加载中...');
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未登录');
        }

        const response = await fetch(`/api/notifications/list?page=${page}&limit=${limit}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || '获取列表失败');
        }

        return data;
    } catch (error) {
        showError(error.message);
        throw error;
    } finally {
        hideLoading();
    }
}

// 创建通知
export async function createNotification(notificationData) {
    try {
        showLoading('创建中...');
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未登录');
        }

        const response = await fetch('/api/notifications/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(notificationData)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || '创建失败');
        }

        showSuccess('创建成功');
        return data;
    } catch (error) {
        showError(error.message);
        throw error;
    } finally {
        hideLoading();
    }
}

// 更新通知
export async function updateNotification(id, notificationData) {
    try {
        showLoading('更新中...');
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未登录');
        }

        const response = await fetch(`/api/notifications/update/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(notificationData)
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

// 删除通知
export async function deleteNotification(id) {
    try {
        showLoading('删除中...');
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未登录');
        }

        const response = await fetch(`/api/notifications/delete/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || '删除失败');
        }

        showSuccess('删除成功');
        return data;
    } catch (error) {
        showError(error.message);
        throw error;
    } finally {
        hideLoading();
    }
}

// 获取通知详情
export async function getNotificationDetail(id) {
    try {
        showLoading('加载中...');
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未登录');
        }

        const response = await fetch(`/api/notifications/detail/${id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || '获取详情失败');
        }

        return data;
    } catch (error) {
        showError(error.message);
        throw error;
    } finally {
        hideLoading();
    }
}

// 发送通知
export async function sendNotification(id) {
    try {
        showLoading('发送中...');
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未登录');
        }

        const response = await fetch(`/api/notifications/send/${id}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || '发送失败');
        }

        showSuccess('发送成功');
        return data;
    } catch (error) {
        showError(error.message);
        throw error;
    } finally {
        hideLoading();
    }
}

// 渲染通知列表
export function renderNotificationList(notificationList) {
    const tbody = document.querySelector('#notificationTable tbody');
    if (!tbody) return;

    tbody.innerHTML = notificationList.map(notification => `
        <tr>
            <td>${escapeHtml(notification.title)}</td>
            <td>${escapeHtml(notification.content)}</td>
            <td>${notification.type === 'system' ? '系统' : '用户'}</td>
            <td>${notification.status === 'read' ? '已读' : '未读'}</td>
            <td>${formatDate(notification.createdAt)}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editNotification('${notification._id}')">
                    <i class="bi bi-pencil"></i> 编辑
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteNotification('${notification._id}')">
                    <i class="bi bi-trash"></i> 删除
                </button>
            </td>
        </tr>
    `).join('');
}

// 初始化通知管理页面
export async function initNotificationPage() {
    console.log('初始化通知管理页面...');
    try {
        // 加载通知列表
        const notificationData = await getNotificationList();
        renderNotificationList(notificationData.items);

        // 绑定分页事件
        const pagination = document.getElementById('notifications-pagination');
        if (pagination) {
            renderPagination(pagination, notificationData.total, notificationData.page, notificationData.limit);
        }

        // 绑定搜索和筛选事件
        const searchInput = document.getElementById('notification-search');
        if (searchInput) {
            searchInput.addEventListener('input', debounce(async (e) => {
                const searchTerm = e.target.value;
                try {
                    const notificationData = await getNotificationList(1, 10, { search: searchTerm });
                    renderNotificationList(notificationData.items);
                    renderPagination(pagination, notificationData.total, notificationData.page, notificationData.limit);
                } catch (error) {
                    console.error('搜索通知失败:', error);
                }
            }, 300));
        }

        // 绑定新建通知按钮
        const newNotificationBtn = document.getElementById('btn-new-notification');
        if (newNotificationBtn) {
            newNotificationBtn.addEventListener('click', () => {
                const modal = new bootstrap.Modal(document.getElementById('notification-modal'));
                modal.show();
            });
        }

        // 绑定通知表单提交事件
        const notificationForm = document.getElementById('notification-form');
        if (notificationForm) {
            notificationForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(notificationForm);
                const notificationData = {
                    title: formData.get('title'),
                    content: formData.get('content'),
                    type: formData.get('type'),
                    isActive: formData.get('isActive') === 'on'
                };
                try {
                    await createNotification(notificationData);
                    // 重新加载通知列表
                    const newNotificationData = await getNotificationList();
                    renderNotificationList(newNotificationData.items);
                    renderPagination(pagination, newNotificationData.total, newNotificationData.page, newNotificationData.limit);
                    // 关闭模态框
                    const modal = bootstrap.Modal.getInstance(document.getElementById('notification-modal'));
                    if (modal) modal.hide();
                } catch (error) {
                    console.error('创建通知失败:', error);
                }
            });
        }

        console.log('通知管理页面初始化完成');
    } catch (error) {
        console.error('初始化通知管理页面失败:', error);
        showError('加载通知列表失败: ' + error.message);
    }
}

// 渲染分页
function renderPagination(element, total, currentPage, limit) {
    const totalPages = Math.ceil(total / limit);
    let html = '';
    
    // 上一页
    html += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage - 1}">上一页</a>
        </li>
    `;
    
    // 页码
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            html += `
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>
            `;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += `
                <li class="page-item disabled">
                    <span class="page-link">...</span>
                </li>
            `;
        }
    }
    
    // 下一页
    html += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage + 1}">下一页</a>
        </li>
    `;
    
    element.innerHTML = html;
    
    // 绑定分页点击事件
    element.querySelectorAll('.page-link').forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const page = parseInt(e.target.dataset.page);
            if (!isNaN(page)) {
                try {
                    const notificationData = await getNotificationList(page, limit);
                    renderNotificationList(notificationData.items);
                    renderPagination(element, notificationData.total, page, limit);
                } catch (error) {
                    console.error('加载通知列表失败:', error);
                    showError('加载通知列表失败: ' + error.message);
                }
            }
        });
    });
}

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
} 