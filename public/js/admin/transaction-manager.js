/**
 * 交易管理模块
 * 将交易审核相关函数整合到全局transactionManager对象
 */

// 创建全局交易管理对象
function createTransactionManager() {
    const transactionManager = {};
    
    // --- 新增函数：获取过滤参数 ---
    transactionManager.getFilterParams = function() {
        const searchInput = document.getElementById('search-input');
        const typeFilter = document.getElementById('type-filter');
        const statusFilter = document.getElementById('status-filter');
        const dateStartInput = document.getElementById('date-start');
        const dateEndInput = document.getElementById('date-end');

        const filters = {};
        if (searchInput && searchInput.value) {
            filters.search = searchInput.value.trim(); // 搜索关键字
        }
        if (typeFilter && typeFilter.value) {
            filters.type = typeFilter.value; // 交易类型
        }
        if (statusFilter && statusFilter.value) {
            filters.status = statusFilter.value; // 交易状态
        }
        if (dateStartInput && dateStartInput.value) {
            // 注意：后端需要能够解析这些日期格式
            filters.startDate = dateStartInput.value; // 开始日期
        }
        if (dateEndInput && dateEndInput.value) {
            filters.endDate = dateEndInput.value; // 结束日期
        }
        
        return filters;
    };

    // 添加数据缓存
    transactionManager.cache = {
        data: null,
        timestamp: 0,
        expiry: 30000 // 30秒缓存过期
    };

    // 获取交易列表
    transactionManager.getTransactionList = async function(page = 1, limit = 20, filters = {}) {
        try {
            // 检查缓存是否有效
            const now = Date.now();
            if (transactionManager.cache.data && 
                now - transactionManager.cache.timestamp < transactionManager.cache.expiry &&
                JSON.stringify(transactionManager.cache.filters) === JSON.stringify(filters)) {
                return transactionManager.cache.data;
            }

            if (window.ui) window.ui.showLoading('加载中...');
            
            const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
            if (!token) {
                throw new Error('未登录');
            }
    
            // API路径和参数
            const params = new URLSearchParams({
                page: page,
                limit: limit,
                excludeTypes: 'purchase,repay,SALE_PROCEEDS,REFERRAL_COMMISSION'
            });

            // 添加其他过滤条件
            if (filters.type) params.set('type', filters.type);
            if (filters.status) params.set('status', filters.status);
            if (filters.search) params.set('search', filters.search);
            if (filters.startDate) params.set('startDate', filters.startDate);
            if (filters.endDate) params.set('endDate', filters.endDate);

            const response = await fetch(`/api/transactions/list?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
    
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || '获取列表失败');
            }
    
            // 更新缓存
            const result = {
                total: parseInt(data.total) || 0,
                list: Array.isArray(data.data) ? data.data : [],
                page: parseInt(page),
                limit: parseInt(limit)
            };
            transactionManager.cache.data = result;
            transactionManager.cache.timestamp = now;
            transactionManager.cache.filters = {...filters};

            return result;
        } catch (error) {
            if (window.ui) window.ui.showError(error.message);
            throw error;
        } finally {
            if (window.ui) window.ui.hideLoading();
        }
    };
    
    // 渲染交易列表
    transactionManager.renderTransactionList = function(transactionData) {
        const tbody = document.querySelector('#transactions-list');
        if (!tbody) {
            return;
        }
    
        // 使用 DocumentFragment 优化DOM操作
        const fragment = document.createDocumentFragment();
        const transactions = transactionData.list;

        if (!transactions || transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">暂无交易记录</td></tr>';
            const paginationContainer = document.getElementById('pagination');
            if (paginationContainer) {
                paginationContainer.style.display = 'none';
            }
            return;
        }

        // 使用虚拟滚动优化大量数据渲染
        const visibleTransactions = transactions.slice(0, 50); // 只渲染前50条数据
        visibleTransactions.forEach(transaction => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${transaction._id || '-'}</td>
                <td>${getTypeText(transaction.type)}</td>
                <td>¥${(transaction.amount || 0).toFixed(2)}</td>
                <td>${transaction.user?.username || '-'}</td>
                <td>
                    <span class="badge ${getBadgeClass(transaction.status)}">
                        ${getStatusText(transaction.status) || '-'}
                    </span>
                </td>
                <td>${formatDate(transaction.createdAt)}</td>
                <td>
                    <div class="btn-group" role="group">
                        ${(transaction.type === 'withdraw' || transaction.type === 'recharge') && getStatusText(transaction.status) === '待处理' ? `
                            <button class="btn btn-sm btn-success btn-approve-transaction" data-id="${transaction._id}">
                                <i class="bi bi-check-circle"></i> 通过
                            </button>
                            <button class="btn btn-sm btn-danger btn-reject-transaction" data-id="${transaction._id}">
                                <i class="bi bi-x-circle"></i> 拒绝
                            </button>
                            <button class="btn btn-sm btn-info btn-view-transaction" data-id="${transaction._id}">
                                <i class="bi bi-eye"></i> 查看
                            </button>
                            ${transaction.proof ? `
                            <button class="btn btn-sm btn-secondary btn-view-proof" data-proof="${transaction.proof}">
                                <i class="bi bi-image"></i> 查看截图
                            </button>
                            ` : ''}
                        ` : `
                            <button class="btn btn-sm btn-info btn-view-transaction" data-id="${transaction._id}">
                                <i class="bi bi-eye"></i> 查看
                            </button>
                            ${transaction.proof ? `
                            <button class="btn btn-sm btn-secondary btn-view-proof" data-proof="${transaction.proof}">
                                <i class="bi bi-image"></i> 查看截图
                            </button>
                            ` : ''}
                        `}
                    </div>
                </td>
            `;
            fragment.appendChild(tr);
        });

        // 一次性更新DOM
        tbody.innerHTML = '';
        tbody.appendChild(fragment);

        // 使用事件委托优化事件绑定
        this.bindTransactionEvents();

        // 根据实际数据处理分页显示
        const paginationContainer = document.getElementById('pagination');
        if (paginationContainer) {
            if (transactionData.total > transactionData.limit) {
                this.renderPagination(transactionData.total, transactionData.page, transactionData.limit);
                paginationContainer.style.display = 'flex';
            } else {
                paginationContainer.style.display = 'none';
            }
        }

        // 添加滚动加载更多功能
        if (transactions.length > 50) {
            const loadMoreObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const currentLength = tbody.children.length;
                        const remainingTransactions = transactions.slice(currentLength, currentLength + 50);
                        if (remainingTransactions.length > 0) {
                            remainingTransactions.forEach(transaction => {
                                const tr = document.createElement('tr');
                                tr.innerHTML = `
                                    <td>${transaction._id || '-'}</td>
                                    <td>${getTypeText(transaction.type)}</td>
                                    <td>¥${(transaction.amount || 0).toFixed(2)}</td>
                                    <td>${transaction.user?.username || '-'}</td>
                                    <td>
                                        <span class="badge ${getBadgeClass(transaction.status)}">
                                            ${getStatusText(transaction.status) || '-'}
                                        </span>
                                    </td>
                                    <td>${formatDate(transaction.createdAt)}</td>
                                    <td>
                                        <div class="btn-group" role="group">
                                            ${(transaction.type === 'withdraw' || transaction.type === 'recharge') && getStatusText(transaction.status) === '待处理' ? `
                                                <button class="btn btn-sm btn-success btn-approve-transaction" data-id="${transaction._id}">
                                                    <i class="bi bi-check-circle"></i> 通过
                                                </button>
                                                <button class="btn btn-sm btn-danger btn-reject-transaction" data-id="${transaction._id}">
                                                    <i class="bi bi-x-circle"></i> 拒绝
                                                </button>
                                                <button class="btn btn-sm btn-info btn-view-transaction" data-id="${transaction._id}">
                                                    <i class="bi bi-eye"></i> 查看
                                                </button>
                                                ${transaction.proof ? `
                                                <button class="btn btn-sm btn-secondary btn-view-proof" data-proof="${transaction.proof}">
                                                    <i class="bi bi-image"></i> 查看截图
                                                </button>
                                                ` : ''}
                                            ` : `
                                                <button class="btn btn-sm btn-info btn-view-transaction" data-id="${transaction._id}">
                                                    <i class="bi bi-eye"></i> 查看
                                                </button>
                                                ${transaction.proof ? `
                                                <button class="btn btn-sm btn-secondary btn-view-proof" data-proof="${transaction.proof}">
                                                    <i class="bi bi-image"></i> 查看截图
                                                </button>
                                                ` : ''}
                                            `}
                                        </div>
                                    </td>
                                `;
                                tbody.appendChild(tr);
                            });
                        }
                    }
                });
            });

            const sentinel = document.createElement('tr');
            sentinel.id = 'load-more-sentinel';
            tbody.appendChild(sentinel);
            loadMoreObserver.observe(sentinel);
        }
    };
    
    // 绑定交易审核按钮点击事件 (修改为只绑定需要审核的提现交易)
    transactionManager.bindTransactionEvents = function() {
        // 使用事件委托，将事件监听器绑定到 tbody 上
        const tbody = document.querySelector('#transactions-list');
        if (!tbody) {
            console.warn('[交易审核] 未找到#transactions-list元素，事件绑定失败');
            return;
        }

        // 先移除之前的事件监听，防止重复绑定
        if (tbody._bindClickHandler) {
            tbody.removeEventListener('click', tbody._bindClickHandler);
        }
        tbody._bindClickHandler = function(e) {
            const target = e.target.closest('button');
            if (!target) return;
            console.log('[交易审核] 点击了按钮：', target.className, target.dataset);

            const transactionId = target.dataset.id;
            // For view-proof, transactionId might be undefined, so handle it earlier.
            if (target.classList.contains('btn-view-proof')) {
                const proofUrl = target.dataset.proof;
                if (proofUrl && typeof window.showImagePreview === 'function') {
                    window.showImagePreview(proofUrl);
                } else if (proofUrl) { // Fallback if showImagePreview is missing temporarily
                    window.open(proofUrl, '_blank');
                }
                return; 
            }

            if (!transactionId && !target.classList.contains('btn-view-proof')) return;


            if (target.classList.contains('btn-approve-transaction')) {
                approveTransaction(transactionId);
            } else if (target.classList.contains('btn-reject-transaction')) {
                rejectTransaction(transactionId);
            } else if (target.classList.contains('btn-view-transaction')) {
                if (typeof transactionManager.showTransactionDetails === 'function') {
                    transactionManager.showTransactionDetails(transactionId);
                }
            }
        };
        tbody.addEventListener('click', tbody._bindClickHandler);
    };
    
    // 获取交易状态显示文本
    function getStatusText(status) {
        const statusMap = {
            'pending': '待处理',
            'approved': '已通过',
            'rejected': '已拒绝',
            'completed': '已完成',
            'failed': '失败'
        };
        return statusMap[status] || status;
    }
    
    // 获取交易类型显示文本
    function getTypeText(type) {
        switch (type) {
            case 'recharge':
                return '充值';
            case 'withdraw':
                return '提现';
            case 'purchase':
                // This type is usually excluded by the API for this page, 
                // but if it appears, show its name.
                return '购买信息'; 
            case 'repay':
                // This type is usually excluded by the API for this page.
                return '还款';
            case 'referral_reward': // Legacy, if still used and needed here
                return '邀请奖励';
            // Removed SALE_PROCEEDS and REFERRAL_COMMISSION for transaction audit page
            // case 'SALE_PROCEEDS':
            //     return '销售收款';
            // case 'REFERRAL_COMMISSION':
            //     return '推荐返利'; 
            default:
                return type || '未知类型';
        }
    }
    
    // 获取状态徽章样式
    function getBadgeClass(status) {
        const classMap = {
            'pending': 'bg-warning',
            'approved': 'bg-success',
            'rejected': 'bg-danger',
            'completed': 'bg-primary',
            'failed': 'bg-secondary'
        };
        return classMap[status] || 'bg-secondary';
    }
    
    // 格式化日期
    function formatDate(dateString) {
        if (!dateString) return '未知时间';
        const date = new Date(dateString);
        return date.toLocaleString();
    }
    
    // 获取充值路径列表
    transactionManager.getRechargePaths = async function() {
        try {
            if (window.ui) window.ui.showLoading('加载中...');
            
            const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
            if (!token) {
                throw new Error('未登录');
            }
    
            // API路径
            const response = await fetch(`/api/recharge/paths/paths`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
    
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || '获取充值路径列表失败');
            }
    
            return data.data || [];
        } catch (error) {
            if (window.ui) window.ui.showError(error.message);
            return [];
        } finally {
            if (window.ui) window.ui.hideLoading();
        }
    };
    
    // 渲染充值路径列表
    transactionManager.renderRechargePaths = function(paths) {
        const container = document.querySelector('#recharge-paths-list');
        if (!container) {
            return;
        }
    
        // 清空容器内容
        container.innerHTML = '';
    
        // 检查是否有充值路径
        if (!paths || paths.length === 0) {
            container.innerHTML = '<div class="alert alert-info">暂无充值路径</div>';
            return;
        }

        // 创建九宫格容器
        const gridContainer = document.createElement('div');
        gridContainer.className = 'row row-cols-1 row-cols-md-3 g-4';
        
        // 生成充值路径九宫格
        paths.forEach(path => {
            const cardCol = document.createElement('div');
            cardCol.className = 'col';
            
            // 设置充值路径卡片内容
            cardCol.innerHTML = `
                <div class="card h-100">
                    <div class="card-body text-center">
                        <h5 class="card-title">${path.name || '未命名'}</h5>
                        <p class="card-text mb-1">收款账号: ${path.account || '未设置'}</p>
                        <p class="card-text mb-3">收款人: ${path.receiver || '未设置'}</p>
                        <div class="qrcode-container mb-3" style="height: 150px; display: flex; align-items: center; justify-content: center;">
                            ${path.qrcode ? 
                                `<img src="${path.qrcode}" alt="${path.name}收款码" class="img-fluid" style="max-height: 150px;">` : 
                                '<div class="text-muted">无二维码</div>'
                            }
                        </div>
                        <div class="d-flex justify-content-between mt-2">
                            <span class="badge ${path.isActive ? 'bg-success' : 'bg-secondary'} my-auto">
                                ${path.isActive ? '启用' : '禁用'}
                            </span>
                            <div class="btn-group">
                                <button class="btn btn-sm btn-primary btn-edit-recharge-path" data-id="${path._id || path.id}">
                                    <i class="bi bi-pencil"></i> 编辑
                                </button>
                                <button class="btn btn-sm btn-danger btn-delete-recharge-path" data-id="${path._id || path.id}">
                                    <i class="bi bi-trash"></i> 删除
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            gridContainer.appendChild(cardCol);
        });
        
        // 将九宫格添加到容器
        container.appendChild(gridContainer);
        
        // 绑定编辑和删除按钮事件
        document.querySelectorAll('.btn-edit-recharge-path').forEach(btn => {
            btn.onclick = function() {
                const pathId = this.getAttribute('data-id');
                this.console.log('编辑充值路径:', pathId);
                transactionManager.showRechargePathModal('edit', pathId);
            };
        });
        
        document.querySelectorAll('.btn-delete-recharge-path').forEach(btn => {
            btn.onclick = function() {
                const pathId = this.getAttribute('data-id');
                if (confirm('确定要删除此充值路径吗？')) {
                    transactionManager.deleteRechargePath(pathId);
                }
            };
        });
    };
    
    // 显示充值路径编辑模态框
    transactionManager.showRechargePathModal = function(mode = 'add', pathId = null) {
        if (window.ui) window.ui.showLoading('加载中...');
        
        // 获取模态框元素
        const modalElement = document.getElementById('recharge-path-modal');
        if (!modalElement) {
            const tempModal = document.createElement('div');
            tempModal.className = 'modal fade';
            tempModal.id = 'recharge-path-modal';
            tempModal.setAttribute('tabindex', '-1');
            tempModal.innerHTML = `
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${mode === 'add' ? '添加' : '编辑'}充值路径</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <form id="recharge-path-form">
                                <input type="hidden" id="recharge-path-id">
                                <div class="mb-3">
                                    <label for="recharge-path-name" class="form-label">充值名称</label>
                                    <input type="text" class="form-control" id="recharge-path-name" required>
                                </div>
                                <div class="mb-3">
                                    <label for="recharge-path-account" class="form-label">收款账号</label>
                                    <input type="text" class="form-control" id="recharge-path-account" required>
                                </div>
                                <div class="mb-3">
                                    <label for="recharge-path-receiver" class="form-label">收款人</label>
                                    <input type="text" class="form-control" id="recharge-path-receiver" required>
                                </div>
                                <div class="mb-3">
                                    <label for="recharge-path-icon" class="form-label">图标</label>
                                    <input type="file" class="form-control" id="recharge-path-icon" accept="image/*">
                                </div>
                                <div class="mb-3">
                                    <label for="recharge-path-qrcode" class="form-label">收款码</label>
                                    <input type="file" class="form-control" id="recharge-path-qrcode" accept="image/*">
                                </div>
                                
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                            <button type="button" class="btn btn-primary" id="btn-save-recharge-path">保存</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(tempModal);
            
            // 获取新创建的模态框元素
            const newModalElement = document.getElementById('recharge-path-modal');
            
            // 绑定保存按钮事件
            const saveBtn = newModalElement.querySelector('#btn-save-recharge-path');
            if (saveBtn) {
                saveBtn.onclick = function() {
                    this.console.log('点击保存按钮');
                    transactionManager.saveRechargePath();
                };
            }
            
            // 显示模态框
            const modal = new bootstrap.Modal(newModalElement);
            modal.show();
            
            return;
        }
        
        // 设置模态框标题
        const modalTitle = modalElement.querySelector('.modal-title');
        if (modalTitle) {
            modalTitle.textContent = mode === 'add' ? '添加充值路径' : '编辑充值路径';
        }
        
        // 清空表单
        const form = modalElement.querySelector('#recharge-path-form');
        if (form) {
            form.reset();
        }
        
        // 设置ID
        const idInput = modalElement.querySelector('#recharge-path-id');
        if (idInput) {
            idInput.value = pathId || '';
        }
        
        // 重新绑定保存按钮事件(确保每次都绑定正确)
        const saveBtn = modalElement.querySelector('#btn-save-recharge-path');
        if (saveBtn) {
            // 移除之前的事件监听器
            saveBtn.onclick = null;
            // 添加新的事件监听器
            saveBtn.onclick = function() {
                this.console.log('点击保存按钮');
                transactionManager.saveRechargePath();
            };
        }
        
        // 如果是编辑模式，加载充值路径数据
        if (mode === 'edit' && pathId) {
            // TODO: 加载充值路径数据
        }
        
        // 显示模态框
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    };
    
    // 保存充值路径
    transactionManager.saveRechargePath = async function() {
        if (window.ui) window.ui.showLoading('保存中...');
        
        const form = document.getElementById('recharge-path-form');
        if (!form) {
            throw new Error('未找到充值路径表单');
        }
        
        // 收集表单数据
        const formData = new FormData();
        
        // 手动收集表单字段
        const nameInput = document.getElementById('recharge-path-name');
        const accountInput = document.getElementById('recharge-path-account');
        const receiverInput = document.getElementById('recharge-path-receiver');
        const iconInput = document.getElementById('recharge-path-icon');
        const qrcodeInput = document.getElementById('recharge-path-qrcode');
        const activeInput = document.getElementById('recharge-path-active');
        const idInput = document.getElementById('recharge-path-id');
        
        if (nameInput) formData.append('name', nameInput.value);
        if (accountInput) formData.append('account', accountInput.value);
        if (receiverInput) formData.append('receiver', receiverInput.value);
        if (activeInput) formData.append('isActive', activeInput.checked);
        if (idInput && idInput.value) formData.append('id', idInput.value);
        
        // 添加文件
        if (iconInput && iconInput.files && iconInput.files.length > 0) {
            formData.append('icon', iconInput.files[0]);
        }
        
        if (qrcodeInput && qrcodeInput.files && qrcodeInput.files.length > 0) {
            formData.append('qrcode', qrcodeInput.files[0]);
        }
        
        const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
        if (!token) {
            throw new Error('未登录');
        }
        
        const pathId = idInput ? idInput.value : '';
        const method = pathId ? 'PUT' : 'POST';
        const url = pathId ? `/api/recharge/paths/${pathId}` : '/api/recharge/paths';
        
        // 发送请求
        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || '保存充值路径失败');
        }
        
        if (window.ui) window.ui.showSuccess('保存充值路径成功');
        
        // 关闭模态框
        const modalElement = document.getElementById('recharge-path-modal');
        if (modalElement && window.bootstrap) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) modal.hide();
        }
        
        // 重新加载充值路径列表
        await transactionManager.loadRechargePaths();
        
    };
    
    // 删除充值路径
    transactionManager.deleteRechargePath = async function(pathId) {
        if (window.ui) window.ui.showLoading('删除中...');
        
        const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
        if (!token) {
            throw new Error('未登录');
        }
        
        // 发送请求
        const response = await fetch(`/api/recharge/paths/paths/${pathId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || '删除充值路径失败');
        }
        
        if (window.ui) window.ui.showSuccess('删除充值路径成功');
        
        // 重新加载充值路径列表
        await transactionManager.loadRechargePaths();
        
    };
    
    // 加载充值路径列表
    transactionManager.loadRechargePaths = async function() {
        try {
            const paths = await transactionManager.getRechargePaths();
            transactionManager.renderRechargePaths(paths);
        } catch (error) {
        }
    };
    
    // --- 新增函数：获取并更新交易统计概览 ---
    transactionManager.loadTransactionSummary = async function() {
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
            if (!token) {
                throw new Error('未登录');
            }

            const response = await fetch('/api/transactions/summary', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('获取交易统计概览失败');
            }

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.message || '获取交易统计概览失败');
            }

            // 更新页面上的统计卡片
            const summary = result.data;
            document.getElementById('today-income').innerText = (summary.today.income || 0).toFixed(2);
            document.getElementById('today-expense').innerText = Math.abs(summary.today.expense || 0).toFixed(2);
            document.getElementById('yesterday-income').innerText = (summary.yesterday.income || 0).toFixed(2);
            document.getElementById('yesterday-expense').innerText = Math.abs(summary.yesterday.expense || 0).toFixed(2);
            document.getElementById('week-income').innerText = (summary.thisWeek.income || 0).toFixed(2);
            document.getElementById('week-expense').innerText = Math.abs(summary.thisWeek.expense || 0).toFixed(2);
            document.getElementById('month-income').innerText = (summary.thisMonth.income || 0).toFixed(2);
            document.getElementById('month-expense').innerText = Math.abs(summary.thisMonth.expense || 0).toFixed(2);

        } catch (error) {
            if (window.ui) window.ui.showError('加载交易统计概览失败: ' + error.message);
        }
    };

    // --- 新增函数：绑定筛选和分页事件 ---
    transactionManager.bindFilterAndPaginationEvents = function() {
        // 获取筛选元素
        const searchInput = document.getElementById('search-input');
        const typeFilter = document.getElementById('type-filter');
        const statusFilter = document.getElementById('status-filter');
        const dateStartInput = document.getElementById('date-start');
        const dateEndInput = document.getElementById('date-end');
        const searchButton = document.getElementById('btn-search'); // 现在是重置按钮

        // 搜索框事件监听 (自动搜索 + 防抖)
        let searchTimeout;
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.currentPage = 1; // 搜索时回到第一页
                    this.loadTransactions();
                }, 500); // 设置防抖延迟，例如 500 毫秒
            });
        }

        // 类型筛选事件监听 (自动搜索)
        if (typeFilter) {
            typeFilter.addEventListener('change', () => {
                this.currentPage = 1; // 筛选时回到第一页
                this.loadTransactions();
            });
        }
        
        // 状态筛选事件监听 (自动搜索)
        if (statusFilter) {
            statusFilter.addEventListener('change', () => {
                this.currentPage = 1; // 筛选时回到第一页
                this.loadTransactions();
            });
        }

        // 日期范围筛选事件监听 (自动搜索)
        if (dateStartInput) {
            dateStartInput.addEventListener('change', () => {
                this.currentPage = 1; // 日期筛选时回到第一页
                // 检查结束日期是否合法（如果填写了）
                if (dateEndInput && dateEndInput.value && new Date(dateStartInput.value) > new Date(dateEndInput.value)) {
                     if (window.ui) window.ui.showError('开始日期不能晚于结束日期');
                     // 可选：清空结束日期或阻止搜索
                     dateEndInput.value = ''; // 清空结束日期
                }
                this.loadTransactions();
            });
        }
        if (dateEndInput) {
            dateEndInput.addEventListener('change', () => {
                this.currentPage = 1; // 日期筛选时回到第一页
                // 检查开始日期是否合法（如果填写了）
                 if (dateStartInput && dateStartInput.value && new Date(dateStartInput.value) > new Date(dateEndInput.value)) {
                     if (window.ui) window.ui.showError('结束日期不能早于开始日期');
                     // 可选：清空开始日期或阻止搜索
                     dateStartInput.value = ''; // 清空开始日期
                }
                this.loadTransactions();
            });
        }
        
        // 分页点击事件监听 (事件委托)
        const paginationContainer = document.getElementById('pagination');
        if (paginationContainer) {
            paginationContainer.addEventListener('click', (e) => {
                if (e.target.tagName === 'A' && e.target.parentElement.classList.contains('page-item') && !e.target.parentElement.classList.contains('disabled')) {
                    e.preventDefault();
                    const page = parseInt(e.target.dataset.page);
                    if (!isNaN(page)) {
                        this.currentPage = page;
                        this.loadTransactions();
                    }
                }
            });
        }
        
        // 绑定重置按钮事件 (原搜索按钮)
        if (searchButton) {
             searchButton.addEventListener('click', async function() {
                 // 清空所有筛选条件
                 if (searchInput) searchInput.value = '';
                 if (typeFilter) typeFilter.value = '';
                 if (statusFilter) statusFilter.value = '';
                 if (dateStartInput) dateStartInput.value = '';
                 if (dateEndInput) dateEndInput.value = '';

                 // 重置页码并加载数据
                 this.currentPage = 1; // 重置时回到第一页
                 await transactionManager.loadTransactions();
                 if (window.ui) window.ui.showSuccess('筛选条件已重置');
             });
        } else {
             console.error('未找到重置按钮 #btn-search');
        }

        // 绑定刷新按钮事件 (如果尚未绑定)
        const btnRefreshTransactions = document.getElementById('btn-refresh-transactions');
        if (btnRefreshTransactions && !btnRefreshTransactions.dataset.eventBound) { // 避免重复绑定
            btnRefreshTransactions.addEventListener('click', async () => {
                // 重置筛选条件和页码 (刷新按钮也应清空筛选)
                if (searchInput) searchInput.value = '';
                if (typeFilter) typeFilter.value = '';
                if (statusFilter) statusFilter.value = '';
                if (dateStartInput) dateStartInput.value = '';
                if (dateEndInput) dateEndInput.value = '';
                this.currentPage = 1;

                await this.loadTransactionSummary(); // 刷新统计概览
                await this.loadTransactions(); // 刷新交易列表
                if (window.ui) window.ui.showSuccess('刷新成功');
            });
            btnRefreshTransactions.dataset.eventBound = 'true'; // 标记已绑定
        }
    };

    // --- 新增函数：加载交易数据 (包含列表和统计) ---
    transactionManager.loadTransactions = async function() {
        try {
            if (window.ui) window.ui.showLoading('加载中...');
            
            const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
            if (!token) {
                throw new Error('未登录');
            }
    
            // 获取当前的筛选条件和页码
            const filters = this.getFilterParams(); // 调用获取过滤参数的函数

            // 调用 getTransactionList 获取交易列表数据
            const transactionData = await this.getTransactionList(this.currentPage, this.pageSize, filters);

            // 渲染交易列表
            this.renderTransactionList(transactionData);
                
            // 渲染分页
            this.renderPagination(transactionData.total, transactionData.page, transactionData.limit);
                
        } catch (error) {
            if (window.ui) window.ui.showError('加载交易数据失败: ' + error.message);
        } finally {
            if (window.ui) window.ui.hideLoading();
        }
    };

    // 渲染分页控件
    transactionManager.renderPagination = function(totalItems, currentPage, itemsPerPage) {
        const paginationContainer = document.getElementById('pagination');
        if (!paginationContainer) {
            return;
        }

        // 如果没有数据，隐藏分页
        if (!totalItems || totalItems === 0) {
            paginationContainer.style.display = 'none';
            return;
        }

        paginationContainer.innerHTML = ''; // 清空现有分页
        paginationContainer.style.display = 'flex';

        const totalPages = Math.ceil(totalItems / itemsPerPage);

        // 如果只有一页，不显示分页
        if (totalPages <= 1) {
            paginationContainer.style.display = 'none';
            return;
        }

        // 添加上一页按钮
        const prevItem = document.createElement('li');
        prevItem.classList.add('page-item');
        if (currentPage === 1) prevItem.classList.add('disabled');
        prevItem.innerHTML = `<a class="page-link" href="#" data-page="${currentPage - 1}">上一页</a>`;
        paginationContainer.appendChild(prevItem);

        // 添加页码（最多显示5个页码）
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        startPage = Math.max(1, endPage - 4); // 确保显示5个页码

        // 显示第一页
        if (startPage > 1) {
            paginationContainer.appendChild(createPageItem(1));
            if (startPage > 2) {
                const ellipsis = document.createElement('li');
                ellipsis.classList.add('page-item', 'disabled');
                ellipsis.innerHTML = '<span class="page-link">...</span>';
                paginationContainer.appendChild(ellipsis);
            }
        }

        // 显示中间页码
        for (let i = startPage; i <= endPage; i++) {
            const pageItem = document.createElement('li');
            pageItem.classList.add('page-item');
            if (i === currentPage) pageItem.classList.add('active');
            pageItem.innerHTML = `<a class="page-link" href="#" data-page="${i}">${i}</a>`;
            paginationContainer.appendChild(pageItem);
        }

        // 显示最后一页
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const ellipsis = document.createElement('li');
                ellipsis.classList.add('page-item', 'disabled');
                ellipsis.innerHTML = '<span class="page-link">...</span>';
                paginationContainer.appendChild(ellipsis);
            }
            paginationContainer.appendChild(createPageItem(totalPages));
        }

        // 添加下一页按钮
        const nextItem = document.createElement('li');
        nextItem.classList.add('page-item');
        if (currentPage === totalPages) nextItem.classList.add('disabled');
        nextItem.innerHTML = `<a class="page-link" href="#" data-page="${currentPage + 1}">下一页</a>`;
        paginationContainer.appendChild(nextItem);

        function createPageItem(pageNum) {
            const pageItem = document.createElement('li');
            pageItem.classList.add('page-item');
            if (pageNum === currentPage) pageItem.classList.add('active');
            pageItem.innerHTML = `<a class="page-link" href="#" data-page="${pageNum}">${pageNum}</a>`;
            return pageItem;
        }
    };

    // --- 新增或修改初始化函数 --- (确保在 DOMContentLoaded 后执行)
    transactionManager.initTransactionPage = async function() {
        // 初始化当前页码和每页数量
        this.currentPage = 1;
        this.pageSize = 20; // 修改为每页显示20条记录

        // 加载交易统计概览
        await transactionManager.loadTransactionSummary();
        
        // 绑定筛选、分页和重置按钮事件
        transactionManager.bindFilterAndPaginationEvents();

        // 初始化加载交易列表（无过滤条件）
        await this.loadTransactions();

    };

    // 在页面加载完成后调用初始化函数
    document.addEventListener('DOMContentLoaded', function() {
        // 确保只有在交易审核页面显示时才初始化
        const transactionSection = document.getElementById('transactions-section');
        // TODO: 需要更可靠的方式判断当前是否在交易审核页面，例如检查URL hash或通过其他管理页面加载逻辑触发
        // 目前先简化处理，假设当 #transactions-section 存在时就初始化
        if (transactionSection) {
             transactionManager.initTransactionPage();
        }
    });
    
    // 在transactionManager对象中添加showTransactionDetails方法
    transactionManager.showTransactionDetails = async function(transactionId) {
        try {
            if (window.ui) window.ui.showLoading('加载详情...');
            const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
            if (!token) throw new Error('未登录');
            const response = await fetch(`/api/transactions/${transactionId}` , {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || '获取详情失败');
            const tx = data.data || data.transaction || data;
            // 构建表格式详情内容
            let html = `<table style='width:100%;margin-bottom:16px;font-size:16px;line-height:2;'>`;
            html += `<tr><td style='color:#888;width:110px;'>交易ID:</td><td style='word-break:break-all;'>${tx._id}</td><td style='color:#888;width:80px;'>类型:</td><td>${getTypeText(tx.type)}</td></tr>`;
            html += `<tr><td style='color:#888;'>用户:</td><td>${tx.user?.username || tx.user || '-'}</td><td style='color:#888;'>金额:</td><td>¥${tx.amount}</td></tr>`;
            html += `<tr><td style='color:#888;'>创建时间:</td><td>${formatDate(tx.createdAt)}</td><td style='color:#888;'>状态:</td><td>${getStatusText(tx.status)}</td></tr>`;
            if (tx.type === 'withdraw') {
                html += `<tr><td style='color:#888;'>收款账号:</td><td>${tx.receiveAccount || '-'}</td><td style='color:#888;'>收款人:</td><td>${tx.receiver || '-'}</td></tr>`;
            }
            html += `</table>`;
            if (tx.qrcode) {
                html += `<div style='color:#888;margin-bottom:4px;'>收款二维码:</div>`;
                html += `<div style='text-align:center;margin:16px 0;'><img src='${tx.qrcode}' alt='收款二维码' style='max-width:340px;max-height:340px;width:auto;height:auto;display:block;margin:0 auto;border:1px solid #eee;border-radius:8px;box-shadow:0 2px 8px #0001;'></div>`;
            }
            if (tx.proof) {
                html += `<div style='color:#888;margin-bottom:4px;'>凭证:</div>`;
                html += `<div style='text-align:center;margin:16px 0;'><img src='${tx.proof}' alt='凭证' style='max-width:340px;max-height:340px;width:auto;height:auto;display:block;margin:0 auto;border:1px solid #eee;border-radius:8px;box-shadow:0 2px 8px #0001;'></div>`;
            }
            if (tx.remark) {
                html += `<div class='mb-2'><b>备注：</b>${tx.remark}</div>`;
            }
            document.getElementById('transaction-detail-content').innerHTML = html;
            const modal = new bootstrap.Modal(document.getElementById('transaction-detail-modal'));
            modal.show();
        } catch (err) {
            if (window.ui) window.ui.showError('加载详情失败: ' + err.message);
        } finally {
            if (window.ui) window.ui.hideLoading();
        }
    };

    return transactionManager;
}

// 实例化transactionManager
const transactionManager = createTransactionManager();

window.transactionManager = window.transactionManager || {};
window.transactionManager.initTransactionPage = function() {
    // 每次都强制请求最新数据
    if (typeof window.transactionManager.fetchTransactionList === 'function') {
        window.transactionManager.fetchTransactionList();
    }
    // ... 其它初始化逻辑 ...
};

// 图片预览函数
function showImagePreview(imageUrl) {
    // 检查并移除已存在的预览模态框，防止重复
    const oldModal = document.getElementById('image-preview-modal');
    if (oldModal) document.body.removeChild(oldModal);

    // 创建遮罩和模态框
    const modal = document.createElement('div');
    modal.className = 'image-preview-modal-custom';
    modal.id = 'image-preview-modal';
    // 强制设置所有关键样式，避免被全局样式影响
    Object.assign(modal.style, {
        display: 'flex',
        background: 'rgba(0,0,0,0.7)',
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        zIndex: '9999',
        justifyContent: 'center',
        alignItems: 'center',
        transition: 'opacity 0.2s',
        opacity: '1',
        pointerEvents: 'auto',
    });
    modal.innerHTML = `
        <div style="max-width:90vw; max-height:90vh; margin:auto; display:flex; flex-direction:column; align-items:center; justify-content:center; background:transparent;">
            <button type="button" style="align-self:flex-end; margin-bottom:8px; font-size:2rem; background:none; border:none; color:#fff; cursor:pointer;" id="close-preview-btn" aria-label="Close">✖</button>
            <img id="preview-img" src="${imageUrl}" class="img-fluid rounded shadow" style="max-width:80vw; max-height:70vh; cursor: zoom-in; transition:transform 0.2s; background:#fff;" alt="图片预览">
            <div id="img-error-msg" class="text-danger mt-2" style="display:none;">图片加载失败</div>
        </div>
    `;
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden'; // 禁止页面滚动
    console.log('[图片预览弹窗] 已插入 DOM');

    // 关闭逻辑
    function closeModal() {
        document.body.style.overflow = '';
        modal.remove();
    }
    modal.addEventListener('click', e => {
        if (e.target === modal) closeModal();
    });
    modal.querySelector('#close-preview-btn').onclick = closeModal;

    // 图片放大/缩小
    const img = modal.querySelector('#preview-img');
    let zoomed = false;
    img.onclick = function(e) {
        e.stopPropagation();
        zoomed = !zoomed;
        if (zoomed) {
            img.style.transform = 'scale(2)';
            img.style.cursor = 'zoom-out';
        } else {
            img.style.transform = 'scale(1)';
            img.style.cursor = 'zoom-in';
        }
    };
    // 图片加载失败提示
    img.onerror = function() {
        img.style.display = 'none';
        modal.querySelector('#img-error-msg').style.display = 'block';
    };
}

window.showImagePreview = showImagePreview;

// ========== 交易审核按钮事件绑定和处理逻辑 ========== //

function bindTransactionReviewButtons() {
    try {
        console.log('开始绑定审核按钮事件...');

        const approveBtns = document.querySelectorAll('.btn-approve-transaction');
        console.log('找到通过按钮数量:', approveBtns.length);
        if (approveBtns.length === 0) {
            console.error('未找到任何通过按钮 .btn-approve-transaction');
        }
        approveBtns.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = this.getAttribute('data-id');
                console.log('点击通过按钮，id:', id, '按钮元素:', this);
                if (typeof approveTransaction === 'function') {
                    try {
                        approveTransaction(id);
                    } catch (err) {
                        console.error('approveTransaction 执行出错:', err);
                    }
                } else {
                    console.error('approveTransaction 函数未定义');
                    if (window.ui && window.ui.showError) window.ui.showError('审核通过功能未实现');
                }
            });
        });

        const rejectBtns = document.querySelectorAll('.btn-reject-transaction');
        console.log('找到拒绝按钮数量:', rejectBtns.length);
        if (rejectBtns.length === 0) {
            console.error('未找到任何拒绝按钮 .btn-reject-transaction');
        }
        rejectBtns.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = this.getAttribute('data-id');
                console.log('点击拒绝按钮，id:', id, '按钮元素:', this);
                if (typeof rejectTransaction === 'function') {
                    try {
                        rejectTransaction(id);
                    } catch (err) {
                        console.error('rejectTransaction 执行出错:', err);
                    }
                } else {
                    console.error('rejectTransaction 函数未定义');
                    if (window.ui && window.ui.showError) window.ui.showError('审核拒绝功能未实现');
                }
            });
        });

        const proofBtns = document.querySelectorAll('.btn-view-proof');
        console.log('找到查看截图按钮数量:', proofBtns.length);
        if (proofBtns.length === 0) {
            console.error('未找到任何查看截图按钮 .btn-view-proof');
        }
        proofBtns.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const proofUrl = this.getAttribute('data-proof');
                console.log('点击查看截图按钮，proofUrl:', proofUrl, '按钮元素:', this);
                if (proofUrl) {
                    try {
                        showImagePreview(proofUrl);
                    } catch (err) {
                        console.error('showImagePreview 执行出错:', err);
                    }
                } else {
                    console.error('未找到 proofUrl');
                    if (window.ui && window.ui.showError) window.ui.showError('未找到凭证图片');
                }
            });
        });

        console.log('审核按钮事件绑定完成');
    } catch (err) {
        console.error('审核按钮事件绑定过程出错:', err);
    }
}

async function approveTransaction(id) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            if (window.ui && window.ui.showError) window.ui.showError('未登录，无法审核');
            return;
        }
        const res = await fetch(`/api/transactions/${id}/review`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: 'approved' })
        });
        const data = await res.json();
        if (data.success) {
            if (window.ui && window.ui.showSuccess) window.ui.showSuccess('审核通过成功');
            // 重新加载列表（你需要根据实际函数名调用刷新）
            if (typeof reloadTransactionList === 'function') {
                reloadTransactionList();
            } else if (typeof transactionManager !== 'undefined' && typeof transactionManager.getTransactionList === 'function') {
                // 使用transactionManager刷新
                await transactionManager.getTransactionList(1, 20, {});
            } else {
                // 如果都没有，尝试刷新页面
                console.log('无法找到刷新函数，尝试刷新页面');
                location.reload();
            }
        } else {
            if (window.ui && window.ui.showError) window.ui.showError(data.message || '审核通过失败');
        }
    } catch (err) {
        if (window.ui && window.ui.showError) window.ui.showError('审核通过出错: ' + err.message);
    }
}

async function rejectTransaction(id) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            if (window.ui && window.ui.showError) window.ui.showError('未登录，无法审核');
            return;
        }
        // 直接拒绝，不填写理由
        const res = await fetch(`/api/transactions/${id}/review`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: 'rejected' })
        });
        const data = await res.json();
        if (data.success) {
            if (window.ui && window.ui.showSuccess) window.ui.showSuccess('审核拒绝成功');
            if (typeof reloadTransactionList === 'function') {
                reloadTransactionList();
            } else if (typeof transactionManager !== 'undefined' && typeof transactionManager.getTransactionList === 'function') {
                // 使用transactionManager刷新
                await transactionManager.getTransactionList(1, 20, {});
            } else {
                // 如果都没有，尝试刷新页面
                console.log('无法找到刷新函数，尝试刷新页面');
                location.reload();
            }
        } else {
            if (window.ui && window.ui.showError) window.ui.showError(data.message || '审核拒绝失败');
        }
    } catch (err) {
        if (window.ui && window.ui.showError) window.ui.showError('审核拒绝出错: ' + err.message);
    }
}

// 你需要在每次渲染完交易列表后调用 bindTransactionReviewButtons()
// 例如在 renderTransactionList 或 reloadTransactionList 之后调用
// ... existing code ... 

// === 全局兜底事件监听，保证查看截图按钮一定有反应 ===
document.body.addEventListener('click', function(e) {
    const btn = e.target.closest('.btn-view-proof');
    if (btn) {
        const proofUrl = btn.dataset.proof;
        if (proofUrl) {
            showImagePreview(proofUrl);
        } else {
            alert('未找到凭证图片URL');
        }
    }
}, true); 

// 动态更新顶部交易审核红点徽章
async function updateNavTransactionsBadge() {
  try {
    const res = await fetch('/api/transactions/pending/count', {
      headers: { 'Authorization': localStorage.getItem('token') || localStorage.getItem('adminToken') }
    });
    const data = await res.json();
    // 交易审核红点
    const badge = document.getElementById('nav-transactions-badge');
    if (badge) {
      if (data.success && data.count > 0) {
        badge.textContent = data.count;
        badge.style.display = '';
      } else {
        badge.style.display = 'none';
      }
    }
    // 客服未读红点
    const csBadge = document.getElementById('unread-messages-badge');
    if (csBadge) {
      if (data.success && data.unreadCSCount > 0) {
        csBadge.textContent = data.unreadCSCount;
        csBadge.style.display = '';
      } else {
        csBadge.style.display = 'none';
      }
    }
    // 音效逻辑保持不变
    if (badge && csBadge) {
      if (lastPendingCount === 0 && (data.count > 0 || data.unreadCSCount > 0)) {
        if (data.unreadCSCount > 0) {
          playNotifySound(1);
          alert('有新的客服未读消息！');
        } else if (data.count > 0) {
          playNotifySound(3);
          alert('有新的充值/提现待审核！');
        }
      }
      lastPendingCount = (data.count || 0) + (data.unreadCSCount || 0);
    }
  } catch (e) {}
}

document.addEventListener('DOMContentLoaded', () => {
  updateNavTransactionsBadge();
  setInterval(updateNavTransactionsBadge, 30000); // 每30秒自动刷新
});

function playNotifySound(times = 3) {
  const audio = document.getElementById('notify-audio');
  if (audio) {
    let count = 0;
    function play() {
      audio.currentTime = 0;
      audio.play().catch(() => {});
      count++;
      if (count < times) {
        setTimeout(play, 300);
      }
    }
    play();
  }
} 
