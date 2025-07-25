/**
 * 信息管理相关函数 (管理员版)
 */

// 确保ui对象存在，即使未加载也不会报错
if (!window.ui) {
    // 创建一个最小化的ui工具对象作为后备
    console.warn('UI工具对象未加载，创建基本替代品');
    window.ui = {
        showLoading: function(message) {
            console.log('加载中: ' + (message || ''));
        },
        hideLoading: function() {
            console.log('加载完成');
        },
        showSuccess: function(message) {
            console.log('成功: ' + message);
            alert(message);
        },
        showError: function(message) {
            console.error('错误: ' + message);
            alert('错误: ' + message);
        },
        escapeHtml: function(text) {
            return text || '';
        },
        formatDate: function(date) {
            return date ? new Date(date).toLocaleString() : '';
        }
    };
}

// 图片上传函数
async function uploadImage(file) {
    try {
        window.ui.showLoading('上传图片中...');
        const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
        if (!token) {
            throw new Error('未登录，请先登录');
        }

        // 创建FormData对象
        const formData = new FormData();
        formData.append('file', file);

        // 发送上传请求
        const response = await fetch('/api/info/upload/image', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || '上传失败');
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || '上传失败');
        }

        // 简化数据处理逻辑，优先使用 url 字段，然后是 data 字段
        let imageUrl = data.url || data.data;
        
        // 如果 imageUrl 是数组，取第一个
        if (Array.isArray(imageUrl)) {
            imageUrl = imageUrl[0];
        }
        
        // 如果 imageUrl 是对象，尝试获取 url 属性
        if (typeof imageUrl === 'object' && imageUrl !== null) {
            imageUrl = imageUrl.url || imageUrl.secure_url;
        }

        if (!imageUrl) {
            throw new Error('服务器返回的数据格式不正确');
        }

        // 确保URL是完整的Cloudinary URL
        if (!imageUrl.startsWith('http')) {
            throw new Error('图片URL格式不正确');
        }

        console.log('图片上传成功，URL:', imageUrl);
        return imageUrl;
    } catch (error) {
        console.error('图片上传失败:', error);
        window.ui.showError('图片上传失败: ' + error.message);
        throw error;
    } finally {
        window.ui.hideLoading();
    }
}

// 辅助函数：解析content字段的字符串
function parseContentString(contentString) {
    const result = {};
    if (contentString) {
        const pairs = contentString.split(',');
        pairs.forEach(pair => {
            const parts = pair.split(':');
            if (parts.length === 2) {
                const key = parts[0].trim();
                const value = parts[1].trim();
                result[key] = value;
            }
        });
    }
    return result;
}

// 创建infoManager对象
const createInfoManager = () => {
    // 存储信息模态框的实例
    let infoModalInstance = null;

    // 当前页面的信息列表数据
    let currentInfoList = [];

    // 当前页码
    let currentPage = 1;
    // 每页显示数量
    const pageSize = 12;

    // 服务器时间和本地时间的基准，用于倒计时计算
    let baseServerTime = null;
    let baseLocalTime = null;
    let activeCardIntervals = []; // 用于存储卡片列表的倒计时定时器ID

    const syncTimeWithServer = async () => {
        try {
            const response = await fetch('/api/info/time', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            if (data.success) {
                return new Date(data.serverTime);
            }
        } catch (error) {
            console.error('获取服务器时间失败:', error);
        }
        return new Date(); // 如果获取失败，返回本地时间
    };

    // 初始化信息管理页面
    const initInfoPage = async () => {
        try {
            window.ui.showLoading("初始化页面..."); // 显示加载提示
            console.log('初始化信息管理页面...');

            // 同步服务器时间
            await syncTimeWithServer();

            // 加载信息列表
            const response = await getInfoList(currentPage, pageSize);
            if (response && response.data && response.data.list) {
                await renderInfoList(response.data.list);
                renderPagination(response.total);
            } else {
                console.error('获取信息列表失败或返回数据格式不正确:', response);
                window.ui.showError('加载信息列表失败，请稍后重试。');
                const infoListContainer = document.getElementById('info-list-container');
                if (infoListContainer) {
                    infoListContainer.innerHTML = '<div class="col-12"><p class="text-center text-danger">加载列表失败</p></div>';
                }
            }

            // 初始化事件监听
            initEvents();

            // 初始化自动还款监控
            initAutoRepaymentMonitoring();
            
            console.log('信息管理页面初始化完成');
        } catch (error) {
            console.error('初始化信息管理页面失败:', error);
            window.ui.showError('初始化页面失败: ' + error.message);
             const infoListContainer = document.getElementById('info-list-container');
            if (infoListContainer) {
                infoListContainer.innerHTML = '<div class="col-12"><p class="text-center text-danger">加载列表时发生错误</p></div>';
            }
        } finally {
            window.ui.hideLoading(); // 隐藏加载提示
            const specificInfoListLoading = document.getElementById('info-list-loading');
            if (specificInfoListLoading) {
                specificInfoListLoading.style.display = 'none'; // 专门隐藏 info-list-loading
            }
        }
    };

    // 初始化自动还款监控
    const initAutoRepaymentMonitoring = () => {
        // 添加监控统计按钮到工具栏
        const toolbar = document.querySelector('#info-section .toolbar');
        if (toolbar) {
            const monitoringBtn = document.createElement('button');
            monitoringBtn.className = 'btn btn-outline-info btn-sm ms-2';
            monitoringBtn.innerHTML = '<i class="fas fa-chart-line"></i> 自动还款监控';
            monitoringBtn.onclick = showAutoRepaymentStats;
            toolbar.appendChild(monitoringBtn);
        }
        
        // 定期刷新监控数据
        setInterval(updateAutoRepaymentStats, 60000); // 每分钟更新一次
    };

    // 显示自动还款统计
    const showAutoRepaymentStats = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('未登录，请先登录');
            }

            const response = await fetch('/api/admin/auto-repayment-stats', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            if (data.success) {
                displayAutoRepaymentStats(data.data);
            } else {
                throw new Error(data.message || '获取统计信息失败');
            }
        } catch (error) {
            console.error('获取自动还款统计失败:', error);
            window.ui.showError('获取统计信息失败: ' + error.message);
        }
    };

    // 显示自动还款统计弹窗
    const displayAutoRepaymentStats = (stats) => {
        const modalHtml = `
            <div class="modal fade" id="autoRepaymentStatsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-chart-line text-info"></i>
                                自动还款监控统计
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="card bg-primary text-white mb-3">
                                        <div class="card-body">
                                            <h6 class="card-title">已调度</h6>
                                            <h3 class="mb-0">${stats.totalScheduled}</h3>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="card bg-success text-white mb-3">
                                        <div class="card-body">
                                            <h6 class="card-title">已执行</h6>
                                            <h3 class="mb-0">${stats.totalExecuted}</h3>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="card bg-danger text-white mb-3">
                                        <div class="card-body">
                                            <h6 class="card-title">执行失败</h6>
                                            <h3 class="mb-0">${stats.totalFailed}</h3>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="card bg-warning text-dark mb-3">
                                        <div class="card-body">
                                            <h6 class="card-title">重试次数</h6>
                                            <h3 class="mb-0">${stats.totalRetries}</h3>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="mt-3">
                                <h6>系统状态</h6>
                                <p><strong>最后运行时间:</strong> ${stats.lastRun ? new Date(stats.lastRun).toLocaleString() : '未运行'}</p>
                                <p><strong>运行时长:</strong> ${formatUptime(stats.uptime)}</p>
                                <p><strong>错误数量:</strong> ${stats.errors.length}</p>
                            </div>
                            
                            ${stats.errors.length > 0 ? `
                                <div class="mt-3">
                                    <h6>最近错误</h6>
                                    <div class="table-responsive">
                                        <table class="table table-sm">
                                            <thead>
                                                <tr>
                                                    <th>时间</th>
                                                    <th>错误</th>
                                                    <th>上下文</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${stats.errors.slice(-5).map(error => `
                                                    <tr>
                                                        <td>${new Date(error.timestamp).toLocaleString()}</td>
                                                        <td>${error.error}</td>
                                                        <td>${error.context}</td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
                            <button type="button" class="btn btn-warning" onclick="resetAutoRepaymentStats()">重置统计</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 移除已存在的模态框
        const existingModal = document.getElementById('autoRepaymentStatsModal');
        if (existingModal) {
            existingModal.remove();
        }

        // 添加新模态框
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // 显示模态框
        const modal = new bootstrap.Modal(document.getElementById('autoRepaymentStatsModal'));
        modal.show();
    };

    // 格式化运行时长
    const formatUptime = (uptime) => {
        if (!uptime) return '未运行';
        
        const hours = Math.floor(uptime / (1000 * 60 * 60));
        const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((uptime % (1000 * 60)) / 1000);
        
        return `${hours}小时${minutes}分钟${seconds}秒`;
    };

    // 更新自动还款统计
    const updateAutoRepaymentStats = async () => {
        // 静默更新，不显示错误
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch('/api/admin/auto-repayment-stats', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            if (data.success) {
                // 更新页面上的统计显示（如果有的话）
                const statsDisplay = document.getElementById('autoRepaymentStatsDisplay');
                if (statsDisplay) {
                    statsDisplay.innerHTML = `
                        <small class="text-muted">
                            调度: ${data.data.totalScheduled} | 
                            执行: ${data.data.totalExecuted} | 
                            失败: ${data.data.totalFailed}
                        </small>
                    `;
                }
            }
        } catch (error) {
            // 静默处理错误
            console.debug('更新自动还款统计失败:', error);
        }
    };

    // 重置自动还款统计
    const resetAutoRepaymentStats = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('未登录，请先登录');
            }

            const response = await fetch('/api/admin/auto-repayment-stats/reset', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            if (data.success) {
                window.ui.showSuccess('统计信息已重置');
                // 关闭模态框并重新显示
                const modal = bootstrap.Modal.getInstance(document.getElementById('autoRepaymentStatsModal'));
                if (modal) {
                    modal.hide();
                }
                setTimeout(showAutoRepaymentStats, 500);
            } else {
                throw new Error(data.message || '重置失败');
            }
        } catch (error) {
            console.error('重置自动还款统计失败:', error);
            window.ui.showError('重置统计信息失败: ' + error.message);
        }
    };

    // 将重置函数暴露到全局
    window.resetAutoRepaymentStats = resetAutoRepaymentStats;

    // 获取信息列表
    async function getInfoList(page = 1, limit = 12, searchTerm = '', status = '', startDate = '', endDate = '') {
        let isLoadingShown = false; // 跟踪是否已显示loading
        try {
            // 避免重复显示 loading, 如果外部函数已显示，则此处不再显示
            // window.ui.showLoading('加载中...'); // 注释掉，由调用者 (initInfoPage, goToPage) 处理
            // isLoadingShown = true;

            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('未登录');
            }

            // 构建请求URL
            let url = `/api/info/list?page=${page}&limit=${limit}`;

            // 添加搜索词参数
            if (searchTerm) {
                url += `&search=${encodeURIComponent(searchTerm)}`;
            }

            // 添加状态过滤参数
            if (status) {
                url += `&status=${encodeURIComponent(status)}`;
            }

            // 添加日期范围过滤参数
            if (startDate) {
                url += `&startDate=${encodeURIComponent(startDate)}`;
            }
            if (endDate) {
                url += `&endDate=${encodeURIComponent(endDate)}`;
            }

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || '获取列表失败');
            }

            // 在这里获取总条数并设置给分页容器，以便goToPage使用
            const totalItems = data.total; // 从响应数据中获取total字段
            const paginationElement = document.querySelector('#info-section .pagination');
            if(paginationElement) {
                 paginationElement.dataset.totalItems = totalItems;
            }

            currentInfoList = data.data.list;
            return data;
        } catch (error) {
            window.ui.showError(error.message);
            throw error;
        } finally {
            // if (isLoadingShown) {
            //     window.ui.hideLoading();
            // }
        }
    }

    // 创建信息
    async function createInfo(infoData) {
        try {
            window.ui.showLoading('创建中...');
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('未登录');
            }


            // 如果 expiryTime 无效，自动修正
            if (!infoData.expiryTime || isNaN(Date.parse(infoData.expiryTime))) {
                const period = infoData.period || 0;
                const now = new Date();
                infoData.expiryTime = new Date(now.getTime() + parseInt(period) * 24 * 60 * 60 * 1000).toISOString();
                console.warn('自动修正 expiryTime:', infoData.expiryTime);
            }

            // 打印最终请求体
            const requestBody = JSON.stringify(infoData);
            const headers = {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            };

            const response = await fetch('/api/info', {
                method: 'POST',
                headers: headers,
                body: requestBody
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || '创建失败');
            }

            window.ui.showSuccess('创建成功');
            return data;
        } catch (error) {
            window.ui.showError(error.message);
            throw error;
        } finally {
            window.ui.hideLoading();
        }
    }

    // 更新信息
    async function updateInfo(id, infoData) {
        try {
            window.ui.showLoading('更新中...');
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('未登录');
            }

            // 添加日志：在 updateInfo 函数开头打印接收到的 infoData
            console.log('updateInfo - 接收到的 infoData:', infoData);

            const response = await fetch(`/api/info/${id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                // 添加日志：打印 JSON.stringify 后的请求体
                body: (() => {
                    const requestBody = JSON.stringify(infoData);
                    console.log('updateInfo - 发送的请求体 (JSON):', requestBody);
                    return requestBody;
                })()
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || '更新失败');
            }

            window.ui.showSuccess('更新成功');
            return data;
        } catch (error) {
            window.ui.showError(error.message);
            throw error;
        } finally {
            window.ui.hideLoading();
        }
    }

    // 删除信息
    async function deleteInfo(id) {
        try {
            window.ui.showLoading('删除中...');
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('未登录');
            }

            const response = await fetch(`/api/info/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || '删除失败');
            }

            window.ui.showSuccess('删除成功');
            // 删除成功后刷新当前页
            // initInfoPage(); // REMOVE THIS
            // 替换为更精确的列表刷新
            const listResponse = await getInfoList(currentPage, pageSize, document.getElementById('info-search-input').value.trim(), document.getElementById('info-status-filter').value, document.getElementById('info-date-start').value, document.getElementById('info-date-end').value);
            if (listResponse && listResponse.data && listResponse.data.list) {
                await renderInfoList(listResponse.data.list);
                renderPagination(listResponse.total);
            }
            return data;
        } catch (error) {
            window.ui.showError(error.message);
            throw error;
        } finally {
            window.ui.hideLoading();
        }
    }

    // 获取信息详情
    async function getInfoDetail(id) {
        try {
            window.ui.showLoading('加载中...');
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('未登录');
            }

            // 添加时间戳参数，防止缓存
            const timestamp = new Date().getTime();
            const response = await fetch(`/api/info/${id}?_t=${timestamp}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || '获取详情失败');
            }

            return data;
        } catch (error) {
            window.ui.showError(error.message);
            throw error;
        } finally {
            window.ui.hideLoading();
        }
    }

    // 处理图片上传和预览
    async function handleImageUpload(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        // 根据输入框ID确定预览容器
        const inputId = event.target.id;
        let previewContainer;

        // 确保隐藏字段存在
        let imageUrlsInput = document.getElementById('info-image-urls');
        if (!imageUrlsInput) {
            // 如果隐藏字段不存在，创建它
            const newImageUrlsInput = document.createElement('input');
            newImageUrlsInput.type = 'hidden';
            newImageUrlsInput.id = 'info-image-urls';
            newImageUrlsInput.name = 'imageUrls';
            newImageUrlsInput.value = '[]';
            const infoForm = document.getElementById('info-form');
            if (infoForm) {
                infoForm.appendChild(newImageUrlsInput);
            } else {
                console.error('找不到info-form，无法创建隐藏字段');
                return;
            }
        }
        let currentUrls = imageUrlsInput.value ? JSON.parse(imageUrlsInput.value) : [];

        if (inputId === 'cover-image') {
            previewContainer = document.getElementById('cover-preview');
            // 封面图片是单文件，清空整个预览容器
            previewContainer.innerHTML = '';
            // 从URL数组中移除旧的封面图片URL
            currentUrls = currentUrls.filter(url => {
                // 这里需要根据实际情况判断哪些是封面图片
                // 暂时保留所有URL，让用户手动管理
                return true;
            });
        } else if (inputId === 'additional-images') {
            previewContainer = document.getElementById('additional-images-preview');
        } else {
            // 如果没有找到对应的预览容器，使用通用的image-preview
            previewContainer = document.getElementById('image-preview');
        }
        
        if (!previewContainer) {
            console.error('找不到图片预览容器');
            return;
        }

        // 处理每个选择的文件
        for (const file of Array.from(files)) {
            try {
                // 验证文件类型和大小
                if (!file.type.startsWith('image/')) {
                    window.ui.showError(`文件 ${file.name} 不是图片格式`);
                    continue;
                }

                if (file.size > 5 * 1024 * 1024) { // 5MB 限制
                    window.ui.showError(`文件 ${file.name} 超过5MB限制`);
                    continue;
                }

                // 显示上传中的占位符和加载提示
                const previewWrapper = document.createElement('div');
                previewWrapper.className = 'image-preview-item position-relative d-inline-block m-1';
                // 根据输入类型设置不同的尺寸
                if (inputId === 'cover-image') {
                    previewWrapper.style.width = '150px';
                    previewWrapper.style.height = '150px';
                } else {
                    previewWrapper.style.width = '100px';
                    previewWrapper.style.height = '100px';
                }
                previewWrapper.innerHTML = `
                    <div class="uploading-overlay position-absolute top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-light bg-opacity-75">
                        <div class="spinner-border text-primary spinner-border-sm"></div>
                        <small>上传中...</small>
                    </div>
                `;
                previewContainer.appendChild(previewWrapper);

                // 上传图片
                const imageUrl = await uploadImage(file);

                // 检查重复URL
                if (currentUrls.includes(imageUrl)) {
                    window.ui.showWarning(`图片 ${file.name} 已存在，跳过重复上传。`);
                    previewWrapper.remove(); // 移除上传占位符
                    continue; // 跳过此文件
                }

                // 移除上传中的提示，显示图片和删除按钮
                previewWrapper.innerHTML = `
                    <img src="${imageUrl}" alt="预览图片" class="img-fluid" style="width: 100%; height: 100%; object-fit: cover;">
                    <button type="button" class="btn btn-danger btn-sm position-absolute top-0 end-0 m-1" onclick="infoManager.deleteImageFromModal(this, '${imageUrl}')">
                        <i class="bi bi-x"></i>
                    </button>
                `;
                previewWrapper.dataset.imageUrl = imageUrl;

                // 添加URL到当前URL列表
                currentUrls.push(imageUrl);

            } catch (error) {
                console.error('处理图片失败:', error);
                window.ui.showError('处理图片失败: ' + error.message);
                // 如果上传失败，移除对应的占位符
                if (previewWrapper) {
                    previewWrapper.remove();
                }
            }
        }

        // 更新隐藏字段的值
        imageUrlsInput.value = JSON.stringify(currentUrls);

        // 清空文件输入框，允许再次选择相同文件
        event.target.value = '';
    }

    // 从模态框中删除图片
    function deleteImageFromModal(buttonElement, imageUrl) {
        console.log('删除模态框图片:', imageUrl);
        const imageUrlsInput = document.getElementById('info-image-urls');
        
        // 查找图片所在的预览容器
        const previewItem = buttonElement.closest('.image-preview-item');
        if (!previewItem) {
            console.error('找不到图片预览项');
            return;
        }
        
        const previewContainer = previewItem.parentElement;
        if (!previewContainer) {
            console.error('找不到预览容器');
            return;
        }

        if (imageUrlsInput) {
            let currentUrls = imageUrlsInput.value ? JSON.parse(imageUrlsInput.value) : [];
            // 查找并移除对应的URL
            const index = currentUrls.indexOf(imageUrl);
            if (index > -1) {
                currentUrls.splice(index, 1);
                imageUrlsInput.value = JSON.stringify(currentUrls);

                // 移除DOM元素
                previewItem.remove();
            }
        }
    }

    // 保存信息
    async function saveInfo() {
        const infoId = document.getElementById('info-id').value;
        
        // 获取基本信息
        const name = document.getElementById('name').value;
        const phone = document.getElementById('phone').value;
        const age = document.getElementById('age').value;
        const occupation = document.getElementById('occupation').value;
        
        // 获取借款信息
        const loanAmount = document.getElementById('loan-amount').value;
        const repaymentAmount = document.getElementById('repayment-amount').value;
        const periodValue = document.getElementById('loan-period').value; // 从输入框获取周期值
        if (!periodValue) {
            window.ui.showError('周期不能为空');
            return;
        }
        // 自动计算过期时间
        const now = new Date();
        const expiryTime = new Date(now.getTime() + parseInt(periodValue) * 24 * 60 * 60 * 1000).toISOString();
        
        // 获取已经上传的图片URL（从隐藏字段）
        const imageUrlsInput = document.getElementById('info-image-urls');
        let imageUrls = [];
        if (imageUrlsInput && imageUrlsInput.value) {
            try {
                imageUrls = JSON.parse(imageUrlsInput.value);
                console.log('从隐藏字段获取到的图片URLs:', imageUrls);
            } catch (error) {
                console.error('解析图片URL失败:', error);
                imageUrls = [];
            }
        } else {
            console.warn('隐藏字段不存在或为空，imageUrlsInput:', imageUrlsInput);
            if (imageUrlsInput) {
                console.log('隐藏字段的值:', imageUrlsInput.value);
            }
        }

        try {
            window.ui.showLoading('保存中...');
            
            // 构建content字符串 (仍然保留，用于展示，但主要数据来源是单独的字段)
            const content = [
                `姓名:${name || ''}`,
                `手机:${phone || ''}`,
                `年龄:${age || ''}`,
                `职业:${occupation || ''}`,
                `借款:${loanAmount || ''}`,
                `还款:${repaymentAmount || ''}`,
                `周期:${periodValue || ''}` // content字符串中使用 periodValue
            ].join(',');

            const infoData = {
                title: name || '未命名信息', // 使用姓名作为标题，如果姓名为空则使用默认标题
                content: content,
                loanAmount: loanAmount ? parseFloat(loanAmount) : 0,
                repaymentAmount: repaymentAmount || '', // 还款金额保持字符串或空
                period: periodValue ? parseInt(periodValue) : 0, // 这里赋值给 period 字段
                expiryTime: expiryTime, // 自动计算的过期时间
                status: 'published', // 状态直接设置为 published
                imageUrls: imageUrls // 使用已经上传的图片URL
            };

            console.log('准备保存的信息数据:', infoData);

            let response;
            if (infoId) {
                // 编辑现有信息
                response = await updateInfo(infoId, infoData);
            } else {
                // 创建新信息
                response = await createInfo(infoData);
            }

            window.ui.showSuccess('信息保存成功');
            // 关闭模态框
            if (infoModalInstance) {
                infoModalInstance.hide();
            }
            // 刷新信息列表
            const listResponse = await getInfoList(currentPage, pageSize, document.getElementById('info-search-input').value.trim(), document.getElementById('info-status-filter').value, document.getElementById('info-date-start').value, document.getElementById('info-date-end').value);
            if (listResponse && listResponse.data && listResponse.data.list) {
                await renderInfoList(listResponse.data.list);
                renderPagination(listResponse.total);
            }
        } catch (error) {
            console.error('保存信息失败:', error);
            window.ui.showError('保存信息失败: ' + error.message);
        } finally {
            window.ui.hideLoading();
        }
    }

    // 显示信息模态框 (用于新增和编辑)
    function showInfoModal(info = null) {
        try {
            // 获取模态框元素
            const infoModalEl = document.getElementById('info-modal');
            if (!infoModalEl) {
                throw new Error('找不到信息模态框元素');
            }

            // 如果模态框实例不存在，则创建它
            if (!infoModalInstance) {
                infoModalInstance = new bootstrap.Modal(infoModalEl);
            }

            // 重置表单
            const form = document.getElementById('info-form');
            if (form) {
                form.reset();
            }

            // 清空图片预览
            const coverPreview = document.getElementById('cover-preview');
            if (coverPreview) {
                coverPreview.innerHTML = '';
            }
            const additionalImagesPreview = document.getElementById('additional-images-preview');
            if (additionalImagesPreview) {
                additionalImagesPreview.innerHTML = '';
            }

            // 如果是编辑模式，填充表单数据
            if (info) {
                document.getElementById('info-modal-label').textContent = '编辑信息';
                document.getElementById('info-id').value = info._id;

                // 解析content字段
                const contentFields = parseContentString(info.content);

                // 填充基本信息
                document.getElementById('name').value = contentFields['姓名'] || '';
                document.getElementById('phone').value = contentFields['手机'] || '';
                document.getElementById('age').value = contentFields['年龄'] || '';
                document.getElementById('occupation').value = contentFields['职业'] || '';

                // 填充借款信息
                document.getElementById('loan-amount').value = contentFields['借款'] || '';
                document.getElementById('repayment-amount').value = contentFields['还款'] || '';
                document.getElementById('loan-period').value = contentFields['周期'] || '';

                // 显示现有图片
                if (info.coverImage) {
                    const coverPreview = document.getElementById('cover-preview');
                    // 清空之前的预览
                    coverPreview.innerHTML = '';
                    
                    const img = document.createElement('img');
                    img.src = info.coverImage;
                    img.style.display = 'block';
                    img.className = 'img-thumbnail';
                    img.style.width = '150px';
                    img.style.height = '150px';
                    img.style.objectFit = 'cover';
                    
                    // 添加删除按钮
                    const removeBtn = document.createElement('button');
                    removeBtn.type = 'button';
                    removeBtn.className = 'btn btn-sm btn-danger position-absolute top-0 end-0 m-1';
                    removeBtn.innerHTML = '<i class="bi bi-x"></i>';
                    removeBtn.onclick = () => {
                        coverPreview.innerHTML = '';
                        // 更新隐藏字段
                        const imageUrlsInput = document.getElementById('info-image-urls');
                        if (imageUrlsInput) {
                            let currentUrls = imageUrlsInput.value ? JSON.parse(imageUrlsInput.value) : [];
                            currentUrls = currentUrls.filter(url => url !== info.coverImage);
                            imageUrlsInput.value = JSON.stringify(currentUrls);
                        }
                    };
                    
                    const wrapper = document.createElement('div');
                    wrapper.className = 'position-relative d-inline-block';
                    wrapper.appendChild(img);
                    wrapper.appendChild(removeBtn);
                    coverPreview.appendChild(wrapper);
                }

                if (info.additionalImages && info.additionalImages.length > 0) {
                    const previewContainer = document.getElementById('additional-images-preview');
                    // 清空之前的预览
                    previewContainer.innerHTML = '';
                    
                    info.additionalImages.forEach(imageUrl => {
                        const wrapper = document.createElement('div');
                        wrapper.className = 'position-relative d-inline-block m-1';
                        wrapper.style.width = '150px';
                        wrapper.style.height = '150px';
                        
                        wrapper.innerHTML = `
                            <img src="${imageUrl}" alt="预览图片" class="img-thumbnail" style="width: 100%; height: 100%; object-fit: cover;">
                            <button type="button" class="btn btn-danger btn-sm position-absolute top-0 end-0 m-1" onclick="infoManager.deleteImageFromModal(this, '${imageUrl}')">
                                <i class="bi bi-x"></i>
                            </button>
                        `;
                        previewContainer.appendChild(wrapper);
                    });
                }
            } else {
                // 新增模式
                document.getElementById('info-modal-label').textContent = '新增信息';
                document.getElementById('info-id').value = '';
                // 默认还款期数为15
                document.getElementById('loan-period').value = 15;
                // 默认还款金额为借款金额的1.2倍（初始为空，需监听借款金额输入）
                document.getElementById('repayment-amount').value = '';
                
                // 清空图片预览容器
                const coverPreview = document.getElementById('cover-preview');
                if (coverPreview) {
                    coverPreview.innerHTML = '';
                }
                const additionalImagesPreview = document.getElementById('additional-images-preview');
                if (additionalImagesPreview) {
                    additionalImagesPreview.innerHTML = '';
                }
                
                // 清空隐藏的图片URL字段
                const imageUrlsInput = document.getElementById('info-image-urls');
                if (imageUrlsInput) {
                    imageUrlsInput.value = '[]';
                }

                // 添加自动选择图片按钮
                const coverPreviewContainer = document.getElementById('cover-preview');
                if (coverPreviewContainer) {
                    const autoSelectBtn = document.createElement('button');
                    autoSelectBtn.type = 'button';
                    autoSelectBtn.className = 'btn btn-primary btn-sm mb-2';
                    autoSelectBtn.innerHTML = '<i class="bi bi-magic"></i> 一键填充图片';
                    autoSelectBtn.onclick = async () => {
                        try {
                            // 确保 folderManager 和新的 getFilesForUpload 方法存在
                            if (!window.folderManager || typeof window.folderManager.getFilesForUpload !== 'function') {
                                window.ui.showError('图片管理器未就绪或版本不正确。请在"系统管理"页面加载图片。');
                                return;
                            }

                            // 从内存队列获取文件对象
                            const { coverFiles, additionalFiles } = window.folderManager.getFilesForUpload();

                            if (coverFiles.length === 0 && additionalFiles.length === 0) {
                                window.ui.showError('没有可用的图片。请先在"系统管理"页面加载图片。');
                                return;
                            }
                            
                            window.ui.showLoading(`正在上传 ${coverFiles.length + additionalFiles.length} 张图片...`);
                            
                            const uploadedUrls = {
                                cover: [],
                                additional: []
                            };

                            // 内部辅助函数：上传单个文件并创建预览
                            const uploadAndPreview = async (file, previewContainer) => {
                                const previewWrapper = document.createElement('div');
                                previewWrapper.className = 'image-preview-item position-relative d-inline-block m-1';
                                previewWrapper.style.width = '100px';
                                previewWrapper.style.height = '100px';
                                previewWrapper.innerHTML = `
                                    <div class="uploading-overlay position-absolute top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-light bg-opacity-75">
                                        <div class="spinner-border text-primary spinner-border-sm"></div>
                                        <small>上传中...</small>
                                    </div>
                                `;
                                previewContainer.appendChild(previewWrapper);
                                
                                try {
                                    const imageUrl = await uploadImage(file); // 使用已有的上传函数
                                    previewWrapper.innerHTML = `
                                        <img src="${imageUrl}" alt="预览图片" class="img-fluid" style="width: 100%; height: 100%; object-fit: cover;">
                                        <button type="button" class="btn btn-danger btn-sm position-absolute top-0 end-0 m-1" onclick="infoManager.deleteImageFromModal(this, '${imageUrl}')">
                                            <i class="bi bi-x"></i>
                                        </button>
                                    `;
                                    previewWrapper.dataset.imageUrl = imageUrl;
                                    return imageUrl;
                                } catch (error) {
                                    previewWrapper.remove();
                                    return null;
                                }
                            };

                            // 上传封面图片
                            for (const file of coverFiles) {
                                const url = await uploadAndPreview(file, coverPreviewContainer);
                                if (url) uploadedUrls.cover.push(url);
                            }

                            // 上传更多图片
                            const additionalImagesPreviewContainer = document.getElementById('additional-images-preview');
                            for (const file of additionalFiles) {
                                const url = await uploadAndPreview(file, additionalImagesPreviewContainer);
                                if (url) uploadedUrls.additional.push(url);
                            }
                            
                            // 更新隐藏的URL输入框
                            const imageUrlsInput = document.getElementById('info-image-urls');
                            if (!imageUrlsInput) {
                                // 如果隐藏字段不存在，创建它
                                const newImageUrlsInput = document.createElement('input');
                                newImageUrlsInput.type = 'hidden';
                                newImageUrlsInput.id = 'info-image-urls';
                                newImageUrlsInput.name = 'imageUrls';
                                newImageUrlsInput.value = '[]';
                                const infoForm = document.getElementById('info-form');
                                if (infoForm) {
                                    infoForm.appendChild(newImageUrlsInput);
                                } else {
                                    console.error('找不到info-form，无法创建隐藏字段');
                                    return;
                                }
                            }
                            
                            // 现在确保隐藏字段存在
                            const finalImageUrlsInput = document.getElementById('info-image-urls');
                            if (finalImageUrlsInput) {
                                let currentUrls = finalImageUrlsInput.value ? JSON.parse(finalImageUrlsInput.value) : [];
                                // 合并新旧URL，并去重
                                const finalUrls = [...new Set([...currentUrls, ...uploadedUrls.cover, ...uploadedUrls.additional])];
                                finalImageUrlsInput.value = JSON.stringify(finalUrls);
                                console.log('更新隐藏字段成功，当前URLs:', finalUrls);
                            } else {
                                console.error('隐藏字段创建失败');
                            }

                            window.ui.hideLoading();
                            window.ui.showSuccess(`成功填充 ${uploadedUrls.cover.length} 张封面和 ${uploadedUrls.additional.length} 张更多照片`);

                        } catch (error) {
                            console.error('一键填充图片失败:', error);
                            if (window.ui) {
                                window.ui.showError('一键填充图片失败: ' + error.message);
                            }
                            window.ui.hideLoading();
                        }
                    };
                    // 将按钮添加到 cover-preview 容器的最前面
                    coverPreviewContainer.prepend(autoSelectBtn);
                }
            }

            // 监听借款金额输入，自动计算还款金额
            const loanAmountInput = document.getElementById('loan-amount');
            const repaymentAmountInput = document.getElementById('repayment-amount');
            if (loanAmountInput && repaymentAmountInput) {
                loanAmountInput.oninput = function() {
                    const val = parseFloat(this.value);
                    if (!isNaN(val)) {
                        repaymentAmountInput.value = (val * 1.2).toFixed(2);
                    } else {
                        repaymentAmountInput.value = '';
                    }
                };
            }

            // 自动修正：每次弹窗显示时都重新绑定保存按钮事件，防止事件丢失
            const saveInfoBtn = document.getElementById('save-info-btn');
            if (!saveInfoBtn) {
                if (window.ui && window.ui.showError) {
                    window.ui.showError('保存按钮未找到，请联系管理员或刷新页面！');
                } else {
                    alert('保存按钮未找到，请联系管理员或刷新页面！');
                }
                return;
            }
            saveInfoBtn.onclick = null;
            saveInfoBtn.onclick = saveInfo;

            // 显示模态框
            infoModalInstance.show();
        } catch (error) {
            console.error('显示信息模态框失败:', error);
            if (window.ui) {
                window.ui.showError('无法打开信息表单: ' + error.message);
            }
        }
    }

    // 查看信息详情
    async function viewInfo(id) {
        try {
            window.ui.showLoading('加载中...');
            const response = await getInfoDetail(id);
            const info = response.data;

            // 每次进入详情都同步一次服务器时间
            baseLocalTime = new Date();
            baseServerTime = await syncTimeWithServer();

            if (!info) {
                console.error('在当前信息列表中未找到对应ID的信息:', id);
                window.ui.showError('未找到信息详情');
                return;
            }

            const modalElement = document.getElementById('info-detail-modal');
            if (!modalElement) {
                console.error('找不到信息详情模态框元素');
                return;
            }
            const modal = new bootstrap.Modal(modalElement);
            const content = document.getElementById('info-detail-content');

            // 添加类用于调整布局
            if (content) {
                content.classList.add('info-detail-align');
            }

            // 构建交易按钮HTML
            let transactionButtons = `
                <div class="mt-3">
                    <button class="btn btn-success" onclick="infoManager.repayInfo('${info._id}')">
                        还款 (${info.repaymentAmount}元)
                    </button>
                </div>
            `;

            // 解析content字段
            const contentFields = parseContentString(info.content);

            // 构建图片HTML
            let imagesHtml = '';
            if (info.imageUrls && info.imageUrls.length > 0) {
                imagesHtml = `
                    <tr>
                        <th>图片</th>
                        <td colspan="3">
                            <div class="d-flex flex-wrap info-detail-align">
                                ${info.imageUrls.map(imageUrl => {
                                    // 修复：Cloudinary的完整URL不应该被修改
                                    // 只有相对路径才需要添加前缀
                                    const fullUrl = !imageUrl.startsWith('http') && !imageUrl.startsWith('/') && !imageUrl.startsWith('data:') ? '/' + imageUrl : imageUrl;
                                    return `<img src="${fullUrl}" class="img-thumbnail m-1" style="width: 80px; height: 80px; object-fit: cover;" onerror="this.style.display='none';">`;
                                }).join('')}
                            </div>
                        </td>
                    </tr>
                `;
            }

            let tableHtml = `
                <table class="table table-bordered table-striped">
                    <tbody>
                        <tr>
                            <th>姓名</th>
                            <td>${window.ui.escapeHtml(info.title || '无标题')}</td>
                            <th>状态</th>
                            <td>${
                                (() => {
                                    if (info.status === 'OFFLINE') {
                                        return '<span class="text-warning">已下架</span>';
                                    } else if (info.isPaid === true) { // Should ideally be OFFLINE if paid by auto-repayment
                                        return '<span class="text-success">已还款</span>';
                                    } else if (info.status === 'published' || info.status === 'PUBLISHED') {
                                        return (info.purchasers && info.purchasers.length > 0) ? '售出' : '待售';
                                    }
                                    return '待售'; // Default
                                })()
                            }</td>
                        </tr>
                        <tr>
                            <th>手机</th>
                            <td>${(() => {
                                const phone = contentFields['手机'] || '';
                                if (phone && phone.length === 11) {
                                    return `${phone.substring(0, 3)}******${phone.substring(9)}`;
                                }
                                return 'N/A';
                            })()}</td>
                            <th>年龄</th>
                            <td>${window.ui.escapeHtml(contentFields['年龄'] || 'N/A')}</td>
                        </tr>
                        <tr>
                            <th>职业</th>
                            <td>${window.ui.escapeHtml(contentFields['职业'] || 'N/A')}</td>
                        </tr>
                        <tr>
                            <th>借款</th>
                            <td>${window.ui.escapeHtml(contentFields['借款'] || 'N/A')}</td>
                            <th>还款</th>
                            <td>${window.ui.escapeHtml(contentFields['还款'] || 'N/A')}</td>
                        </tr>
                        <tr>
                            <th>周期</th>
                            <td>${window.ui.escapeHtml(contentFields['周期'] || 'N/A')}</td>
                            <th>倒计时</th>
                            <td>
                                <div class="countdown" style="cursor: pointer;" title="点击查看倒计时状态">
                                    ${info.expiryTime ? '加载中...' : 'N/A'}
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <th>发布人</th>
                            <td>${window.ui.escapeHtml(info.authorName || '未知')}</td>
                            <th>购买者</th>
                            <td>
                                ${info.purchasers && info.purchasers.length > 0 ? 
                                    info.purchasers.map(p => window.ui.escapeHtml(p.username || p._id)).join(', ')
                                    : 'N/A'}
                            </td>
                        </tr>
                        ${imagesHtml}
                    </tbody>
                </table>
            `;

            content.innerHTML = tableHtml + transactionButtons;

            // 处理倒计时
            // 修改倒计时逻辑，根据 saleStatus 和 period 在前端模拟倒计时
            const countdownElement = document.querySelector('.countdown');
            let countdownInterval = null; // 定义定时器变量

            if (countdownElement) { // 确保倒计时元素存在
                // 添加点击事件用于调试
                countdownElement.addEventListener('click', () => {
                    console.log('点击倒计时区域进行诊断:');
                    console.log('信息ID:', info._id);
                    console.log('销售状态 (saleStatus):', info.saleStatus);
                    console.log('周期 (period):', info.period);
                    console.log('period 是否为数字且大于0:', typeof info.period === 'number' && info.period > 0);
                    console.log('启动倒计时条件是否满足:', (info.saleStatus === '售出' || info.saleStatus === '已售出') && typeof info.period === 'number' && info.period > 0);
                });

                if ((info.saleStatus === '售出' || info.saleStatus === '已售出') && typeof info.period === 'number' && info.period > 0) {
                    // 使用购买时间计算到期时间
                    let purchaseTime;
                    if (info.purchaseTime) {
                        purchaseTime = new Date(info.purchaseTime);
                        if (isNaN(purchaseTime.getTime())) {
                            purchaseTime = new Date(info.createdAt);
                        }
                    } else {
                        purchaseTime = new Date(info.createdAt);
                    }
                    const expiryTime = new Date(purchaseTime.getTime() + info.period * 24 * 60 * 60 * 1000);
                    const countdownElement = document.querySelector('.countdown');
                    if (!countdownElement) return;
                    const updateCountdown = () => {
                        const now = new Date();
                        const timePassed = now - baseLocalTime;
                        const currentServerTime = new Date(baseServerTime.getTime() + timePassed);
                        const timeLeft = expiryTime - currentServerTime;
                        if (timeLeft > 0) {
                            const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                            const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
                            countdownElement.innerHTML = `${days}天 ${hours}小时 ${minutes}分钟 ${seconds}秒`;
                        } else {
                            countdownElement.innerHTML = '已到期';
                            if (countdownInterval) {
                                clearInterval(countdownInterval);
                                countdownInterval = null;
                            }
                        }
                    };
                    updateCountdown();
                    countdownInterval = setInterval(updateCountdown, 1000);
                } else if (info.saleStatus === '待售') {
                     // 待售状态不倒计时
                    countdownElement.innerHTML = '未售出，无倒计时';
                } else if (info.saleStatus === '已下架') {
                     // 已下架状态不倒计时
                     countdownElement.innerHTML = '已下架，无倒计时';
                } else {
                    // 其他情况，显示 N/A
                    countdownElement.innerHTML = 'N/A';
                }
            }

            // 在模态框关闭时清除定时器
            modalElement.addEventListener('hidden.bs.modal', () => {
                if (countdownInterval) {
                    clearInterval(countdownInterval);
                    countdownInterval = null;
                }
            });

            modal.show();
        } catch (error) {
            console.error('获取信息详情失败:', error);
            if (window.ui) {
                window.ui.showError('获取信息详情失败: ' + error.message);
            }
        } finally {
            window.ui.hideLoading();
        }
    }

    // 购买信息
    async function purchaseInfo(id) {
        try {
            window.ui.showLoading('购买中...');
            // 假设有这样的API
            const response = await fetch(`/api/info/${id}/purchase`, {
                 method: 'POST',
                 headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                 }
            });
             const data = await response.json();

            if (data.success) {
                window.ui.showSuccess('购买成功');
                // 刷新信息详情模态框内容
                viewInfo(id);
                 // 刷新信息列表
                initInfoPage();
            } else {
                window.ui.showError(data.message || '购买失败');
            }
        } catch (error) {
            console.error('购买失败:', error);
            window.ui.showError('购买失败: ' + error.message);
        } finally {
            window.ui.hideLoading();
        }
    }

    // 还款
    async function repayInfo(id) {
        try {
            window.ui.showLoading('还款处理中...');
            const token = localStorage.getItem('token'); // 直接使用token
            if (!token) {
                throw new Error('未登录，请先登录');
            }

            console.log(`尝试还款信息ID: ${id}`);

            const response = await fetch(`/api/info/${id}/repay`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json' // Even if body is empty, set content type
                },
                 body: JSON.stringify({}) // Send empty object as body
            });

            const data = await response.json();
            console.log(`还款接口响应:`, data);

            if (!response.ok) {
                 // Handle non-2xx responses
                throw new Error(data.message || `还款失败，状态码: ${response.status}`);
            }

            if (data.success) {
                window.ui.showSuccess(data.message || '还款成功');
                // TODO: Close info detail modal and refresh list
                 // Close the info detail modal
                const infoDetailModalElement = document.getElementById('info-detail-modal');
                const infoDetailModalInstance = bootstrap.Modal.getInstance(infoDetailModalElement);
                if (infoDetailModalInstance) {
                    infoDetailModalInstance.hide();
                } else {
                    console.warn('信息详情模态框实例未找到');
                }

                // Refresh the info list
                // Assuming current page and filters should be maintained. 
                // You might need to adjust this if you want to go back to page 1 or clear filters.
                const searchTerm = document.getElementById('info-search-input').value;
                const statusFilter = document.getElementById('info-status-filter').value;
                const startDate = document.getElementById('info-date-start').value;
                const endDate = document.getElementById('info-date-end').value;
                // Call getInfoList with current page and filters
                const response = await getInfoList(currentPage, pageSize, searchTerm, statusFilter, startDate, endDate);
                await renderInfoList(response.data.list);
                renderPagination(response.total);

            } else {
                window.ui.showError(data.message || '还款失败');
            }

        } catch (error) {
            console.error('还款失败:', error);
            window.ui.showError('还款失败: ' + error.message);
        } finally {
            window.ui.hideLoading();
        }
    }

    // 编辑信息
    async function editInfo(id) {
        console.log('编辑信息:', id);
        try {
            const info = await getInfoDetail(id);
            showInfoModal(info); // 调用 showInfoModal 显示编辑界面
        } catch (error) {
            console.error('获取信息详情失败:', error);
            if (window.ui) {
                 window.ui.showError('获取信息详情失败: ' + error.message);
            }
        }
    }

    // 渲染信息列表
    async function renderInfoList(infoList) {
        const infoListContainer = document.getElementById('info-list-container');
        if (!infoListContainer) {
            console.error('信息列表容器未找到!');
            return;
        }

        // 清理旧的倒计时
        activeCardIntervals.forEach(clearInterval);
        activeCardIntervals = [];

        // 同步服务器时间作为倒计时的基准
        // 这部分也可能导致长时间的 showLoading，如果 syncTimeWithServer 耗时较长
        // 考虑将 showLoading/hideLoading 更精确地包裹实际渲染过程
        // window.ui.showLoading('渲染列表...'); // 移动到更精确的位置

        try { // 添加 try-finally 确保 hideLoading
            baseServerTime = await syncTimeWithServer();
            baseLocalTime = new Date().getTime(); // 获取当前的本地时间戳

            // 移除顶部的横幅提示
            const summaryBanner = document.getElementById('auto-repayment-summary-banner');
            if (summaryBanner) {
                summaryBanner.remove(); // 直接移除元素
            }

            infoListContainer.innerHTML = ''; // 清空现有列表

            if (!Array.isArray(infoList) || infoList.length === 0) {
                infoListContainer.innerHTML = `<div class="col-12"><p class="text-center text-muted">暂无信息</p></div>`;
                return;
            }

            // --- 随机打乱infoList顺序 ---
            infoList = infoList.slice(); // 复制一份，避免影响原数组
            for (let i = infoList.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [infoList[i], infoList[j]] = [infoList[j], infoList[i]];
            }
            // --- 随机化结束 ---

            // 生成信息卡片的HTML数组
            const infoCardHtmlArray = infoList.map(info => {
                // 兼容 imageUrls/images 字段
                let imageUrl = '';
                if (Array.isArray(info.imageUrls) && info.imageUrls.length > 0) {
                    imageUrl = info.imageUrls[0];
                } else if (Array.isArray(info.images) && info.images.length > 0) {
                    imageUrl = info.images[0];
                }
                
                // 修复：Cloudinary的完整URL不应该被修改
                // 只有相对路径才需要添加前缀
                if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('/') && !imageUrl.startsWith('data:')) {
                    imageUrl = '/' + imageUrl;
                }

                let statusDisplay = '';
                if (info.status === 'OFFLINE') {
                    statusDisplay = '<span class="text-warning">已下架</span>';
                } else if (info.isPaid === true) {
                    statusDisplay = '<span class="text-success">已还款</span>';
                } else if (info.status === 'published' || info.status === 'PUBLISHED') {
                    statusDisplay = (info.purchasers && info.purchasers.length > 0) ? '售出' : '待售';
                } else {
                    statusDisplay = '待售'; // Default
                }

                // 如果是待处理的自动还款任务，添加标记
                if (info.isPendingAutoRepayment) {
                    statusDisplay += ' <span class="badge bg-primary">待自动还款</span>';
                }

                // 添加警告状态标记
                if (info.isCritical) {
                    statusDisplay += ' <span class="badge bg-danger">已过期</span>';
                } else if (info.isWarning) {
                    statusDisplay += ' <span class="badge bg-warning text-dark">即将到期</span>';
                }

                // 计算卡片样式和警告覆盖
                let cardClass = 'card info-card h-100';
                let cardStyle = 'cursor: pointer;';
                let warningOverlay = '';
                const cardId = `info-card-${info._id}`;

                if (info.isCritical) {
                    cardClass += ' border-danger';
                    cardStyle += 'border-width: 3px; box-shadow: 0 0 20px rgba(220, 53, 69, 0.5);';
                    warningOverlay = `
                        <div class="warning-overlay critical" style="
                            position: absolute;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            background: rgba(220, 53, 69, 0.2);
                            z-index: 10;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            border-radius: 0.375rem;
                        ">
                            <div class="text-danger fw-bold fs-6">
                                <i class="fas fa-exclamation-triangle me-2"></i>
                                已过期！请立即处理
                            </div>
                        </div>
                    `;
                    // 添加到警告系统
                    if (typeof warningSystem !== 'undefined') {
                        warningSystem.addWarningCard(cardId);
                    }
                } else if (info.isWarning) {
                    cardClass += ' border-warning';
                    cardStyle += 'border-width: 2px; box-shadow: 0 0 15px rgba(255, 193, 7, 0.4);';
                    warningOverlay = `
                        <div class="warning-overlay warning" style="
                            position: absolute;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            background: rgba(255, 193, 7, 0.15);
                            z-index: 10;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            border-radius: 0.375rem;
                        ">
                            <div class="text-warning fw-bold">
                                <i class="fas fa-clock me-2"></i>
                                即将到期
                            </div>
                        </div>
                    `;
                    // 添加到警告系统
                    if (typeof warningSystem !== 'undefined') {
                        warningSystem.addWarningCard(cardId);
                    }
                } else if (info.isPendingAutoRepayment) {
                    cardClass += ' border-primary';
                    cardStyle += 'border-width: 2px;';
                }

                // 计算剩余时间显示
                let timeDisplay = '';
                if (info.remainingTime !== null && info.remainingTime !== undefined) {
                    const hours = Math.floor(info.remainingTime / (1000 * 60 * 60));
                    const minutes = Math.floor((info.remainingTime % (1000 * 60 * 60)) / (1000 * 60));
                    
                    if (info.isCritical) {
                        timeDisplay = `<span class="text-danger fw-bold">已过期 ${Math.abs(hours)}小时${Math.abs(minutes)}分钟</span>`;
                    } else if (info.isWarning) {
                        timeDisplay = `<span class="text-warning fw-bold">剩余 ${hours}小时${minutes}分钟</span>`;
                    } else if (hours > 0) {
                        timeDisplay = `<span class="text-muted">剩余 ${hours}小时${minutes}分钟</span>`;
                    }
                }

                return `
                    <div class="col-6 col-sm-4 col-md-3 col-lg-2 col-xl-2 col-xxl-2 mb-4">
                        <div class="${cardClass}" id="${cardId}" data-info-id="${info._id || ''}" style="${cardStyle}">
                            ${warningOverlay}
                            <div class="info-image">
                                ${imageUrl ? 
                                    `<img src="${imageUrl}" class="card-img-top" alt="信息图片" onerror="this.style.display='none';">` :
                                    '<div class="no-image">无图片</div>'}
                            </div>
                            <div class="card-body info-card-content">
                                <h5 class="card-title info-card-title">${window.ui.escapeHtml(info.title || '无标题')}</h5>
                                <p class="card-text info-card-meta">
                                    <small class="text-muted">价格: ¥${info.loanAmount ? info.loanAmount.toFixed(2) : (info.price ? info.price.toFixed(2) : 'N/A')}</small><br>
                                    <small class="text-muted">状态: ${statusDisplay}</small><br>
                                    <small class="text-muted card-countdown-display" id="card-countdown-${info._id || ''}">倒计时: N/A</small>
                                    ${timeDisplay ? `<br><small class="text-muted">${timeDisplay}</small>` : ''}
                                </p>
                                <div class="info-card-actions mt-3">
                                    <button class="btn btn-sm btn-info" onclick="infoManager.viewInfo('${info._id || ''}')">查看</button>
                                    ${(info.status === 'OFFLINE' || !(info.purchasers && info.purchasers.length > 0)) ? `<button class="btn btn-sm btn-danger" onclick="infoManager.deleteInfoConfirm('${info._id || ''}')">删除</button>` : ''}
                                    ${(info.isCritical || info.isWarning) ? `<button class="btn btn-sm btn-warning" onclick="infoManager.repayInfo('${info._id || ''}')">立即还款</button>` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });

            // 将卡片HTML拼接起来，并用一个row div包裹
            infoListContainer.innerHTML = `<div class="row info-card-row g-3">${infoCardHtmlArray.join('')}</div>`;

            // 为每个卡片启动倒计时 (如果适用)
            infoList.forEach(info => {
                const countdownElementId = `card-countdown-${info._id || ''}`;
                const countdownElement = document.getElementById(countdownElementId);

                if (!countdownElement) return;

                if ((info.saleStatus === '售出' || info.saleStatus === '已售出' || (info.purchasers && info.purchasers.length > 0)) && // 兼容 purchaser 判断是否售出
                    typeof info.period === 'number' && info.period > 0 &&
                    info.purchaseTime) {

                    let purchaseTime = new Date(info.purchaseTime);
                    if (isNaN(purchaseTime.getTime()) && info.createdAt) {
                        purchaseTime = new Date(info.createdAt);
                    }

                    if (isNaN(purchaseTime.getTime())) {
                        countdownElement.innerHTML = '倒计时: 时间错误';
                        return;
                    }

                    const expiryTime = new Date(purchaseTime.getTime() + info.period * 24 * 60 * 60 * 1000);

                    const updateThisCardCountdown = () => {
                        const now = new Date(); 
                        const timePassed = now - baseLocalTime; 
                        const currentServerTime = new Date(baseServerTime.getTime() + timePassed);
                        const timeLeft = expiryTime - currentServerTime;

                        if (timeLeft > 0) {
                            const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                            const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
                            countdownElement.innerHTML = `倒计时: ${days}天 ${hours}时 ${minutes}分 ${seconds}秒`;
                        } else {
                            countdownElement.innerHTML = '倒计时: 已到期';
                            const intervalItem = activeCardIntervals.find(item => item.elementId === countdownElementId);
                            if (intervalItem) {
                                clearInterval(intervalItem.intervalId);
                                activeCardIntervals = activeCardIntervals.filter(item => item.elementId !== countdownElementId);
                            }
                        }
                    };
                    updateThisCardCountdown(); 
                    const intervalId = setInterval(updateThisCardCountdown, 1000);
                    activeCardIntervals.push({ elementId: countdownElementId, intervalId: intervalId });
                } else {
                    if (info.saleStatus === '待售' || !(info.purchasers && info.purchasers.length > 0)) {
                        countdownElement.innerHTML = '倒计时: 未售出';
                    } else if (info.saleStatus === '已下架') {
                        countdownElement.innerHTML = '倒计时: 已下架';
                    } else {
                        countdownElement.innerHTML = '倒计时: N/A'; 
                    }
                }
            });
        } catch (error) {
            console.error('渲染信息列表失败:', error);
            window.ui.showError('渲染信息列表失败: ' + error.message);
        } finally {
            // if (isLoadingShown) {
            //     window.ui.hideLoading();
            // }
        }
    }

    // 渲染分页
    const renderPagination = (total) => {
        const pagination = document.querySelector('#info-section .pagination'); // 使用更具体的选择器
        if (!pagination) {
            console.error('找不到分页容器');
            return;
        }

        const totalPages = Math.ceil(total / pageSize);

        let html = '';

        // 上一页
        html += `
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentPage - 1}" onclick="infoManager.goToPage(${currentPage - 1})">上一页</a>
            </li>
        `;

        // 页码
        for (let i = 1; i <= totalPages; i++) {
            html += `
                <li class="page-item ${currentPage === i ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}" onclick="infoManager.goToPage(${i})">${i}</a>
                </li>
            `;
        }

        // 下一页
        html += `
            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentPage + 1}" onclick="infoManager.goToPage(${currentPage + 1})">下一页</a>
            </li>
        `;

        pagination.innerHTML = html;
    };

     // 分页跳转函数
    async function goToPage(page, searchTerm = '', status = '', startDate = '', endDate = '') {
        currentPage = page;
        try {
            window.ui.showLoading("跳转页面..."); // 显示加载提示
            // 调用 getInfoList 获取指定页码和所有过滤条件的信息列表
            const response = await getInfoList(currentPage, pageSize, searchTerm, status, startDate, endDate);
            // 渲染新的信息列表
            if (response && response.data && response.data.list) { // 增加检查
                await renderInfoList(response.data.list);
                // 重新渲染分页（总条数可能因过滤而改变）
                renderPagination(response.total);
            } else {
                 console.error('获取信息列表失败或返回数据格式不正确 (goToPage):', response);
                 window.ui.showError('加载信息列表失败，请稍后重试。');
                 const infoListContainer = document.getElementById('info-list-container');
                 if (infoListContainer) {
                    infoListContainer.innerHTML = '<div class="col-12"><p class="text-center text-danger">加载列表失败</p></div>';
                 }
            }
        } catch (error) {
            console.error('跳转页面失败:', error);
            window.ui.showError('跳转页面失败: ' + error.message);
             const infoListContainer = document.getElementById('info-list-container');
            if (infoListContainer) {
                infoListContainer.innerHTML = '<div class="col-12"><p class="text-center text-danger">加载列表时发生错误</p></div>';
            }
        } finally {
            console.log('即将执行 hideLoading，来自: [goToPage]');
            window.ui.hideLoading();
            console.log('hideLoading 执行完毕，来自: [goToPage]');
        }
    }

    // 绑定事件 (绑定新增信息按钮和保存按钮，图片上传由 handleImageUpload 函数内部处理)
    const initEvents = () => {
        // 为 paginationContainer 和 infoListContainer 定义事件处理函数，以便可以移除它们
        const paginationClickHandler = async (event) => {
            const target = event.target;
            if (target.tagName === 'A' && target.parentElement.classList.contains('page-item')) {
                event.preventDefault();
                const page = parseInt(target.dataset.page);
                if (!isNaN(page)) {
                    const currentSearchTerm = document.getElementById('info-search-input').value.trim();
                    const currentStatusFilter = document.getElementById('info-status-filter').value;
                    const currentStartDate = document.getElementById('info-date-start').value;
                    const currentEndDate = document.getElementById('info-date-end').value;
                    await goToPage(page, currentSearchTerm, currentStatusFilter, currentStartDate, currentEndDate);
                }
            }
        };

        const infoListClickHandler = async (event) => {
            const target = event.target.closest('button[data-info-id][data-action]'); // 更精确地定位按钮

            if (target) {
                const infoId = target.dataset.infoId;
                const action = target.dataset.action;
                console.log(`点击了信息卡片按钮: ID = ${infoId}, Action = ${action}`);

                // 阻止事件冒泡到卡片本身的点击事件 (如果卡片也有点击事件)
                event.stopPropagation(); 

                switch (action) {
                    case 'view':
                        viewInfo(infoId);
                        break;
                    case 'edit': // 假设编辑按钮的 data-action 是 'edit'
                        // 此处需要确保 editInfo 和 deleteInfoConfirm 也可访问
                        // 或者将它们的逻辑直接放在这里或通过 infoManager 调用
                        window.infoManager.editInfo(infoId); 
                        break;
                    case 'delete':
                        window.infoManager.deleteInfoConfirm(infoId);
                        break;
                    default:
                        console.warn('未知操作:', action);
                }
            } else {
                 // 处理卡片本身的点击事件 (如果需要)
                const card = event.target.closest('.info-card[data-info-id]');
                if (card) {
                    const infoId = card.dataset.infoId;
                    // 默认点击卡片是查看详情
                    // window.infoManager.viewInfo(infoId); 
                    // 根据需求决定是否启用，目前按钮已经覆盖了查看操作
                }
            }
        };

        // 获取搜索和过滤元素的引用
        const searchInput = document.getElementById('info-search-input');
        const searchButton = document.getElementById('btn-info-search');
        const statusFilter = document.getElementById('info-status-filter'); // 获取状态过滤下拉框
        const dateStartInput = document.getElementById('info-date-start'); // 获取开始日期输入框
        const dateEndInput = document.getElementById('info-date-end');     // 获取结束日期输入框

        // 搜索/过滤按钮点击事件监听器
        if (searchButton && searchInput && statusFilter && dateStartInput && dateEndInput) {
            searchButton.addEventListener('click', () => {
                const searchTerm = searchInput.value.trim();
                const selectedStatus = statusFilter.value; // 获取选中的状态值
                const startDate = dateStartInput.value; // 获取开始日期值
                const endDate = dateEndInput.value;     // 获取结束日期值


                // 调用 goToPage 并传递所有过滤参数，同时重置页码到1
                goToPage(1, searchTerm, selectedStatus, startDate, endDate);
            });
             // 搜索输入框回车键事件监听
            searchInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    searchButton.click();
                }
            });
        }

        // 新增信息按钮点击事件
        const addInfoBtn = document.getElementById('add-info-btn');
        if (addInfoBtn) {
            // 移除旧的事件监听器，避免重复绑定
            const oldClickListener = addInfoBtn.onclick;
             if (oldClickListener) {
                 addInfoBtn.onclick = null; // 或者使用 removeEventListener
             }
            addInfoBtn.onclick = () => showInfoModal(); // 调用 showInfoModal 打开新增界面
        }

         // 保存信息按钮点击事件
        const saveInfoBtn = document.getElementById('save-info-btn');
        if (saveInfoBtn) {
             // 移除旧的事件监听器，避免重复绑定
            const oldClickListener = saveInfoBtn.onclick;
             if (oldClickListener) {
                 saveInfoBtn.onclick = null; // 或者使用 removeEventListener
             }
            saveInfoBtn.onclick = saveInfo;
        }

        // 图片上传事件
        const coverImageInput = document.getElementById('cover-image');
        const additionalImagesInput = document.getElementById('additional-images');
        
        // 分页点击事件
        const paginationContainer = document.querySelector('#info-section .pagination');
        if (paginationContainer) {
            // 移除旧的监听器 (如果存在)
            if (paginationContainer._clickHandler) {
                paginationContainer.removeEventListener('click', paginationContainer._clickHandler);
            }
            paginationContainer.addEventListener('click', paginationClickHandler);
            paginationContainer._clickHandler = paginationClickHandler; // 保存新的监听器引用
        }

         // 事件委托处理信息卡片的操作按钮（查看、编辑、删除）
         const infoListContainer = document.getElementById('info-list-container');
         if(infoListContainer) {
            // 移除旧的监听器 (如果存在)
            if (infoListContainer._clickHandler) {
                infoListContainer.removeEventListener('click', infoListContainer._clickHandler);
            }
            infoListContainer.addEventListener('click', infoListClickHandler);
            infoListContainer._clickHandler = infoListClickHandler; // 保存新的监听器引用
         }
    };

    // 添加删除信息确认函数
    function deleteInfoConfirm(id) {
        if (confirm('确定要删除这条信息吗？')) {
            deleteInfo(id);
        }
    }

    return {
        _isAdminVersion: true, // 标记为管理员版
        initInfoPage,
        getInfoList,
        createInfo,
        updateInfo,
        deleteInfo,
        getInfoDetail,
        renderInfoList,
        viewInfo,
        editInfo,
        saveInfo,
        showInfoModal,
        deleteImageFromModal, // 导出删除图片函数
        goToPage, // 导出分页跳转函数
        deleteInfoConfirm, // 导出删除确认函数
        repayInfo, // 导出还款函数，确保按钮可用
        handleImageUpload, // 导出图片上传函数
        initAutoRepaymentMonitoring, // 导出自动还款监控初始化函数
        showAutoRepaymentStats, // 导出显示自动还款统计函数
        displayAutoRepaymentStats, // 导出显示自动还款统计弹窗函数
        updateAutoRepaymentStats, // 导出更新自动还款统计函数
        resetAutoRepaymentStats, // 导出重置自动还款统计函数
    };
};

// 创建并导出infoManager
const infoManager = createInfoManager();
// 直接将infoManager赋值给window对象，确保立即可用
window.infoManager = infoManager;

// 在DOMContentLoaded事件中初始化页面
document.addEventListener('DOMContentLoaded', function() {
    // 1. 自动创建 image-preview 容器（如果不存在）
    let previewContainer = document.getElementById('image-preview');
    if (!previewContainer) {
        previewContainer = document.createElement('div');
        previewContainer.id = 'image-preview';
        // 默认插入到 info-form 末尾
        const infoForm = document.getElementById('info-form');
        if (infoForm) {
            infoForm.appendChild(previewContainer);
        } else {
            document.body.appendChild(previewContainer);
        }
    }
    // 2. 自动绑定 input 事件 - 通过 infoManager 调用
    const coverInput = document.getElementById('cover-image');
    if (coverInput && window.infoManager) {
        coverInput.addEventListener('change', window.infoManager.handleImageUpload);
    }
    const additionalInput = document.getElementById('additional-images');
    if (additionalInput && window.infoManager) {
        additionalInput.addEventListener('change', window.infoManager.handleImageUpload);
    }
});

// 显示消息提示 (保持不变)
function showMessage(message, type = 'info') {
    // ... existing code ...
}

// 添加警告音效和通知功能
const warningSystem = {
    audio: null,
    notificationInterval: null,
    warningCards: new Set(),
    
    // 初始化音效
    initAudio: () => {
        try {
            // 创建警告音效（使用Web Audio API）
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
            
            warningSystem.audio = audioContext;
        } catch (error) {
            console.warn('无法创建音效:', error);
        }
    },
    
    // 播放警告音效
    playWarningSound: () => {
        if (warningSystem.audio) {
            try {
                warningSystem.audio.resume();
                warningSystem.initAudio();
            } catch (error) {
                console.warn('播放音效失败:', error);
            }
        }
    },
    
    // 开始持续通知
    startContinuousNotification: () => {
        if (warningSystem.notificationInterval) {
            return; // 已经在运行
        }
        
        console.log('开始持续警告通知');
        warningSystem.notificationInterval = setInterval(() => {
            warningSystem.playWarningSound();
            
            // 浏览器通知
            if (Notification.permission === 'granted') {
                new Notification('还款警告', {
                    body: '有信息即将到期，请及时处理！',
                    icon: '/images/warning-icon.png',
                    tag: 'repayment-warning'
                });
            }
        }, 30000); // 每30秒播放一次
    },
    
    // 停止持续通知
    stopContinuousNotification: () => {
        if (warningSystem.notificationInterval) {
            clearInterval(warningSystem.notificationInterval);
            warningSystem.notificationInterval = null;
            console.log('停止持续警告通知');
        }
    },
    
    // 添加警告卡片
    addWarningCard: (cardId) => {
        warningSystem.warningCards.add(cardId);
        if (warningSystem.warningCards.size > 0) {
            warningSystem.startContinuousNotification();
        }
    },
    
    // 移除警告卡片
    removeWarningCard: (cardId) => {
        warningSystem.warningCards.delete(cardId);
        if (warningSystem.warningCards.size === 0) {
            warningSystem.stopContinuousNotification();
        }
    },
    
    // 请求通知权限
    requestNotificationPermission: () => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }
};

// 初始化警告系统
document.addEventListener('DOMContentLoaded', () => {
    warningSystem.requestNotificationPermission();
});
