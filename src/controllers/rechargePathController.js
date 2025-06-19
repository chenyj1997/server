// server/src/controllers/rechargePathController.js

const RechargePath = require('../models/RechargePath'); // 引入充值路径模型
const path = require('path');
const fs = require('fs');

// TODO: 引入文件上传中间件，例如 multer

// 创建充值路径
const createRechargePath = async (req, res) => {
    try {
        console.log('后端：接收到创建充值路径的请求:');
        console.log('req.body:', req.body); // 文本字段数据
        console.log('req.files:', req.files); // 文件数据 (如果使用了文件上传中间件)

        // TODO: 处理文件上传，获取文件路径
        let iconPath = '';
        let qrcodePath = '';

        // 假设使用了 multer，文件会保存在 req.files 中
        if (req.files && req.files.icon && req.files.icon[0]) {
            iconPath = '/uploads/rechargePaths/' + req.files.icon[0].filename; // 假设保存在 /uploads/rechargePaths 目录下
        }
        if (req.files && req.files.qrcode && req.files.qrcode[0]) {
            qrcodePath = '/uploads/rechargePaths/' + req.files.qrcode[0].filename; // 假设保存在 /uploads/rechargePaths 目录下
        }

        // 从 req.body 中获取文本字段数据
        const { name, type, account, receiver, status } = req.body; // 注意：status 字段可能从前端传来

        // 创建新的充值路径实例
        const newRechargePath = new RechargePath({
            name,
            type,
            account,
            receiver,
            icon: iconPath,
            qrcode: qrcodePath,
            status: status || 'active' // 如果前端没有传 status，默认为 active
        });

        // 保存到数据库
        await newRechargePath.save();

        console.log('后端：充值路径创建成功:', newRechargePath);
        res.status(201).json({ code: 0, message: '充值路径创建成功', data: newRechargePath });

    } catch (error) {
        console.error('后端：创建充值路径失败:', error); // 添加错误日志
        res.status(500).json({ code: 1, message: '创建充值路径失败', error: error.message }); // 返回详细错误信息
    }
};

// TODO: 实现获取充值路径列表、更新充值路径、删除充值路径的函数

// 获取充值路径列表
const getRechargePaths = async (req, res) => {
    try {
        console.log('后端：正在获取充值路径列表...'); // 添加日志
        const rechargePaths = await RechargePath.find(); // 查询所有充值路径

        console.log('后端：获取充值路径列表成功，返回数据数量:', rechargePaths.length); // 添加日志
        res.status(200).json({ code: 0, message: '获取充值路径列表成功', data: rechargePaths });

    } catch (error) {
        console.error('后端：获取充值路径列表失败:', error); // 添加错误日志
        res.status(500).json({ code: 1, message: '获取充值路径列表失败', error: error.message });
    }
};

// TODO: 实现更新充值路径、删除充值路径的函数 

// 删除充值路径
const deleteRechargePath = async (req, res) => {
    try {
        // 从请求参数中获取充值路径的ID
        const { id } = req.params;

        // 查找并删除指定的充值路径
        const deletedPath = await RechargePath.findByIdAndDelete(id);

        // 如果没有找到该充值路径
        if (!deletedPath) {
            return res.status(404).json({ message: '找不到该充值路径' }); // 返回404错误
        }

        // 返回成功信息
        res.status(200).json({ message: '充值路径删除成功' });
    } catch (error) {
        // 捕获并处理错误
        console.error('删除充值路径错误:', error);
        res.status(500).json({ message: '服务器内部错误', error: error.message }); // 返回500错误
    }
};

// 导出所有控制器函数
module.exports = {
    createRechargePath,
    getRechargePaths,
    deleteRechargePath
}; 