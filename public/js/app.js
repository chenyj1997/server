// 监听用户信息更新事件
document.addEventListener('userInfoUpdated', function(event) {
    const userInfo = event.detail;
    // console.log('收到用户信息更新:', userInfo);
    
    // 更新页面上的用户信息显示
    updateUserInfoDisplay(userInfo);
    
    // 更新全局用户信息
    if (window.userInfo) {
        window.userInfo = userInfo;
    }
});

// 更新用户信息显示
function updateUserInfoDisplay(userInfo) {
    // 更新余额显示
    const balanceElements = document.querySelectorAll('.user-balance');
    balanceElements.forEach(element => {
        element.textContent = `¥${userInfo.balance || 0}`;
    });
    
    // 更新用户名显示
    const usernameElements = document.querySelectorAll('.user-username');
    usernameElements.forEach(element => {
        element.textContent = userInfo.username || '';
    });
    
    // 更新其他用户信息显示
    const userInfoElements = document.querySelectorAll('.user-info');
    userInfoElements.forEach(element => {
        if (element.dataset.field && userInfo[element.dataset.field]) {
            element.textContent = userInfo[element.dataset.field];
        }
    });
    
    // console.log('用户信息显示已更新');
} 