/**
 * 钱包管理相关函数
 */
import { showSuccess, showError, showLoading, hideLoading } from '../utils/ui.js';
import { formatDate, escapeHtml, getTransactionType, getTransactionStatus } from '../utils/common.js';

// 获取钱包列表
export async function getWalletList(page = 1, limit = 10) {
    try {
        showLoading('加载中...');
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未登录');
        }

        const response = await fetch(`/api/wallets/list?page=${page}&limit=${limit}`, {
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

// 获取交易记录
export async function getTransactionList(walletId, page = 1, limit = 10) {
    try {
        showLoading('加载中...');
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未登录');
        }

        const response = await fetch(`/api/wallets/${walletId}/transactions?page=${page}&limit=${limit}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || '获取交易记录失败');
        }

        return data;
    } catch (error) {
        showError(error.message);
        throw error;
    } finally {
        hideLoading();
    }
}

// 创建交易
export async function createTransaction(walletId, transactionData) {
    try {
        showLoading('处理中...');
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未登录');
        }

        const response = await fetch(`/api/wallets/${walletId}/transactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(transactionData)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || '创建交易失败');
        }

        showSuccess('交易创建成功');
        return data;
    } catch (error) {
        showError(error.message);
        throw error;
    } finally {
        hideLoading();
    }
}

// 获取钱包详情
export async function getWalletDetail(walletId) {
    try {
        showLoading('加载中...');
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未登录');
        }

        const response = await fetch(`/api/wallets/${walletId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || '获取钱包详情失败');
        }

        return data;
    } catch (error) {
        showError(error.message);
        throw error;
    } finally {
        hideLoading();
    }
}

// 渲染钱包列表
export function renderWalletList(walletList) {
    const tbody = document.querySelector('#walletTable tbody');
    if (!tbody) return;

    tbody.innerHTML = walletList.map(wallet => `
        <tr>
            <td>${escapeHtml(wallet.username)}</td>
            <td>${wallet.balance || 0}</td>
            <td>${wallet.frozen || 0}</td>
            <td>${formatDate(wallet.updatedAt)}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editWallet('${wallet._id}')">
                    <i class="bi bi-pencil"></i> 编辑
                </button>
                <button class="btn btn-sm btn-success" onclick="rechargeWallet('${wallet._id}')">
                    <i class="bi bi-cash"></i> 充值
                </button>
            </td>
        </tr>
    `).join('');
}

// 初始化钱包管理页面
export async function initWalletPage() {
    console.log('初始化钱包管理页面');
    try {
        // 每次都强制请求最新数据
        if (typeof window.walletManager.fetchWalletInfo === 'function') {
            window.walletManager.fetchWalletInfo();
        }

        // 加载钱包列表
        const walletData = await getWalletList();
        renderWalletList(walletData.items);

        // 绑定分页事件
        const pagination = document.getElementById('wallet-pagination');
        if (pagination) {
            renderPagination(pagination, walletData.total, walletData.page, walletData.limit);
        }

        // 绑定搜索和筛选事件
        const searchInput = document.getElementById('wallet-search');
        if (searchInput) {
            searchInput.addEventListener('input', debounce(async (e) => {
                const searchTerm = e.target.value;
                try {
                    const walletData = await getWalletList(1, 10, { search: searchTerm });
                    renderWalletList(walletData.items);
                    renderPagination(pagination, walletData.total, walletData.page, walletData.limit);
                } catch (error) {
                    console.error('搜索钱包失败:', error);
                }
            }, 300));
        }

        // 绑定刷新按钮
        const refreshBtn = document.getElementById('btn-refresh-wallet');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                try {
                    const walletData = await getWalletList();
                    renderWalletList(walletData.items);
                    renderPagination(pagination, walletData.total, walletData.page, walletData.limit);
                    showSuccess('刷新成功');
                } catch (error) {
                    console.error('刷新钱包列表失败:', error);
                }
            });
        }

        // 绑定充值按钮
        const rechargeBtn = document.getElementById('btn-recharge-wallet');
        if (rechargeBtn) {
            rechargeBtn.addEventListener('click', () => {
                const modal = new bootstrap.Modal(document.getElementById('recharge-modal'));
                modal.show();
            });
        }

        // 绑定充值表单提交事件
        const rechargeForm = document.getElementById('recharge-form');
        if (rechargeForm) {
            rechargeForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(rechargeForm);
                const rechargeData = {
                    amount: parseFloat(formData.get('amount')),
                    description: formData.get('description')
                };
                try {
                    await createTransaction('current', rechargeData);
                    // 重新加载钱包列表
                    const newWalletData = await getWalletList();
                    renderWalletList(newWalletData.items);
                    renderPagination(pagination, newWalletData.total, newWalletData.page, newWalletData.limit);
                    // 关闭模态框
                    const modal = bootstrap.Modal.getInstance(document.getElementById('recharge-modal'));
                    if (modal) modal.hide();
                } catch (error) {
                    console.error('充值失败:', error);
                }
            });
        }

        console.log('钱包管理页面初始化完成');
    } catch (error) {
        console.error('初始化钱包管理页面失败:', error);
        showError('加载钱包列表失败: ' + error.message);
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
                    const walletData = await getWalletList(page, limit);
                    renderWalletList(walletData.items);
                    renderPagination(element, walletData.total, page, limit);
                } catch (error) {
                    console.error('加载钱包列表失败:', error);
                    showError('加载钱包列表失败: ' + error.message);
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

// 渲染交易记录
export function renderTransactionList(transactionList) {
    const tbody = document.querySelector('#transactionTable tbody');
    if (!tbody) return;

    tbody.innerHTML = transactionList.map(transaction => `
        <tr>
            <td>${getTransactionType(transaction.type)}</td>
            <td>${transaction.amount.toFixed(2)}</td>
            <td>${getTransactionStatus(transaction.status)}</td>
            <td>${formatDate(transaction.createdAt)}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="viewTransaction('${transaction._id}')">
                    <i class="fas fa-eye"></i> 查看
                </button>
                ${transaction.status === 'pending' ? `
                    <button class="btn btn-sm btn-success" onclick="approveTransaction('${transaction._id}')">
                        <i class="fas fa-check"></i> 通过
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="rejectTransaction('${transaction._id}')">
                        <i class="fas fa-times"></i> 拒绝
                    </button>
                ` : ''}
            </td>
        </tr>
    `).join('');
}

// 钱包管理模块
document.addEventListener('DOMContentLoaded', function() {
    // 初始化钱包管理页面
    initWalletPage();
});

// 加载交易列表
function loadTransactions() {
    // 这里添加加载交易列表的代码
}

// 处理充值请求
function handleRechargeRequest(requestId, action) {
    // 这里添加处理充值请求的代码
} 