document.addEventListener('DOMContentLoaded', () => {
    console.log('Admin dashboard loaded');
    loadDashboardData(); 
    setupEventListeners();
});

function loadDashboardData() {
    console.log('Loading dashboard data...');
}

function setupEventListeners() {
    console.log('Setting up event listeners...');
}

function showRechargeRequestNotification(data) {
    console.log('显示充值请求通知:', data);
    const rechargeTab = document.querySelector('#recharge-tab');
    if (rechargeTab) {
        let badge = rechargeTab.querySelector('.badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'badge badge-danger';
            rechargeTab.appendChild(badge);
        }
        const currentCount = parseInt(badge.textContent || '0');
        badge.textContent = currentCount + 1;
        badge.style.display = 'inline-block';
    }
    playNotificationSound();
}

function updateUnreadRequestsCount(count) {
    console.log('更新未读请求计数:', count);
    const rechargeTab = document.querySelector('#recharge-tab');
    if (rechargeTab) {
        const badge = rechargeTab.querySelector('.badge');
        if (badge) {
            if (count > 0) {
                badge.textContent = count;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
    }
}

function playNotificationSound() {
    const audio = new Audio('/sounds/notification.mp3');
    audio.play().catch(error => console.log('无法播放通知声音:', error));
}

// 编辑充值路径
window.editRechargePath = async (pathId) => {
    try {
        const response = await fetch(`/api/recharge-paths/${pathId}`);
        const result = await response.json();
        
        if (result.success) {
            const path = result.data;
            // 填充表单
            document.getElementById('recharge-path-id').value = path._id;
            document.getElementById('recharge-path-name').value = path.name;
            document.getElementById('recharge-path-account').value = path.account;
            document.getElementById('recharge-path-receiver').value = path.receiver;
            
            // 显示图标预览
            const iconPreview = document.getElementById('icon-preview');
            if (path.icon) {
                iconPreview.innerHTML = `<img src="${path.icon}" alt="图标预览" style="max-width: 100px;">`;
            }
            
            // 显示二维码预览
            const qrcodePreview = document.getElementById('qrcode-preview');
            if (path.qrcode) {
                qrcodePreview.innerHTML = `<img src="${path.qrcode}" alt="二维码预览" style="max-width: 200px;">`;
            }
            
            // 关闭列表模态框
            const listModal = bootstrap.Modal.getInstance(document.getElementById('recharge-paths-list-modal'));
            listModal.hide();
            
            // 打开编辑模态框
            const editModal = new bootstrap.Modal(document.getElementById('recharge-path-modal'));
            editModal.show();
        }
    } catch (error) {
        console.error('获取充值路径详情失败:', error);
    }
};

// 删除充值路径
window.deleteRechargePath = async (pathId) => {
    if (!confirm('确定要删除这个充值路径吗？')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/recharge-paths/${pathId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        if (result.success) {
            // 刷新列表
            rechargePathsButton.click();
        } else {
            console.error('删除充值路径失败:', result.message);
        }
    } catch (error) {
        console.error('删除充值路径失败:', error);
    }
}; 