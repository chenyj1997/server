/**
 * API工具函数
 */

// API基础URL
const BASE_URL = '/api';

// 获取请求头
function getHeaders() {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json'
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
}

// GET请求
async function get(url, options = {}) {
    try {
        if (window.ui) {
            window.ui.showLoading();
        }
        
        const fullUrl = `${BASE_URL}${url}${options.params ? '?' + new URLSearchParams(options.params).toString() : ''}`;
        
        const response = await fetch(fullUrl, {
            method: 'GET',
            headers: getHeaders(),
            ...options
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || '请求失败');
        }
        
        return await response.json();
    } catch (error) {
        console.error('GET请求失败:', error);
        if (window.ui) {
            window.ui.showError(error.message);
        }
        throw error;
    } finally {
        if (window.ui) {
            window.ui.hideLoading();
        }
    }
}

// POST请求
async function post(url, data, options = {}) {
    try {
        if (window.ui) {
            window.ui.showLoading();
        }
        
        const response = await fetch(`${BASE_URL}${url}`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data),
            ...options
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || '请求失败');
        }
        
        return await response.json();
    } catch (error) {
        console.error('POST请求失败:', error);
        if (window.ui) {
            window.ui.showError(error.message);
        }
        throw error;
    } finally {
        if (window.ui) {
            window.ui.hideLoading();
        }
    }
}

// PUT请求
async function put(url, data, options = {}) {
    try {
        if (window.ui) {
            window.ui.showLoading();
        }
        
        const response = await fetch(`${BASE_URL}${url}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data),
            ...options
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || '请求失败');
        }
        
        return await response.json();
    } catch (error) {
        console.error('PUT请求失败:', error);
        if (window.ui) {
            window.ui.showError(error.message);
        }
        throw error;
    } finally {
        if (window.ui) {
            window.ui.hideLoading();
        }
    }
}

// DELETE请求
async function del(url, options = {}) {
    try {
        if (window.ui) {
            window.ui.showLoading();
        }
        
        const response = await fetch(`${BASE_URL}${url}`, {
            method: 'DELETE',
            headers: getHeaders(),
            ...options
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || '请求失败');
        }
        
        return await response.json();
    } catch (error) {
        console.error('DELETE请求失败:', error);
        if (window.ui) {
            window.ui.showError(error.message);
        }
        throw error;
    } finally {
        if (window.ui) {
            window.ui.hideLoading();
        }
    }
}

// 上传文件
async function upload(url, formData, options = {}) {
    try {
        if (window.ui) {
            window.ui.showLoading();
        }
        
        const token = localStorage.getItem('token');
        const headers = {};
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(`${BASE_URL}${url}`, {
            method: 'POST',
            headers,
            body: formData,
            ...options
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || '上传失败');
        }
        
        return await response.json();
    } catch (error) {
        console.error('文件上传失败:', error);
        if (window.ui) {
            window.ui.showError(error.message);
        }
        throw error;
    } finally {
        if (window.ui) {
            window.ui.hideLoading();
        }
    }
}

// 检查token是否过期
function isTokenExpired(token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.exp * 1000 < Date.now();
    } catch (e) {
        return true;
    }
}

// 带认证的fetch请求
async function fetchWithAuth(url, options = {}) {
    let tokenToUse = null;
    const adminTokenValue = localStorage.getItem('adminToken');
    const genericTokenValue = localStorage.getItem('token');

    if (adminTokenValue && !isTokenExpired(adminTokenValue)) {
        tokenToUse = adminTokenValue;
    } else if (genericTokenValue && !isTokenExpired(genericTokenValue)) {
        tokenToUse = genericTokenValue;
    } else if (adminTokenValue) {
        tokenToUse = adminTokenValue;
    } else if (genericTokenValue) {
        tokenToUse = genericTokenValue;
    }

    if (!tokenToUse) {
        console.error('fetchWithAuth: No valid token available');
        throw new Error('No valid authentication token found. Please log in again.');
    }

    const headers = {
        ...(options.headers || {}),
        'Authorization': `Bearer ${tokenToUse}`,
    };
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
    }
    try {
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            console.error(`API Error ${response.status}: ${errorData.message} for URL: ${url}`);
            throw new Error(errorData.message || `HTTP error ${response.status}`);
        }
        return response.json();
    } catch (error) {
        console.error('Fetch error:', error.message);
        throw error;
    }
}

// 导出到全局
window.api = {
    get,
    post,
    put,
    delete: del,
    upload,
    fetchWithAuth
}; 