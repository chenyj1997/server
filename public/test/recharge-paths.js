// server/public/js/admin/recharge-paths.js

import { showSuccess, showError, showLoading, hideLoading } from '../utils/ui.js'; // 引入 UI 工具函数

// 获取充值路径列表
export async function getRechargePaths() {
    try {
        showLoading('加载充值路径中...');
        const token = localStorage.getItem('adminToken'); // 修改为 adminToken
        if (!token) {
            throw new Error('管理员未登录');
        }

        const response = await fetch('/api/recharge-paths/list', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        hideLoading();

        if (!response.ok) {
            throw new Error(data.message || '获取充值路径列表失败');
        }

        console.log('前端：获取充值路径列表成功:', data.data);
        return data.data;
    } catch (error) {
        hideLoading();
        console.error('前端：调用获取充值路径列表 API 失败:', error);
        showError('获取充值路径列表失败: ' + error.message);
        throw error;
    }
}

// 渲染充值路径列表
export function renderRechargePathsList(paths) {
    console.log('开始渲染充值路径列表...');
    console.log('传入的路径数据:', paths);
    
    const listContainer = document.getElementById('recharge-paths-list-container');
    console.log('找到的列表容器元素:', listContainer);
    
    if (!listContainer) {
        console.error('未找到充值路径列表容器 #recharge-paths-list-container');
        return;
    }

    // 清空现有内容
    listContainer.innerHTML = '';

    if (paths && paths.length > 0) {
        console.log(`渲染 ${paths.length} 条充值路径记录`);
        const ul = document.createElement('ul');
        ul.className = 'list-group';
        ul.id = 'recharge-paths-ul';

        paths.forEach((path, index) => {
            console.log(`渲染第 ${index + 1} 条记录:`, path);
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            li.innerHTML = `
                <div>
                    ${path.icon ? `<img src="${path.icon}" alt="图标" style="width: 30px; height: 30px; margin-right: 10px;">` : ''}
                    <span>${path.name} - ${path.account} - ${path.receiver}</span>
                </div>
                <div>
                    <button class="btn btn-sm btn-primary me-2 btn-edit-path" data-id="${path._id}">编辑</button>
                    <button class="btn btn-sm btn-danger btn-delete-path" data-id="${path._id}">删除</button>
                </div>
            `;
            ul.appendChild(li);
        });

        listContainer.appendChild(ul);

        // 为编辑和删除按钮添加事件监听
        ul.querySelectorAll('.btn-edit-path').forEach(button => {
            button.addEventListener('click', handleEditPath);
        });
        ul.querySelectorAll('.btn-delete-path').forEach(button => {
            button.addEventListener('click', handleDeletePath);
        });
    } else {
        console.log('没有充值路径记录，显示空状态');
        listContainer.innerHTML = '<div class="text-center">暂无充值路径</div>';
    }
}

// 处理编辑按钮点击
async function handleEditPath(event) {
    const pathId = event.target.dataset.id;
    try {
        const token = localStorage.getItem('adminToken');
        if (!token) {
            throw new Error('管理员未登录');
        }

        const response = await fetch(`/api/recharge-paths/${pathId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();
        if (result.success) {
            // 填充表单
            const form = document.getElementById('recharge-path-form');
            form.querySelector('#recharge-path-id').value = pathId;
            form.querySelector('#recharge-path-name').value = result.data.name;
            form.querySelector('#recharge-path-type').value = result.data.type;
            form.querySelector('#recharge-path-account').value = result.data.account;
            form.querySelector('#recharge-path-receiver').value = result.data.receiver;

            // 显示图标预览
            const iconPreview = document.getElementById('icon-preview');
            if (iconPreview && result.data.icon) {
                iconPreview.innerHTML = `<img src="${result.data.icon}" alt="图标预览" style="max-width: 100px;">`;
            }

            // 显示二维码预览
            const qrcodePreview = document.getElementById('qrcode-preview');
            if (qrcodePreview && result.data.qrcode) {
                qrcodePreview.innerHTML = `<img src="${result.data.qrcode}" alt="二维码预览" style="max-width: 200px;">`;
            }

            // 关闭列表模态框
            const listModal = bootstrap.Modal.getInstance(document.getElementById('recharge-paths-list-modal'));
            if (listModal) listModal.hide();

            // 打开编辑模态框
            const editModal = new bootstrap.Modal(document.getElementById('recharge-path-modal'));
            editModal.show();
        } else {
            throw new Error(result.message || '获取充值路径详情失败');
        }
    } catch (error) {
        console.error('获取充值路径详情失败:', error);
        showError('获取充值路径详情失败: ' + error.message);
    }
}

// 处理删除按钮点击
async function handleDeletePath(event) {
    const pathId = event.target.dataset.id;
    if (confirm('确定要删除这条充值路径吗？')) {
        try {
            const token = localStorage.getItem('adminToken');
            if (!token) {
                throw new Error('管理员未登录');
            }

            const response = await fetch(`/api/recharge-paths/${pathId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();
            if (result.success) {
                showSuccess('充值路径删除成功');
                // 重新加载列表
                const paths = await getRechargePaths();
                renderRechargePathsList(paths);
            } else {
                throw new Error(result.message || '删除失败');
            }
        } catch (error) {
            console.error('删除充值路径失败:', error);
            showError('删除充值路径失败: ' + error.message);
        }
    }
}

// 创建新的充值路径
export async function createRechargePath(formData) {
    try {
        showLoading('保存充值路径中...');
        const token = localStorage.getItem('adminToken');
        if (!token) {
            throw new Error('管理员未登录');
        }

        const response = await fetch('/api/recharge-paths/create', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const data = await response.json();
        hideLoading();

        if (!response.ok) {
            throw new Error(data.message || '保存充值路径失败');
        }

        showSuccess('充值路径保存成功');
        return data;
    } catch (error) {
        hideLoading();
        console.error('前端：调用创建充值路径 API 失败:', error);
        showError('保存充值路径失败: ' + error.message);
        throw error;
    }
}

// 重置充值路径表单
export function resetRechargePathForm() {
    console.log('重置充值路径表单...');
    const form = document.getElementById('recharge-path-form');
    if (form) {
        form.reset();
        // 清除图标和二维码预览
        const iconPreview = document.getElementById('icon-preview');
        if (iconPreview) iconPreview.innerHTML = '';
        const qrcodePreview = document.getElementById('qrcode-preview');
        if (qrcodePreview) qrcodePreview.innerHTML = '';
        
        // 重置隐藏的ID字段
        const rechargePathId = document.getElementById('recharge-path-id');
        if (rechargePathId) rechargePathId.value = '';

        // 更新模态框标题为"添加充值路径"
        const modalTitle = document.getElementById('recharge-path-modal-title');
        if (modalTitle) modalTitle.textContent = '添加充值路径';

        // 确保保存按钮显示为"保存"
        const saveButton = document.getElementById('btn-save-recharge-path');
        if(saveButton) saveButton.textContent = '保存';
    }
}

// 页面初始化函数
function initRechargePathsPage() {
    console.log('初始化充值路径管理页面...');

    // 绑定添加充值路径按钮点击事件
    const addRechargePathBtn = document.getElementById('btn-add-recharge-path');
    if (addRechargePathBtn) {
        addRechargePathBtn.addEventListener('click', async () => {
            try {
                // 加载充值路径列表
                const paths = await getRechargePaths();
                renderRechargePathsList(paths);
                
                // 显示列表模态框
                const listModal = new bootstrap.Modal(document.getElementById('recharge-paths-list-modal'));
                listModal.show();
            } catch (error) {
                console.error('加载充值路径列表失败:', error);
            }
        });
    }

    // 绑定列表模态框中添加新充值路径按钮的事件
    const addNewRechargePathBtn = document.getElementById('btn-add-new-recharge-path-in-list-modal');
    if (addNewRechargePathBtn) {
        addNewRechargePathBtn.addEventListener('click', () => {
            // 关闭列表模态框
            const listModal = bootstrap.Modal.getInstance(document.getElementById('recharge-paths-list-modal'));
            if (listModal) listModal.hide();

            // 重置表单并显示添加模态框
            resetRechargePathForm();
            const addModal = new bootstrap.Modal(document.getElementById('recharge-path-modal'));
            addModal.show();
        });
    }

    // 绑定保存充值路径按钮的事件
    const saveRechargePathBtn = document.getElementById('btn-save-recharge-path');
    if (saveRechargePathBtn) {
        saveRechargePathBtn.addEventListener('click', async () => {
            const form = document.getElementById('recharge-path-form');
            if (!form) return;

            const formData = new FormData(form);
            try {
                await createRechargePath(formData);
                
                // 关闭编辑模态框
                const editModal = bootstrap.Modal.getInstance(document.getElementById('recharge-path-modal'));
                if (editModal) editModal.hide();

                // 重新加载列表
                const paths = await getRechargePaths();
                renderRechargePathsList(paths);
            } catch (error) {
                console.error('保存充值路径失败:', error);
            }
        });
    }

    // 绑定图标上传预览
    const iconInput = document.getElementById('recharge-path-icon');
    if (iconInput) {
        iconInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const iconPreview = document.getElementById('icon-preview');
                    if (iconPreview) {
                        iconPreview.innerHTML = `<img src="${e.target.result}" alt="图标预览" style="max-width: 100px;">`;
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // 绑定二维码上传预览
    const qrcodeInput = document.getElementById('recharge-path-qrcode');
    if (qrcodeInput) {
        qrcodeInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const qrcodePreview = document.getElementById('qrcode-preview');
                    if (qrcodePreview) {
                        qrcodePreview.innerHTML = `<img src="${e.target.result}" alt="二维码预览" style="max-width: 200px;">`;
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

// 在 DOM 加载完成后初始化页面
document.addEventListener('DOMContentLoaded', initRechargePathsPage);