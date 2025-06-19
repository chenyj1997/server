/**
 * 用户管理模块
 * 将用户管理相关函数整合到全局userManager对象
 */

// 创建全局用户管理对象
function createUserManager() {
    const userManager = {};
    
    userManager.currentPage = 1;
    userManager.pageSize = 10;
    userManager.currentTransactionUserId = null;
    userManager.currentTransactionPage = 1;
    userManager.userTransactionsModalInstance = null;
    userManager.TRANSACTION_PAGE_SIZE = 10;
    userManager.initialized = false; // 初始化标志
    userManager.cache = {
        data: null,
        timestamp: 0,
        expiry: 30000
    };

    userManager.getFilterParams = function() {
        const searchInput = document.getElementById('user-search');
        const roleFilter = document.getElementById('user-role-filter');
        const statusFilter = document.getElementById('user-status-filter');
        const filters = {};
        if (searchInput && searchInput.value) filters.search = searchInput.value.trim();
        if (roleFilter && roleFilter.value) filters.role = roleFilter.value;
        if (statusFilter && statusFilter.value) filters.status = statusFilter.value;
        return filters;
    };

    userManager.getUserList = async function(page = this.currentPage, limit = this.pageSize, filters = {}) {
        try {
            const now = Date.now();
            if (this.cache.data && now - this.cache.timestamp < this.cache.expiry && JSON.stringify(this.cache.filters) === JSON.stringify(filters)) {
                return this.cache.data;
            }
            if (window.ui) window.ui.showLoading('加载用户列表...');
            const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
            if (!token) throw new Error('未登录');
            const params = new URLSearchParams({ page, limit, ...filters });
            const response = await fetch(`/api/admin/users?${params.toString()}`, { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || '获取用户列表失败');
            const result = { total: data.total || 0, list: data.data || [], page: data.page || page, limit: data.limit || limit };
            this.cache.data = result;
            this.cache.timestamp = now;
            this.cache.filters = {...filters};
            return result;
        } catch (error) {
            if (window.ui) window.ui.showError('获取用户列表错误: ' + error.message);
            return { total: 0, list: [], page, limit };
        } finally {
            if (window.ui) window.ui.hideLoading();
        }
    };
    
    userManager.renderUserList = function(userData) {
        const tbody = document.querySelector('#users-list');
        if (!tbody) { console.error('#users-list tbody not found for rendering'); return; }
        tbody.innerHTML = ''; 
        const fragment = document.createDocumentFragment();
        const users = userData.list;
        if (!users || users.length === 0) {
            const tr = fragment.appendChild(document.createElement('tr'));
            const td = tr.appendChild(document.createElement('td'));
            td.colSpan = 6;
            td.className = 'text-center';
            td.textContent = '暂无用户数据';
        } else {
            users.forEach(user => {
                const tr = fragment.appendChild(document.createElement('tr'));
                tr.dataset.userId = user._id;
                const balance = (user.balance !== undefined && user.balance !== null && !isNaN(parseFloat(user.balance))) ? parseFloat(user.balance) : 0;
            tr.innerHTML = `
                    <td>${user.numericId || user._id.slice(-6) || 'N/A'}</td>
                <td>${user.username || '未命名用户'}</td>
                    <td><span class="user-role-editable" data-user-id="${user._id}" data-user-role="${user.role || 'user'}" style="cursor: pointer; text-decoration: underline;">${user.role || 'user'}</span></td>
                    <td><a href="javascript:void(0)" class="balance-link" data-user-id="${user._id}" data-user-name="${user.username || '未知用户'}">¥${balance.toFixed(2)}</a></td>
                    <td><span class="user-status-toggle" style="cursor: pointer; color: ${user.status === 'active' ? 'green' : 'red'};" data-user-id="${user._id}" data-current-status="${user.status}">${user.status === 'active' ? '正常' : '禁用'}</span></td>
                <td class="text-end">
                        <div class="btn-group btn-group-sm" role="group">
                            <button class="btn btn-outline-info btn-view-details" data-id="${user._id}" title="详情"><i class="bi bi-info-circle"></i></button>
                            <button class="btn btn-outline-primary btn-edit-user" data-id="${user._id}" title="编辑"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-outline-danger btn-delete-user" data-id="${user._id}" title="删除"><i class="bi bi-trash"></i></button>
                                        </div>
                                    </td>
                                `;
            });
        }
        tbody.appendChild(fragment);
        this.renderPagination(userData.total, userData.page, userData.limit);
    };

    userManager.loadUsers = async function() {
        const filters = this.getFilterParams();
        const userData = await this.getUserList(this.currentPage, this.pageSize, filters);
        this.renderUserList(userData);
    };

    userManager.renderPagination = function(totalItems, currentPage, itemsPerPage) {
        const paginationContainer = document.getElementById('users-pagination');
        if (!paginationContainer) { console.warn('#users-pagination container not found'); return; }
        paginationContainer.innerHTML = '';
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        if (totalPages <= 1) { paginationContainer.style.display = 'none'; return; }
        paginationContainer.style.display = 'flex';
        let paginationHtml = '<ul class="pagination pagination-sm justify-content-center">';
        paginationHtml += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${currentPage - 1}">上一页</a></li>`;
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, currentPage + 2);
        if (currentPage <= 3) endPage = Math.min(totalPages, 5);
        if (currentPage > totalPages - 3) startPage = Math.max(1, totalPages - 4);
        if (startPage > 1) {
            paginationHtml += '<li class="page-item"><a class="page-link" href="#" data-page="1">1</a></li>';
            if (startPage > 2) paginationHtml += '<li class="page-item disabled"><span class="page-link">...</span></li>';
        }
        for (let i = startPage; i <= endPage; i++) { 
            paginationHtml += `<li class="page-item ${i === currentPage ? 'active' : ''}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`; 
        }
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) paginationHtml += '<li class="page-item disabled"><span class="page-link">...</span></li>';
            paginationHtml += `<li class="page-item"><a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a></li>`;
        }
        paginationHtml += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${currentPage + 1}">下一页</a></li>`;
        paginationHtml += '</ul>';
        paginationContainer.innerHTML = paginationHtml;
    };

    userManager.updateUserRole = async function(userId, newRole) {
        try {
            if (window.ui) window.ui.showLoading('更新角色中...');
            const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
            if (!token) throw new Error('未登录');
            const response = await fetch(`/api/admin/users/${userId}/role`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ role: newRole })
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || '更新角色失败');
            if (window.ui) window.ui.showSuccess('用户角色已更新');
            this.loadUsers();
            return data;
        } catch (error) {
            if (window.ui) window.ui.showError('更新角色失败: ' + error.message);
            throw error;
        } finally {
            if (window.ui) window.ui.hideLoading();
        }
    };

    userManager.showEditUserRoleModal = function(userId, currentRole) {
        const modalElement = document.getElementById('edit-user-role-modal');
        const userIdInput = document.getElementById('edit-user-role-id');
        const newUserRoleSelect = document.getElementById('new-user-role');
        const saveButton = document.getElementById('btn-save-user-role');
        if (!modalElement || !userIdInput || !newUserRoleSelect || !saveButton) {
            if (window.ui) window.ui.showError('角色编辑模态框元素缺失'); return;
        }
        userIdInput.value = userId;
        newUserRoleSelect.value = currentRole;
        const modalInstance = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
        const saveHandler = async () => {
            const userIdToUpdate = userIdInput.value;
            const newRole = newUserRoleSelect.value;
            if (!userIdToUpdate || !newRole) { if (window.ui) window.ui.showError('请选择一个新角色'); return; }
            try {
                 await this.updateUserRole(userIdToUpdate, newRole);
                 modalInstance.hide();
            } catch (error) { /* Error handled in updateUserRole */ }
        };
        if (saveButton.currentSaveHandler) saveButton.removeEventListener('click', saveButton.currentSaveHandler);
        saveButton.addEventListener('click', saveHandler);
        saveButton.currentSaveHandler = saveHandler;
        modalInstance.show();
    };
    
    userManager.toggleUserStatus = async function(userId, currentStatus) {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        try {
            if (window.ui) window.ui.showLoading('更新状态中...');
            const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
            if (!token) throw new Error('未登录');
            const response = await fetch(`/api/admin/users/${userId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ status: newStatus })
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || '更新状态失败');
            if (window.ui) window.ui.showSuccess('用户状态已更新');
            this.loadUsers();
        } catch (e) {
            if (window.ui) window.ui.showError('更新状态失败: ' + e.message);
        } finally {
            if (window.ui) window.ui.hideLoading();
        }
    };

    userManager.confirmDeleteUser = async function(userId) {
        if (window.ui && window.ui.confirmDialog) {
            window.ui.confirmDialog('确定要删除此用户吗？此操作无法撤销。', () => this.deleteUser(userId));
        } else if (confirm('确定要删除此用户吗？此操作无法撤销。')) {
            this.deleteUser(userId);
        }
    };
    
    userManager.deleteUser = async function(userId) {
        try {
            if (window.ui) window.ui.showLoading('删除中...');
            const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
            if (!token) throw new Error('未登录，无法执行删除操作');
            const response = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }});
            if (response.status === 404) {
                if (window.ui) window.ui.showWarning('用户已不存在，列表将刷新');
                this.loadUsers(); return;
            }
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || `删除失败: ${response.status} ${response.statusText}`);
            if (window.ui) window.ui.showSuccess('用户已删除');
                this.loadUsers();
        } catch (e) {
            if (window.ui) window.ui.showError('删除用户失败: ' + e.message);
        } finally {
            if (window.ui) window.ui.hideLoading();
        }
    };

    // 新增：辅助函数获取用户详细信息
    userManager.getUserDetail = async function(userId) {
        if (window.ui && window.ui.showLoading) window.ui.showLoading('加载用户数据...');
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
            if (!token) throw new Error('未授权访问');

            const response = await fetch(`/api/users/detail/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || '获取用户详情失败');
            }
            return data.data;
        } catch (error) {
            const errorMessage = '获取用户详情出错: ' + (error.message || error);
            if (window.ui && window.ui.showError) window.ui.showError(errorMessage);
            else console.error(errorMessage);
            throw error;
        } finally {
            if (window.ui && window.ui.hideLoading) window.ui.hideLoading();
        }
    };

    // 修改：获取并显示用户邀请的用户列表
    userManager.fetchAndDisplayInvitedUsers = async function(userId) {
        const loadingEl = document.getElementById('detail-user-invited-users-loading');
        const emptyEl = document.getElementById('detail-user-invited-users-empty');
        const tableEl = document.querySelector('#detail-user-invited-users-container table');
        const tbodyEl = document.getElementById('detail-user-invited-users-table-body');

        if (!loadingEl || !emptyEl || !tableEl || !tbodyEl) {
            console.error('邀请用户列表显示的模态框元素未找到。');
            return;
        }

        loadingEl.style.display = 'block';
        tableEl.classList.add('d-none');
        emptyEl.style.display = 'none';
        tbodyEl.innerHTML = '';

        try {
            const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
            if (!token) throw new Error('未授权访问');

            // 调用新的API
            const response = await fetch(`/api/admin/users/${userId}/invited-users?limit=50&page=1`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || '获取邀请用户列表失败');
            }

            const invitedUsers = result.data; 
            if (invitedUsers && invitedUsers.length > 0) {
                invitedUsers.forEach(invitedUser => {
                    const row = tbodyEl.insertRow();
                    const fDate = window.utils && window.utils.formatDate ? window.utils.formatDate : (d) => new Date(d).toLocaleString();
                    const escHtml = window.utils && window.utils.escapeHtml ? window.utils.escapeHtml : (s) => s;
                    const statusText = invitedUser.status === 'active' ? '正常' : '禁用';
                    const statusClass = invitedUser.status === 'active' ? 'text-success' : 'text-danger';
                    // DEBUG: Log invited user data being used for the link

                    row.innerHTML = `
                        <td>${escHtml(invitedUser.numericId || invitedUser._id.slice(-6) || 'N/A')}</td>
                        <td><a href="#" class="view-invited-user-purchases" data-invited-user-id="${invitedUser._id}" data-invited-user-name="${escHtml(invitedUser.username)}">${escHtml(invitedUser.username)}</a></td>
                        <td>${fDate(invitedUser.createdAt)}</td>
                        <td><span class="${statusClass}">${statusText}</span></td>
                        <td>${escHtml(invitedUser.email || '-')}</td>
                        <td>${escHtml(invitedUser.phone || '-')}</td>
                    `;
                });
                tableEl.classList.remove('d-none');
            } else {
                emptyEl.style.display = 'block';
            }
        } catch (error) {
            const errorMessage = '加载邀请用户列表出错: ' + (error.message || error);
            if (window.ui && window.ui.showError) window.ui.showError(errorMessage);
            else console.error(errorMessage);
            emptyEl.textContent = '加载邀请用户列表失败。';
            emptyEl.style.display = 'block';
        } finally {
            loadingEl.style.display = 'none';
        }
    };
    
    // 获取并渲染受邀用户的特定交易记录 (例如：购买记录)
    userManager.fetchAndRenderInvitedUserPurchases = async function(invitedUserId) {
        // DEBUG: Log function call and arguments

        const loadingEl = document.getElementById('invited-user-purchases-loading'); 
        const emptyEl = document.getElementById('invited-user-purchases-empty');
        const tableEl = document.querySelector('#detail-invited-user-purchases-container table');
        const tbodyEl = document.getElementById('invited-user-purchases-table-body');

        if (!loadingEl || !emptyEl || !tableEl || !tbodyEl) {
            console.error('受邀用户购买记录的模态框元素未找到。');
            return;
        }

        loadingEl.textContent = '正在加载购买记录...'; 
        emptyEl.textContent = '该用户暂无购买记录。';   

        loadingEl.style.display = 'block';
        tableEl.classList.add('d-none');
        emptyEl.style.display = 'none';
        tbodyEl.innerHTML = '';

        try {
            const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
            if (!token) throw new Error('未授权访问');

            // Fetch ALL transactions
            const response = await fetch(`/api/admin/users/${invitedUserId}/transactions?limit=100&page=1`, { // Fetch more if needed, or implement pagination for filtered results
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || '获取交易记录失败以进行筛选');
            }

            let transactions = result.data || [];
            
            // **FILTERING STEP:** Keep only transactions where remark starts with "购买信息:"
            const purchaseTransactions = transactions.filter(tx => tx.remark && tx.remark.startsWith('购买信息:')); 


            if (purchaseTransactions && purchaseTransactions.length > 0) {
                purchaseTransactions.forEach(purchase => {
                    const row = tbodyEl.insertRow();
                    const fDate = window.utils && window.utils.formatDate ? window.utils.formatDate : (d) => new Date(d).toLocaleString();
                    const escHtml = window.utils && window.utils.escapeHtml ? window.utils.escapeHtml : (s) => s;
                    
                    // Extract content from remark, assuming format "购买信息: Actual Content"
                    let displayContent = purchase.remark;
                    if (purchase.remark.startsWith('购买信息:')) {
                        displayContent = purchase.remark.substring('购买信息:'.length).trim();
                    }
                    if (!displayContent) displayContent = '购买信息'; // Fallback if remark is just "购买信息:" or empty after substring

                    const amountDisplay = `¥${(Math.abs(purchase.amount) || 0).toFixed(2)}`;

                    row.innerHTML = `
                        <td>${fDate(purchase.createdAt)}</td>
                        <td>${escHtml(displayContent)}</td>
                        <td>${amountDisplay}</td>
                        <td>${escHtml(this.getStatusDisplay ? this.getStatusDisplay(purchase.status) : purchase.status)}</td>
                        <td>${escHtml(purchase.remark)}</td> <!-- Full remark in the last column -->
                    `;
                });
                tableEl.classList.remove('d-none');
            } else {
                emptyEl.style.display = 'block';
            }
        } catch (error) {
            const errorMessage = '加载购买记录出错: ' + (error.message || error);
            if (window.ui && window.ui.showError) window.ui.showError(errorMessage);
            else console.error(errorMessage);
            emptyEl.textContent = '加载购买记录失败。';
            emptyEl.style.display = 'block';
        } finally {
            loadingEl.style.display = 'none';
        }
    };

    // 新增：切换到受邀用户购买记录视图
    userManager.switchToPurchaseHistoryView = function(invitedUserId, invitedUserName) {
        document.getElementById('detail-user-invited-users-container').style.display = 'none';
        const purchasesContainer = document.getElementById('detail-invited-user-purchases-container');
        purchasesContainer.style.display = 'block';
        document.getElementById('invited-user-purchases-title').textContent = `${invitedUserName || '用户'} 的购买记录`;
        this.fetchAndRenderInvitedUserPurchases(invitedUserId); 
    };

    // 新增：切换回邀请用户列表视图
    userManager.switchToInvitedUsersView = function() {
        document.getElementById('detail-invited-user-purchases-container').style.display = 'none';
        document.getElementById('detail-user-invited-users-container').style.display = 'block';
    };
    
    userManager.showUserDetailsModal = async function(userId) {
        try {
            const user = await this.getUserDetail(userId);
            if (!user) return;

            const escHtml = window.utils && window.utils.escapeHtml ? window.utils.escapeHtml : (s) => s;
            const fDate = window.utils && window.utils.formatDate ? window.utils.formatDate : (d) => new Date(d).toLocaleString();
            const getRoleDisplayName = window.utils && window.utils.getRoleName ? window.utils.getRoleName : (r) => r;

            document.getElementById('detail-user-name').textContent = escHtml(user.username || '未知用户');
            document.getElementById('detail-user-id').textContent = escHtml(user.numericId || user._id || 'N/A');
            
            const roleBadge = document.getElementById('detail-user-role');
            roleBadge.textContent = escHtml(getRoleDisplayName(user.role || 'user'));
            roleBadge.className = 'badge p-2'; // Reset
             if (user.role === 'admin') roleBadge.classList.add('bg-danger');
             else if (user.role === 'vip') roleBadge.classList.add('bg-warning');
             else roleBadge.classList.add('bg-secondary');


            const statusBadge = document.getElementById('detail-user-status');
            statusBadge.textContent = user.status === 'active' ? '正常' : '禁用';
            statusBadge.className = `badge p-2 ${user.status === 'active' ? 'bg-success' : 'bg-danger'}`;

            document.getElementById('detail-user-email').textContent = escHtml(user.email || '-');
            document.getElementById('detail-user-phone').textContent = escHtml(user.phone || '-');
            document.getElementById('detail-user-balance').textContent = `¥${(user.balance || 0).toFixed(2)}`;
            document.getElementById('detail-user-created').textContent = user.createdAt ? fDate(user.createdAt) : '-';
            
            document.getElementById('detail-user-invite-code').textContent = escHtml(user.inviteCode || '-');
            document.getElementById('detail-user-referrer').textContent = user.referrer ? escHtml(user.referrer.username) : '无';
            document.getElementById('detail-user-last-login').textContent = user.lastLoginAt ? fDate(user.lastLoginAt) : '从未';
            document.getElementById('detail-user-updated-at').textContent = user.updatedAt ? fDate(user.updatedAt) : '-';
            document.getElementById('detail-user-payment-password-set').textContent = user.paymentPasswordStatus || '未设置';

            // 确保在显示模态框前，购买记录区域是隐藏的，邀请列表是显示的
            this.switchToInvitedUsersView();

            const modalElement = document.getElementById('user-detail-modal');
            if (modalElement) {
                const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
                
                // 移除旧的事件监听器以防重复绑定 (针对动态内容)
                const invitedUsersTableBody = document.getElementById('detail-user-invited-users-table-body');
                if (invitedUsersTableBody.clickHandler) {
                    invitedUsersTableBody.removeEventListener('click', invitedUsersTableBody.clickHandler);
                }
                const backButton = document.getElementById('btn-back-to-invited-list');
                if (backButton.clickHandler) {
                    backButton.removeEventListener('click', backButton.clickHandler);
                }

                modal.show();

                // 等待模态框显示并且邀请用户列表加载完毕
                await this.fetchAndDisplayInvitedUsers(userId);
                
                // 为邀请用户列表中的链接绑定事件
                // DEBUG: Log when event listener is being attached
                invitedUsersTableBody.clickHandler = (event) => {
                    // DEBUG: Log click event details
                    const targetLink = event.target.closest('a.view-invited-user-purchases');

                    if (targetLink) {
                        event.preventDefault();
                        const invitedId = targetLink.dataset.invitedUserId;
                        const invitedName = targetLink.dataset.invitedUserName;
                        // DEBUG: Log extracted data
                        this.switchToPurchaseHistoryView(invitedId, invitedName);
                    }
                };
                invitedUsersTableBody.addEventListener('click', invitedUsersTableBody.clickHandler);

                // 为返回按钮绑定事件
                backButton.clickHandler = () => {
                    this.switchToInvitedUsersView();
                };
                backButton.addEventListener('click', backButton.clickHandler);

            } else {
                const errorMsg = '#user-detail-modal 模态框未找到。';
                console.error(errorMsg);
                if(window.ui && window.ui.showError) window.ui.showError(errorMsg);
                return;
            }
        } catch (error) {
            const errorMsg = '显示用户详情时发生未知错误: ' + (error.message || error);
            console.error(errorMsg, error);
            if(window.ui && window.ui.showError) window.ui.showError(errorMsg);
        }
    };

    userManager.showEditUserModal = function(userId) {
        if(window.ui && window.ui.showToast) window.ui.showToast('编辑用户功能待实现: ' + userId, 'info'); else alert('编辑用户功能待实现: ' + userId);
    };

    userManager.bindUserEvents = function() {
        const userListTbody = document.querySelector('#users-list');
        if (!userListTbody) { console.error('#users-list (tbody) not found for attaching events.'); return; }
        if (userListTbody.eventListenerAttached) userListTbody.removeEventListener('click', userListTbody.clickHandler);
        userListTbody.clickHandler = (event) => {
            let actionTarget = event.target.closest('.balance-link, .btn-view-details, .btn-edit-user, .btn-delete-user, .user-role-editable, .user-status-toggle');
            if (!actionTarget) return;
            const userId = actionTarget.dataset.userId || actionTarget.dataset.id;
            if (!userId) { console.warn('No user ID found on actionable target.'); return; }

            if (actionTarget.classList.contains('balance-link')) {
                event.preventDefault();
                this.openUserTransactionsModal(userId, actionTarget.dataset.userName);
            } else if (actionTarget.classList.contains('btn-view-details')) {
                this.showUserDetailsModal(userId);
            } else if (actionTarget.classList.contains('btn-edit-user')) {
                this.showEditUserModal(userId);
            } else if (actionTarget.classList.contains('btn-delete-user')) {
                this.confirmDeleteUser(userId);
            } else if (actionTarget.classList.contains('user-role-editable')) {
                this.showEditUserRoleModal(userId, actionTarget.dataset.userRole);
            } else if (actionTarget.classList.contains('user-status-toggle')) {
                this.toggleUserStatus(userId, actionTarget.dataset.currentStatus);
            }
        };
        userListTbody.addEventListener('click', userListTbody.clickHandler);
        userListTbody.eventListenerAttached = true;
    };

    userManager.bindFilterAndPaginationEvents = function() {
        const searchInput = document.getElementById('user-search');
        const roleFilter = document.getElementById('user-role-filter');
        const statusFilter = document.getElementById('user-status-filter');
        const resetButton = document.getElementById('btn-reset-filter');
        const paginationContainer = document.getElementById('users-pagination');
        const manualSearchButton = document.getElementById('btn-manual-search');

        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', () => { clearTimeout(searchTimeout); searchTimeout = setTimeout(() => { this.currentPage = 1; this.loadUsers(); }, 500); });
        }
        if (manualSearchButton) manualSearchButton.addEventListener('click', () => { this.currentPage = 1; this.loadUsers(); });
        if (roleFilter) roleFilter.addEventListener('change', () => { this.currentPage = 1; this.loadUsers(); });
        if (statusFilter) statusFilter.addEventListener('change', () => { this.currentPage = 1; this.loadUsers(); });
        if (resetButton) {
            resetButton.addEventListener('click', () => { 
                if(searchInput) searchInput.value = ''; 
                if(roleFilter) roleFilter.value = ''; 
                if(statusFilter) statusFilter.value = ''; 
                this.currentPage = 1; 
                this.loadUsers(); 
            });
        }
        if (paginationContainer) {
            paginationContainer.addEventListener('click', (event) => { 
                const target = event.target.closest('a.page-link');
                if (target && target.dataset.page && !target.closest('.page-item.disabled')) { 
                    event.preventDefault(); 
                    this.currentPage = parseInt(target.dataset.page); 
                    this.loadUsers(); 
                } 
            });
        }
    };

    userManager.getTransactionTypeDisplay = function(type) {
        const types = {
            'recharge': '充值',
            'withdraw': '提现',
            'purchase': '购买信息',
            'repay': '还款',
            'transfer_out': '转出',
            'transfer_in': '转入',
            'refund': '退款',
            'reward': '奖励',
            'fee': '手续费',
            'REFERRAL_COMMISSION': '推荐奖励'
        };
        return types[type] || type;
    };
    userManager.getStatusDisplay = function(status) {
        const statuses = {'pending': '待审核','approved': '已通过','rejected': '已拒绝','completed': '已完成','failed': '失败','cancelled': '已取消'};
        return statuses[status] || status;
    };

    userManager.fetchUserTransactions = async function(userId, page = 1, limit = this.TRANSACTION_PAGE_SIZE, filters = {}) {
        if (!userId) { console.warn("fetchUserTransactions called with no userId"); return; }
        const container = document.getElementById('userTransactionsTableContainer');
        if (!container) { console.error("#userTransactionsTableContainer not found"); return; }
        container.innerHTML = '<p class="text-center"><div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Loading...</span></div> 正在加载明细...</p>';
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
            if (!token) throw new Error('未授权访问');
            const params = new URLSearchParams({ page, limit, ...filters });
            for (let [key, value] of params.entries()) { if (value === '' || value === null || value === undefined) params.delete(key); }
            const response = await fetch(`/api/admin/users/${userId}/transactions?${params.toString()}`, { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || '获取资金明细失败');
            this.renderUserTransactions(data);
        } catch (error) {
            if (container) container.innerHTML = `<p class="text-center text-danger">加载失败: ${error.message}</p>`;
            if (window.ui) window.ui.showError(`加载资金明细失败: ${error.message}`);
        }
    };

    userManager.renderUserTransactions = function(data) {
        const container = document.getElementById('userTransactionsTableContainer');
        const paginationInfo = document.getElementById('transactionsPaginationInfo');
        const prevBtn = document.getElementById('prevTransactionsPage');
        const nextBtn = document.getElementById('nextTransactionsPage');
        if (!container || !paginationInfo || !prevBtn || !nextBtn) { console.error("Transaction modal elements not found for render."); return; }
        container.innerHTML = ''; 
        const transactions = data.data || [];
        if (transactions.length === 0) {
            container.innerHTML = '<p class="text-center">该用户暂无资金明细记录。</p>';
        } else {
            let tableHtml = '<table class="table table-sm table-striped table-hover align-middle">';
            tableHtml += '<thead><tr><th>时间</th><th>类型</th><th>金额</th><th>状态</th><th>备注</th></tr></thead><tbody>';
            transactions.forEach(tx => {
                const amountClass = tx.amount > 0 && ['recharge', 'transfer_in', 'refund', 'reward'].includes(tx.type) ? 'text-success' : (tx.amount < 0 || ['withdraw', 'purchase', 'transfer_out', 'fee'].includes(tx.type) ? 'text-danger' : '');
                tableHtml += `<tr><td>${new Date(tx.createdAt).toLocaleString()}</td><td>${this.getTransactionTypeDisplay(tx.type)}</td><td><span class="${amountClass}">${tx.amount ? tx.amount.toFixed(2) : '0.00'}</span></td><td>${this.getStatusDisplay(tx.status)}</td><td>${tx.remark || '-'}</td></tr>`;
            });
            tableHtml += '</tbody></table>';
            container.innerHTML = tableHtml;
        }
        this.currentTransactionPage = data.page;
        paginationInfo.textContent = `第 ${data.page} / ${data.totalPages || 1} 页 (共 ${data.total || 0} 条)`;
        prevBtn.disabled = data.page <= 1;
        nextBtn.disabled = data.page >= data.totalPages;
    };

    userManager.openUserTransactionsModal = function(userId, userName) {
        this.currentTransactionUserId = userId;
        this.currentTransactionPage = 1;
        const modalTitleUserName = document.getElementById('modalUserName');
        if (modalTitleUserName) modalTitleUserName.textContent = userName || '未知用户';
        const elementsToReset = ['transactionTypeFilter', 'transactionStatusFilter', 'transactionStartDateFilter', 'transactionEndDateFilter'];
        elementsToReset.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

        if (!this.userTransactionsModalInstance) {
            const modalElement = document.getElementById('userTransactionsModal');
            if (modalElement && window.bootstrap && window.bootstrap.Modal) {
                this.userTransactionsModalInstance = new bootstrap.Modal(modalElement);
            } else {
                if(window.ui) window.ui.showError("无法初始化资金明细模态框。请检查页面元素和Bootstrap库。"); return;
            }
        }
        if (this.userTransactionsModalInstance) {
            this.userTransactionsModalInstance.show();
            this.fetchUserTransactions(userId, 1, this.TRANSACTION_PAGE_SIZE);
        } else {
            if (window.ui) window.ui.showError("无法打开资金明细模态框，实例未创建。");
        }
    };
    
    userManager.init = async function() {
        if (this.initialized) {
            await this.loadUsers(); // If already initialized, perhaps just reload data.
            return;
        }
        
        await this.loadUsers(); 
        this.bindFilterAndPaginationEvents(); 
        this.bindUserEvents();

        const applyFiltersBtn = document.getElementById('applyTransactionFilters');
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', () => {
                const filters = {
                    type: document.getElementById('transactionTypeFilter').value,
                    status: document.getElementById('transactionStatusFilter').value,
                    startDate: document.getElementById('transactionStartDateFilter').value,
                    endDate: document.getElementById('transactionEndDateFilter').value,
                };
                for (const key in filters) { if (filters[key] === '' || filters[key] === null || filters[key] === undefined) delete filters[key]; }
                if(this.currentTransactionUserId) this.fetchUserTransactions(this.currentTransactionUserId, 1, this.TRANSACTION_PAGE_SIZE, filters);
                else console.warn("Cannot apply transaction filters: currentTransactionUserId is not set.");
            });
        }

        const prevPageBtn = document.getElementById('prevTransactionsPage');
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', () => {
                if (!prevPageBtn.disabled && this.currentTransactionPage > 1 && this.currentTransactionUserId) {
                    const filters = { type: document.getElementById('transactionTypeFilter').value, status: document.getElementById('transactionStatusFilter').value, startDate: document.getElementById('transactionStartDateFilter').value, endDate: document.getElementById('transactionEndDateFilter').value };
                    for (const key in filters) { if (filters[key] === '' || filters[key] === null || filters[key] === undefined) delete filters[key]; }
                    this.fetchUserTransactions(this.currentTransactionUserId, this.currentTransactionPage - 1, this.TRANSACTION_PAGE_SIZE, filters);
                }
            });
        }

        const nextPageBtn = document.getElementById('nextTransactionsPage');
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', () => {
                if (!nextPageBtn.disabled && this.currentTransactionUserId) {
                     const filters = { type: document.getElementById('transactionTypeFilter').value, status: document.getElementById('transactionStatusFilter').value, startDate: document.getElementById('transactionStartDateFilter').value, endDate: document.getElementById('transactionEndDateFilter').value };
                    for (const key in filters) { if (filters[key] === '' || filters[key] === null || filters[key] === undefined) delete filters[key]; }
                    this.fetchUserTransactions(this.currentTransactionUserId, this.currentTransactionPage + 1, this.TRANSACTION_PAGE_SIZE, filters);
                }
            });
        }

        const modalElement = document.getElementById('userTransactionsModal');
        if (modalElement && window.bootstrap && window.bootstrap.Modal && !this.userTransactionsModalInstance) {
            this.userTransactionsModalInstance = new bootstrap.Modal(modalElement);
        }
        
        this.initialized = true;
    };

    return userManager;
}

// --- Global Instance and Initialization ---
if (typeof window.adminUserManager === 'undefined') {
    window.adminUserManager = createUserManager();
    
    document.addEventListener('DOMContentLoaded', () => {
        // const usersSectionElement = document.getElementById('users-section');
        // Initialize if users-section is present and displayed (or no specific section is displayed, implying it's the default)
        // if (usersSectionElement && (usersSectionElement.style.display === 'block' || usersSectionElement.classList.contains('active') || getComputedStyle(usersSectionElement).display !== 'none')) { 
            if (window.adminUserManager && typeof window.adminUserManager.init === 'function') {
                 window.adminUserManager.init();
            } else {
            }
        // } else {
        // }
    });
} else {
    console.warn('[DEBUG] window.adminUserManager already defined. Possible script duplication or state issue.');
} 