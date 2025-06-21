/**
 * 系统管理模块
 * 处理文件和数据清理等系统级功能
 */

// 创建全局系统管理对象
function createSystemManager() {
    const systemManager = {};

    // 获取过滤参数
    systemManager.getFilterParams = function() {
        const dateBeforeInput = document.getElementById('system-date-filter');
        const searchInput = document.getElementById('system-search');

        const filters = {};
        if (dateBeforeInput && dateBeforeInput.value) {
            filters.dateBefore = dateBeforeInput.value; // 日期筛选
        }
        if (searchInput && searchInput.value) {
            filters.search = searchInput.value.trim(); // 搜索关键字
        }

        return filters;
    };

    // 扫描未使用文件和数据
    systemManager.scanUnusedFiles = async function() {
        try {
            if (window.ui) window.ui.showLoading('扫描中...');

            const filters = this.getFilterParams();
            const params = new URLSearchParams(filters);

            const result = await window.api.fetchWithAuth(`/api/system/scan?${params.toString()}`);
            this.renderScanResults(result.data);

            if (window.ui) window.ui.showSuccess('扫描完成');

        } catch (error) {
            if (window.ui) window.ui.showError(error.message || '扫描过程中发生错误');
        } finally {
            if (window.ui) window.ui.hideLoading();
        }
    };

    // 渲染扫描结果
    systemManager.renderScanResults = function(results) {
        const resultsContainer = document.getElementById('system-scan-results');
        if (!resultsContainer) {
            return;
        }

        resultsContainer.innerHTML = ''; // 清空现有结果

        if (!results || results.length === 0) {
            resultsContainer.innerHTML = '<p class="text-center">没有找到未使用文件。</p>';
            // 禁用清理按钮
            document.getElementById('btn-clean-files').disabled = true;
            return;
        }

        // 启用清理按钮
        document.getElementById('btn-clean-files').disabled = false;

        // 创建表格
        const table = document.createElement('table');
        table.classList.add('table', 'table-striped', 'table-hover');

        // 创建表头
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th><input type="checkbox" id="select-all-files"></th> <!-- 全选复选框 -->
                <th>文件路径</th>
                <th>文件大小</th>
                <th>最后修改日期</th>
            </tr>
        `;
        table.appendChild(thead);

        // 创建表体并填充数据
        const tbody = document.createElement('tbody');
        results.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="checkbox" class="file-checkbox" data-file-path="${item.filePath}"></td>
                <td>${item.filePath}</td>
                <td>${(item.size / 1024).toFixed(2)} KB</td> <!-- 简单转换为KB -->
                <td>${new Date(item.lastModified).toLocaleString()}</td>
            `;
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);

        resultsContainer.appendChild(table);

        // 绑定全选事件
        document.getElementById('select-all-files').addEventListener('change', function(e) {
            const isChecked = e.target.checked;
            document.querySelectorAll('.file-checkbox').forEach(checkbox => {
                checkbox.checked = isChecked;
            });
        });
    };

    // 清理未使用文件
    systemManager.cleanUnusedFiles = async function() {
        // 获取所有被选中的文件
        const selectedFiles = Array.from(document.querySelectorAll('.file-checkbox:checked'))
            .map(checkbox => checkbox.getAttribute('data-file-path'));

        if (selectedFiles.length === 0) {
            if (window.ui) window.ui.showWarning('请选择要清理的文件');
            return;
        }

        if (!confirm(`确定要删除选中的 ${selectedFiles.length} 个文件吗？此操作不可逆！`)) {
            return; // 用户取消操作
        }

        try {
            if (window.ui) window.ui.showLoading('清理中...');

            const result = await window.api.fetchWithAuth('/api/system/clean', {
                method: 'POST',
                body: { files: selectedFiles }
            });

            if (window.ui) window.ui.showSuccess(`成功清理 ${result.data.length} 个文件`);

            // 清理完成后，重新扫描并更新列表
            this.scanUnusedFiles();

        } catch (error) {
            if (window.ui) window.ui.showError(error.message || '清理过程中发生错误');
        } finally {
            if (window.ui) window.ui.hideLoading();
        }
    };

    // 加载充值/提现订单
    systemManager.loadTransactions = async function() {
        try {
            const result = await window.api.fetchWithAuth('/api/admin/transactions');
            if (result.success) {
                this.renderTransactions(result.data);
            }
        } catch (error) {
            if (window.ui) window.ui.showError('加载订单失败: ' + error.message);
        }
    };

    // 渲染充值/提现订单列表
    systemManager.renderTransactions = function(transactions) {
        const container = document.getElementById('transactions-container');
        if (!container) return;

        if (!transactions || transactions.length === 0) {
            container.innerHTML = '<p class="text-center">暂无订单记录</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'table table-striped';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>用户</th>
                    <th>类型</th>
                    <th>金额</th>
                    <th>状态</th>
                    <th>支付方式</th>
                    <th>凭证</th>
                    <th>创建时间</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
                ${transactions.map(tx => `
                    <tr>
                        <td>${tx.user ? tx.user.username : '未知用户'}</td>
                        <td>${tx.type === 'recharge' ? '充值' : '提现'}</td>
                        <td>${tx.amount}</td>
                        <td>
                            <span class="badge ${tx.status === 'pending' ? 'bg-warning' : 
                                               tx.status === 'approved' ? 'bg-success' : 
                                               'bg-danger'}">
                                ${tx.status === 'pending' ? '待审核' : 
                                  tx.status === 'approved' ? '已通过' : '已拒绝'}
                            </span>
                        </td>
                        <td>${tx.paymentMethod || '-'}</td>
                        <td>
                            ${tx.proof ? 
                                `<a href="${tx.proof}" target="_blank" class="btn btn-sm btn-info">查看凭证</a>` : 
                                '-'}
                        </td>
                        <td>${new Date(tx.createdAt).toLocaleString()}</td>
                        <td>
                            ${tx.status === 'pending' ? `
                                <button class="btn btn-sm btn-success" onclick="systemManager.reviewTransaction('${tx._id}', 'approved')">
                                    通过
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="systemManager.reviewTransaction('${tx._id}', 'rejected')">
                                    拒绝
                                </button>
                            ` : '-'}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        `;

        container.innerHTML = '';
        container.appendChild(table);
    };

    // 审核订单
    systemManager.reviewTransaction = async function(id, status) {
        try {
            const remark = prompt('请输入审核备注（可选）：');
            const result = await window.api.fetchWithAuth(`/api/admin/transactions/${id}/review`, {
                method: 'POST',
                body: JSON.stringify({ status, remark })
            });

            if (result.success) {
                if (window.ui) window.ui.showSuccess('审核成功');
                this.loadTransactions(); // 重新加载订单列表
            }
        } catch (error) {
            if (window.ui) window.ui.showError('审核失败: ' + error.message);
        }
    };

    // 初始化系统管理页面
    systemManager.initSystemPage = () => {
        console.log('[SystemManager] initSystemPage function called.');
        systemManager.bindSystemEvents();
        systemManager.scanUnusedFiles();
        systemManager.loadAdSettings();
        systemManager.loadRebateSettings();
        systemManager.loadTransactions(); // 加载订单列表
    };

    // 绑定系统管理页面事件
    systemManager.bindSystemEvents = () => {
        const scanButton = document.getElementById('btn-scan-files');
        const cleanButton = document.getElementById('btn-clean-files');
        const dateFilterInput = document.getElementById('system-date-filter');
        const searchInput = document.getElementById('system-search');

        // 广告设置保存按钮
        const saveAdBtn = document.getElementById('btn-save-ad-path-settings');
        if (saveAdBtn) {
            saveAdBtn.addEventListener('click', () => systemManager.saveAdSettings());
        }

        // 返利设置保存按钮
        const saveRebateBtn = document.getElementById('btn-save-rebate-settings');
        if (saveRebateBtn) {
            saveRebateBtn.addEventListener('click', () => systemManager.saveRebateSettings());
        }

        // 广告图片上传预览
        const adImageUploadInput = document.getElementById('ad-image-upload');
        if (adImageUploadInput) {
            adImageUploadInput.addEventListener('change', (e) => systemManager.handleAdImageUploadPreview(e));
        }

        // 绑定"扫描"按钮事件
        if (scanButton) {
            scanButton.addEventListener('click', () => {
                systemManager.scanUnusedFiles();
            });
        }

        // 绑定"清理"按钮事件
        if (cleanButton) {
             cleanButton.addEventListener('click', () => {
                systemManager.cleanUnusedFiles();
             });
        }

        // 日期筛选事件绑定
        if (dateFilterInput) {
            dateFilterInput.addEventListener('change', () => {
                systemManager.scanUnusedFiles();
            });
        }

        // 搜索输入框事件绑定 (带防抖)
        let searchTimeout;
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    systemManager.scanUnusedFiles();
                }, 500);
            });
        }
    };

    // 在页面加载完成后调用初始化函数
    document.addEventListener('DOMContentLoaded', () => {
        const systemSection = document.getElementById('system-section');
        if (systemSection && window.location.hash === '#system') {
            console.log('[SystemManager] DOMContentLoaded: #system hash found, calling initSystemPage.');
            systemManager.initSystemPage();
        }
    });

    // 监听 hashchange 事件，以便在单页面应用中切换标签时触发初始化
    window.addEventListener('hashchange', () => {
        const systemSection = document.getElementById('system-section');
        if (systemSection && window.location.hash === '#system') {
            console.log('[SystemManager] hashchange: #system hash found, calling initSystemPage.');
            systemManager.initSystemPage();
        }
    });

    // 加载广告设置
    systemManager.loadAdSettings = async function() {
        try {
            const result = await window.api.fetchWithAuth('/api/system/ad');
            if (result.success && result.data) {
                const settings = result.data;
                const adPathInput = document.getElementById('ad-path-input');
                const adImagePreview = document.querySelector('#ad-image-preview img');
                const noAdImageText = document.getElementById('no-ad-image-text');

                if (adPathInput) {
                    adPathInput.value = settings.adPath || '';
                }

                if (adImagePreview) {
                    if (settings.adImageUrl) {
                        adImagePreview.src = settings.adImageUrl;
                        adImagePreview.style.display = 'block';
                        if (noAdImageText) {
                            noAdImageText.style.display = 'none';
                        }
                    } else {
                        adImagePreview.src = '';
                        adImagePreview.style.display = 'none';
                        if (noAdImageText) {
                            noAdImageText.style.display = 'block';
                        }
                    }
                }
            }
        } catch (error) {
            console.error('加载广告设置失败:', error);
            if (window.ui) window.ui.showError('加载广告设置失败');
        }
    };

    // 保存广告设置
    systemManager.saveAdSettings = async function() {
        try {
            if (window.ui) window.ui.showLoading('保存中...');

            const adPathInput = document.getElementById('ad-path-input');
            const adImageUploadInput = document.getElementById('ad-image-upload');
            const formData = new FormData();

            if (!adPathInput) {
                throw new Error('找不到广告路径输入框');
            }

            formData.append('path', adPathInput.value.trim());
            formData.append('status', 'active');

            const imageFile = adImageUploadInput?.files[0];
            if (imageFile) {
                formData.append('image', imageFile);
        }

            const result = await window.api.fetchWithAuth('/api/system/ads', {
                method: 'POST',
                body: formData
            });

            if (window.ui) window.ui.showSuccess('广告设置保存成功');
            this.loadAds(); // 重新加载广告列表

        } catch (error) {
            if (window.ui) window.ui.showError(error.message || '保存广告设置失败');
        } finally {
            if (window.ui) window.ui.hideLoading();
        }
    };

    // 处理广告图片上传预览
    systemManager.handleAdImageUploadPreview = function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        const adImagePreview = document.querySelector('#ad-image-preview img');
        const noAdImageText = document.getElementById('no-ad-image-text');

        reader.onload = function(e) {
            if (adImagePreview) {
                adImagePreview.src = e.target.result;
                adImagePreview.style.display = 'block';
            }
            if (noAdImageText) {
                noAdImageText.style.display = 'none';
            }
        };

        reader.readAsDataURL(file);
    };

    // 加载返利设置
    systemManager.loadRebateSettings = async function() {
        try {
            const result = await window.api.fetchWithAuth('/api/system/rebate');
            if (result.success && result.data) {
                const settings = result.data;
                const rebatePercentageInput = document.getElementById('rebate-percentage');
                const minRebateAmountInput = document.getElementById('rebate-min-amount');

                if (rebatePercentageInput) {
                    rebatePercentageInput.value = settings.inviteRebatePercentage || 0;
                    rebatePercentageInput.placeholder = `当前比例: ${settings.inviteRebatePercentage || 0}%`;
                }
                if (minRebateAmountInput) {
                    minRebateAmountInput.value = settings.minRebateAmount || 0;
                    minRebateAmountInput.placeholder = `最低金额: ${settings.minRebateAmount || 0}元`;
                }
            }
        } catch (error) {
            console.error('加载返利设置失败:', error);
            if (window.ui) window.ui.showError('加载返利设置失败');
        }
    };

    // 保存返利设置
    systemManager.saveRebateSettings = async function() {
        try {
            if (window.ui) window.ui.showLoading('保存中...');

            const inviteRebatePercentage = document.getElementById('rebate-percentage').value;
            const minRebateAmount = document.getElementById('rebate-min-amount').value;

            const result = await window.api.fetchWithAuth('/api/system/rebate', {
                method: 'POST',
                body: { inviteRebatePercentage, minRebateAmount }
            });

            if (window.ui) window.ui.showSuccess('返利设置保存成功');

        } catch (error) {
            if (window.ui) window.ui.showError(error.message || '保存返利设置失败');
        } finally {
            if (window.ui) window.ui.hideLoading();
        }
    };

    return systemManager;
}

// 实例化systemManager
const systemManager = createSystemManager(); 

// 广告管理相关功能
const adManager = {
    init() {
        this.bindEvents();
        this.loadAds();
    },

    bindEvents() {
        // 添加广告按钮
        document.getElementById('btn-add-ad').addEventListener('click', () => {
            this.showAdModal();
        });

        // 保存广告按钮
        document.getElementById('btn-save-ad').addEventListener('click', () => {
            this.saveAd();
        });

        // 图片上传预览
        document.getElementById('ad-image-upload').addEventListener('change', (e) => {
            this.previewImage(e.target.files[0]);
        });
    },

    showAdModal(ad = null) {
        const modal = document.getElementById('ad-modal');
        const form = document.getElementById('ad-form');
        const idInput = document.getElementById('ad-id');
        const pathInput = document.getElementById('ad-path-input');
        const statusInput = document.getElementById('ad-status');
        const previewImg = document.querySelector('#ad-image-preview img');

        // 检查必要元素是否存在
        if (!modal || !form || !idInput || !pathInput || !statusInput) {
            console.error('广告模态框相关元素未找到');
            return;
        }

        // 重置表单
        form.reset();
        
        // 安全地处理预览图片
        if (previewImg) {
            previewImg.style.display = 'none';
        }

        if (ad) {
            // 编辑模式
            idInput.value = ad._id;
            pathInput.value = ad.path;
            statusInput.checked = ad.status === 'active';
            if (ad.imageUrl && previewImg) {
                previewImg.src = ad.imageUrl;
                previewImg.style.display = 'block';
            }
        } else {
            // 新增模式
            idInput.value = '';
        }

        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();
    },

    async loadAds() {
        try {
            const result = await window.api.fetchWithAuth('/api/system/ads');
            if (result.success) {
                this.renderAds(result.data);
            } else {
                ui.showError('加载广告列表失败');
            }
        } catch (error) {
            console.error('加载广告列表错误:', error);
            ui.showError('加载广告列表失败');
        }
    },

    renderAds(ads) {
        const tbody = document.getElementById('ad-list');
        tbody.innerHTML = ads.map((ad, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>
                    <img src="${ad.imageUrl}" alt="广告预览" style="max-width: 100px; max-height: 60px; object-fit: cover;">
                </td>
                <td>${ad.path}</td>
                <td>
                    <span class="badge ${ad.status === 'active' ? 'bg-success' : 'bg-secondary'}">
                        ${ad.status === 'active' ? '启用' : '禁用'}
                    </span>
                </td>
                <td>${new Date(ad.createdAt).toLocaleString()}</td>
                <td>
                    <button class="btn btn-sm btn-primary me-1" onclick="adManager.showAdModal(${JSON.stringify(ad)})">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="adManager.deleteAd('${ad._id}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    previewImage(file) {
        if (file) {
            const reader = new FileReader();
            const previewImg = document.querySelector('#ad-image-preview img');
            
            if (!previewImg) {
                console.error('预览图片元素未找到');
                return;
            }
            
            reader.onload = (e) => {
                previewImg.src = e.target.result;
                previewImg.style.display = 'block';
            };
            
            reader.readAsDataURL(file);
        }
    },

    async saveAd() {
        const form = document.getElementById('ad-form');
        const formData = new FormData();
        
        formData.append('path', document.getElementById('ad-path-input').value);
        formData.append('status', document.getElementById('ad-status').checked ? 'active' : 'inactive');
        
        const imageFile = document.getElementById('ad-image-upload').files[0];
        if (imageFile) {
            formData.append('image', imageFile);
        }

        const adId = document.getElementById('ad-id').value;
        const url = adId ? `/api/system/ads/${adId}` : '/api/system/ads';
        const method = adId ? 'PUT' : 'POST';

        try {
            const result = await window.api.fetchWithAuth(url, {
                method,
                body: formData
            });
            
            if (result.success) {
                ui.showSuccess(adId ? '广告更新成功' : '广告添加成功');
                bootstrap.Modal.getInstance(document.getElementById('ad-modal')).hide();
                this.loadAds();
            } else {
                ui.showError(result.message || '保存失败');
            }
        } catch (error) {
            console.error('保存广告错误:', error);
            ui.showError('保存失败');
        }
    },

    async deleteAd(id) {
        if (!confirm('确定要删除这条广告吗？')) {
            return;
        }

        try {
            const result = await window.api.fetchWithAuth(`/api/system/ads/${id}`, {
                method: 'DELETE'
            });
            
            if (result.success) {
                ui.showSuccess('广告删除成功');
                this.loadAds();
            } else {
                ui.showError(result.message || '删除失败');
            }
        } catch (error) {
            console.error('删除广告错误:', error);
            ui.showError('删除失败');
        }
    }
};

// 初始化广告管理
document.addEventListener('DOMContentLoaded', () => {
    adManager.init();
}); 

const createFolderManager = () => {
    let coverImageFiles = [];
    let additionalImageFiles = [];
    // 新增一个游标来跟踪用过的图片
    let coverImageCursor = 0;
    let additionalImageCursor = 0;

    return {
        // ... (保持 loadFiles, getStats 不变) ...
        loadFiles: (coverFiles, additionalFiles, deleteAfterUse) => {
            coverImageFiles = Array.from(coverFiles);
            additionalImageFiles = Array.from(additionalFiles);
            // 重置游标
            coverImageCursor = 0;
            additionalImageCursor = 0;
            
            console.log(`[FolderManager] Loaded ${coverImageFiles.length} cover images and ${additionalImageFiles.length} additional images.`);
            
            // 基于deleteAfterUse参数，这里可以决定加载后是否要从本地删除，但目前我们只在内存中操作
        },

        getStats: () => {
            return {
                totalCover: coverImageFiles.length,
                totalAdditional: additionalImageFiles.length,
                // 新增：返回剩余图片数量
                remainingCover: coverImageFiles.length - coverImageCursor,
                remainingAdditional: additionalImageFiles.length - additionalImageCursor,
            };
        },

        // 核心修改：实现"用完即删"的逻辑
        getFilesForUpload: () => {
            // 从系统设置中获取每次选择的数量
            const coverCount = parseInt(document.getElementById('cover-image-count')?.value || 1);
            const additionalCount = parseInt(document.getElementById('additional-image-count')?.value || 3);
            
            // 检查剩余图片是否足够
            const remainingCover = coverImageFiles.length - coverImageCursor;
            const remainingAdditional = additionalImageFiles.length - additionalImageCursor;

            if (remainingCover < coverCount || remainingAdditional < additionalCount) {
                 // 如果任何一种图片不足，就提示用户并返回空数组
                 const errorMessage = `剩余图片不足。需要封面: ${coverCount} (剩余: ${remainingCover}), 需要更多照片: ${additionalCount} (剩余: ${remainingAdditional})。请重新加载图片。`;
                 // 使用 window.ui (如果存在) 显示错误
                 if (window.ui && window.ui.showError) {
                     window.ui.showError(errorMessage);
                 } else {
                    alert(errorMessage);
                 }
                 // 返回空，让调用方知道没有文件可用
                 return { coverFiles: [], additionalFiles: [] };
            }

            // 从当前游标位置"切片"所需数量的图片
            const coverFilesToUpload = coverImageFiles.slice(coverImageCursor, coverImageCursor + coverCount);
            const additionalFilesToUpload = additionalImageFiles.slice(additionalImageCursor, additionalImageCursor + additionalCount);
            
            // *关键*：移动游标，标记这些图片为"已使用"
            coverImageCursor += coverCount;
            additionalImageCursor += additionalCount;
            
            console.log(`[FolderManager] Providing ${coverFilesToUpload.length} cover and ${additionalFilesToUpload.length} additional files.`);
            console.log(`[FolderManager] Next cover cursor at: ${coverImageCursor}, Next additional cursor at: ${additionalImageCursor}`);

            // 更新状态显示
            const stats = document.getElementById('folder-stats');
            if (stats) {
                const newStats = `
                    封面图: ${coverImageFiles.length} (剩余: ${coverImageFiles.length - coverImageCursor}) | 
                    更多照片: ${additionalImageFiles.length} (剩余: ${additionalImageFiles.length - additionalImageCursor})
                `;
                stats.innerHTML = newStats;
            }

            return {
                coverFiles: coverFilesToUpload,
                additionalFiles: additionalFilesToUpload,
            };
        },

        // 新增一个重置方法，方便重新开始
        reset: () => {
            coverImageFiles = [];
            additionalImageFiles = [];
            coverImageCursor = 0;
            additionalImageCursor = 0;
            console.log('[FolderManager] Manager has been reset.');
            const stats = document.getElementById('folder-stats');
            if (stats) {
                stats.innerHTML = '请加载图片文件夹。';
            }
        }
    };
};

const folderManager = createFolderManager();
// 将 folderManager 挂载到 window 对象，以便在 info.js 中访问
window.folderManager = folderManager;

// ... (systemManager的其余代码) ...

// 在 systemManager 的 initSystemPage 中，我们确保事件被正确绑定
// ... 之前的 initSystemPage 代码 ...
// ...
            // 绑定"加载图片"按钮事件
            const loadBtn = document.getElementById('load-images-btn');
            if (loadBtn) {
                loadBtn.onclick = async () => {
                    const coverInput = document.getElementById('cover-image-folder');
                    const additionalInput = document.getElementById('additional-image-folder');
                    const deleteCheckbox = document.getElementById('delete-after-use');

                    if (coverInput.files.length === 0 || additionalInput.files.length === 0) {
                        window.ui.showError('请同时选择封面图片和更多照片文件夹');
                        return;
                    }

                    // 调用 folderManager 的 loadFiles 方法
                    window.folderManager.loadFiles(coverInput.files, additionalInput.files, deleteCheckbox.checked);
                    
                    // 更新统计显示
                    const stats = window.folderManager.getStats();
                    const statsEl = document.getElementById('folder-stats');
                    if (statsEl) {
                        statsEl.innerHTML = `
                            封面图: ${stats.totalCover} (剩余: ${stats.remainingCover}) | 
                            更多照片: ${stats.totalAdditional} (剩余: ${stats.remainingAdditional})
                        `;
                    }
                    window.ui.showSuccess('图片已加载到浏览器内存队列中。');
                };
            }

            // 绑定"保存设置"按钮
            const saveBtn = document.getElementById('save-system-settings-btn');
// ... (后续代码) ... 
