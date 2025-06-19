// 发布信息
const publishInfo = async () => {
    try {
        // 获取表单数据
        const title = document.getElementById('title').value;
        const content = document.getElementById('content').value;
        const category = document.getElementById('category').value;
        const loanAmount = parseFloat(document.getElementById('loanAmount').value) || 0;
        const period = parseInt(document.getElementById('period').value) || 0;
        const repaymentAmount = parseFloat(document.getElementById('repaymentAmount').value) || 0;

        // 验证必填字段
        if (!title || !content) {
            if (window.ui) {
                window.ui.showError('请填写标题和内容');
            }
            return;
        }

        // 验证交易字段
        if (loanAmount < 0 || period < 0 || repaymentAmount < 0) {
            if (window.ui) {
                window.ui.showError('金额和周期不能为负数');
            }
            return;
        }

        // 构建请求数据
        const data = {
            title,
            content,
            category,
            loanAmount,
            period,
            repaymentAmount
        };

        // 发送请求
        const response = await window.api.post('/info', data);
        
        if (response.success) {
            if (window.ui) {
                window.ui.showSuccess('发布成功');
            }
            // 清空表单
            document.getElementById('title').value = '';
            document.getElementById('content').value = '';
            document.getElementById('category').value = '资讯';
            document.getElementById('loanAmount').value = '';
            document.getElementById('period').value = '';
            document.getElementById('repaymentAmount').value = '';
            // 关闭模态框
            const modal = bootstrap.Modal.getInstance(document.getElementById('publish-modal'));
            modal.hide();
            // 刷新列表
            if (window.infoManager && window.infoManager.loadInfoList) {
                window.infoManager.loadInfoList();
            }
        } else {
            if (window.ui) {
                window.ui.showError(response.message || '发布失败');
            }
        }
    } catch (error) {
        console.error('发布信息失败:', error);
        if (window.ui) {
            window.ui.showError('发布失败');
        }
    }
}; 