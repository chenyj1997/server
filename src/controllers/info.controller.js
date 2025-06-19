console.log('[info.controller.js] __dirname:', __dirname, ' __filename:', __filename);

exports.getInfoById = async (req, res) => {
  try {
    const info = await Info.findById(req.params.id)
      .populate('author', 'username')
      .populate('purchasers', 'username');

    if (!info) {
      return res.status(404).json({ success: false, message: '信息不存在' });
    }

    // 获取当前用户ID
    const userId = req.user?._id?.toString();

    // 查询购买记录，包含买家信息
    const purchase = await Purchase.findOne({
      info: info._id,
      buyer: userId
    }).sort({ createdAt: -1 }); // 按创建时间倒序，获取最新的购买记录

    // 计算时间字段
    let purchaseTime = null;
    let expiryTime = null;
    let remainingTime = null;

    if (purchase) {
      purchaseTime = purchase.createdAt.getTime(); // 恢复为 UTC 毫秒时间戳
      if (info.period) {
        expiryTime = purchaseTime + (info.period * 24 * 60 * 60 * 1000);
        remainingTime = Math.max(0, expiryTime - Date.now());
      }

      // 添加调试日志
      console.log('时间计算:', {
        purchaseTime: new Date(purchaseTime).toISOString(),
        period: info.period,
        expiryTime: new Date(expiryTime).toISOString(),
        remainingTime,
        currentTime: new Date().toISOString(),
        purchaseId: purchase._id,
        infoId: info._id,
        userId: userId
      });
    } else {
      console.warn('未找到购买记录:', {
        infoId: info._id,
        userId: userId
      });
    }

    // 构建响应数据
    const responseData = {
      ...info.toObject(),
      purchaseTime: purchase ? purchase.createdAt.getTime() : null,
      expiryTime: expiryTime !== null ? expiryTime : null,
      remainingTime: remainingTime !== null ? remainingTime : null,
      isPurchased: !!purchase
    };

    // 添加调试日志
    console.log('数据库查询结果:', {
      id: info._id,
      period: info.period,
      loanPeriod: info.loanPeriod,
      rawInfo: info
    });
    console.log('修正后的数据:', {
      id: info._id,
      period: info.period,
      loanPeriod: info.loanPeriod,
      purchaseTime: responseData.purchaseTime,
      expiryTime: responseData.expiryTime,
      remainingTime: responseData.remainingTime,
      isPurchased: responseData.isPurchased
    });

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('获取信息详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取信息详情失败'
    });
  }
};

exports.getPurchasedInfo = async (req, res) => {
  try {
    const { page = 1, pageSize = 20, userId } = req.query;
    const skip = (page - 1) * pageSize;

    // 先查询所有已购信息
    const infos = await Info.find({
      purchasers: userId,
      status: 'published'
    })
      .populate('author', 'username')
      .populate('purchasers', 'username')
      .skip(skip)
      .limit(parseInt(pageSize))
      .sort({ updatedAt: -1 });

    // 为每个已购买的信息拼接时间字段
    const infosWithTime = await Promise.all(infos.map(async (info) => {
      let infoObj = info.toObject();
      let purchaseTime = null;
      let expiryTime = null;
      let remainingTime = null;
      
      // 查询购买记录
      const purchase = await Purchase.findOne({
        info: info._id,
        buyer: userId
      }).sort({ createdAt: -1 }); // 按创建时间倒序，获取最新的购买记录
      
      if (purchase) {
        purchaseTime = purchase.createdAt.getTime(); // 恢复为 UTC 毫秒时间戳
        if (info.period) {
          expiryTime = purchaseTime + (info.period * 24 * 60 * 60 * 1000);
          remainingTime = Math.max(0, expiryTime - Date.now());
        }
        
        // 添加调试日志
        console.log('已购列表时间计算:', {
          purchaseTime: new Date(purchaseTime).toISOString(),
          period: info.period,
          expiryTime: new Date(expiryTime).toISOString(),
          remainingTime,
          currentTime: new Date().toISOString(),
          purchaseId: purchase._id,
          infoId: info._id,
          userId: userId
        });
      } else {
        console.warn('未找到购买记录:', {
          infoId: info._id,
          userId: userId
        });
      }

      // 创建新的响应对象，包含所有必要字段
      const responseData = {
        ...infoObj,
        purchaseTime: purchase ? purchase.createdAt.getTime() : null,
        expiryTime: expiryTime !== null ? expiryTime : null,
        remainingTime: remainingTime !== null ? remainingTime : null,
        isPurchased: !!purchase
      };

      // 添加调试日志
      console.log('已购信息项响应:', {
        id: info._id,
        title: info.title,
        purchaseTime: responseData.purchaseTime,
        expiryTime: responseData.expiryTime,
        remainingTime: responseData.remainingTime
      });

      return responseData;
    }));

    // 添加调试日志
    console.log('已购信息列表响应:', {
      total: infosWithTime.length,
      userId: userId,
      firstItem: infosWithTime[0] ? {
        id: infosWithTime[0]._id,
        title: infosWithTime[0].title,
        purchaseTime: infosWithTime[0].purchaseTime,
        expiryTime: infosWithTime[0].expiryTime,
        remainingTime: infosWithTime[0].remainingTime
      } : null
    });

    res.json({ success: true, data: infosWithTime });
  } catch (err) {
    console.error('获取已购信息列表失败:', err);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}; 