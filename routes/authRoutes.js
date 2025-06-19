// 用户注册
router.post('/register', async (req, res) => {
    try {
        
        const { username, password, email, phone } = req.body;
        
        // 只验证用户名和密码
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: '用户名和密码不能为空'
            });
        }
        
        // 检查用户名是否已存在
        const existingUser = await User.findOne({ username });
        
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: '用户名已被注册'
            });
        }
        
        // 创建新用户，确保email和phone为空时不设置这些字段
        const userData = {
            username,
            password,
            balance: 0,
            role: 'user'
        };
        
        // 只有当email和phone有值时才添加到userData中
        if (email && email.trim()) {
            userData.email = email.trim();
        }
        if (phone && phone.trim()) {
            userData.phone = phone.trim();
        }
        
        const user = new User(userData);
        await user.save();
        
        // 生成JWT令牌
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({
            success: true,
            message: '注册成功',
            data: {
                token,
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    phone: user.phone,
                    balance: user.balance,
                    role: user.role
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '注册失败',
            error: error.message
        });
    }
});

// 验证邮箱格式
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// 验证手机号格式
function isValidPhone(phone) {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone);
} 