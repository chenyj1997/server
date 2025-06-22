/**
 * 通知管理器模块
 * 负责处理系统通知的显示和管理
 */
const notificationManager = {
    // 初始化状态标记
    _initialized: false,
    
    // 初始化通知页面
    init() {
        // 防止重复初始化
        if (this._initialized) {
            console.log('通知管理器已经初始化，跳过重复初始化');
            return;
        }
        
        this.removeEventListeners(); // 先移除已有的事件监听器
        this.addEventListeners();
        this.refreshAllNotifications();
        this._initialized = true; // 标记为已初始化
        console.log('通知管理器初始化完成');
    },

    // 初始化通知页面（供外部调用）
    async initNotificationPage() {
        // 如果已经初始化，只刷新数据
        if (this._initialized) {
            console.log('通知管理器已初始化，只刷新数据');
            await this.refreshAllNotifications();
            return;
        }
        
        this.init();
    },

    // 加载通知列表
    async loadNotifications() {
        try {
            if (window.ui) window.ui.showLoading('加载通知列表...');

            const token = localStorage.getItem('token');
            if (!token) {
                console.warn('未登录或登录已过期，跳过通知加载');
                return;
            }

            // 修改查询参数，使用字符串类型
            const response = await fetch(`/api/admin/notifications/list?type=SYSTEM`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.warn('获取通知列表失败:', errorData.message);
                // 不显示错误提示，因为通知可能不是必需的
                return;
            }

            const data = await response.json();

            // 过滤系统通知
            const systemNotifications = data.data.filter(notification => notification.type === 'SYSTEM');

            this.renderNotificationList(systemNotifications || []);

        } catch (error) {
            console.warn('加载通知列表异常：', error);
            // 不显示错误提示，因为通知可能不是必需的
        } finally {
            if (window.ui) window.ui.hideLoading();
        }
    },
    
    // 渲染通知列表
    renderNotificationList(notifications) {
        const container = document.getElementById('notification-list');
        if (!container) {
            return;
        }

        // 过滤掉交易相关的通知类型
        const systemNotifications = notifications.filter(notification => {
            const transactionTypes = ['RECHARGE', 'WITHDRAW', 'TRANSFER', 'REPAY', 'recharge', 'withdraw', 'transfer', 'purchase', 'repay'];
            return !transactionTypes.includes(notification.type);
        });

        if (!systemNotifications || systemNotifications.length === 0) {
            container.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">暂无系统通知</td></tr>';
            return;
        }

        container.innerHTML = systemNotifications.map(notification => `
            <tr>
                <td>${notification.title}</td>
                <td>${this.getTypeText(notification.type)}</td>
                <td>
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" 
                            ${notification.status === 'ACTIVE' ? 'checked' : ''} 
                            onchange="notificationManager.updateNotificationStatus('${notification._id}', this.checked)">
                        <label class="form-check-label">${notification.status === 'ACTIVE' ? '已发布' : '草稿'}</label>
                    </div>
                </td>
                <td>${new Date(notification.createdAt).toLocaleString()}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="notificationManager.editNotification('${notification._id}')">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-success" onclick="notificationManager.sendNotification('${notification._id}')">
                            <i class="bi bi-send"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="notificationManager.deleteNotification('${notification._id}')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    },
    
    // 获取通知类型文本
    getTypeText(type) {
        const typeMap = {
            'SYSTEM': '系统通知',
            'PAYMENT': '支付通知',
            'INCOME': '收入通知',
            'TRANSACTION': '交易通知'
        };
        return typeMap[type] || type;
    },
    
    // 移除事件监听器
    removeEventListeners() {
        const addButton = document.getElementById('btn-new-notification');
        const saveButton = document.getElementById('btn-save-notification');
        
        if (addButton) {
            const newHandler = addButton.getAttribute('data-handler');
            if (newHandler) {
                addButton.removeEventListener('click', window[newHandler]);
                addButton.removeAttribute('data-handler');
            }
        }
        
        if (saveButton) {
            const saveHandler = saveButton.getAttribute('data-handler');
            if (saveHandler) {
                saveButton.removeEventListener('click', window[saveHandler]);
                saveButton.removeAttribute('data-handler');
            }
        }
    },
    
    // 添加事件监听器
    addEventListeners() {
        // 添加新通知按钮
        const addButton = document.getElementById('btn-new-notification');
        if (addButton) {
            // 创建新的处理函数
            const newHandler = () => {
                // 重置表单
                const form = document.getElementById('notification-form');
                if (form) {
                    form.reset();
                }
                
                // 清除隐藏的ID字段
                const idInput = document.getElementById('notification-id');
                if (idInput) {
                    idInput.value = '';
                }
                
                // 显示模态框
                const modal = new bootstrap.Modal(document.getElementById('notification-modal'));
                modal.show();
            };

            // 存储处理函数引用
            const handlerName = 'notificationNewHandler_' + Date.now();
            window[handlerName] = newHandler;
            addButton.setAttribute('data-handler', handlerName);
            
            // 添加事件监听器
            addButton.addEventListener('click', newHandler);
        }

        // 保存通知按钮
        const saveButton = document.getElementById('btn-save-notification');
        if (saveButton) {
            // 创建新的处理函数
            const saveHandler = () => this.saveNotification();
            
            // 存储处理函数引用
            const handlerName = 'notificationSaveHandler_' + Date.now();
            window[handlerName] = saveHandler;
            saveButton.setAttribute('data-handler', handlerName);
            
            // 添加事件监听器
            saveButton.addEventListener('click', saveHandler);
        }
    },
    
    // 保存通知
    async saveNotification() {
        try {
            // 获取表单数据
            const form = document.getElementById('notification-form');
            if (!form) {
                if (window.ui) window.ui.showError('找不到通知表单');
                return;
            }

            const title = document.getElementById('notification-title').value.trim();
            const content = document.getElementById('notification-content').value.trim();
            const type = document.getElementById('notification-type').value;
            const isActive = document.getElementById('notification-active')?.checked || false;
            const id = document.getElementById('notification-id').value;

            // 详细的表单验证
            if (!title) {
                if (window.ui) window.ui.showError('请输入通知标题');
                return;
            }
            if (!content) {
                if (window.ui) window.ui.showError('请输入通知内容');
                return;
            }
            if (!type) {
                if (window.ui) window.ui.showError('请选择通知类型');
                return;
            }

            if (window.ui) window.ui.showLoading('保存中...');

            // 获取认证令牌
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('未登录或登录已过期，请重新登录');
            }

            const notificationData = {
                title,
                content,
                type,
                status: isActive ? 'ACTIVE' : 'ARCHIVED'  // 修改状态值：已发布/草稿
            };

            console.log('准备保存的通知数据：', notificationData);

            const url = id ? `/api/notifications/${id}` : '/api/notifications';
            const method = id ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(notificationData)
            });

            const result = await response.json();
            console.log('保存通知响应：', result);

            if (!response.ok) {
                throw new Error(result.message || '保存失败，请检查网络连接');
            }

            // 关闭模态框
            const modal = bootstrap.Modal.getInstance(document.getElementById('notification-modal'));
            if (modal) modal.hide();

            // 重新加载通知列表
            await this.loadNotifications();

            if (window.ui) window.ui.showSuccess(result.message || '保存成功');

        } catch (error) {
            console.error('保存通知失败:', error);
            if (window.ui) {
                if (error.message.includes('未登录')) {
                    window.ui.showError('登录已过期，请重新登录');
                } else if (error.message.includes('网络')) {
                    window.ui.showError('网络连接失败，请检查网络设置');
                } else {
                    window.ui.showError('保存失败: ' + error.message);
                }
            }
        } finally {
            if (window.ui) window.ui.hideLoading();
        }
    },
    
    // 编辑通知
    async editNotification(id) {
        try {
            if (window.ui) window.ui.showLoading('加载中...');

            const response = await fetch(`/api/notifications/${id}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '获取通知详情失败');
            }

            const notification = await response.json();

            // 填充表单
            document.getElementById('notification-id').value = notification._id;
            document.getElementById('notification-title').value = notification.title;
            document.getElementById('notification-content').value = notification.content;
            document.getElementById('notification-type').value = notification.type;
            document.getElementById('notification-active').checked = notification.status === 'ACTIVE';

            // 显示模态框
            const modal = new bootstrap.Modal(document.getElementById('notification-modal'));
            modal.show();

        } catch (error) {
            if (window.ui) window.ui.showError('获取通知详情失败: ' + error.message);
        } finally {
            if (window.ui) window.ui.hideLoading();
        }
    },
    
    // 发送通知
    async sendNotification(id) {
        if (!confirm('确定要发送这条通知吗？')) return;
        
        try {
            if (window.ui) window.ui.showLoading('发送中...');
            
            const response = await fetch(`/api/notifications/${id}/send`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('发送通知失败');
            }
            
            await this.loadNotifications();
            if (window.ui) window.ui.showSuccess('通知发送成功');
            
        } catch (error) {
            if (window.ui) window.ui.showError('发送通知失败');
        } finally {
            if (window.ui) window.ui.hideLoading();
        }
    },
    
    // 删除通知
    async deleteNotification(id) {
        if (!confirm('确定要删除这条通知吗？此操作不可恢复。')) return;
        
        try {
            if (window.ui) window.ui.showLoading('删除中...');
            
            // 获取认证令牌
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('未登录或登录已过期，请重新登录');
            }
            
            const response = await fetch(`/api/notifications/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '删除通知失败');
            }
            
            // 重新加载通知列表
            await this.loadNotifications();
            
            if (window.ui) window.ui.showSuccess('删除成功');
            
        } catch (error) {
            if (window.ui) window.ui.showError('删除失败: ' + error.message);
        } finally {
            if (window.ui) window.ui.hideLoading();
        }
    },
    
    // 更新通知状态
    async updateNotificationStatus(id, status) {
        try {
            if (window.ui) window.ui.showLoading('更新中...');

            // 修改请求URL和方法，使用 PUT /api/notifications/:id
            const response = await fetch(`/api/notifications/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                // 只发送 status 字段
                body: JSON.stringify({ 
                    status: status ? 'ACTIVE' : 'ARCHIVED'  // 修改状态值：已发布/草稿
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '更新状态失败');
            }

            // 重新加载通知列表
            await this.loadNotifications();

            if (window.ui) window.ui.showSuccess('更新成功');

        } catch (error) {
            if (window.ui) window.ui.showError('更新失败: ' + error.message);
        } finally {
            if (window.ui) window.ui.hideLoading();
        }
    },
    
    // 应用搜索和过滤
    async applyFilters() {
        try {
            if (window.ui) window.ui.showLoading('搜索中...');

            const searchTerm = document.getElementById('notification-search').value;
            const typeFilter = document.getElementById('notification-type-filter').value;
            const statusFilter = document.getElementById('notification-status-filter').value;

            // 定义需要排除的交易通知类型
            const transactionTypesToExclude = ['RECHARGE', 'WITHDRAW', 'TRANSFER', 'REPAY', 'recharge', 'withdraw', 'transfer', 'purchase', 'repay', 'transaction']; // 添加 'transaction' 类型

            // 如果选择了交易通知类型，只显示交易通知
            if (typeFilter === 'TRANSACTION') {
                 // 在这里加载交易通知，并且不需要排除任何类型
                await this.refreshTransactionNotifications();
                return;
            }

            const queryParams = new URLSearchParams();
            if (searchTerm) queryParams.set('search', searchTerm);
            if (typeFilter) queryParams.set('type', typeFilter);
            if (statusFilter) queryParams.set('status', statusFilter);

            // 在应用过滤器时，也排除交易通知类型
            transactionTypesToExclude.forEach(type => queryParams.append('excludeTypes', type));

            const response = await fetch(`/api/notifications/list?${queryParams.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error('搜索通知失败');
            }

            const data = await response.json();
             // 前端也做一次过滤作为保险
            const systemNotifications = data.data.filter(notification => !transactionTypesToExclude.includes(notification.type));
            this.renderNotificationList(systemNotifications || []);

        } catch (error) {
            if (window.ui) window.ui.showError('搜索失败: ' + error.message);
        } finally {
            if (window.ui) window.ui.hideLoading();
        }
    },
    
    // 重置过滤器
    resetFilters() {
        // 重置搜索框
        const searchInput = document.getElementById('notification-search');
        if (searchInput) searchInput.value = '';
        
        // 重置类型过滤器
        const typeFilter = document.getElementById('notification-type-filter');
        if (typeFilter) typeFilter.value = '';
        
        // 重置状态过滤器
        const statusFilter = document.getElementById('notification-status-filter');
        if (statusFilter) statusFilter.value = '';
        
        // 重新加载通知列表
        this.loadNotifications();
    },

    // REMOVE: Commenting out setupAutoNotifications as notifications are being removed.
    // setupAutoNotifications() {
    //     // 监听交易状态变化
    //     document.addEventListener('transactionStatusChanged', async (event) => {
    //         const { transactionId, type, status } = event.detail;
    //         if (status === 'COMPLETED') {
    //             // 先创建通知
    //             // await this.createTransactionNotification(transactionId, type);
    //             // 刷新通知列表
    //             // await this.refreshTransactionNotifications();
    //         }
    //     });

    //     // 监听系统事件
    //     document.addEventListener('systemEvent', async (event) => {
    //         const { type, data } = event.detail;
    //         switch (type) {
    //             case 'TRANSACTION_COMPLETED':
    //                 // await this.createTransactionNotification(data.transactionId, data.type);
    //                 // await this.refreshTransactionNotifications();
    //                 break;
    //             case 'INFO_PURCHASED':
    //                 // await this.createSystemNotification('INFO_PURCHASED', data);
    //                 // await this.loadNotifications();
    //                 break;
    //             case 'INFO_REPAID':
    //                 // await this.createSystemNotification('INFO_REPAID', data);
    //                 // await this.loadNotifications();
    //                 break;
    //         }
    //     });
    // },

    // REMOVE: Commenting out createTransactionNotification as notifications are being removed.
    // async createTransactionNotification(transactionId, type) {
    //     try {
    //         const token = localStorage.getItem('token');
    //         if (!token) {
    //             throw new Error('未登录或登录已过期');
    //         }

    //         const response = await fetch('/api/admin/transactions/notifications', {
    //             method: 'POST',
    //             headers: {
    //                 'Authorization': `Bearer ${token}`,
    //                 'Content-Type': 'application/json'
    //             },
    //             body: JSON.stringify({
    //                 transactionId,
    //                 type
    //             })
    //         });

    //         if (!response.ok) {
    //             const errorData = await response.json();
    //             throw new Error(errorData.message || '创建交易通知失败');
    //         }

    //         const result = await response.json();
    //         if (result.success) {
    //             // 通知创建成功后，自动发送给用户
    //             // await this.sendTransactionNotification(transactionId, type);
    //         }
    //     } catch (error) {
    //         // console.error('前端创建交易通知失败:', error);
    //     }
    // },

    // REMOVE: Commenting out createSystemNotification as notifications are being removed.
    // async createSystemNotification(type, data) {
    //     try {
    //         const token = localStorage.getItem('token');
    //         if (!token) {
    //             throw new Error('未登录或登录已过期');
    //         }

    //         const response = await fetch('/api/notifications', {
    //             method: 'POST',
    //             headers: {
    //                 'Authorization': `Bearer ${token}`,
    //                 'Content-Type': 'application/json'
    //             },
    //             body: JSON.stringify({
    //                 type,
    //                 title: this.getNotificationTitle(type),
    //                 content: this.getNotificationContent(type, data),
    //                 status: 'ACTIVE'
    //             })
    //         });

    //         if (!response.ok) {
    //             const errorData = await response.json();
    //             throw new Error(errorData.message || '创建系统通知失败');
    //         }

    //         const result = await response.json();
    //         if (result.success) {
    //             // 通知创建成功后，自动发送给用户
    //             // await this.sendSystemNotification(type, data);
    //         }
    //     } catch (error) {
    //         // console.error('前端创建系统通知失败:', error);
    //     }
    // },

    // 获取通知标题
    getNotificationTitle(type) {
        const titleMap = {
            'INFO_PURCHASED': '信息购买通知',
            'INFO_REPAID': '信息还款通知',
            'TRANSACTION_COMPLETED': '交易完成通知'
        };
        return titleMap[type] || '系统通知';
    },

    // 获取通知内容
    getNotificationContent(type, data) {
        switch (type) {
            case 'INFO_PURCHASED':
                return `您已成功购买信息：${data.infoTitle || '未知信息'}`;
            case 'INFO_REPAID':
                return `信息还款成功：${data.infoTitle || '未知信息'}，金额：¥${data.amount?.toFixed(2) || '0.00'}`;
            case 'TRANSACTION_COMPLETED':
                return `交易已完成：${this.getTransactionTypeText(data.type)}，金额：¥${data.amount?.toFixed(2) || '0.00'}`;
            default:
                return '系统通知';
        }
    },

    // 渲染交易通知列表
    renderTransactionNotifications(notifications) {
        const container = document.getElementById('transaction-notifications');
        if (!container) {
            return;
        }

        if (!notifications || notifications.length === 0) {
            container.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">暂无交易通知</td></tr>';
            return;
        }

        container.innerHTML = notifications.map(notification => {
            // 对于还款类型的通知，显示收益方（receiveAccount）的信息
            let displayUser;
            if (notification.type === 'repay') {
                displayUser = notification.payeeUsername || '未知收款方'; // Use the new backend-provided field
            } else {
                displayUser = notification.user?.username || '未知用户'; // Existing logic for other types
            }

            const isExpense = ['withdraw', 'purchase'].includes(String(notification.type).toLowerCase());
            const amountDisplay = isExpense ? `-` : `+`;
            const amountColor = isExpense ? 'text-danger' : 'text-success';

            return `
                <tr>
                    <td>${this.getTransactionTypeText(notification.type)}</td>
                    <td>${displayUser}</td>
                    <td class="${amountColor}">${amountDisplay}¥${notification.amount.toFixed(2)}</td>
                    <td>${new Date(notification.createdAt).toLocaleString()}</td>
                    <td>
                        <span class="badge ${notification.notificationSent ? 'bg-success' : 'bg-secondary'}">
                            ${notification.notificationSent ? '已通知' : '未通知'}
                        </span>
                        ${!notification.notificationSent ? `
                            <button class="btn btn-outline-primary btn-sm ms-2" onclick="notificationManager.sendTransactionNotification('${notification._id}', '${notification.type}')">
                                <i class="bi bi-send"></i> 发送
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `;
        }).join('');
    },

    // 获取交易类型文本
    getTransactionTypeText(type) {
        const typeMap = {
            'RECHARGE': '充值',
            'WITHDRAW': '提现',
            'TRANSFER': '转账',
            'REPAY': '收益',
            'recharge': '充值',
            'withdraw': '提现',
            'transfer': '转账',
            'purchase': '购买',
            'repay': '收益',
            'REFERRAL_COMMISSION': '推荐返利',
            'SALE_PROCEEDS': '销售收款'
        };
        return typeMap[type] || type;
    },

    // 查看交易详情
    async viewTransactionDetail(id) {
        try {
            if (window.ui) window.ui.showLoading('加载交易详情...');
            
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('未登录或登录已过期');
            }

            const response = await fetch(`/api/admin/transactions/${id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('获取交易详情失败');
            }

            const transaction = await response.json();
            
            // 显示交易详情模态框
            const modal = new bootstrap.Modal(document.getElementById('transaction-detail-modal'));
            document.getElementById('transaction-detail-content').innerHTML = `
                <div class="mb-3">
                    <label class="form-label fw-bold">交易类型</label>
                    <p>${this.getTransactionTypeText(transaction.type)}</p>
                </div>
                <div class="mb-3">
                    <label class="form-label fw-bold">用户</label>
                    <p>${transaction.user?.username || '未知用户'}</p>
                </div>
                <div class="mb-3">
                    <label class="form-label fw-bold">金额</label>
                    <p>¥${transaction.amount.toFixed(2)}</p>
                </div>
                <div class="mb-3">
                    <label class="form-label fw-bold">状态</label>
                    <p>${this.getTransactionStatusText(transaction.status)}</p>
                </div>
                <div class="mb-3">
                    <label class="form-label fw-bold">创建时间</label>
                    <p>${new Date(transaction.createdAt).toLocaleString()}</p>
                </div>
                ${transaction.remark ? `
                <div class="mb-3">
                    <label class="form-label fw-bold">备注</label>
                    <p>${transaction.remark}</p>
                </div>
                ` : ''}
            `;
            modal.show();

        } catch (error) {
            if (window.ui) window.ui.showError('获取交易详情失败');
        } finally {
            if (window.ui) window.ui.hideLoading();
        }
    },

    // 处理交易
    async processTransaction(id) {
        if (!confirm('确定要处理这笔交易吗？')) return;

        try {
            if (window.ui) window.ui.showLoading('处理中...');
            
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('未登录或登录已过期');
            }

            const response = await fetch(`/api/notifications/transactions/${id}/process`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('处理交易失败');
            }

            // 重新加载交易通知列表
            await this.refreshTransactionNotifications();
            
            if (window.ui) window.ui.showSuccess('交易处理成功');

        } catch (error) {
            if (window.ui) window.ui.showError('处理交易失败');
        } finally {
            if (window.ui) window.ui.hideLoading();
        }
    },

    // 获取交易状态文本
    getTransactionStatusText(status) {
        const statusMap = {
            'PENDING': '待处理',
            'PROCESSING': '处理中',
            'COMPLETED': '已完成',
            'FAILED': '失败',
            'CANCELLED': '已取消'
        };
        return statusMap[status] || status;
    },

    // 刷新交易通知
    async refreshTransactionNotifications() {
        try {
            if (window.ui) window.ui.showLoading('加载交易通知...');
            
            const token = localStorage.getItem('token');
            if (!token) {
                console.warn('未登录或登录已过期，跳过交易通知加载');
                return;
            }

            const response = await fetch('/api/admin/transactions/notifications', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                console.warn('获取交易通知失败');
                return;
            }

            const data = await response.json();
            this.renderTransactionNotifications(data.data || []);

        } catch (error) {
            console.warn('加载交易通知失败:', error);
            // 不显示错误提示，因为通知可能不是必需的
        } finally {
            if (window.ui) window.ui.hideLoading();
        }
    },

    // 发布多个通知
    async publishMultipleNotifications(id) {
        if (!confirm('确定要发布3条相同的通知吗？')) return;
        
        try {
            if (window.ui) window.ui.showLoading('发布中...');
            
            const response = await fetch(`/api/notifications/${id}/publish-multiple`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ count: 3 })
            });
            
            if (!response.ok) {
                throw new Error('发布通知失败');
        }
            
            const result = await response.json();
            
            // 重新加载通知列表
            await this.loadNotifications();
            
            if (window.ui) window.ui.showSuccess(result.message || '发布成功');
            
        } catch (error) {
            if (window.ui) window.ui.showError('发布失败: ' + error.message);
        } finally {
            if (window.ui) window.ui.hideLoading();
        }
    },

    // 发送交易通知
    async sendTransactionNotification(transactionId, transactionType) {
        if (!confirm(`确定要向关联用户发送此${this.getTransactionTypeText(transactionType)}交易的通知吗？`)) return;

        try {
            // 获取认证令牌
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('未登录或登录已过期，请重新登录');
            }

            // 调用后端发送通知的API
            const response = await fetch(`/api/admin/transactions/${transactionId}/send-notification`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ type: transactionType })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `发送通知失败，状态码: ${response.status}`);
            }

            const data = await response.json();
            if (data.success) {
                // 发送成功后刷新交易通知列表
                await this.refreshTransactionNotifications();
            } else {
                if (window.ui) window.ui.showError(data.message || '通知发送失败');
            }

        } catch (error) {
            if (window.ui) window.ui.showError('发送通知失败: ' + error.message);
        }
    },

    // 发送系统通知
    async sendSystemNotification(type, data) {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('未登录或登录已过期');
            }

            const response = await fetch('/api/notifications/system', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type,
                    data
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '发送系统通知失败');
            }

            const result = await response.json();
            if (result.success) {
            }
        } catch (error) {
        }
    },

    // 刷新所有通知
    async refreshAllNotifications() {
        try {
            if (window.ui) window.ui.showLoading('加载通知...');
            await Promise.all([
                this.loadNotifications(),
                this.refreshTransactionNotifications()
            ]);
        } catch (error) {
            if (window.ui) window.ui.showError('刷新通知失败');
        } finally {
            if (window.ui) window.ui.hideLoading();
        }
    }
};

// 将通知管理器对象添加到全局作用域
window.notificationManager = notificationManager;

// 移除自动初始化，改为手动调用
// document.addEventListener('DOMContentLoaded', () => {
//     notificationManager.init();
// }); 
