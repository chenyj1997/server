 // 表单验证工具
const validator = {
    // 验证规则
    rules: {
        required: {
            validate: value => value !== undefined && value !== null && value !== '',
            message: '此字段不能为空'
        },
        email: {
            validate: value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
            message: '请输入有效的邮箱地址'
        },
        phone: {
            validate: value => /^1[3-9]\d{9}$/.test(value),
            message: '请输入有效的手机号码'
        },
        password: {
            validate: value => /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/.test(value),
            message: '密码必须包含字母和数字，且长度不少于6位'
        },
        amount: {
            validate: value => /^\d+(\.\d{1,2})?$/.test(value) && Number(value) > 0,
            message: '请输入有效的金额'
        }
    },

    // 验证单个字段
    validateField(value, rules) {
        if (!Array.isArray(rules)) {
            rules = [rules];
        }

        for (const rule of rules) {
            if (typeof rule === 'string') {
                const ruleObj = this.rules[rule];
                if (ruleObj && !ruleObj.validate(value)) {
                    return ruleObj.message;
                }
            } else if (typeof rule === 'function') {
                const result = rule(value);
                if (result !== true) {
                    return result;
                }
            }
        }

        return true;
    },

    // 验证表单
    validateForm(formData, rules) {
        const errors = {};

        for (const [field, fieldRules] of Object.entries(rules)) {
            const value = formData[field];
            const error = this.validateField(value, fieldRules);
            if (error !== true) {
                errors[field] = error;
            }
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    },

    // 显示表单错误
    showFormErrors(form, errors) {
        // 清除之前的错误
        form.querySelectorAll('.error-message').forEach(el => el.remove());
        form.querySelectorAll('.has-error').forEach(el => {
            el.classList.remove('has-error');
        });

        // 显示新的错误
        for (const [field, message] of Object.entries(errors)) {
            const input = form.querySelector(`[name="${field}"]`);
            if (input) {
                input.classList.add('has-error');
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error-message';
                errorDiv.textContent = message;
                input.parentNode.appendChild(errorDiv);
            }
        }
    },

    // 添加自定义规则
    addRule(name, rule) {
        this.rules[name] = rule;
    }
};

// 导出验证工具
window.validator = validator;