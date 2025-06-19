const express = require('express');
const router = express.Router();
const RechargePath = require('../models/RechargePath');
const fs = require('fs');
const path = require('path');

// 检查文件是否存在
function fileExists(filePath) {
    try {
        // 统一处理路径格式
        const relativePath = filePath.replace(/^\//, '');
        const fullPath = path.join(__dirname, '..', 'public', relativePath);
        return fs.existsSync(fullPath);
    } catch (err) {
        console.error('检查文件出错:', err);
        return false;
    }
}

// 添加测试路由，显示所有充值路径和图片状态
router.get('/debug', async (req, res) => {
    try {
        const paths = await RechargePath.find();
        
        // 添加文件状态信息
        const pathsWithFileStatus = paths.map(path => {
            const data = path.toObject();
            
            // 检查图标文件
            data.iconStatus = {
                path: data.icon,
                exists: data.icon ? fileExists(data.icon) : false
            };
            
            // 检查二维码文件
            data.qrCodeStatus = {
                path: data.qrCode,
                exists: data.qrCode ? fileExists(data.qrCode) : false
            };
            
            return data;
        });
        
        // 返回调试信息
        res.json({
            success: true,
            message: '充值路径调试信息',
            data: pathsWithFileStatus,
            system: {
                nodeVersion: process.version,
                platform: process.platform,
                cwd: process.cwd(),
                publicDir: path.join(__dirname, '..', 'public'),
                uploadsDir: path.join(__dirname, '..', 'public', 'uploads')
            }
        });
    } catch (error) {
        console.error('获取充值路径调试信息错误:', error);
        res.status(500).json({
            success: false,
            message: '获取充值路径调试信息失败',
            error: error.message
        });
    }
});

// 获取充值路径列表
router.get('/', async (req, res) => {
    try {
        const rechargePaths = await RechargePath.find({ active: true })
            .sort({ sort: 1 });

        res.json({
            success: true,
            data: rechargePaths
        });
    } catch (error) {
        console.error('获取充值路径列表错误:', error);
        res.status(500).json({
            success: false,
            message: '获取充值路径列表失败'
        });
    }
});

// 创建充值路径（管理员）
router.post('/', async (req, res) => {
    try {
        const { name, icon, account, qrCode, sort } = req.body;

        // 创建充值路径
        const rechargePath = new RechargePath({
            name,
            icon,
            account,
            qrCode,
            sort: sort || 0
        });

        await rechargePath.save();

        res.status(201).json({
            success: true,
            message: '创建充值路径成功',
            data: rechargePath
        });
    } catch (error) {
        console.error('创建充值路径错误:', error);
        res.status(500).json({
            success: false,
            message: '创建充值路径失败'
        });
    }
});

// 更新充值路径（管理员）
router.put('/:id', async (req, res) => {
    try {
        const { name, icon, account, qrCode, sort, active } = req.body;

        const rechargePath = await RechargePath.findById(req.params.id);
        if (!rechargePath) {
            return res.status(404).json({
                success: false,
                message: '充值路径不存在'
            });
        }

        // 更新字段
        if (name) rechargePath.name = name;
        if (icon) rechargePath.icon = icon;
        if (account) rechargePath.account = account;
        if (qrCode) rechargePath.qrCode = qrCode;
        if (sort !== undefined) rechargePath.sort = sort;
        if (active !== undefined) rechargePath.active = active;

        await rechargePath.save();

        res.json({
            success: true,
            message: '更新充值路径成功',
            data: rechargePath
        });
    } catch (error) {
        console.error('更新充值路径错误:', error);
        res.status(500).json({
            success: false,
            message: '更新充值路径失败'
        });
    }
});

// 删除充值路径（管理员）
router.delete('/:id', async (req, res) => {
    try {
        const rechargePath = await RechargePath.findById(req.params.id);
        if (!rechargePath) {
            return res.status(404).json({
                success: false,
                message: '充值路径不存在'
            });
        }

        await rechargePath.remove();

        res.json({
            success: true,
            message: '删除充值路径成功'
        });
    } catch (error) {
        console.error('删除充值路径错误:', error);
        res.status(500).json({
            success: false,
            message: '删除充值路径失败'
        });
    }
});

module.exports = router; 