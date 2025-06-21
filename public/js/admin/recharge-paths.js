// server/public/js/admin/recharge-paths.js

// 获取充值路径列表
async function getRechargePaths() {
    try {
        if (window.ui && window.ui.showLoading) {
            window.ui.showLoading('加载充值路径中...');
        }
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('用户未登录');
        }

        const response = await fetch('/api/recharge-paths/paths', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (window.ui && window.ui.hideLoading) {
            window.ui.hideLoading();
        }

        if (!response.ok) {
            throw new Error(data.message || '获取充值路径列表失败');
        }

        console.log('前端：获取充值路径列表成功:', data.data);
        return data.data;
    } catch (error) {
        if (window.ui && window.ui.hideLoading) {
            window.ui.hideLoading();
        }
        console.error('前端：调用获取充值路径列表 API 失败:', error);
        if (window.ui && window.ui.showError) {
            window.ui.showError('获取充值路径列表失败: ' + error.message);
        }
        throw error;
    }
}

// 渲染充值路径列表
function renderRechargePathsList(paths) {
    console.log('开始渲染充值路径列表...');
    console.log('传入的路径数据:', paths);
    
    const listContainer = document.getElementById('recharge-paths-ul');
    console.log('找到的列表容器元素:', listContainer);
    
    if (!listContainer) {
        console.error('未找到充值路径列表容器 #recharge-paths-ul');
        // 尝试等待DOM加载完成
        setTimeout(() => {
            const retryListContainer = document.getElementById('recharge-paths-ul');
            if (retryListContainer) {
                console.log('重试成功，找到列表容器');
                renderListContent(retryListContainer, paths);
            } else {
                console.error('重试后仍未找到列表容器');
            }
        }, 100);
        return;
    }

    renderListContent(listContainer, paths);
}

// 渲染列表内容
function renderListContent(listContainer, paths) {
    console.log('开始渲染列表内容...');
    listContainer.innerHTML = ''; // 清空现有内容

    if (paths && paths.length > 0) {
        console.log(`渲染 ${paths.length} 条充值路径记录`);
        paths.forEach((path, index) => {
            console.log(`渲染第 ${index + 1} 条记录:`, path);
            
            // 创建 list-group-item
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
            
            // 构建显示内容
            const displayContent = document.createElement('div');
            displayContent.innerHTML = `
                <div>
                    ${path.icon ? `<img src="${path.icon}" alt="图标" style="width: 30px; height: 30px; margin-right: 10px;">` : ''}
                    <span>${path.name || '未命名'} - ${path.account || '无账号'} - ${path.receiver || '无收款人'}</span>
                </div>
            `;
            
            // 构建操作按钮
            const actionButtons = document.createElement('div');
            actionButtons.innerHTML = `
                <button class="btn btn-sm btn-primary me-2 btn-edit-path" data-id="${path._id}">编辑</button>
                <button class="btn btn-sm btn-danger btn-delete-path" data-id="${path._id}">删除</button>
            `;
            
            listItem.appendChild(displayContent);
            listItem.appendChild(actionButtons);
            listContainer.appendChild(listItem);
        });

        // 为编辑和删除按钮添加事件监听
        listContainer.querySelectorAll('.btn-edit-path').forEach(button => {
            button.addEventListener('click', handleEditPath);
        });
        listContainer.querySelectorAll('.btn-delete-path').forEach(button => {
            button.addEventListener('click', handleDeletePath);
        });
    } else {
        console.log('没有充值路径记录，显示空状态');
        listContainer.innerHTML = '<li class="list-group-item text-center">暂无充值路径</li>';
    }
}

// 处理编辑按钮点击
async function handleEditPath(event) {
    const pathId = event.target.dataset.id;
    // TODO: 实现编辑功能
    console.log('编辑充值路径:', pathId);
}

// 处理删除按钮点击
async function handleDeletePath(event) {
    const pathId = event.target.dataset.id;
    if (confirm('确定要删除这条充值路径吗？')) {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('用户未登录');
            }

            const response = await fetch(`/api/recharge-paths/${pathId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                if (window.ui && window.ui.showSuccess) {
                    window.ui.showSuccess('充值路径删除成功');
                }
                // 重新加载列表
                const paths = await getRechargePaths();
                renderRechargePathsList(paths);
            } else {
                const error = await response.json();
                throw new Error(error.message || '删除失败');
            }
        } catch (error) {
            console.error('删除充值路径失败:', error);
            if (window.ui && window.ui.showError) {
                window.ui.showError('删除充值路径失败: ' + error.message);
            }
        }
    }
}

// 创建新的充值路径
async function createRechargePath(formData) {
    try {
        console.log('🚀 createRechargePath 函数被调用');
        console.log('📋 FormData 内容:');
        for (let [key, value] of formData.entries()) {
            if (value instanceof File) {
                console.log(`  ${key}: File(${value.name}, ${value.size} bytes, ${value.type})`);
            } else {
                console.log(`  ${key}: ${value}`);
            }
        }

        if (window.ui && window.ui.showLoading) {
            window.ui.showLoading('保存充值路径中...');
        }
        const token = localStorage.getItem('token'); // 获取认证token
        if (!token) {
            throw new Error('用户未登录');
        }

        console.log('🔐 认证状态: 已登录');
        console.log('🌐 发送请求到 /api/recharge-paths/');
        console.log('📤 请求方法: POST');
        console.log('📤 请求头: Authorization: Bearer [token]');
        
        const response = await fetch('/api/recharge-paths/', {
            method: 'POST',
            headers: {
                // 当使用 FormData 时，浏览器会自动设置 Content-Type: multipart/form-data
                // 这里只需要添加认证 header
                'Authorization': `Bearer ${token}`
            },
            body: formData // 直接发送 FormData 对象
        });

        console.log('📡 收到响应:');
        console.log('  状态码:', response.status);
        console.log('  状态文本:', response.statusText);
        console.log('  响应头:');
        for (let [key, value] of response.headers.entries()) {
            console.log(`    ${key}: ${value}`);
        }

        if (!response.ok) {
            console.error('❌ 请求失败，状态码:', response.status);
            
            // 尝试获取错误详情
            let errorMessage = '保存充值路径失败';
            let errorDetails = null;
            
            try {
                const errorResponse = await response.text();
                console.log('错误响应内容:', errorResponse);
                
                // 尝试解析为JSON
                try {
                    errorDetails = JSON.parse(errorResponse);
                    errorMessage = errorDetails.message || errorDetails.error || errorMessage;
                } catch (parseError) {
                    console.log('响应不是有效的JSON格式，原始内容:', errorResponse);
                    errorMessage = `服务器错误 (${response.status}): ${errorResponse}`;
                }
            } catch (textError) {
                console.log('无法读取错误响应内容:', textError);
                errorMessage = `服务器错误 (${response.status}): ${response.statusText}`;
            }
            
            console.log('最终错误信息:', errorMessage);
            console.log('错误详情:', errorDetails);
            
            throw new Error(errorMessage);
        }

        // 尝试解析成功响应
        let data;
        try {
            const responseText = await response.text();
            console.log('✅ 成功响应内容:', responseText);
            
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.log('成功响应不是有效的JSON格式，原始内容:', responseText);
                throw new Error('服务器返回了无效的JSON响应');
            }
        } catch (responseError) {
            console.log('读取响应内容失败:', responseError);
            throw new Error('无法读取服务器响应');
        }

        if (window.ui && window.ui.hideLoading) {
            window.ui.hideLoading();
        }
        if (window.ui && window.ui.showSuccess) {
            window.ui.showSuccess('充值路径保存成功');
        }
        console.log('🎉 保存成功，返回数据:', data);
        return data; // 返回后端响应数据

    } catch (error) {
        console.error('=== 充值路径保存错误详情 ===');
        console.error('错误类型:', error.constructor.name);
        console.error('错误消息:', error.message);
        console.error('错误堆栈:', error.stack);
        console.error('完整错误对象:', error);
        
        if (window.ui && window.ui.hideLoading) {
            window.ui.hideLoading();
        }
        console.error('前端：调用创建充值路径 API 失败:', error); // 添加错误日志
        if (window.ui && window.ui.showError) {
            window.ui.showError('保存充值路径失败: ' + error.message);
        }
        throw error; // 抛出错误以便上层调用者处理
    }
}

// 重置充值路径表单
function resetRechargePathForm() {
    console.log('重置充值路径表单...');
    const form = document.getElementById('recharge-path-form');
    if (form) {
        form.reset();
        // TODO: 清除图标和二维码预览
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

         // 确保保存按钮显示为"保存"或"添加"
         const saveButton = document.getElementById('btn-save-recharge-path');
         if(saveButton) saveButton.textContent = '保存';
    }
}

// 创建充值路径模态框
function createRechargePathModal() {
    console.log('创建充值路径模态框...');
    const modalElement = document.getElementById('recharge-path-modal');
    if (!modalElement) {
        console.warn('未找到充值路径模态框元素');
        return;
    }

    // 初始化 Bootstrap 模态框
    const modal = new bootstrap.Modal(modalElement);

    // 绑定模态框事件
    modalElement.addEventListener('hidden.bs.modal', () => {
        resetRechargePathForm();
    });

    return modal;
}

// 页面初始化函数
function initRechargePathsPage() {
    console.log('🚀 初始化充值路径管理页面...');

    // --- 绑定弹出充值路径列表模态框的按钮事件 ---
    const openRechargePathsListBtn = document.getElementById('btn-recharge-paths'); // 修改为正确的按钮ID
    const rechargePathsListModalElement = document.getElementById('recharge-paths-list-modal'); // 列表模态框元素

    if (openRechargePathsListBtn && rechargePathsListModalElement) {
        console.log('✅ 找到弹出充值路径列表按钮和列表模态框，绑定点击事件...');
        // 确保移除之前可能绑定的事件，避免重复
        openRechargePathsListBtn.removeEventListener('click', handleOpenRechargePathsListModal);
        openRechargePathsListBtn.addEventListener('click', handleOpenRechargePathsListModal);
    } else {
        console.warn('未找到弹出充值路径列表按钮或列表模态框元素，无法绑定弹出列表事件。');
        console.log('按钮元素:', openRechargePathsListBtn);
        console.log('模态框元素:', rechargePathsListModalElement);
    }

    // --- 绑定列表模态框中添加新充值路径按钮的事件 ---
    const addNewRechargePathBtnInListModal = document.getElementById('btn-add-new-recharge-path-in-list-modal');
    const rechargePathModalElement = document.getElementById('recharge-path-modal'); // 添加/编辑模态框元素
    const rechargePathsListModalElementById = document.getElementById('recharge-paths-list-modal'); // 再次获取列表模态框元素以便关闭

    if (addNewRechargePathBtnInListModal && rechargePathModalElement && rechargePathsListModalElementById) {
         console.log('✅ 找到列表模态框中添加按钮和相关模态框元素，绑定点击事件...');
        // 确保移除之前可能绑定的事件，避免重复
         addNewRechargePathBtnInListModal.removeEventListener('click', handleAddNewRechargePathFromList);
         addNewRechargePathBtnInListModal.addEventListener('click', handleAddNewRechargePathFromList);
    } else {
        console.warn('未找到列表模态框中添加按钮或相关模态框元素，无法绑定从列表添加事件。');
    }

    // --- 绑定添加/编辑模态框中保存按钮的事件 ---
    const saveRechargePathBtn = document.getElementById('btn-save-recharge-path');
    const rechargePathForm = document.getElementById('recharge-path-form');
    // 注意：rechargePathModalElement 已经在上面获取，这里不需要再次获取

    if (saveRechargePathBtn && rechargePathForm && rechargePathModalElement) {
        console.log('✅ 找到保存充值路径按钮和表单，绑定点击事件...');
        // 确保移除之前可能绑定的事件，避免重复
        saveRechargePathBtn.removeEventListener('click', handleSaveRechargePath);
        saveRechargePathBtn.addEventListener('click', handleSaveRechargePath);
    } else {
        console.warn('未找到保存充值路径按钮或表单，无法绑定保存事件。');
    }

    // TODO: 为列表中的编辑和删除按钮绑定事件 (使用事件委托)

    console.log('🎉 充值路径管理页面初始化完成');

     // 页面加载时是否需要显示列表在页面上还是只在模态框中显示？
     // 如果需要在页面上显示列表，在这里调用 getRechargePaths 并渲染到 #recharge-paths-list
}

// --- 事件处理函数 --- 

// 处理弹出充值路径列表模态框的逻辑
async function handleOpenRechargePathsListModal() {
    console.log('🔘 弹出充值路径列表按钮被点击，显示列表模态框并加载列表...');
    const rechargePathsListModalElement = document.getElementById('recharge-paths-list-modal'); // 列表模态框元素
    if (!rechargePathsListModalElement) return;

    try {
        // 加载充值路径列表
        const rechargePaths = await getRechargePaths();
        renderRechargePathsList(rechargePaths);
        
        // 显示列表模态框
        const listModal = new bootstrap.Modal(rechargePathsListModalElement);
        listModal.show();

    } catch (error) {
        console.error('加载充值路径列表失败:', error);
        // 错误已在 getRechargePaths 中处理并显示
    }
}

// 处理列表模态框中添加新充值路径按钮的点击逻辑
function handleAddNewRechargePathFromList() {
    const rechargePathsListModalElement = document.getElementById('recharge-paths-list-modal'); // 列表模态框元素
    const rechargePathModalElement = document.getElementById('recharge-path-modal'); // 添加/编辑模态框元素

     if (!rechargePathsListModalElement || !rechargePathModalElement) return;

    // 隐藏列表模态框
    const listModal = bootstrap.Modal.getInstance(rechargePathsListModalElement);
    if (listModal) listModal.hide();

    // 显示添加/编辑模态框并重置表单
    resetRechargePathForm();
    const addEditModal = new bootstrap.Modal(rechargePathModalElement);
    addEditModal.show();
}

// 处理保存充值路径按钮的点击逻辑
async function handleSaveRechargePath() {
     console.log('🚀 handleSaveRechargePath 函数被调用');
     const rechargePathForm = document.getElementById('recharge-path-form');
     const rechargePathModalElement = document.getElementById('recharge-path-modal'); // 添加/编辑模态框元素

     if (!rechargePathForm || !rechargePathModalElement) {
         console.error('❌ 未找到表单或模态框元素');
         return;
     }
     
     console.log('📋 开始收集表单数据...');
     const formData = new FormData(rechargePathForm);
     
     console.log('📋 收集到的 FormData 数据:');
     for (let [key, value] of formData.entries()) {
         if (value instanceof File) {
             console.log(`  ${key}: File(${value.name}, ${value.size} bytes, ${value.type})`);
         } else {
             console.log(`  ${key}: ${value}`);
         }
     }

     // 显示用户填入的内容
     console.log('👤 用户填入的内容:');
     console.log('  充值名称:', formData.get('name') || '未填写');
     console.log('  支付类型:', formData.get('type') || '未填写');
     console.log('  收款账号:', formData.get('account') || '未填写');
     console.log('  收款人:', formData.get('receiver') || '未填写');
     console.log('  排序:', formData.get('sort') || '未填写');
     console.log('  图标文件:', formData.get('icon') ? '已选择' : '未选择');
     console.log('  二维码文件:', formData.get('qrCode') ? '已选择' : '未选择');

     try {
          console.log('🌐 调用 createRechargePath 函数...');
          const result = await createRechargePath(formData); 

          console.log('✅ 保存成功，返回数据:', result);
          console.log('🎉 系统反馈: 充值路径创建成功');

          console.log('✅ 保存成功，关闭模态框');
          const modal = bootstrap.Modal.getInstance(rechargePathModalElement);
          if (modal) modal.hide();
          
          // 显示成功消息
          if (window.ui && window.ui.showSuccess) {
              window.ui.showSuccess('充值路径保存成功！');
          }
          
          // TODO: 刷新充值路径列表 (可能需要重新加载并渲染列表模态框中的列表)
          // loadRechargePathsList(); 
          // 可能需要重新打开列表模态框或者提供一个提示

     } catch (error) {
         console.error('❌ 保存流程出现错误:', error);
         console.error('错误类型:', error.constructor.name);
         console.error('错误消息:', error.message);
         console.error('错误堆栈:', error.stack);
         
         console.log('💥 系统反馈: 保存失败');
         console.log('  错误详情:', error.message);
         
         // 错误处理和提示已在 createRechargePath 中进行
     }
}

// 在 DOM 加载完成后初始化页面
document.addEventListener('DOMContentLoaded', initRechargePathsPage);

// 导出到全局对象，以便其他脚本可以访问
window.rechargePathManager = {
    getRechargePaths,
    renderRechargePathsList,
    createRechargePath,
    resetRechargePathForm,
    createRechargePathModal,
    handleEditPath,
    handleDeletePath
};

// TODO: 实现加载充值路径列表到页面上（如果需要）
// TODO: 实现编辑和删除充值路径的功能（包括前端和后端）
// TODO: 实现列表项的编辑和删除按钮事件处理 
