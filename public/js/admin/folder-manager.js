// 图片文件夹管理器
class FolderManager {
    constructor() {
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadSettings();
        this.refreshFolderStatus();
    }

    bindEvents() {
        // 选择文件夹按钮
        document.getElementById('btn-select-cover-folder')?.addEventListener('click', () => {
            this.selectFolder('cover');
        });

        document.getElementById('btn-select-additional-folder')?.addEventListener('click', () => {
            this.selectFolder('additional');
        });

        // 保存设置
        document.getElementById('btn-save-folder-settings')?.addEventListener('click', () => {
            this.saveSettings();
        });

        // 刷新状态
        document.getElementById('btn-refresh-folder-status')?.addEventListener('click', () => {
            this.refreshFolderStatus();
        });

        // 测试自动选择
        document.getElementById('btn-test-auto-select')?.addEventListener('click', () => {
            this.testAutoSelect();
        });
    }

    // 选择文件夹
    async selectFolder(type) {
        try {
            // 由于浏览器安全限制，我们使用输入框让用户手动输入路径
            const inputId = type === 'cover' ? 'cover-folder-path' : 'additional-folder-path';
            const input = document.getElementById(inputId);
            
            // 提示用户输入文件夹路径
            const folderPath = prompt(`请输入${type === 'cover' ? '封面' : '更多'}图片文件夹的完整路径：`);
            
            if (folderPath && folderPath.trim()) {
                input.value = folderPath.trim();
                
                // 保存到本地存储
                localStorage.setItem(`${type}FolderPath`, folderPath.trim());
                
                // 刷新状态
                await this.refreshFolderStatus();
                
                if (window.ui) {
                    window.ui.showSuccess(`${type === 'cover' ? '封面' : '更多'}图片文件夹已设置`);
                }
            }
        } catch (error) {
            console.error('选择文件夹失败:', error);
            if (window.ui) {
                window.ui.showError('选择文件夹失败: ' + error.message);
            }
        }
    }

    // 加载设置
    loadSettings() {
        const coverPath = localStorage.getItem('coverFolderPath');
        const additionalPath = localStorage.getItem('additionalFolderPath');
        const autoDelete = localStorage.getItem('autoDeleteUsedImages') !== 'false';
        const randomSelect = localStorage.getItem('randomSelectImages') !== 'false';
        const coverCount = localStorage.getItem('coverImagesCount') || '1';
        const additionalCount = localStorage.getItem('additionalImagesCount') || '1';

        if (coverPath) {
            document.getElementById('cover-folder-path').value = coverPath;
        }
        if (additionalPath) {
            document.getElementById('additional-folder-path').value = additionalPath;
        }

        document.getElementById('auto-delete-used-images').checked = autoDelete;
        document.getElementById('random-select-images').checked = randomSelect;
        document.getElementById('cover-images-count').value = coverCount;
        document.getElementById('additional-images-count').value = additionalCount;
    }

    // 保存设置
    async saveSettings() {
        try {
            const settings = {
                coverFolderPath: document.getElementById('cover-folder-path').value,
                additionalFolderPath: document.getElementById('additional-folder-path').value,
                autoDeleteUsedImages: document.getElementById('auto-delete-used-images').checked,
                randomSelectImages: document.getElementById('random-select-images').checked,
                coverImagesCount: document.getElementById('cover-images-count').value,
                additionalImagesCount: document.getElementById('additional-images-count').value
            };

            // 保存到本地存储
            localStorage.setItem('coverFolderPath', settings.coverFolderPath);
            localStorage.setItem('additionalFolderPath', settings.additionalFolderPath);
            localStorage.setItem('autoDeleteUsedImages', settings.autoDeleteUsedImages);
            localStorage.setItem('randomSelectImages', settings.randomSelectImages);
            localStorage.setItem('coverImagesCount', settings.coverImagesCount);
            localStorage.setItem('additionalImagesCount', settings.additionalImagesCount);

            // 保存到服务器
            const response = await fetch('/api/admin/folder-settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(settings)
            });

            if (response.ok) {
                if (window.ui) {
                    window.ui.showSuccess('文件夹设置已保存');
                }
            } else {
                throw new Error('保存设置失败');
            }
        } catch (error) {
            console.error('保存设置失败:', error);
            if (window.ui) {
                window.ui.showError('保存设置失败: ' + error.message);
            }
        }
    }

    // 刷新文件夹状态
    async refreshFolderStatus() {
        try {
            const coverPath = document.getElementById('cover-folder-path').value;
            const additionalPath = document.getElementById('additional-folder-path').value;

            // 检查是否为部署环境
            const isDeployed = window.location.hostname.includes('onrender.com') || 
                              window.location.hostname.includes('vercel.app') || 
                              window.location.hostname.includes('herokuapp.com');

            // 更新封面文件夹状态
            if (coverPath) {
                if (isDeployed) {
                    document.getElementById('cover-folder-status').textContent = '已设置 (部署环境)';
                    document.getElementById('cover-folder-status').className = 'badge bg-warning';
                    document.getElementById('cover-folder-count').textContent = '模拟数据';
                } else {
                    const coverCount = await this.getImageCount(coverPath);
                    document.getElementById('cover-folder-status').textContent = '已设置';
                    document.getElementById('cover-folder-status').className = 'badge bg-success';
                    document.getElementById('cover-folder-count').textContent = `${coverCount} 张图片`;
                }
            } else {
                document.getElementById('cover-folder-status').textContent = '未设置';
                document.getElementById('cover-folder-status').className = 'badge bg-info';
                document.getElementById('cover-folder-count').textContent = '0 张图片';
            }

            // 更新更多照片文件夹状态
            if (additionalPath) {
                if (isDeployed) {
                    document.getElementById('additional-folder-status').textContent = '已设置 (部署环境)';
                    document.getElementById('additional-folder-status').className = 'badge bg-warning';
                    document.getElementById('additional-folder-count').textContent = '模拟数据';
                } else {
                    const additionalCount = await this.getImageCount(additionalPath);
                    document.getElementById('additional-folder-status').textContent = '已设置';
                    document.getElementById('additional-folder-status').className = 'badge bg-success';
                    document.getElementById('additional-folder-count').textContent = `${additionalCount} 张图片`;
                }
            } else {
                document.getElementById('additional-folder-status').textContent = '未设置';
                document.getElementById('additional-folder-status').className = 'badge bg-info';
                document.getElementById('additional-folder-count').textContent = '0 张图片';
            }

            // 如果是部署环境，显示提示信息
            if (isDeployed) {
                const feedbackDiv = document.getElementById('folder-settings-feedback');
                if (feedbackDiv) {
                    feedbackDiv.innerHTML = `
                        <div class="alert alert-warning" role="alert">
                            <i class="bi bi-exclamation-triangle"></i>
                            <strong>部署环境提示：</strong> 当前在部署环境中运行，文件夹管理功能将使用模拟数据。
                            完整功能请在本地环境中使用。
                        </div>
                    `;
                }
            }
        } catch (error) {
            console.error('刷新文件夹状态失败:', error);
        }
    }

    // 获取文件夹中的图片数量
    async getImageCount(folderPath) {
        try {
            const response = await fetch('/api/admin/folder-image-count', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ folderPath })
            });

            if (response.ok) {
                const result = await response.json();
                return result.count || 0;
            }
            return 0;
        } catch (error) {
            console.error('获取图片数量失败:', error);
            return 0;
        }
    }

    // 测试自动选择
    async testAutoSelect() {
        try {
            const coverPath = document.getElementById('cover-folder-path').value;
            const additionalPath = document.getElementById('additional-folder-path').value;

            // 检查是否为部署环境
            const isDeployed = window.location.hostname.includes('onrender.com') || 
                              window.location.hostname.includes('vercel.app') || 
                              window.location.hostname.includes('herokuapp.com');

            if (!coverPath && !additionalPath) {
                if (window.ui) {
                    window.ui.showError('请先设置图片文件夹');
                }
                return;
            }

            if (isDeployed) {
                if (window.ui) {
                    window.ui.showSuccess('部署环境测试成功！模拟选择了 1 张封面图片和 1 张更多照片');
                }
                return;
            }

            const response = await fetch('/api/admin/test-auto-select', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    coverFolderPath: coverPath,
                    additionalFolderPath: additionalPath,
                    coverImagesCount: document.getElementById('cover-images-count').value,
                    additionalImagesCount: document.getElementById('additional-images-count').value,
                    randomSelect: document.getElementById('random-select-images').checked
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (window.ui) {
                    window.ui.showSuccess(`测试成功！选择了 ${result.coverImages.length} 张封面图片和 ${result.additionalImages.length} 张更多照片`);
                }
            } else {
                throw new Error('测试失败');
            }
        } catch (error) {
            console.error('测试自动选择失败:', error);
            if (window.ui) {
                window.ui.showError('测试失败: ' + error.message);
            }
        }
    }

    // 自动选择图片（供信息编辑使用）
    async autoSelectImages() {
        try {
            const coverPath = document.getElementById('cover-folder-path').value;
            const additionalPath = document.getElementById('additional-folder-path').value;
            const coverCount = parseInt(document.getElementById('cover-images-count').value);
            const additionalCount = parseInt(document.getElementById('additional-images-count').value);
            const randomSelect = document.getElementById('random-select-images').checked;
            const autoDelete = document.getElementById('auto-delete-used-images').checked;

            if (!coverPath && !additionalPath) {
                throw new Error('未设置图片文件夹');
            }

            const response = await fetch('/api/admin/auto-select-images', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    coverFolderPath: coverPath,
                    additionalFolderPath: additionalPath,
                    coverImagesCount: coverCount,
                    additionalImagesCount: additionalCount,
                    randomSelect,
                    autoDelete
                })
            });

            if (response.ok) {
                const result = await response.json();
                return result;
            } else {
                throw new Error('自动选择图片失败');
            }
        } catch (error) {
            console.error('自动选择图片失败:', error);
            throw error;
        }
    }
}

// 初始化文件夹管理器
window.folderManager = new FolderManager(); 
