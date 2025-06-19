const Info = require('../models/Info');
const fs = require('fs');
const path = require('path');

// 获取所有信息列表
exports.getAllInformation = async (req, res) => {
    try {
        const list = await Info.find().sort({ createdAt: -1 });  // 按创建时间降序排序
        console.log('后端：获取信息列表成功，返回数据:', list);  // 添加日志
        res.json({ success: true, list });
    } catch (err) {
        console.error('获取信息列表失败:', err);  // 添加错误日志
        res.status(500).json({ success: false, message: '获取信息列表失败', error: err.message });
    }
};

// 获取单个信息详情
exports.getInformationById = async (req, res) => {
    try {
        const info = await Info.findById(req.params.id);
        if (!info) {
            return res.status(404).json({ success: false, message: '信息未找到' });
        }
        // 计算倒计时相关字段
        const purchaseTime = info.purchaseTime || info.createdAt;
        const period = info.period || 0;
        let expiryTime = info.expiryTime;
        if (!expiryTime && purchaseTime && period > 0) {
            expiryTime = new Date(new Date(purchaseTime).getTime() + period * 24 * 60 * 60 * 1000);
        }
        let remainingTime = 0;
        if (expiryTime) {
            remainingTime = expiryTime.getTime() - Date.now();
            if (remainingTime < 0) remainingTime = 0;
        }
        // 日志输出关键字段
        console.log('[详情接口] purchaseTime:', purchaseTime, 'period:', period, 'expiryTime:', expiryTime, 'remainingTime:', remainingTime, 'now:', new Date());
        res.json({
            success: true,
            data: {
                ...info.toObject(),
                purchaseTime,
                expiryTime,
                remainingTime
            }
        });
    } catch (err) {
        console.error('获取信息详情失败:', err);  // 添加错误日志
        res.status(500).json({ success: false, message: '获取信息详情失败', error: err.message });
    }
};

// 创建新信息
exports.createInformation = async (req, res) => {
    try {
        const { title, content, author } = req.body;
        const images = req.files ? req.files.map(file => '/uploads/info/' + file.filename) : [];
        
        const info = new Info({ title, content, author, images });
        await info.save();
        
        console.log('后端：创建信息成功，保存的图片路径:', images);  // 添加日志
        res.json({ success: true, info });
    } catch (err) {
        console.error('创建信息失败:', err);  // 添加错误日志
        res.status(500).json({ success: false, message: '创建信息失败', error: err.message });
    }
};

// 更新信息
exports.updateInformation = async (req, res) => {
    try {
        const infoId = req.params.id;
        const { title, content, author } = req.body;
        
        const info = await Info.findById(infoId);
        if (!info) {
            return res.status(404).json({ success: false, message: '信息未找到' });
        }

        // 更新字段
        info.title = title || info.title;
        info.content = content || info.content;
        info.author = author || info.author;

        // 处理新上传的图片
        const newImages = req.files ? req.files.map(file => '/uploads/info/' + file.filename) : [];
        if (newImages.length > 0) {
            info.images = newImages;
        }

        await info.save();
        console.log('后端：更新信息成功，保存的图片路径:', info.images);  // 添加日志
        res.json({ success: true, info });
    } catch (err) {
        console.error('更新信息失败:', err);  // 添加错误日志
        res.status(500).json({ success: false, message: '更新信息失败', error: err.message });
    }
};

// 删除信息
exports.deleteInformation = async (req, res) => {
    const { id } = req.params;
    console.log(`后端：尝试删除信息 ID: ${id}`);

    try {
        // 查找信息以获取图片路径
        const infoToDelete = await Info.findById(id);
        if (!infoToDelete) {
            console.log(`后端：未找到信息 ID: ${id}`);
            return res.status(404).json({ success: false, message: '信息未找到' });
        }

        const imagePaths = infoToDelete.images; // 获取图片路径数组

        // 删除数据库中的信息
        const result = await Info.findByIdAndDelete(id);

        if (!result) {
            console.log(`后端：删除数据库信息失败 ID: ${id}`);
            return res.status(404).json({ success: false, message: '信息未找到或删除失败' });
        }

        console.log(`后端：数据库信息删除成功 ID: ${id}`);

        // 删除服务器上的图片文件
        if (imagePaths && imagePaths.length > 0) {
            console.log(`后端：准备删除 ${imagePaths.length} 张图片...`);
            for (const imagePath of imagePaths) {
                try {
                    // 构建图片文件的绝对路径
                    const absoluteImagePath = path.join(__dirname, '..', '..', 'public', imagePath);
                    await fs.promises.unlink(absoluteImagePath);
                    console.log(`后端：成功删除图片文件: ${absoluteImagePath}`);
                } catch (err) {
                    // 如果文件不存在，不认为是错误，只记录其他错误
                    if (err.code !== 'ENOENT') {
                        console.error(`后端：删除图片文件失败 ${imagePath}:`, err);
                    } else {
                        console.warn(`后端：图片文件未找到或已删除: ${imagePath}`);
                    }
                }
            }
        }

        // 返回成功响应
        res.json({
            success: true,
            message: '删除成功'
        });
    } catch (error) {
        console.error('后端：删除信息失败:', error);
        res.status(500).json({
            success: false,
            message: '删除信息失败'
        });
    }
}; 