/**
 * 用户钱包相关函数
 */
import { showSuccess, showError, showLoading, hideLoading } from '../utils/ui.js';
import { formatDate, getTransactionType, getTransactionStatus } from '../utils/common.js';

// 获取钱包信息
export async function getWalletInfo() {
    try {
        showLoading('加载中...');
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未登录');
        }

        const response = await fetch('/api/user/wallet', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || '获取钱包信息失败');
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
export async function getTransactionList(page = 1, limit = 10) {
    try {
        showLoading('加载中...');
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未登录');
        }

        const response = await fetch(`/api/user/transactions?page=${page}&limit=${limit}`, {
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

// 创建充值交易
export async function createRecharge(amount, pathId, proofFile) {
    try {
        console.log('创建充值交易:', amount, pathId, proofFile);
        showLoading('处理中...');
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未登录');
        }

        // 使用 FormData 来发送文件和文本数据
        const formData = new FormData();
        formData.append('amount', amount);
        formData.append('pathId', pathId); // 假设前端也需要发送 pathId
        if (proofFile) {
            formData.append('proof', proofFile); // 添加文件，字段名 'proof' 对应后端 upload.single('proof')
        }

        // 注意：使用 FormData 时，Content-Type 会由浏览器自动设置，不需要手动设置 'application/json'
        const response = await fetch('/api/wallet/recharge', { // 确保路径正确
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
                // 不要设置 Content-Type: 'application/json'
            },
            body: formData
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || '创建充值失败');
        }

        showSuccess('充值申请已提交');
        return data;
    } catch (error) {
        showError(error.message);
        throw error;
    } finally {
        hideLoading();
    }
}

// 创建提现交易
export async function createWithdraw(amount) {
    try {
        showLoading('处理中...');
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未登录');
        }

        const response = await fetch('/api/user/withdraw', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ amount })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || '创建提现失败');
        }

        showSuccess('提现申请已提交');
        return data;
    } catch (error) {
        showError(error.message);
        throw error;
    } finally {
        hideLoading();
    }
}

// 渲染钱包信息
export function renderWalletInfo(wallet) {
    const container = document.getElementById('wallet-info');
    if (!container) return;

    container.innerHTML = `
        <div class="card">
            <div class="card-body">
                <h5 class="card-title">钱包余额</h5>
                <h2 class="text-primary">${wallet.balance.toFixed(2)}</h2>
                <div class="mt-3">
                    <button class="btn btn-success me-2" onclick="showRechargeModal()">
                        <i class="fas fa-plus"></i> 充值
                    </button>
                    <button class="btn btn-warning" onclick="showWithdrawModal()">
                        <i class="fas fa-minus"></i> 提现
                    </button>
                </div>
            </div>
        </div>
    `;
}

// 渲染交易记录
export function renderTransactionList(transactions) {
    const tbody = document.querySelector('#transactionTable tbody');
    if (!tbody) return;

    tbody.innerHTML = transactions.map(transaction => `
        <tr>
            <td>${getTransactionType(transaction.type)}</td>
            <td>${transaction.amount.toFixed(2)}</td>
            <td>${getTransactionStatus(transaction.status)}</td>
            <td>${formatDate(transaction.createdAt)}</td>
        </tr>
    `).join('');
}

// 渲染充值模态框
export function renderRechargeModal() {
    const modal = document.getElementById('rechargeModal');
    if (!modal) return;

    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">充值</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <label for="rechargeAmount" class="form-label">充值金额</label>
                        <input type="number" class="form-control" id="rechargeAmount" min="1" step="0.01" required>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                    <button type="button" class="btn btn-primary" onclick="handleRecharge()">确认充值</button>
                </div>
            </div>
        </div>
    `;
}

// 渲染提现模态框
export function renderWithdrawModal() {
    const modal = document.getElementById('withdrawModal');
    if (!modal) return;

    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">提现</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <label for="withdrawAmount" class="form-label">提现金额</label>
                        <input type="number" class="form-control" id="withdrawAmount" min="1" step="0.01" required>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                    <button type="button" class="btn btn-primary" onclick="handleWithdraw()">确认提现</button>
                </div>
            </div>
        </div>
    `;
} 