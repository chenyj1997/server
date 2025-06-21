// 图片文件夹管理器
class FolderManager {
    constructor() {
        this.coverFilesQueue = [];
        this.additionalFilesQueue = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadSettings();
        this.updateUI();
    }

    bindEvents() {
        document.getElementById('btn-select-cover-folder')?.addEventListener('click', () => {
            this.loadFiles('cover');
        });

        document.getElementById('btn-select-additional-folder')?.addEventListener('click', () => {
            this.loadFiles('additional');
        });

        document.getElementById('btn-save-folder-settings')?.addEventListener('click', () => {
            this.saveSettings();
        });

        document.getElementById('btn-refresh-folder-status')?.addEventListener('click', () => {
            this.updateUI();
        });

        document.getElementById('btn-test-auto-select')?.addEventListener('click', () => {
            this.testSelection();
        });
    }

    async loadFiles(type) {
        try {
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.accept = 'image/*';
            input.style.display = 'none';

            input.onchange = (event) => {
                const files = Array.from(event.target.files);
                if (files.length > 0) {
                    if (type === 'cover') {
                        this.coverFilesQueue = files;
                        if (window.ui) window.ui.showSuccess(`已加载 ${files.length} 张封面图片到待用队列。`);
                    } else {
                        this.additionalFilesQueue = files;
                        if (window.ui) window.ui.showSuccess(`已加载 ${files.length} 张更多图片到待用队列。`);
                    }
                    this.updateUI();
                }
            };
            
            document.body.appendChild(input);
            input.click();
            document.body.removeChild(input);

        } catch (error) {
            console.error('加载图片失败:', error);
            if (window.ui) window.ui.showError('加载图片失败: ' + error.message);
        }
    }

    loadSettings() {
        const autoDelete = localStorage.getItem('autoDeleteUsedImages') !== 'false';
        const randomSelect = localStorage.getItem('randomSelectImages') !== 'false';
        const coverCount = localStorage.getItem('coverImagesCount') || '1';
        const additionalCount = localStorage.getItem('additionalImagesCount') || '1';

        document.getElementById('auto-delete-used-images').checked = autoDelete;
        document.getElementById('random-select-images').checked = randomSelect;
        document.getElementById('cover-images-count').value = coverCount;
        document.getElementById('additional-images-count').value = additionalCount;
    }

    saveSettings() {
        localStorage.setItem('autoDeleteUsedImages', document.getElementById('auto-delete-used-images').checked);
        localStorage.setItem('randomSelectImages', document.getElementById('random-select-images').checked);
        localStorage.setItem('coverImagesCount', document.getElementById('cover-images-count').value);
        localStorage.setItem('additionalImagesCount', document.getElementById('additional-images-count').value);
        if (window.ui) window.ui.showSuccess('设置已保存到浏览器');
    }

    updateUI() {
        document.getElementById('cover-folder-path').value = `队列中剩余 ${this.coverFilesQueue.length} 张图片`;
        document.getElementById('cover-folder-status').textContent = this.coverFilesQueue.length > 0 ? '已加载' : '未加载';
        document.getElementById('cover-folder-status').className = this.coverFilesQueue.length > 0 ? 'badge bg-success' : 'badge bg-info';
        document.getElementById('cover-folder-count').textContent = `${this.coverFilesQueue.length} 张图片`;
        
        document.getElementById('additional-folder-path').value = `队列中剩余 ${this.additionalFilesQueue.length} 张图片`;
        document.getElementById('additional-folder-status').textContent = this.additionalFilesQueue.length > 0 ? '已加载' : '未加载';
        document.getElementById('additional-folder-status').className = this.additionalFilesQueue.length > 0 ? 'badge bg-success' : 'badge bg-info';
        document.getElementById('additional-folder-count').textContent = `${this.additionalFilesQueue.length} 张图片`;
    }
    
    testSelection() {
        const coverCount = this.coverFilesQueue.length > 0 ? Math.min(parseInt(document.getElementById('cover-images-count').value, 10), this.coverFilesQueue.length) : 0;
        const additionalCount = this.additionalFilesQueue.length > 0 ? Math.min(parseInt(document.getElementById('additional-images-count').value, 10), this.additionalFilesQueue.length) : 0;
        
        if (coverCount === 0 && additionalCount === 0) {
            window.ui.showError('请先加载图片文件到队列');
            return;
        }
        window.ui.showSuccess(`测试成功！将从队列中取出 ${coverCount} 张封面图片和 ${additionalCount} 张更多照片`);
    }

    getFilesForUpload() {
        const coverCount = parseInt(document.getElementById('cover-images-count').value, 10);
        const additionalCount = parseInt(document.getElementById('additional-images-count').value, 10);
        const randomSelect = document.getElementById('random-select-images').checked;
        const autoDelete = document.getElementById('auto-delete-used-images').checked;

        const result = { coverFiles: [], additionalFiles: [] };

        const processQueue = (queue, count) => {
            if (!queue || queue.length === 0) return [];
            
            let tempQueue = [...queue];
            if (randomSelect) {
                tempQueue.sort(() => 0.5 - Math.random());
            }
            
            const filesToTake = tempQueue.slice(0, count);
            
            if (autoDelete) {
                for (const file of filesToTake) {
                    const index = queue.findIndex(f => f === file);
                    if (index !== -1) {
                        queue.splice(index, 1);
                    }
                }
            }
            return filesToTake;
        };

        result.coverFiles = processQueue(this.coverFilesQueue, coverCount);
        result.additionalFiles = processQueue(this.additionalFilesQueue, additionalCount);
        
        this.updateUI();
        
        return result;
    }
}

// 初始化文件夹管理器
window.folderManager = new FolderManager(); 
