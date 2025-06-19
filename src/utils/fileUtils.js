const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const config = require('../config');

// 将fs的异步操作转换为Promise
const unlinkAsync = promisify(fs.unlink);
const existsAsync = promisify(fs.exists);
const mkdirAsync = promisify(fs.mkdir);
const copyFileAsync = promisify(fs.copyFile);

class FileUtils {
    constructor() {
        // 设置基础路径
        this.uploadsDir = path.join(__dirname, '../../public/uploads');
        this.imagesDir = path.join(this.uploadsDir, 'images');
        this.qrcodesDir = path.join(this.uploadsDir, 'qrcodes');
        this.iconsDir = path.join(this.uploadsDir, 'icons');
        this.documentsDir = path.join(this.uploadsDir, 'documents');
        
        // 确保目录存在
        this.ensureDirectories();
    }

    // 确保必要的目录存在
    async ensureDirectories() {
        try {
            const directories = [
                this.uploadsDir,
                this.imagesDir,
                this.qrcodesDir,
                this.iconsDir,
                this.documentsDir
            ];

            for (const dir of directories) {
                if (!await existsAsync(dir)) {
                    await mkdirAsync(dir, { recursive: true });
                    console.log('创建目录:', dir);
                }
            }
        } catch (error) {
            console.error('创建目录失败:', error);
            throw error;
        }
    }

    // 上传文件
    async uploadFile(file, type) {
        try {
            // 验证文件
            this.validateFile(file, type);

            // 确定上传目录
            const uploadDir = path.join(this.uploadsDir, type);
            await this.ensureDirectoryExists(uploadDir);
            
            // 生成文件名
            const extension = path.extname(file.originalname);
            const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}${extension}`;
            const filepath = path.join(uploadDir, filename);
            
            // 移动文件
            await copyFileAsync(file.path, filepath);
            
            // 删除临时文件
            try {
                await unlinkAsync(file.path);
            } catch (unlinkErr) {
                console.error('删除临时文件失败:', unlinkErr);
            }
            
            // 返回文件URL
            return `/uploads/${type}/${filename}`;
        } catch (error) {
            throw error;
        }
    }

    // 删除文件
    async deleteFile(filePath) {
        try {
            console.log('尝试删除文件:', filePath);
            
            if (await existsAsync(filePath)) {
                try {
                    await unlinkAsync(filePath);
                    console.log('文件删除成功:', filePath);
                    return true;
                } catch (unlinkError) {
                    if (unlinkError.code === 'ENOENT') {
                        console.log('文件不存在(unlink):', filePath);
                        return false;
                    }
                    if (unlinkError.code === 'EACCES') {
                        console.error('没有删除文件的权限:', filePath);
                        return false;
                    }
                    throw unlinkError;
                }
            } else {
                console.log('文件不存在(exists):', filePath);
                return false;
            }
        } catch (error) {
            console.error('删除文件失败:', filePath, error);
            return false;
        }
    }

    // 删除信息相关的图片
    async deleteInfoImages(imageUrls) {
        if (!Array.isArray(imageUrls)) return;

        const deletePromises = imageUrls.map(async (imageUrl) => {
            try {
                let fileName = this.extractFileName(imageUrl);
                if (!fileName) return;

                const filePath = path.join(this.imagesDir, fileName);
                await this.deleteFile(filePath);
            } catch (error) {
                console.error('删除图片失败:', imageUrl, error);
            }
        });

        await Promise.all(deletePromises);
    }

    // 验证文件
    validateFile(file, type) {
        // 验证文件大小
        if (file.size > config.upload.maxFileSize) {
            throw new Error('文件大小超过限制');
        }

        // 验证文件类型
        const allowedTypes = config.upload.allowedTypes[type];
        if (!allowedTypes || !allowedTypes.includes(file.mimetype)) {
            throw new Error('不支持的文件类型');
        }

        return true;
    }

    // 辅助方法
    async ensureDirectoryExists(directory) {
        if (!await existsAsync(directory)) {
            await mkdirAsync(directory, { recursive: true });
        }
    }

    extractFileName(imageUrl) {
        if (imageUrl.startsWith('/uploads/images/')) {
            return path.basename(imageUrl);
        } else if (imageUrl.includes('/uploads/images/')) {
            const matches = imageUrl.match(/\/uploads\/images\/([^\/\?#]+)/);
            return matches ? matches[1] : path.basename(imageUrl);
        }
        return path.basename(imageUrl);
    }

    getFullPath(fileName) {
        return path.join(this.imagesDir, fileName);
    }

    getUrlPath(fileName) {
        return `/uploads/images/${fileName}`;
    }
}

// 导出单例
module.exports = new FileUtils(); 