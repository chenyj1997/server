const express = require('express');
const router = express.Router();
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const Info = require('../models/Info'); // 假设信息模型在这里，用于检查图片使用情况
const Transaction = require('../models/Transaction'); // 假设交易模型在这里，用于检查证明文件使用情况
const SystemSetting = require('../models/SystemSetting');
const { protect, restrictToAdmin } = require('../middleware/auth');
const multer = require('multer');
const Ad = require('../models/Ad');

// 辅助函数：递归获取目录下所有文件路径
async function getAllFiles(dirPath, arrayOfFiles) {
    const files = await fsPromises.readdir(dirPath, { withFileTypes: true });
    arrayOfFiles = arrayOfFiles || [];

    for (const file of files) {
        if (file.isDirectory()) {
            arrayOfFiles = await getAllFiles(path.join(dirPath, file.name), arrayOfFiles);
        } else {
            arrayOfFiles.push(path.join(dirPath, file.name));
        }
    }
    return arrayOfFiles;
}

// GET /api/system/scan - 扫描未使用文件和数据
router.get('/scan', async (req, res) => {
    console.log('收到扫描未使用文件请求', req.query);
    try {
        const { dateBefore, search } = req.query; // 获取日期筛选和搜索关键字
        const uploadsDir = path.join(__dirname, '../public/uploads');

        // 1. 遍历文件系统，获取所有上传文件的列表
        console.log('开始遍历上传目录:', uploadsDir);
        let allUploadFiles = [];
        try {
            allUploadFiles = await getAllFiles(uploadsDir);
            console.log('遍历完成，找到文件数:', allUploadFiles.length);
        } catch (fsError) {
            console.error('遍历文件系统失败:', fsError);
            // 如果 uploadsDir 不存在或者没有权限，getAllFiles可能会抛出错误
            if (fsError.code === 'ENOENT') {
                console.warn('上传目录不存在，跳过文件扫描。');
                allUploadFiles = []; // 将文件列表设置为空，继续执行数据库检查
            } else {
                throw fsError; // 其他文件系统错误则向上抛出
            }
        }

        // 2. 从数据库中获取所有被引用的文件路径
        console.log('开始查询数据库中被引用的文件路径...');
        const referencedFiles = new Set();

        // 从 Info 集合获取 imageUrls
        const infos = await Info.find({}, 'imageUrls');
        infos.forEach(info => {
            if (info.imageUrls && Array.isArray(info.imageUrls)) {
                info.imageUrls.forEach(url => {
                    if (url) referencedFiles.add(url); // 添加非空URL
                });
            }
        });
        console.log(`从 Info 集合找到 ${referencedFiles.size} 个图片引用`);

        // 从 Transaction 集合获取 proof
        const transactions = await Transaction.find({}, 'proof');
        transactions.forEach(transaction => {
            if (transaction.proof) {
                referencedFiles.add(transaction.proof); // 添加非空proof路径
            }
        });
        console.log(`从 Transaction 集合找到 ${referencedFiles.size - infos.length} 个证明文件引用`); // 减去Info的引用数量，得到Transaction新增的引用数量
        console.log('数据库中总共被引用的文件路径数:', referencedFiles.size);

        // 3. 对比文件系统和数据库，找出未使用文件
        const unusedFiles = [];
        const dateBeforeFilter = dateBefore ? new Date(dateBefore) : null;
        const searchRegex = search ? new RegExp(search, 'i') : null;

        for (const filePath of allUploadFiles) {
            // 将文件系统路径转换为与数据库中可能存储的相对路径进行对比
            // 假设数据库存储的是相对于 public 目录或 uploads 目录的路径
            // 这里简单处理，假设数据库存储的是 /uploads/... 这样的格式
            const relativeFilePath = path.relative(path.join(__dirname, '../public'), filePath).replace(/\\/g, '/'); // 转换为相对路径并统一斜杠
            const relativeUploadsPath = path.relative(uploadsDir, filePath).replace(/\\/g, '/'); // 相对于uploads目录的路径

            // 检查文件路径是否在数据库的引用列表中
            // 需要根据实际数据库存储格式进行调整这里的对比逻辑
            // 简单对比完整相对路径和相对于uploads的路径
            const isReferenced = referencedFiles.has('/' + relativeFilePath) || referencedFiles.has('/' + relativeUploadsPath) || referencedFiles.has(relativeUploadsPath);
            // TODO: 如果数据库只存文件名，则需要从 filePath 中提取文件名进行对比
            // const fileName = path.basename(filePath);
            // const isReferenced = referencedFileNames.has(fileName);

            if (!isReferenced) {
                // 获取文件的最后修改日期
                const stats = await fsPromises.stat(filePath);
                const lastModified = stats.mtime;

                // 应用日期筛选
                if (dateBeforeFilter && lastModified >= dateBeforeFilter) {
                    continue; // 跳过不符合日期要求的文件
                }

                // 应用搜索筛选 (搜索文件名)
                const fileName = path.basename(filePath);
                if (searchRegex && !searchRegex.test(fileName)) {
                    continue; // 跳过不符合搜索条件的文件名
                }

                // 如果文件未被引用且符合筛选条件，则添加到未使用列表
                unusedFiles.push({
                    filePath: relativeFilePath, // 返回相对于 public 目录的路径
                    lastModified: lastModified,
                    size: stats.size // 可以添加文件大小信息
                });
            }
        }

        console.log('扫描和对比完成，找到未使用文件数:', unusedFiles.length);

        res.json({
            success: true,
            message: '扫描完成',
            data: unusedFiles // 返回未使用文件的列表
        });

    } catch (error) {
        console.error('扫描未使用文件错误:', error);
        res.status(500).json({
            success: false,
            message: '扫描失败',
            error: error.message
        });
    }
});

// POST /api/system/clean - 清理未使用文件
router.post('/clean', async (req, res) => {
    console.log('收到清理未使用文件请求', req.body.files);
    try {
        const filesToClean = req.body.files; // 从请求体获取要清理的文件列表 (应为相对于 public 目录的路径)
        const publicDir = path.join(__dirname, '../public');
        const uploadsDir = path.join(publicDir, 'uploads'); // 上传目录的绝对路径
        const cleanedFilesList = [];

        if (!filesToClean || !Array.isArray(filesToClean) || filesToClean.length === 0) {
            return res.status(400).json({
                success: false,
                message: '请提供要清理的文件列表'
            });
        }

        console.log('开始清理文件...');

        for (const relativeFilePath of filesToClean) {
            // 验证路径是否在 uploads 目录下且是有效的相对路径
            if (relativeFilePath.startsWith('uploads/') || relativeFilePath.startsWith('/uploads/')) { // 检查是否以 uploads/ 或 /uploads/ 开头
                 const absoluteFilePath = path.join(publicDir, relativeFilePath); // 获取文件的绝对路径

                 // 进一步验证绝对路径是否真的在 uploads 目录内，防止路径遍历攻击
                 if (absoluteFilePath.startsWith(uploadsDir + path.sep)) { // 确保路径在 uploadsDir 内
                      console.log('尝试删除安全路径:', absoluteFilePath);
                     try {
                         // 检查文件是否存在再删除，避免不必要的错误
                         await fsPromises.access(absoluteFilePath, fsPromises.constants.F_OK); 
                         await fsPromises.unlink(absoluteFilePath); // 删除文件
                         console.log('成功删除文件:', absoluteFilePath);
                         cleanedFilesList.push(relativeFilePath); // 记录成功删除的文件
                     } catch (deleteError) {
                          console.error('删除文件失败或文件不存在:', absoluteFilePath, deleteError);
                          // 如果是文件不存在的错误 (ENOENT)，可以忽略继续
                          if (deleteError.code !== 'ENOENT') {
                               // 对于其他错误，可以记录日志但不中断进程
                          }
                     }
                 } else {
                      console.warn('尝试删除的路径超出uploads目录范围，拒绝删除:', absoluteFilePath);
                 }
            } else {
                 console.warn('提供的文件路径格式不正确或不在uploads目录下，拒绝删除:', relativeFilePath);
            }
        }

        console.log(`清理完成，成功删除 ${cleanedFilesList.length} 个文件`);

        res.json({
            success: true,
            message: `成功清理 ${cleanedFilesList.length} 个未使用文件`,
            data: cleanedFilesList // 返回成功删除的文件列表
        });

    } catch (error) {
        console.error('清理未使用文件错误:', error);
        res.status(500).json({
            success: false,
            message: '清理失败',
            error: error.message
        });
    }
});

// GET /api/system/ad - 获取广告设置（公开接口）
router.get('/ad', async (req, res) => {
    try {
        const adSettings = await SystemSetting.findOne({ key: 'ad_settings' });
        const settings = adSettings?.value || { adPath: '', adImageUrl: '' };
        console.log('获取广告设置:', settings); // 添加日志
        return res.json({
            success: true,
            data: settings
        });
    } catch (error) {
        console.error('获取广告设置失败:', error);
        res.status(500).json({ success: false, message: '获取广告设置失败' });
    }
});

// PUT /api/system/ad - 更新广告设置（仅管理员）
router.put('/ad', [protect, restrictToAdmin], async (req, res) => {
    try {
        const { adPath, adImageUrl } = req.body;
        console.log('更新广告设置:', { adPath, adImageUrl }); // 添加日志

        // 验证参数
        if (!adPath || !adImageUrl) {
            return res.status(400).json({ 
                success: false, 
                message: '广告链接和图片URL都是必需的' 
            });
        }

        const setting = await SystemSetting.findOneAndUpdate(
            { key: 'ad_settings' },
            { 
                key: 'ad_settings',
                value: { adPath, adImageUrl },
                description: '广告设置'
            },
            { new: true, upsert: true }
        );

        console.log('广告设置已更新:', setting); // 添加日志
        res.json({ 
            success: true, 
            message: '广告设置更新成功',
            data: setting.value
        });
    } catch (error) {
        console.error('更新广告设置失败:', error);
        res.status(500).json({ success: false, message: '更新广告设置失败' });
    }
});

// GET /api/system/rebate - 获取返利设置
router.get('/rebate', async (req, res) => {
    try {
        const rebateSettings = await SystemSetting.findOne({ key: 'rebate_settings' });
        return res.json({
            success: true,
            data: rebateSettings?.value || { inviteRebatePercentage: 0, minRebateAmount: 0 }
        });
    } catch (error) {
        console.error('获取返利设置失败:', error);
        res.status(500).json({ success: false, message: '获取返利设置失败' });
    }
});

// PUT /api/system/rebate - 更新返利设置（仅管理员）
router.put('/rebate', [protect, restrictToAdmin], async (req, res) => {
    try {
        const { inviteRebatePercentage, minRebateAmount } = req.body;
        
        // 验证返利比例
        if (inviteRebatePercentage < 0 || inviteRebatePercentage > 100) {
            return res.status(400).json({ 
                success: false, 
                message: '返利比例必须在0-100之间' 
            });
        }

        // 验证最小返利金额
        if (minRebateAmount < 0) {
            return res.status(400).json({ 
                success: false, 
                message: '最小返利金额不能小于0' 
            });
        }

        await SystemSetting.findOneAndUpdate(
            { key: 'rebate_settings' },
            { 
                key: 'rebate_settings',
                value: { inviteRebatePercentage, minRebateAmount },
                description: '返利设置'
            },
            { upsert: true }
        );
        res.json({ success: true, message: '返利设置更新成功' });
    } catch (error) {
        console.error('更新返利设置失败:', error);
        res.status(500).json({ success: false, message: '更新返利设置失败' });
    }
});

// POST /api/system/rebate - 更新返利设置（仅管理员）
router.post('/rebate', [protect, restrictToAdmin], async (req, res) => {
    try {
        const { inviteRebatePercentage, minRebateAmount } = req.body;
        
        // 验证返利比例
        if (inviteRebatePercentage < 0 || inviteRebatePercentage > 100) {
            return res.status(400).json({ 
                success: false, 
                message: '返利比例必须在0-100之间' 
            });
        }

        // 验证最小返利金额
        if (minRebateAmount < 0) {
            return res.status(400).json({ 
                success: false, 
                message: '最小返利金额不能小于0' 
            });
        }

        await SystemSetting.findOneAndUpdate(
            { key: 'rebate_settings' },
            { 
                key: 'rebate_settings',
                value: { inviteRebatePercentage, minRebateAmount },
                description: '返利设置'
            },
            { upsert: true }
        );
        res.json({ success: true, message: '返利设置更新成功' });
    } catch (error) {
        console.error('更新返利设置失败:', error);
        res.status(500).json({ success: false, message: '更新返利设置失败' });
    }
});

// 配置 multer 存储
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../public/uploads/ads');
        // 确保上传目录存在
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // 生成唯一文件名
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
    // 只允许图片文件
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('只允许上传图片文件！'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 限制5MB
    }
});

// 获取所有广告
router.get('/ads', async (req, res) => {
    try {
        const ads = await Ad.find().sort({ createdAt: -1 });
        res.json({
            success: true,
            data: ads
        });
    } catch (error) {
        console.error('获取广告列表错误:', error);
        res.status(500).json({
            success: false,
            message: '获取广告列表失败'
        });
    }
});

// 添加新广告
router.post('/ads', protect, restrictToAdmin, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: '请上传广告图片'
            });
        }

        const ad = new Ad({
            path: req.body.path,
            imageUrl: `/uploads/ads/${req.file.filename}`,
            status: req.body.status || 'active'
        });

        await ad.save();

        res.json({
            success: true,
            data: ad
        });
    } catch (error) {
        console.error('添加广告错误:', error);
        res.status(500).json({
            success: false,
            message: '添加广告失败'
        });
    }
});

// 更新广告
router.put('/ads/:id', protect, restrictToAdmin, upload.single('image'), async (req, res) => {
    try {
        const ad = await Ad.findById(req.params.id);
        if (!ad) {
            return res.status(404).json({
                success: false,
                message: '广告不存在'
            });
        }

        ad.path = req.body.path;
        ad.status = req.body.status;

        if (req.file) {
            // 删除旧图片
            const oldImagePath = path.join(__dirname, '../public', ad.imageUrl);
            if (fs.existsSync(oldImagePath)) {
                fs.unlinkSync(oldImagePath);
            }
            ad.imageUrl = `/uploads/ads/${req.file.filename}`;
        }

        await ad.save();

        res.json({
            success: true,
            data: ad
        });
    } catch (error) {
        console.error('更新广告错误:', error);
        res.status(500).json({
            success: false,
            message: '更新广告失败'
        });
    }
});

// 删除广告
router.delete('/ads/:id', protect, restrictToAdmin, async (req, res) => {
    try {
        const ad = await Ad.findById(req.params.id);
        if (!ad) {
            return res.status(404).json({
                success: false,
                message: '广告不存在'
            });
        }

        // 删除图片文件
        const imagePath = path.join(__dirname, '../public', ad.imageUrl);
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }

        await Ad.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: '广告删除成功'
        });
    } catch (error) {
        console.error('删除广告错误:', error);
        res.status(500).json({
            success: false,
            message: '删除广告失败'
        });
    }
});

module.exports = router; 