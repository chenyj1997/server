// server/public/js/user/chat.js

// 用户端聊天模块

import { showSuccess, showError } from '../utils/ui.js';

const chatModalElement = document.getElementById('user-chat-modal'); // 聊天模态框元素
const chatMessagesElement = document.getElementById('user-chat-messages'); // 聊天消息显示区域
const messageInput = document.getElementById('user-message-input'); // 输入框
const sendMessageButton = document.getElementById('button-send-user'); // 发送按钮
// 获取客服图标和未读消息徽章，它们可能在 user.html 或 index.html 中
// 先假设它们在 user.html 或通过某种方式在用户页面可用
const customerServiceIcon = document.getElementById('customer-service-icon-container'); // 客服图标容器 (可能在 index.html 中)
const unreadMessagesBadge = document.getElementById('unread-messages-badge'); // 总未读消息徽章 (可能在 index.html 中)

// 存储当前用户的ID (需要从后端获取或在页面加载时已知)
let currentUserId = null;
let currentUserName = null;

// 初始化聊天模块
export function initUserChat() {
    console.log('初始化用户端聊天模块');

    // 从localStorage获取用户信息
    const userInfo = JSON.parse(localStorage.getItem('userInfo'));
    if (userInfo) {
        currentUserId = userInfo.id;  // 使用MongoDB的ObjectId
        currentUserName = userInfo.username;  // 使用真实用户名
        console.log('当前用户信息:', { id: currentUserId, name: currentUserName });
    } else {
        console.error('未找到用户信息，请先登录');
        return;
    }

    if (!chatModalElement || !chatMessagesElement || !messageInput || !sendMessageButton) {
        console.error('用户端聊天界面必要的DOM元素未找到！');
        // 如果缺少必要的元素，停止 Polling 并返回
        return;
    }

    // 绑定发送按钮点击事件
    sendMessageButton.addEventListener('click', handleSendMessage);

    // 监听输入框回车事件
    messageInput.addEventListener('keypress', handleMessageInputKeypress);

    // 绑定客服图标点击事件 (如果存在)
    if (customerServiceIcon) {
        customerServiceIcon.style.cursor = 'pointer'; // 添加手型光标提示可点击
        customerServiceIcon.addEventListener('click', openChatModal);
    }

    // 监听聊天模态框的显示和隐藏事件
    if (chatModalElement) {
        chatModalElement.addEventListener('shown.bs.modal', handleChatModalShown);
        chatModalElement.addEventListener('hidden.bs.modal', handleChatModalHidden);
    }

    console.log('用户端聊天模块初始化完成。');
}

// 打开聊天模态框
function openChatModal() {
    console.log('打开用户聊天模态框');
    const modal = new bootstrap.Modal(chatModalElement);
    modal.show();
}

// 模态框显示后的处理
async function handleChatModalShown() {
    console.log('用户聊天模态框已显示');
    // 加载聊天记录
    await loadChatMessages(currentUserId);
    // 标记未读消息为已读（自动实现"查看即已读"）
    await markMessagesAsRead(currentUserId, 'user');
}

// 模态框隐藏后的处理
function handleChatModalHidden() {
    console.log('用户聊天模态框已隐藏');
    // 清空消息区域
    chatMessagesElement.innerHTML = '<p class="text-muted text-center mt-3">加载中...</p>';
}

// 加载特定用户的聊天记录
async function loadChatMessages(userId) {
    if (!userId) {
        console.error('无法加载聊天记录: 用户ID未知');
        chatMessagesElement.innerHTML = '<p class="text-danger text-center mt-3">无法加载聊天记录。</p>';
        return;
    }
    console.log(`加载用户 ${userId} 的所有聊天记录...`);
    chatMessagesElement.innerHTML = '<p class="text-muted text-center mt-3">加载中...</p>'; // 显示加载提示

    try {
        const response = await fetch(`/api/chat/messages/${userId}?isFromAdmin=false`); // 用户端加载自己的消息
        if (!response.ok) {
            chatMessagesElement.innerHTML = `<p class="text-danger text-center mt-3">加载聊天记录失败: ${response.statusText}</p>`;
            console.error('加载聊天记录失败:', response.statusText);
            return;
        }

        const result = await response.json();

        chatMessagesElement.innerHTML = ''; // 清空加载提示

        if (result.success && Array.isArray(result.data)) {
            const messages = result.data;
            if (messages.length === 0) {
                chatMessagesElement.innerHTML = '<p class="text-muted text-center mt-3">暂无聊天记录，开始对话吧！</p>';
            } else {
                messages.forEach(message => {
                    addMessageToChatWindow(message);
                });
                // 滚动到最新消息
                 setTimeout(() => {
                    chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight;
                 }, 0);
            }
        } else {
            chatMessagesElement.innerHTML = `<p class="text-danger text-center mt-3">加载聊天记录失败: ${result.message || '未知错误'}</p>`;
            console.error('加载聊天记录失败:', result.message);
        }
    } catch (error) {
        chatMessagesElement.innerHTML = `<p class="text-danger text-center mt-3">加载聊天记录出错: ${error.message}</p>`;
        console.error('加载聊天记录出错:', error);
    }
}

// 处理发送消息按钮点击或回车事件
async function handleSendMessage() {
    const content = messageInput.value.trim();
    if (!content || !currentUserId) {
        console.warn('发送消息失败: 内容为空或用户ID未知');
         if (!content) showError('消息内容不能为空。');
        return;
    }

    console.log(`用户 ${currentUserName} 发送消息: ${content}`);
    try {
        const response = await fetch('/api/chat/message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`  // 添加token
            },
            body: JSON.stringify({
                senderId: currentUserId,  // 使用MongoDB的ObjectId
                senderName: currentUserName,  // 使用真实用户名
                content: content,
                isFromAdmin: false,
                targetUserId: 'admin'
            })
        });

        if (!response.ok) {
             const errorText = await response.text();
             console.error('用户消息发送失败:', response.status, errorText);
             showError('消息发送失败: ' + (errorText || response.status));
            return; // 阻止后续处理
        }

        const result = await response.json();

        if (result.success && result.data) {
            console.log('用户消息发送成功', result.data);
             // 发送成功后立即将消息添加到当前聊天窗口
             // 使用后端返回的完整消息对象添加
             addMessageToChatWindow(result.data);
            // 滚动到最新消息
             setTimeout(() => {
                 chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight;
             }, 0);
            // 清空输入框
            messageInput.value = '';
            // 根据isRead字段显示已读/未读
            if (typeof result.isRead !== 'undefined') {
                showReadStatusOnLastMessage(result.isRead);
            }
        } else {
            console.error('用户消息发送失败:', result.message);
            showError('消息发送失败: ' + (result.message || '未知错误'));
        }
    } catch (error) {
        console.error('用户消息发送出错:', error);
        showError('消息发送出错: ' + error.message);
    }
}

// 处理输入框回车事件
function handleMessageInputKeypress(event) {
    if (event.key === 'Enter') {
        event.preventDefault(); // 阻止默认回车换行行为
        handleSendMessage(); // 触发发送消息逻辑
    }
}

// 添加消息到聊天窗口
// message 对象应包含 content, isFromAdmin, senderId, timestamp
function addMessageToChatWindow(message) {
     if (!message || typeof message.content === 'undefined') {
         console.warn('尝试添加无效消息到聊天窗口', message);
         return;
     }
    console.log('向用户聊天窗口添加消息:', message);

    const messageElement = document.createElement('div');
    messageElement.classList.add('message-bubble');
    // 根据消息发送者添加不同的样式类
    // 用户端看，isFromAdmin 为 true 表示是管理员发来的消息，靠左显示
    if (message.isFromAdmin) {
        messageElement.classList.add('admin'); // 管理员消息靠左显示
    } else {
        messageElement.classList.add('user'); // 用户消息靠右显示
    }

    const contentElement = document.createElement('div');
    contentElement.classList.add('message-content');
    contentElement.textContent = message.content; // 消息内容
    messageElement.appendChild(contentElement);

    // 添加时间戳
    const timestampElement = document.createElement('small');
    timestampElement.classList.add('message-timestamp');
    // 格式化时间戳，确保 message.timestamp 是有效的日期格式
    try {
         const date = new Date(message.timestamp);
         if (!isNaN(date)) {
            timestampElement.textContent = date.toLocaleString();
         } else {
            timestampElement.textContent = '无效时间';
         }
    } catch (e) {
         console.error('格式化消息时间戳出错:', e);
         timestampElement.textContent = '无效时间';
    }


    messageElement.appendChild(timestampElement);

    chatMessagesElement.appendChild(messageElement);
}

// 标记消息为已读
async function markMessagesAsRead(userId, role) {
     if (!userId) {
        console.error('无法标记消息为已读: 用户ID未知');
        return;
     }
     console.log(`用户 ${userId} 标记消息为已读 (角色: ${role})...`);
     try {
         const response = await fetch(`/api/chat/markAsRead/${userId}?role=${role}`, {
             method: 'POST',
              headers: {
                 'Content-Type': 'application/json',
                  // 如果需要认证，这里添加 token
                 // 'Authorization': `Bearer ${localStorage.getItem('token')}`
             },
         });
          if (!response.ok) {
              console.error(`标记用户 ${userId} 消息为已读失败:`, response.statusText);
              return;
          }
          const result = await response.json();
          if (result.success) {
              console.log(`成功标记用户 ${result.updatedCount} 条消息为已读`);
          } else {
              console.error(`标记用户 ${userId} 消息为已读返回错误:`, result.message);
          }

     } catch (error) {
         console.error(`标记用户 ${userId} 消息为已读出错:`, error);
     }
}

// 新增：显示已读/未读状态
function showReadStatusOnLastMessage(isRead) {
    // 获取最后一条消息气泡
    const bubbles = chatMessagesElement.querySelectorAll('.message-bubble');
    if (bubbles.length === 0) return;
    const lastBubble = bubbles[bubbles.length - 1];
    // 移除旧的已读状态
    const oldStatus = lastBubble.querySelector('.read-status');
    if (oldStatus) oldStatus.remove();
    // 新建状态元素
    const status = document.createElement('span');
    status.className = 'read-status ms-2';
    status.style.fontSize = '12px';
    status.style.color = isRead ? '#28a745' : '#dc3545';
    status.textContent = isRead ? '已读' : '未读';
    lastBubble.appendChild(status);
}

// 导出需要在其他地方使用的函数
export { openChatModal };

// 注意：需要在 user/index.js 中导入并调用 initUserChat()
// TODO: 在用户登录成功后设置 accurate 的 currentUserId 