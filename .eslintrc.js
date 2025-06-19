module.exports = {
  env: {
    node: true, // Node.js 环境
    browser: true, // 浏览器环境
    es2021: true, // ES2021 特性支持
    jest: true, // Jest 测试环境
  },
  extends: [
    'eslint:recommended', // 推荐规则
  ],
  parserOptions: {
    ecmaVersion: 12, // ES2021
    sourceType: 'module', // 使用 ES 模块
  },
  rules: {
    // 代码风格规则
    'indent': ['error', 2], // 使用2个空格缩进
    'linebreak-style': ['error', 'unix'], // 使用 Unix 换行符
    'quotes': ['error', 'single'], // 使用单引号
    'semi': ['error', 'always'], // 总是使用分号
    'no-trailing-spaces': 'error', // 禁止行尾空格
    'no-multiple-empty-lines': ['error', { 'max': 1 }], // 最多允许一个空行
    'no-unused-vars': ['warn', { 'argsIgnorePattern': '^_' }], // 未使用的变量改为警告，忽略以下划线开头的参数
    'no-undef': 'error', // 未定义的变量保持错误
    'no-useless-catch': 'off', // 关闭不必要的try/catch警告
    'no-useless-escape': 'off', // 关闭不必要的转义字符警告
    'no-console': ['warn', { allow: ['warn', 'error'] }], // 只允许使用 console.warn 和 console.error
    'no-debugger': 'warn', // 警告使用 debugger
    'no-duplicate-imports': 'error', // 禁止重复导入
    'no-var': 'error', // 禁止使用 var
    'prefer-const': 'error', // 优先使用 const
    'arrow-spacing': 'error', // 箭头函数空格
    'no-confusing-arrow': 'error', // 禁止混淆箭头函数
    'no-const-assign': 'error', // 禁止修改 const 变量
    'no-dupe-args': 'error', // 禁止函数参数重复
    'no-dupe-keys': 'error', // 禁止对象字面量重复键
    'no-duplicate-case': 'error', // 禁止重复的 case 标签
    'no-unreachable': 'error', // 禁止不可达代码
    'valid-typeof': 'error', // 强制 typeof 表达式与有效字符串进行比较
  },
  globals: {
    // 前端全局变量
    $: 'readonly', // jQuery
    jQuery: 'readonly', // jQuery
    bootstrap: 'readonly', // Bootstrap
    localStorage: 'readonly', // localStorage
    sessionStorage: 'readonly', // sessionStorage
    FileReader: 'readonly', // FileReader
    FormData: 'readonly', // FormData
    alert: 'readonly', // alert
    confirm: 'readonly', // confirm
    prompt: 'readonly', // prompt
    
    // 自定义全局变量
    walletModule: 'readonly', // 钱包模块
    notificationModule: 'readonly', // 通知模块
    rechargePathsButton: 'readonly', // 充值路径按钮
    currentAdminId: 'readonly', // 当前管理员ID
    showWarning: 'readonly', // 显示警告
    
    // 后端全局变量
    router: 'readonly', // Express路由
    User: 'readonly', // 用户模型
    bcrypt: 'readonly', // 密码加密
    jwt: 'readonly', // JWT
    protect: 'readonly', // 保护中间件
    Wallet: 'readonly', // 钱包模型
    authMiddleware: 'readonly', // 认证中间件
    adminMiddleware: 'readonly', // 管理员中间件
    createUser: 'readonly', // 创建用户
    
    // 测试相关
    describe: 'readonly', // Jest describe
    it: 'readonly', // Jest it
    expect: 'readonly', // Jest expect
    beforeEach: 'readonly', // Jest beforeEach
    afterEach: 'readonly', // Jest afterEach
  },
  ignorePatterns: [
    'public/vendor/**/*.js', // 忽略第三方库文件
    'public/js/vendor/**/*.js',
    'public/js/bootstrap.bundle.min.js',
    'public/js/fontawesome.min.js',
    'public/js/jquery.min.js',
    'public/js/popper.min.js',
    'public/backup/**/*.js', // 忽略备份文件
    'node_modules/**/*.js', // 忽略 node_modules
    'dist/**/*.js', // 忽略构建输出
    'coverage/**/*.js', // 忽略测试覆盖率报告
    '*.test.js', // 忽略测试文件
    '*.spec.js', // 忽略测试文件
  ],
}; 