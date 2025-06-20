const express = require('express');
const multer = require('multer');
const cloudinary = require('../utils/cloudinary');
const fs = require('fs');

const router = express.Router();
const upload = multer({ dest: 'tmp_uploads/' }); // 临时存储目录

// 上传图片接口
router.post('/image', upload.single('file'), async (req, res) => {
  try {
    // 上传到 Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'uploads', // Cloudinary 文件夹，可自定义
      public_id: Date.now() + '-' + req.file.originalname
    });
    // 删除本地临时文件
    fs.unlinkSync(req.file.path);

    // 返回 cloudinary 的图片地址
    res.json({
      success: true,
      url: result.secure_url, // Cloudinary 图片访问地址
      public_id: result.public_id
    });
  } catch (err) {
    // 打印 cloudinary 错误
    console.error('cloudinary 上传失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
