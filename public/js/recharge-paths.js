// 获取充值路径列表
async function getRechargePaths() {
  try {
    // 检查管理员权限
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');
    const isAdmin = localStorage.getItem('isAdmin');

    if (!token || !isAdmin || userRole !== 'admin') {
      alert('需要管理员权限，请重新登录');
      window.location.href = '/login.html';
      return;
    }

    // 显示加载中提示
    window.ui.showLoading('加载充值路径中...');

    // 发送请求到后端API
    const response = await fetch('/api/recharge-paths/paths', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    // 隐藏加载提示
    window.ui.hideLoading();

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '获取充值路径列表失败');
    }

    const data = await response.json();
    console.log('前端：获取充值路径列表成功:', data.data);
    
    // 渲染充值路径列表
    console.log('DEBUG: 调用 renderRechargePathsList 渲染列表');
    renderRechargePathsList(data.data);
  } catch (error) {
    console.error('前端：调用获取充值路径列表 API 失败:', error);
    if (error && error.stack) console.error(error.stack);
    window.ui.hideLoading();
    alert('获取充值路径列表失败: ' + error.message);
  }
}

// 渲染充值路径列表到模态框
function renderRechargePathsList(paths) {
  const listContainer = document.getElementById('recharge-paths-ul');
  if (!listContainer) {
    window.ui.hideLoading(); // 保证遮罩被隐藏
    return;
  }

  try {
    listContainer.innerHTML = ''; // 清空现有内容

    if (paths && paths.length > 0) {
      // 创建宫格容器
      const gridContainer = document.createElement('div');
      gridContainer.className = 'row row-cols-1 row-cols-md-3 g-4';
      
      paths.forEach(path => {
        const col = document.createElement('div');
        col.className = 'col';
        col.innerHTML = `
          <div class="card h-100">
            <div class="card-body">
              <div class="text-center mb-3">
                ${path.qrcode ? `<img src="${path.qrcode}" alt="二维码" class="img-fluid mb-2" style="max-width: 150px;">` : ''}
              </div>
              <h5 class="card-title text-center">${path.name}</h5>
              <p class="card-text">
                <strong>账号：</strong>${path.account}<br>
                <strong>收款人：</strong>${path.receiver || '未设置'}
              </p>
              <div class="d-flex justify-content-center gap-2">
                <button class="btn btn-primary edit-path-btn" data-id="${path._id}">
                  <i class="bi bi-pencil"></i> 编辑
                </button>
                <button class="btn btn-danger delete-path-btn" data-id="${path._id}">
                  <i class="bi bi-trash"></i> 删除
                </button>
              </div>
            </div>
          </div>
        `;
        gridContainer.appendChild(col);
      });

      listContainer.appendChild(gridContainer);

      // 为编辑和删除按钮添加事件监听
      listContainer.querySelectorAll('.edit-path-btn').forEach(button => {
        button.addEventListener('click', handleEditButtonClick);
      });
      listContainer.querySelectorAll('.delete-path-btn').forEach(button => {
        button.addEventListener('click', handleDeleteButtonClick);
      });
    } else {
      listContainer.innerHTML = '<div class="alert alert-info text-center">暂无充值路径</div>';
    }
  } catch (err) {
    console.error('渲染充值路径列表时发生异常:', err);
    if (err && err.stack) console.error(err.stack);
    alert('渲染充值路径列表时发生异常: ' + err.message);
  } finally {
    window.ui.hideLoading(); // 无论如何都隐藏遮罩
  }
}

// 处理编辑按钮点击事件
async function handleEditButtonClick(event) {
  const pathId = event.target.dataset.id;
  
  try {
    // 检查管理员权限
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');
    const isAdmin = localStorage.getItem('isAdmin');

    if (!token || !isAdmin || userRole !== 'admin') {
      alert('需要管理员权限，请重新登录');
      window.location.href = '/login.html';
      return;
    }

    // 显示加载中提示
    window.ui.showLoading('加载充值路径详情中...');

    // 从后端获取充值路径详情 (这里假设后端有根据ID获取详情的接口，例如 /api/recharge-paths/:id)
    // 如果没有，我们需要先添加这个后端接口
    const response = await fetch(`/api/recharge-paths/${pathId}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    // 隐藏加载提示
    window.ui.hideLoading();

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '获取充值路径详情失败');
    }

    const result = await response.json();
    if (result.success && result.data) {
        const path = result.data;
        console.log('DEBUG: 获取到充值路径详情:', path); // 添加日志
        
        // 打开编辑模态框
        const editModal = new bootstrap.Modal(document.getElementById('recharge-path-modal'));
        
        // 监听模态框完全打开事件
        document.getElementById('recharge-path-modal').addEventListener('shown.bs.modal', function onModalShown() {
            // 使用获取到的数据填充表单
            fillRechargePathForm(path);
            // 移除事件监听器，避免重复触发
            document.getElementById('recharge-path-modal').removeEventListener('shown.bs.modal', onModalShown);
        });
        
        editModal.show();
        
        // 修改模态框标题为"编辑充值路径"
        document.getElementById('recharge-path-modal-title').innerText = '编辑充值路径';
        
        // 将保存按钮的事件改为更新操作 (这里需要修改 handleSaveRechargePath 逻辑来区分添加和更新)
        // 目前 handleSaveRechargePath 总是发送 POST 请求，需要修改为根据是否有ID来发送 PUT 或 POST
        const saveButton = document.getElementById('btn-save-recharge-path');
        saveButton.dataset.pathId = path._id; // 将ID存储在按钮上，方便保存时获取

    } else {
        throw new Error(result.message || '获取充值路径详情失败');
    }

  } catch (error) {
    console.error('获取充值路径详情或打开编辑模态框错误:', error);
    if (error && error.stack) console.error(error.stack);
    window.ui.hideLoading();
    alert('获取充值路径详情失败: ' + error.message);
  }
}

// 填充充值路径表单 (这是一个辅助函数，根据路径数据填充表单字段)
function fillRechargePathForm(path) {
    // 填充基础字段
    document.getElementById('recharge-path-id').value = path._id || ''; // 填充ID隐藏字段
    document.getElementById('recharge-path-name').value = path.name || '';
    document.getElementById('recharge-path-account').value = path.account || '';
    document.getElementById('recharge-path-receiver').value = path.receiver || '';
    document.getElementById('recharge-path-type').value = path.type || 'other';
    // 填充活跃状态复选框
    document.getElementById('recharge-path-active').checked = path.active === true; // 根据 path.active 设置复选框状态

    // TODO: 处理图标和二维码文件的回显（如果需要）
    // 注意：文件输入框出于安全考虑，不能通过JS设置其value来显示已上传的文件路径
    // 通常的做法是显示当前已上传的图片预览，或者在编辑时提供重新上传的选项
}

// 保存充值路径
async function handleSaveRechargePath(event) {
  event.preventDefault();
  try {
    const form = document.getElementById('recharge-path-form');
    if (!form) return;
    const formData = new FormData(form);
    // 只添加文件，不传对象
    const iconInput = document.getElementById('recharge-path-icon');
    if (iconInput && iconInput.files && iconInput.files.length > 0) {
      formData.set('icon', iconInput.files[0]);
    }
    const qrcodeInput = document.getElementById('recharge-path-qrcode');
    if (qrcodeInput && qrcodeInput.files && qrcodeInput.files.length > 0) {
      formData.set('qrCode', qrcodeInput.files[0]);
    }
    // 获取活跃状态复选框的值
    const isActiveCheckbox = document.getElementById('recharge-path-active');
    let isActive = true; // 默认启用
    if (isActiveCheckbox) {
        isActive = isActiveCheckbox.checked; // 如果元素存在，获取它的状态
    } else {
        console.error('保存时未找到充值路径启用复选框 #recharge-path-active');
        // 如果找不到复选框，保留默认值 true，或者根据实际情况抛出错误
        // 这里我们保留默认启用，以免保存失败
    }
    formData.append('isActive', isActive);

    // 获取路径ID，用于判断是添加还是更新
    const pathId = document.getElementById('recharge-path-id').value; // 从隐藏字段获取ID
    const method = pathId ? 'PUT' : 'POST'; // 如果有ID，使用PUT进行更新；否则使用POST进行添加
    const url = pathId ? `/api/recharge-paths/${pathId}` : '/api/recharge-paths'; // 根据是否有ID构建URL

    // 检查必填字段
    const name = formData.get('name');
    const account = formData.get('account');
    const receiver = formData.get('receiver');
    if (!name || !account || !receiver) {
      alert('请填写所有必填字段');
      return;
    }

    // 显示加载中提示
    window.ui.showLoading(method === 'POST' ? '创建中...' : '更新中...');

    // 发送请求到后端API
    const response = await fetch(url, {
      method: method,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: formData
    });

    // 隐藏加载提示
    window.ui.hideLoading();

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '保存充值路径失败');
    }

    const result = await response.json();
    if (result.success) {
      console.log('DEBUG: 保存成功，准备更新列表');
      alert(method === 'POST' ? '充值路径创建成功' : '充值路径更新成功');
      // 关闭模态框
      const modal = bootstrap.Modal.getInstance(document.getElementById('recharge-path-modal'));
      if (modal) {
        modal.hide();
      }
      // 重新加载充值路径列表
      getRechargePaths();
      // 重新打开充值路径列表模态框
      const listModal = new bootstrap.Modal(document.getElementById('recharge-paths-list-modal'));
      listModal.show();
    } else {
      throw new Error(result.message || '保存充值路径失败');
    }
  } catch (error) {
    console.error('保存充值路径错误:', error);
    if (error && error.stack) console.error(error.stack);
    window.ui.hideLoading();
    alert('保存充值路径失败: ' + error.message);
  }
}

// 初始化事件监听器
document.addEventListener('DOMContentLoaded', function() {
  
  // 绑定打开充值路径列表模态框的按钮事件
  const openRechargePathsListBtn = document.getElementById('btn-recharge-paths');
  
  if (openRechargePathsListBtn) {
    openRechargePathsListBtn.addEventListener('click', function() {
      // 打开模态框
      const listModal = new bootstrap.Modal(document.getElementById('recharge-paths-list-modal'));
      listModal.show();
      // 加载充值路径列表
      getRechargePaths();
    });
  } else {
  }

  // 绑定添加新充值路径按钮事件 (在列表模态框中)
  const addNewRechargePathBtnInList = document.getElementById('btn-add-new-recharge-path-in-list-modal');
  
  if (addNewRechargePathBtnInList) {
    addNewRechargePathBtnInList.addEventListener('click', function() {
      // 清空表单并设置标题为"添加充值路径"
      document.getElementById('recharge-path-form').reset();
      document.getElementById('recharge-path-id').value = ''; // 清空ID隐藏字段
      document.getElementById('recharge-path-modal-title').innerText = '添加充值路径';
      document.getElementById('icon-preview').innerHTML = ''; // 清空图标预览
      document.getElementById('qrcode-preview').innerHTML = ''; // 清空二维码预览
      document.getElementById('recharge-path-icon').value = ''; // 清空文件输入框
      document.getElementById('recharge-path-qrcode').value = ''; // 清空文件输入框
      
      // 关闭列表模态框
      const listModal = bootstrap.Modal.getInstance(document.getElementById('recharge-paths-list-modal'));
      if (listModal) {
        listModal.hide();
      }
      
      // 打开添加/编辑模态框
      const addModal = new bootstrap.Modal(document.getElementById('recharge-path-modal'));
      
      // 监听模态框完全打开事件
      document.getElementById('recharge-path-modal').addEventListener('shown.bs.modal', function onModalShown() {
        // 设置复选框的默认值
        const activeCheckbox = document.getElementById('recharge-path-active');
        if (activeCheckbox) {
          activeCheckbox.checked = true; // 新增时默认启用
        } else {
          console.error('未找到充值路径启用复选框 #recharge-path-active');
        }
        // 移除事件监听器，避免重复触发
        document.getElementById('recharge-path-modal').removeEventListener('shown.bs.modal', onModalShown);
      });
      
      addModal.show();
    });
  } else {
  }

  // 绑定保存充值路径按钮事件
  const saveRechargePathBtn = document.getElementById('btn-save-recharge-path');
  if (saveRechargePathBtn) {
    saveRechargePathBtn.addEventListener('click', function() {
      const form = document.getElementById('recharge-path-form');
      if (form) {
        handleSaveRechargePath(new Event('submit'));
      }
    });
  } else {
    console.error('未找到保存充值路径按钮 #btn-save-recharge-path');
  }

});

// 处理删除按钮点击事件
async function handleDeleteButtonClick(event) {
  const pathId = event.target.dataset.id;

  if (confirm('确定要删除这条充值路径吗？')) {
    try {
      // 检查管理员权限
      const token = localStorage.getItem('token');
      const userRole = localStorage.getItem('userRole');
      const isAdmin = localStorage.getItem('isAdmin');

      if (!token || !isAdmin || userRole !== 'admin') {
        alert('需要管理员权限，请重新登录');                          
        window.location.href = '/login.html';
        return;
      }

      // 显示加载中提示
      window.ui.showLoading('删除中...');

      // 发送删除请求到后端API
      const response = await fetch(`/api/recharge-paths/${pathId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // 隐藏加载提示
      window.ui.hideLoading();

      // 检查响应状态
      if (response.ok) {
        alert('充值路径删除成功');
        getRechargePaths(); // 删除成功后重新加载列表
      } else {
        const error = await response.json();
        alert(`删除失败: ${error.message}`); // 显示错误信息
      }
    } catch (error) {
      console.error('删除充值路径错误:', error);
      if (error && error.stack) console.error(error.stack);
      window.ui.hideLoading();
      alert('删除过程中发生错误');
    }
  }
}

// 本地图片预览（图标）
function handleIconUpload(event) {
  const [file] = event.target.files;
  const preview = document.getElementById('icon-preview');
  if (file && preview) {
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.innerHTML = `<img src="${e.target.result}" style="max-width: 100px;" alt="图标预览">`;
    };
    reader.readAsDataURL(file);
  } else if (preview) {
    preview.innerHTML = '';
  }
}

// 本地图片预览（二维码）
function handleQrcodeUpload(event) {
  const [file] = event.target.files;
  const preview = document.getElementById('qrcode-preview');
  if (file && preview) {
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.innerHTML = `<img src="${e.target.result}" style="max-width: 150px;" alt="二维码预览">`;
    };
    reader.readAsDataURL(file);
  } else if (preview) {
    preview.innerHTML = '';
  }
}

// 导出模块
window.rechargePathManager = {
  getRechargePaths,
  renderRechargePathsList,
  handleEditButtonClick,
  handleDeleteButtonClick,
  handleSaveRechargePath
}; 
