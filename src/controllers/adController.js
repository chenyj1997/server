const Ad = require('../../models/Ad');
const fs = require('fs').promises;
const path = require('path');

// 设置广告
exports.setAd = async (req, res) => {
    console.log('adController.setAd: 收到设置广告请求', req.body);
    try {
        const { imageUrl, adPath } = req.body;

        if (!imageUrl || !adPath) {
            console.error('adController.setAd: 缺少 imageUrl 或 adPath');
            return res.status(400).json({
                success: false,
                message: '缺少广告图片URL或跳转链接'
            });
        }

        // 检查图片URL是否有效（这里仅做简单检查，实际生产环境需更健壮的验证）
        // 如果是本地图片路径，需要检查文件是否存在
        if (imageUrl.startsWith('/uploads')) {
            const absoluteImagePath = path.join(__dirname, '../../public', imageUrl);
            try {
                await fs.access(absoluteImagePath, fs.constants.F_OK);
                console.log('adController.setAd: 本地图片文件存在:', absoluteImagePath);
            } catch (fileError) {
                console.error('adController.setAd: 本地图片文件不存在或无法访问:', absoluteImagePath, fileError);
                return res.status(400).json({
                    success: false,
                    message: '广告图片文件不存在或无法访问'
                });
            }
        }

        // 查找现有的广告
        console.log('adController.setAd: 尝试查找现有广告...');
        let ad = await Ad.findOne();
        
        if (ad) {
            // 如果存在广告，则更新
            console.log('adController.setAd: 找到现有广告，进行更新');
            ad.imageUrl = imageUrl;
            ad.adPath = adPath;
            ad.updatedAt = new Date();
            await ad.save();
            console.log('adController.setAd: 广告更新成功:', ad);
        } else {
            // 如果不存在广告，则创建新的
            console.log('adController.setAd: 未找到现有广告，创建新广告');
            ad = new Ad({
                imageUrl,
                adPath
            });
            await ad.save();
            console.log('adController.setAd: 广告创建成功:', ad);
        }

        res.json({
            success: true,
            message: '广告设置成功',
            data: ad
        });
    } catch (error) {
        console.error('adController.setAd: 设置广告失败，捕获到异常:', error);
        res.status(500).json({
            success: false,
            message: '设置广告失败',
            error: error.message
        });
    }
};

// 获取广告
exports.getAd = async (req, res) => {
    console.log('adController.getAd: 收到获取广告请求');
    try {
        const ad = await Ad.findOne({ status: 'active' });
        
        if (!ad) {
            console.log('adController.getAd: 数据库中没有找到活动的广告');
            return res.json({
                success: true,
                data: {
                    imageUrl: '',
                    adPath: ''
                }
            });
        }
        console.log('adController.getAd: 成功获取到广告数据:', ad);
        res.json({
            success: true,
            data: ad
        });
    } catch (error) {
        console.error('adController.getAd: 获取广告失败，捕获到异常:', error);
        res.status(500).json({
            success: false,
            message: '获取广告失败',
            error: error.message
        });
    }
};

// 删除广告
exports.deleteAd = async (req, res) => {
    console.log('adController.deleteAd: 收到删除广告请求', req.params);
    try {
        const { id } = req.params;
        
        // 查找并删除广告
        const ad = await Ad.findByIdAndDelete(id);
        
        if (!ad) {
            console.log('adController.deleteAd: 未找到要删除的广告');
            return res.status(404).json({
                success: false,
                message: '广告不存在'
            });
        }

        // 如果广告有本地图片，删除图片文件
        if (ad.imageUrl && ad.imageUrl.startsWith('/uploads')) {
            const absoluteImagePath = path.join(__dirname, '../../public', ad.imageUrl);
            try {
                await fs.unlink(absoluteImagePath);
                console.log('adController.deleteAd: 成功删除广告图片文件:', absoluteImagePath);
            } catch (fileError) {
                console.warn('adController.deleteAd: 删除广告图片文件失败:', fileError);
                // 继续执行，不中断删除流程
            }
        }

        console.log('adController.deleteAd: 成功删除广告:', ad);
        res.json({
            success: true,
            message: '广告删除成功'
        });
    } catch (error) {
        console.error('adController.deleteAd: 删除广告失败，捕获到异常:', error);
        res.status(500).json({
            success: false,
            message: '删除广告失败',
            error: error.message
        });
    }
};

// 获取广告列表
exports.getAds = async (req, res) => {
    console.log('adController.getAds: 收到获取广告列表请求');
    try {
        const ads = await Ad.find().sort({ createdAt: -1 });
        
        console.log('adController.getAds: 成功获取广告列表:', ads);
        res.json({
            success: true,
            data: ads
        });
    } catch (error) {
        console.error('adController.getAds: 获取广告列表失败，捕获到异常:', error);
        res.status(500).json({
            success: false,
            message: '获取广告列表失败',
            error: error.message
        });
    }
}; 