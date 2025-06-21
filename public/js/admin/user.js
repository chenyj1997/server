/**
 * 用户管理相关函数
 */
import { showSuccess, showError, showLoading, hideLoading } from '../utils/ui.js';
import { formatDate, escapeHtml, getRoleNames } from '../utils/common.js';

// 获取用户列表
export async function getUserList(page = 1, limit = 10) {
    try {
        showLoading('加载中...');
        const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
        if (!token) {
            throw new Error('未登录');
        }

        // 使用正确的管理员用户列表API
        const response = await fetch(`/api/admin/users`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || '获取列表失败');
        }

        // 为了兼容代码，将data转换为原期望的格式
        return {
            total: data.data ? data.data.length : 0,
            list: data.data || [],
            page: page,
            limit: limit
        };
    } catch (error) {
        showError(error.message);
        throw error;
    } finally {
        hideLoading();
    }
}

// 创建用户
export async function createUser(userData) {
    try {
        showLoading('创建中...');
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未登录');
        }

        const response = await fetch('/api/users/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(userData)
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

// 更新用户
export async function updateUser(id, userData) {
    try {
        showLoading('更新中...');
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未登录');
        }

        const response = await fetch(`/api/users/update/${id}`, {
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

// 删除用户
export async function deleteUser(id) {
    try {
        showLoading('删除中...');
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未登录');
        }

        const response = await fetch(`/api/users/delete/${id}`, {
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

// 获取用户详情
export async function getUserDetail(id) {
    try {
        showLoading('加载中...');
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未登录');
        }

        const response = await fetch(`/api/users/detail/${id}`, {
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

// 重置用户密码
export async function resetUserPassword(id) {
    try {
        showLoading('重置中...');
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未登录');
        }

        const response = await fetch(`/api/users/reset-password/${id}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || '重置失败');
        }

        showSuccess('密码重置成功');
        return data;
    } catch (error) {
        showError(error.message);
        throw error;
    } finally {
        hideLoading();
    }
}

// 更新用户状态
export async function updateUserStatus(id, newStatus) {
    try {
        showLoading('更新状态中...');
        const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
        if (!token) {
            throw new Error('未登录');
        }

        const response = await fetch(`/api/users/status/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: newStatus })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || '更新状态失败');
        }

        showSuccess('用户状态已更新');
        return data;
    } catch (error) {
        showError(error.message);
        throw error;
    } finally {
        hideLoading();
    }
}

// 渲染用户列表
export function renderUserList(userList) {
    const tbody = document.querySelector('#users-list');
    if (!tbody) {
        console.error('未找到用户列表 tbody 元素 (#users-list)');
        return;
    }

    // 首先更新表头
    const thead = document.querySelector('#users-table thead tr');
    if (thead) {
        thead.innerHTML = `
            <th style="width: 10%">用户ID</th>
            <th style="width: 15%">用户名</th>
            <th style="width: 15%">角色</th>
            <th style="width: 15%">余额</th>
            <th style="width: 15%">状态</th>
            <th style="width: 30%">操作</th>
        `;
    }

    // 更新表格内容
    tbody.innerHTML = userList.map(user => {
        const statusClass = user.status === 'active' ? 'text-success' : 'text-danger';
        const statusText = user.status === 'active' ? '正常' : '禁用';
        const displayId = user.inviteCode || (user._id ? user._id.substring(0, 8) : '未知ID');
        
        return `
        <tr data-user-id="${user._id}">
            <td>${displayId}</td>
            <td>${escapeHtml(user.username)}</td>
            <td>${getRoleNames(user.role)}</td>
            <td>¥${user.balance || 0}</td>
            <td>
                <a href="#" class="status-toggle ${statusClass}" data-user-id="${user._id}" data-current-status="${user.status}">
                    ${statusText}
                </a>
            </td>
            <td class="text-center">
                <div class="btn-group" role="group">
                    <button class="btn btn-sm btn-info btn-view-details">
                        <i class="bi bi-info-circle"></i> 详情
                    </button>
                    <button class="btn btn-sm btn-primary btn-edit-user">
                        <i class="bi bi-pencil"></i> 编辑
                    </button>
                    <button class="btn btn-sm btn-danger btn-delete-user">
                        <i class="bi bi-trash"></i> 删除
                    </button>
                    <button class="btn btn-sm btn-warning btn-reset-password">
                        <i class="bi bi-key"></i> 重置密码
                    </button>
                </div>
            </td>
        </tr>
    `}).join('');
    
    // 为状态切换添加点击事件
    const statusToggles = document.querySelectorAll('.status-toggle');
    statusToggles.forEach(toggle => {
        toggle.addEventListener('click', async (e) => {
            e.preventDefault();
            const userId = toggle.dataset.userId;
            const currentStatus = toggle.dataset.currentStatus;
            const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
            
            if (confirm(`确定要将此用户状态从"${currentStatus === 'active' ? '正常' : '禁用'}"改为"${newStatus === 'active' ? '正常' : '禁用'}"吗？`)) {
                try {
                    await updateUserStatus(userId, newStatus);
                    // 更新用户列表
                    const userData = await getUserList();
                    renderUserList(userData.list);
                } catch (error) {
                    console.error('更新用户状态失败:', error);
                    showError('更新用户状态失败: ' + error.message);
                }
            }
        });
    });
}

// 显示用户详细信息
function showUserDetails(user) {
    // 创建模态框内容
    const modalContent = `
        <div class="modal fade" id="userDetailsModal" tabindex="-1" aria-labelledby="userDetailsModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="userDetailsModalLabel">用户详细信息</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row mb-3">
                            <div class="col-md-6">
                                <p><strong>用户ID：</strong> ${user.inviteCode || (user._id ? user._id.substring(0, 8) : '未知ID')}</p>
                                <p><strong>用户名：</strong> ${escapeHtml(user.username)}</p>
                                <p><strong>角色：</strong> ${getRoleNames(user.role)}</p>
                                <p><strong>余额：</strong> ¥${user.balance || 0}</p>
                            </div>
                            <div class="col-md-6">
                                <p><strong>邮箱：</strong> ${escapeHtml(user.email || '未设置')}</p>
                                <p><strong>手机号：</strong> ${escapeHtml(user.phone || '未设置')}</p>
                                <p><strong>状态：</strong> <span class="${user.status === 'active' ? 'text-success' : 'text-danger'}">${user.status === 'active' ? '正常' : '禁用'}</span></p>
                                <p><strong>创建时间：</strong> ${formatDate(user.createdAt)}</p>
                            </div>
                        </div>
                        
                        <hr>
                        
                        <div class="row">
                            <div class="col-12">
                                <h6>账户信息</h6>
                                <table class="table table-striped table-bordered">
                                    <tr>
                                        <td style="width: 30%"><strong>MongoDB ID：</strong></td>
                                        <td>${escapeHtml(user._id)}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>最后登录时间：</strong></td>
                                        <td>${user.lastLoginAt ? formatDate(user.lastLoginAt) : '从未登录'}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>推荐码：</strong></td>
                                        <td>${user.referrerCode || '未设置'}</td>
                                    </tr>
                                </table>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 移除已存在的模态框（如果有）
    const existingModal = document.getElementById('userDetailsModal');
    if (existingModal) {
        existingModal.remove();
    }

    // 添加新的模态框到页面
    document.body.insertAdjacentHTML('beforeend', modalContent);

    // 显示模态框
    const modal = new bootstrap.Modal(document.getElementById('userDetailsModal'));
    modal.show();
}

// 导出用户列表为 CSV
// 这个函数将在前端直接生成并下载 CSV 文件
async function exportUsers() {
    console.log('DEBUG: 触发导出用户功能...');
    try {
        showLoading('导出用户中...');
        // 获取所有用户数据（假设一个足够大的limit来获取所有用户）
        const allUserData = await getUserList(1, 9999); // 注意：如果用户数量巨大，前端一次性加载可能导致性能问题

        if (!allUserData || !allUserData.items || allUserData.items.length === 0) {
            showWarning('没有用户数据可导出');
            return;
        }

        const users = allUserData.items;

        // 定义 CSV 头部
        const headers = ['用户名', '邮箱', '电话', '角色', '余额', '状态', '创建时间'].join(',');
        const csvRows = [headers];

        // 格式化用户数据为 CSV 行
        users.forEach(user => {
            const row = [
                `"${escapeHtml(user.username || '')}"`, // 确保包含特殊字符的字段用双引号括起来
                `"${escapeHtml(user.email || '')}"`, // 确保包含特殊字符的字段用双引号括起来
                `"${escapeHtml(user.phone || '')}"`, // 确保包含特殊字符的字段用双引号括起来
                `"${escapeHtml(getRoleNames(user.role))}"`, // 确保包含特殊字符的字段用双引号括起来
                user.balance || 0, // 余额
                user.status === 'active' ? '正常' : '禁用', // 状态
                formatDate(user.createdAt) // 创建时间
            ].join(',');
            csvRows.push(row);
        });

        const csvString = csvRows.join('\n');

        // 创建 Blob 对象
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });

        // 创建下载链接并触发下载
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'users_export_' + new Date().toISOString().slice(0, 10) + '.csv'; // 文件名，例如 users_export_2023-10-27.csv
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showSuccess('用户数据导出成功');
        console.log('DEBUG: 用户数据导出完成');

    } catch (error) {
        console.error('导出用户失败:', error); // 添加错误日志
        showError('导出用户失败: ' + error.message);
    } finally {
        hideLoading();
    }
}

// TODO: 考虑优化：如果用户数量巨大，前端一次性加载可能导致性能问题。
// 更好的方法是后端提供一个分页导出接口或生成文件后提供下载链接。

// 初始化用户管理页面
export async function initUserPage() {
    console.log('初始化用户管理页面...');
    try {
        // 加载用户列表
        const userData = await getUserList();
        renderUserList(userData.list);

        // 绑定分页事件
        const pagination = document.getElementById('users-pagination');
        if (pagination) {
            renderPagination(pagination, userData.total, userData.page, userData.limit);
        }

        // 绑定添加会员按钮点击事件
        const addUserBtn = document.getElementById('btn-add-user');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', () => {
                // 重置表单
                const addUserForm = document.getElementById('add-user-form');
                if(addUserForm) addUserForm.reset();

                const modalElement = document.getElementById('add-user-modal');
                if (modalElement) {
                    const modal = new bootstrap.Modal(modalElement);
                    modal.show();
                }
            });
        }

        // 绑定导出用户按钮点击事件
        const exportUsersBtn = document.getElementById('btn-export-users');
        if (exportUsersBtn) {
            exportUsersBtn.addEventListener('click', exportUsers);
        }

        // 绑定搜索和筛选事件
        const searchInput = document.getElementById('user-search');
        if (searchInput) {
            searchInput.addEventListener('input', debounce(async (e) => {
                const searchTerm = e.target.value;
                try {
                    const userData = await getUserList(1, 10, { search: searchTerm });
                    renderUserList(userData.list);
                    renderPagination(pagination, userData.total, userData.page, userData.limit);
                } catch (error) {
                    console.error('搜索用户失败:', error);
                }
            }, 300));
        }

        const roleFilter = document.getElementById('user-role-filter');
        if (roleFilter) {
            roleFilter.addEventListener('change', async (e) => {
                const role = e.target.value;
                try {
                    const userData = await getUserList(1, 10, { role });
                    renderUserList(userData.list);
                    renderPagination(pagination, userData.total, userData.page, userData.limit);
                } catch (error) {
                    console.error('筛选用户失败:', error);
                }
            });
        }

        const statusFilter = document.getElementById('user-status-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', async (e) => {
                const status = e.target.value;
                try {
                    const userData = await getUserList(1, 10, { status });
                    renderUserList(userData.list);
                    renderPagination(pagination, userData.total, userData.page, userData.limit);
                } catch (error) {
                    console.error('筛选用户失败:', error);
                }
            });
        }

        // 绑定重置筛选按钮
        const resetFilterBtn = document.getElementById('btn-reset-filter');
        if (resetFilterBtn) {
            resetFilterBtn.addEventListener('click', async () => {
                if (searchInput) searchInput.value = '';
                if (roleFilter) roleFilter.value = '';
                if (statusFilter) statusFilter.value = '';
                try {
                    const userData = await getUserList();
                    renderUserList(userData.list);
                    renderPagination(pagination, userData.total, userData.page, userData.limit);
                } catch (error) {
                    console.error('重置筛选失败:', error);
                }
            });
        }

        // 绑定添加用户表单提交事件
        const addUserForm = document.getElementById('add-user-form');
        if (addUserForm) {
            console.log('找到 #add-user-form 表单，绑定提交事件...');
            addUserForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log('DEBUG: #add-user-form 表单提交事件被触发！');
                const formData = new FormData(addUserForm);
                const userData = {
                    username: formData.get('username'),
                    password: formData.get('password'),
                    email: formData.get('email'),
                    phone: formData.get('phone')
                };
                console.log('收集到用户数据:', userData);
                try {
                    showLoading('添加中...');
                    await createUser(userData);
                    showSuccess('会员添加成功');
                    // 重新加载用户列表
                    const newUserData = await getUserList();
                    renderUserList(newUserData.list);
                    renderPagination(pagination, newUserData.total, newUserData.page, newUserData.limit);
                    // 关闭模态框
                    const modal = bootstrap.Modal.getInstance(document.getElementById('add-user-modal'));
                    if (modal) modal.hide();
                } catch (error) {
                    console.error('创建用户失败:', error);
                    showError('添加会员失败: ' + error.message);
                } finally {
                    hideLoading();
                }
            });
        }

        // 绑定保存用户按钮点击事件 (手动触发表单提交)
        const saveUserBtn = document.getElementById('btn-save-user');
        console.log('尝试查找 #btn-save-user 按钮:', saveUserBtn);
        console.log('尝试查找 #add-user-form 表单进行绑定:', addUserForm);

        if (saveUserBtn && addUserForm) {
            console.log('找到 #btn-save-user 按钮和 #add-user-form 表单，绑定点击事件...');
             saveUserBtn.addEventListener('click', () => {
                 console.log('DEBUG: #btn-save-user 按钮被点击！触发表单提交...');
                 addUserForm.dispatchEvent(new Event('submit', { cancelable: true }));
             });
        } else {
            console.warn('未找到 #btn-save-user 按钮或 #add-user-form 表单，无法绑定保存事件。');
        }

        // 使用事件委托绑定用户列表操作按钮事件
        const usersListTbody = document.querySelector('#users-list');
        if (usersListTbody) {
            console.log('找到 #users-list tbody，绑定事件委托...'); // 添加日志
            usersListTbody.removeEventListener('click', handleUserActions);
            usersListTbody.addEventListener('click', handleUserActions);
        }

        console.log('用户管理页面初始化完成');
    } catch (error) {
        console.error('初始化用户管理页面失败:', error); // 添加错误日志
        showError('加载用户列表失败: ' + error.message);
    }
}

// 用户列表操作事件委托处理函数
async function handleUserActions(e) {
    const target = e.target.closest('button'); // 找到被点击的按钮
    if (!target) return; // 如果点击的不是按钮，则返回

    const tr = target.closest('tr'); // 找到最近的表格行
    if (!tr) return; // 如果没有找到表格行，则返回

    const userId = tr.dataset.userId; // 从表格行获取用户ID
    if (!userId) {
        console.warn('点击的操作按钮所在的行没有 data-user-id 属性。');
        return;
    }

    if (target.classList.contains('btn-view-details')) {
        console.log('查看用户详情按钮被点击...', userId); // 添加日志
        try {
            showLoading('加载中...');
            const userData = await getUserDetail(userId);
            showUserDetails(userData.user);
        } catch (error) {
            console.error('获取用户详情失败:', error);
            showError('获取用户详情失败: ' + error.message);
        } finally {
            hideLoading();
        }
    } else if (target.classList.contains('btn-edit-user')) {
        console.log('编辑用户按钮被点击...', userId); // 添加日志
        // TODO: 实现编辑用户逻辑
        showError('编辑功能待实现'); // 暂时显示提示
    } else if (target.classList.contains('btn-delete-user')) {
        console.log('删除用户按钮被点击...', userId); // 添加日志
        if (confirm('确定要删除这个用户吗？')) {
            try {
                showLoading('删除中...');
                await deleteUser(userId); // 调用删除用户函数
                showSuccess('用户删除成功');
                // 重新加载用户列表
                const newUserData = await getUserList();
                renderUserList(newUserData.list);
                renderPagination(document.getElementById('users-pagination'), newUserData.total, newUserData.page, newUserData.limit);
            } catch (error) {
                console.error('删除用户失败:', error); // 添加错误日志
                showError('删除用户失败: ' + error.message);
            } finally {
                hideLoading();
            }
        }
    } else if (target.classList.contains('btn-reset-password')) {
        console.log('重置密码按钮被点击...', userId); // 添加日志
        if (confirm('确定要重置这个用户的密码吗？')) {
             try {
                 showLoading('重置密码中...');
                 await resetUserPassword(userId); // 调用重置密码函数
                 showSuccess('密码重置成功');
                 // 重置密码后可能不需要重新加载列表，取决于业务需求
             } catch (error) {
                 console.error('重置密码失败:', error); // 添加错误日志
                 showError('重置密码失败: ' + error.message);
             } finally {
                 hideLoading();
             }
        }
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
                    const userData = await getUserList(page, limit);
                    renderUserList(userData.list);
                    renderPagination(element, userData.total, page, limit);
                } catch (error) {
                    console.error('加载用户列表失败:', error);
                    showError('加载用户列表失败: ' + error.message);
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
