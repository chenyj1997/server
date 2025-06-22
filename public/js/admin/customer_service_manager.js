/**
 * 客服管理模块
 * 负责处理客服相关的功能
 */

// ===== Admin to User Chat Functionality =====
let adminChatCurrentOpenUserId = null;
let adminChatActivePollIntervalId = null;
let adminChatBackgroundPollIntervalId = null;
const ADMIN_CHAT_API_BASE = '/api/customer-service';
const MESSAGES_PER_PAGE = 20; // Number of messages to load per page

let adminChatMessagesCache = {}; // userId: [messages]
let adminChatMessagesPage = {}; // userId: currentPage
let adminChatHasMoreMessages = {}; // userId: boolean
let adminChatIsLoadingMore = {}; // userId: boolean // To prevent multiple load more requests

// Add base static URL for images (assuming server and static files are on the same origin)
const BASE_STATIC_URL = window.location.origin;

// Helper function to show a toast message (assuming Bootstrap toasts are available)
function showToast(message, type = 'info') {
    const toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        console.warn('Toast container not found, logging message instead:', message);
        alert(message); // Fallback to alert
        return;
    }

    const toastHtml = `
        <div class="toast align-items-center text-white bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;
    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    const toastElement = toastContainer.lastElementChild;
    const toast = new bootstrap.Toast(toastElement);
    toast.show();
    // Remove toast element after it's hidden to prevent accumulation
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

// Helper function to open image modal
function openImageModal(imageUrl) {
    // Ensure Bootstrap is loaded and accessible via `bootstrap` global object
    if (typeof bootstrap === 'undefined' || !bootstrap.Modal) {
        console.error('Bootstrap Modal is not defined. Cannot open image modal.');
        // Fallback for image preview if Bootstrap is not loaded or modal is not available
        window.open(imageUrl, '_blank');
        return;
    }

    const modalHtml = `
        <div class="modal fade" id="imagePreviewModal" tabindex="-1" aria-labelledby="imagePreviewModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content bg-transparent border-0">
                    <div class="modal-header border-0 pb-0">
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body d-flex justify-content-center align-items-center p-0">
                        <img src="${imageUrl}" class="img-fluid" style="max-height: 50vh; max-width: 50vw; object-fit: contain;">
                    </div>
                </div>
            </div>
        </div>
    `;
    // Remove existing modal if any
    const existingModal = document.getElementById('imagePreviewModal');
    if (existingModal) {
        existingModal.remove();
    }
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    // Create and show the new modal instance
    const modalElement = document.getElementById('imagePreviewModal');
    const imageModal = new bootstrap.Modal(modalElement);
    imageModal.show();
    // Add event listener to remove modal from DOM after it's hidden
    modalElement.addEventListener('hidden.bs.modal', () => {
        modalElement.remove();
    });
}

// Helper function to decode JWT and check expiration
function isTokenExpired(token) {
    if (!token) return true;
    try {
        const payloadBase64 = token.split('.')[1];
        if (!payloadBase64) return true;
        const decodedJson = atob(payloadBase64);
        const decoded = JSON.parse(decodedJson);
        const exp = decoded.exp; // Expiration timestamp in seconds
        return (Date.now() >= exp * 1000); // Compare with current time in milliseconds
    } catch (e) {
        console.error('Error decoding or checking token expiration:', e);
        return true; // Treat as expired if an error occurs
    }
}

async function fetchWithAuth(url, options = {}) {
    let tokenToUse = null;
    const adminTokenValue = localStorage.getItem('adminToken');
    const genericTokenValue = localStorage.getItem('token');


    if (adminTokenValue && !isTokenExpired(adminTokenValue)) {
        tokenToUse = adminTokenValue;
    } else if (genericTokenValue && !isTokenExpired(genericTokenValue)) {
        tokenToUse = genericTokenValue;
    } else if (adminTokenValue) { // Both expired, or generic not found, but adminToken was present
        tokenToUse = adminTokenValue; // Fallback to adminToken to let server send TokenExpiredError
    } else if (genericTokenValue) { // Fallback to genericToken if adminToken was not present
        tokenToUse = genericTokenValue;
    }


    if (!tokenToUse) {
        console.error('fetchWithAuth: No valid token available (both adminToken and genericToken are missing or expired and unrecoverable)!');
        // Potentially redirect to login or show a global error message
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

// Background polling function
async function adminBackgroundPoll() {
    try {
        const result = await fetchWithAuth(`${ADMIN_CHAT_API_BASE}/unread-count`);
        if (result.success && typeof result.data.unreadCount === 'number') {
            const unreadBadge = document.getElementById('unread-messages-badge');
            if (unreadBadge) {
                unreadBadge.textContent = result.data.unreadCount;
                unreadBadge.style.display = result.data.unreadCount > 0 ? 'block' : 'none';
            }
        }
        // If chat modal is open, refresh conversation list too
        const modalElement = document.getElementById('admin-customer-chat-modal');
        if (modalElement && modalElement.classList.contains('show')) {
            await loadAdminConversations();
        }
    } catch (error) {
        console.error('Error in admin background poll:', error);
    }
}

// Function to load conversations into the #user-tabs
async function loadAdminConversations() {
    const userTabs = document.getElementById('user-tabs');
    if (!userTabs) {
        console.error('#user-tabs element not found');
        return;
    }

    try {
        const result = await fetchWithAuth(`${ADMIN_CHAT_API_BASE}/conversations`);
        if (result.success && Array.isArray(result.data)) {
            // 获取已关闭的用户列表
            const closedUsers = JSON.parse(localStorage.getItem('closedCustomerServiceUsers') || '[]');
            // 过滤掉已关闭的对话
            const activeConversations = result.data.filter(conv => !closedUsers.includes(conv.user));

            userTabs.innerHTML = ''; // Clear existing tabs
            if (activeConversations.length === 0) {
                userTabs.innerHTML = '<li class="nav-item"><span class="nav-link text-muted">暂无会话</span></li>';
                document.getElementById('chat-messages').innerHTML = '<p class="text-muted text-center mt-3">暂无会话</p>';
                return;
            }

            activeConversations.forEach(conv => {
                const tabId = `user-tab-${conv.user}`;
                const isActive = conv.user === adminChatCurrentOpenUserId;
                const tabHtml = `
                    <li class="nav-item" role="presentation" id="${tabId}-li">
                        <button class="nav-link ${isActive ? 'active' : ''} d-flex align-items-center" id="${tabId}-tab" data-bs-toggle="tab" data-bs-target="#chat-pane-${conv.user}" type="button" role="tab" aria-controls="chat-pane-${conv.user}" aria-selected="${isActive}" data-user-id="${conv.user}">
                            <span class="flex-grow-1 text-start" style="color:${isActive ? '#222' : '#333'}; font-weight:${isActive ? 'bold' : 'normal'};">
                                ${conv.username || '未知用户'}
                                ${conv.unreadCount > 0 ? `<span class=\"badge bg-danger ms-1\">${conv.unreadCount}</span>` : ''}
                            </span>
                            <span class="close-tab-btn ms-2" data-user-id="${conv.user}" style="cursor: pointer; font-size: 1.2em; line-height: 1; color: #888;">&times;</span>
                        </button>
                    </li>
                `;
                userTabs.insertAdjacentHTML('beforeend', tabHtml);
            });

            // Add event listeners to new tabs
            userTabs.querySelectorAll('.nav-link').forEach(tab => {
                tab.addEventListener('click', handleAdminUserTabClick);
            });

            // Add event listeners for close buttons
            userTabs.querySelectorAll('.close-tab-btn').forEach(closeBtn => {
                closeBtn.addEventListener('click', handleCloseTabClick);
            });
        } else {
            userTabs.innerHTML = '<li class="nav-item"><span class="nav-link text-danger">加载会话失败</span></li>';
            console.error('Failed to load conversations or data is not an array:', result.message);
        }
    } catch (error) {
        console.error('Error loading admin conversations:', error);
        if (userTabs) userTabs.innerHTML = '<li class="nav-item"><span class="nav-link text-danger">加载会话出错</span></li>';
    }
}

// Initialize admin chat functionality (e.g., start background polling)
function initializeAdminChat() {
    if (adminChatBackgroundPollIntervalId) clearInterval(adminChatBackgroundPollIntervalId);
    adminChatBackgroundPollIntervalId = setInterval(adminBackgroundPoll, 30000); // 30 seconds
    adminBackgroundPoll(); // Initial call
    // Add event listener for the send button once at initialization
    const sendButton = document.getElementById('button-send-admin');
    if (sendButton) {
        sendButton.addEventListener('click', handleAdminSendMessage);
    } else {
        console.error('Admin chat send button not found during init!');
    }

    // Add image upload related elements and event listeners
    const imageUploadButton = document.getElementById('button-upload-image-admin');
    const imageUploadInput = document.getElementById('admin-image-upload-input');

    if (imageUploadButton && imageUploadInput) {
        imageUploadButton.addEventListener('click', () => {
            imageUploadInput.click();
        });

        imageUploadInput.addEventListener('change', (event) => {
            handleAdminImageUpload(event);
        });
    } else {
        console.error('Admin chat image upload button or input not found!');
    }

    // Listen for modal close to stop active polling
    const chatModalElement = document.getElementById('admin-customer-chat-modal');
    if (chatModalElement) {
        chatModalElement.addEventListener('hidden.bs.modal', () => {
            if (adminChatActivePollIntervalId) {
                clearInterval(adminChatActivePollIntervalId);
                adminChatActivePollIntervalId = null;
            }
            adminChatCurrentOpenUserId = null;
            // Optionally clear chat messages or user tabs if desired on close
            document.getElementById('chat-messages').innerHTML = '<p class="text-muted text-center mt-3">请选择一个用户开始聊天</p>'; // Clear on close
        });
    }
}

async function loadAndDisplayAdminMessages(userId, loadMore = false, showLoadingIndicator = true) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) {
        console.error('#chat-messages container not found');
        return;
    }
    if (adminChatIsLoadingMore[userId] && loadMore) return; // Already loading more for this user

    let pageToFetch;
    if (loadMore) {
        if (!adminChatHasMoreMessages[userId]) {
            console.log('No more messages to load for user', userId);
            // Optionally show a small indicator that there are no more messages
            const noMoreMsgDiv = document.getElementById('no-more-messages-indicator');
            if(noMoreMsgDiv) noMoreMsgDiv.style.display = 'block';
            setTimeout(() => { if(noMoreMsgDiv) noMoreMsgDiv.style.display = 'none'; }, 2000);
            return;
        }
        pageToFetch = (adminChatMessagesPage[userId] || 0) + 1;
        adminChatIsLoadingMore[userId] = true;
        const loadMoreSpinner = document.getElementById('load-more-spinner');
        if(loadMoreSpinner) loadMoreSpinner.style.display = 'block';
    } else {
        // Initial load for a user
        adminChatMessagesCache[userId] = [];
        adminChatMessagesPage[userId] = 0; // Will fetch page 1
        adminChatHasMoreMessages[userId] = true; // Assume there are messages initially
        pageToFetch = 1;
    if (showLoadingIndicator) {
            messagesContainer.innerHTML = '<div id="load-more-spinner" style="display:none; text-align:center; padding:10px;"><div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">加载中...</span></div></div><div id="no-more-messages-indicator" style="display:none; text-align:center; padding:5px; font-size:0.9em; color:grey;">没有更多消息了</div><p class="text-center text-muted">加载消息中...</p>';
        } else {
            // For refresh, ensure spinner placeholders are there if not already
            if(!document.getElementById('load-more-spinner')){
                messagesContainer.insertAdjacentHTML('afterbegin', '<div id="load-more-spinner" style="display:none; text-align:center; padding:10px;"><div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">加载中...</span></div></div><div id="no-more-messages-indicator" style="display:none; text-align:center; padding:5px; font-size:0.9em; color:grey;">没有更多消息了</div>');
            }
        }
    }

    try {
        const result = await fetchWithAuth(`${ADMIN_CHAT_API_BASE}/messages/${userId}?page=${pageToFetch}&limit=${MESSAGES_PER_PAGE}`);
        if (result.success && Array.isArray(result.data)) {
            const newMessages = result.data;
            adminChatMessagesPage[userId] = pageToFetch;
            adminChatHasMoreMessages[userId] = newMessages.length === MESSAGES_PER_PAGE;
            
            if (loadMore) {
                adminChatMessagesCache[userId] = [...newMessages.reverse(), ...adminChatMessagesCache[userId]];
            } else {
                adminChatMessagesCache[userId] = newMessages.reverse(); // API sends latest first, reverse for display
            }
            displayAdminChatMessages(adminChatMessagesCache[userId], userId, loadMore); // Pass loadMore flag
        } else {
            if (!loadMore) messagesContainer.innerHTML = '<p class="text-center text-danger">加载消息失败。</p>';
            console.error('Failed to load messages for user:', userId, result.message);
            adminChatHasMoreMessages[userId] = false; // Stop trying if error
        }
    } catch (error) {
        console.error('Error fetching messages for user:', userId, error);
        if (!loadMore && messagesContainer) messagesContainer.innerHTML = '<p class="text-center text-danger">加载消息出错。</p>';
        adminChatHasMoreMessages[userId] = false;
    } finally {
        if(loadMore) {
            adminChatIsLoadingMore[userId] = false;
            const loadMoreSpinner = document.getElementById('load-more-spinner');
            if(loadMoreSpinner) loadMoreSpinner.style.display = 'none';
        }
    }
}

// 处理关闭标签点击
async function handleCloseTabClick(event) {
    const userId = event.currentTarget.dataset.userId;
    if (!userId) {
        console.error('User ID not found on close button click');
        return;
    }
    try {
        // 调用后端API隐藏对话
        const response = await fetchWithAuth(`${ADMIN_CHAT_API_BASE}/conversations/${userId}/hide`, {
            method: 'PUT'
            // fetchWithAuth already sets Content-Type: application/json if body is object, but here body is empty.
            // No need to manually set headers here, fetchWithAuth handles it.
        });

        if (!response.success) { // fetchWithAuth returns { success: true, data: ... } or throws error
            throw new Error(response.message || '隐藏对话失败');
        }

        // 从UI中移除标签和聊天面板
        const tabLi = document.getElementById(`user-tab-${userId}-li`);
        const chatPane = document.querySelector(`#chat-pane-${userId}`);
        if (tabLi) tabLi.remove();
        if (chatPane) chatPane.remove();

        // 清除缓存的消息
        delete adminChatMessagesCache[userId];
        delete adminChatMessagesPage[userId];
        delete adminChatHasMoreMessages[userId];
        delete adminChatIsLoadingMore[userId];

        // 如果关闭的是当前打开的对话，显示"无活动对话"消息
        if (adminChatCurrentOpenUserId === userId) {
            adminChatCurrentOpenUserId = null;
            if (adminChatActivePollIntervalId) {
                clearInterval(adminChatActivePollIntervalId);
                adminChatActivePollIntervalId = null;
            }
            document.getElementById('chat-messages').innerHTML = '<p class="text-muted text-center mt-3">请选择一个用户开始聊天</p>';
        }

        // 重新加载会话列表以更新UI
        await loadAdminConversations();

        showToast('对话已成功隐藏', 'success');

    } catch (error) {
        console.error('关闭对话错误:', error);
        showToast('关闭对话失败: ' + error.message, 'error');
    }
}

// Placeholder for handling tab click - will be implemented next
async function handleAdminUserTabClick(event) {
    const buttonElement = event.currentTarget; // The button element that was clicked
    const userId = buttonElement.dataset.userId;
    
    if (!userId) {
        console.error('User ID not found on tab click');
        return;
    }

    // Stop current active polling if any
    if (adminChatActivePollIntervalId) {
        clearInterval(adminChatActivePollIntervalId);
        adminChatActivePollIntervalId = null;
    }

    adminChatCurrentOpenUserId = userId;
    // Clear chat messages container for new user and show loading
    const messagesContainer = document.getElementById('chat-messages');
    if (messagesContainer) {
        messagesContainer.innerHTML = '<p class="text-center text-muted mt-3">加载消息中...</p>';
    }

    // Start active polling for the newly selected user
    await loadAndDisplayAdminMessages(userId, false, true); // Initial load
    adminChatActivePollIntervalId = setInterval(async () => {
        // Only poll if the modal is still open and this user is still selected
        const modalElement = document.getElementById('admin-customer-chat-modal');
        if (modalElement && modalElement.classList.contains('show') && adminChatCurrentOpenUserId === userId) {
            await loadAndDisplayAdminMessages(userId, false, false); // Refresh, no loading indicator for polling
            await loadAdminConversations(); // Refresh conversation list too for unread counts
        } else {
            clearInterval(adminChatActivePollIntervalId); // Stop polling if modal is closed or user changed
            adminChatActivePollIntervalId = null;
        }
    }, 5000); // Poll every 5 seconds for active chat

    // Mark messages as read for this user on tab click
    // This part is handled by the backend when fetching messages, but can be explicitly called if needed.
    // await fetchWithAuth(`${ADMIN_CHAT_API_BASE}/messages/${userId}/read-all`, { method: 'PUT' }); // Example
    await loadAdminConversations(); // Refresh conversation list to update unread counts
}

// New function to handle image upload
async function handleAdminImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!adminChatCurrentOpenUserId) {
        showToast('请先选择一个用户！', 'error');
        // Clear file input immediately if no user selected
        event.target.value = '';
        return;
    }

    // Show a loading indicator (e.g., disable buttons)
    const sendButton = document.getElementById('button-send-admin');
    const imageUploadBtn = document.getElementById('button-upload-image-admin');
    const inputField = document.getElementById('admin-message-input');
    
    sendButton.disabled = true;
    imageUploadBtn.disabled = true;
    inputField.disabled = true;

    try {
        const formData = new FormData();
        formData.append('file', file); // 'file' is the key expected by /customer-service/upload/image

        // Upload image using customer service specific endpoint
        const uploadResponse = await fetchWithAuth('/api/customer-service/upload/image', {
            method: 'POST',
            body: formData,
        });

        if (uploadResponse.success && uploadResponse.data && uploadResponse.data.url) {
            const imageUrl = uploadResponse.data.url;
            // Send image message
            await sendAdminMessage(adminChatCurrentOpenUserId, '', 'image', imageUrl); // No content for image message
        } else {
            showToast(uploadResponse.message || '图片上传失败！', 'error');
        }
    } catch (error) {
        console.error('图片上传或发送失败:', error);
        showToast(error.message || '图片上传或发送失败！', 'error');
    } finally {
        sendButton.disabled = false;
        imageUploadBtn.disabled = false;
        inputField.disabled = false;
        event.target.value = ''; // Clear file input value to allow re-uploading the same file
        scrollToBottom(document.getElementById('chat-messages'));
    }
}

// Modify handleAdminSendMessage to be a generic send function
async function sendAdminMessage(userId, content, messageType = 'text', imageUrl = null) {
    if (!content.trim() && messageType === 'text') { // Only require content for text messages
        showToast('消息内容不能为空！', 'warning');
        return;
    }
    if (messageType === 'image' && !imageUrl) {
        showToast('图片消息缺少URL！', 'error');
        return;
    }
    if (!userId) {
        showToast('请先选择一个用户！', 'error');
        return;
    }

    const messageInput = document.getElementById('admin-message-input');
    const sendButton = document.getElementById('button-send-admin');
    const imageUploadBtn = document.getElementById('button-upload-image-admin'); // Also disable image button

    sendButton.disabled = true;
    imageUploadBtn.disabled = true;
    messageInput.disabled = true;

    try {
        const payload = {
            recipientId: userId,
            content: content,
            messageType: messageType,
            imageUrl: imageUrl
        };
        const result = await fetchWithAuth(`${ADMIN_CHAT_API_BASE}/messages`, {
            method: 'POST',
            body: payload,
        });

        if (result.success && result.data) {
            // Add new message to cache and re-display
            if (!adminChatMessagesCache[userId]) {
                adminChatMessagesCache[userId] = [];
            }
            adminChatMessagesCache[userId].push(result.data); // Add to end
            displayAdminChatMessages(adminChatMessagesCache[userId], userId); // Re-display all messages
            messageInput.value = ''; // Clear input field only for text messages
            scrollToBottom(document.getElementById('chat-messages'));
            await loadAdminConversations(); // Refresh conversation list to update unread counts
        } else {
            showToast(result.message || '发送消息失败！', 'error');
        }
    } catch (error) {
        console.error('发送消息错误:', error);
        showToast(error.message || '发送消息出错！', 'error');
    } finally {
        sendButton.disabled = false;
        imageUploadBtn.disabled = false;
        messageInput.disabled = false;
    }
}

// Event listener for the main send button (will call sendAdminMessage)
async function handleAdminSendMessage() {
    const messageInput = document.getElementById('admin-message-input');
    const content = messageInput.value.trim();
    await sendAdminMessage(adminChatCurrentOpenUserId, content, 'text', null);
}

// Modify displayAdminChatMessages to render images and add click handler for modal
function displayAdminChatMessages(messages, userId, isLoadMore = false, newMessagesReceived = false) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) {
        console.error('Messages container not found!');
        return;
    }

    // Clear existing content if not loading more
    if (!isLoadMore) {
        messagesContainer.innerHTML = '';
        messagesContainer.insertAdjacentHTML('afterbegin', '<div id="load-more-spinner" style="display:none; text-align:center; padding:10px;"><div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">加载中...</span></div></div><div id="no-more-messages-indicator" style="display:none; text-align:center; padding:5px; font-size:0.9em; color:grey;">没有更多消息了</div>');
    }

    // 逆序渲染：最新消息在底部
    const renderList = isLoadMore ? messages : [...messages].reverse();
    renderList.forEach(msg => {
        if (adminChatCurrentOpenUserId && msg.user !== adminChatCurrentOpenUserId) {
            return;
        }
        const isUserMessage = msg.senderType === 'user';
        const isMyMessage = msg.senderType === 'admin';
        const senderName = msg.sender ? msg.sender.username : (isUserMessage ? '用户' : '我 (管理员)');
        const messageTime = new Date(msg.createdAt).toLocaleString();
        let messageHtml = '';
        
        if (msg.messageType === 'image' && msg.imageUrl) {
            // 如果imageUrl已经是完整的URL（以http或https开头），直接使用
            // 否则添加BASE_STATIC_URL前缀
            const fullImageUrl = msg.imageUrl.startsWith('http') ? msg.imageUrl : `${BASE_STATIC_URL}${msg.imageUrl}`;
            messageHtml = `
                <div class="chat-message ${isMyMessage ? 'chat-message-right' : 'chat-message-left'}">
                    <div class="message-bubble ${isMyMessage ? 'bg-primary text-white' : 'bg-light text-dark'}">
                        <img src="${fullImageUrl}" alt="${msg.content || '图片消息'}" class="img-fluid rounded chat-image-preview" style="max-width: 150px; max-height: 150px; object-fit: contain; cursor: pointer;" onclick="openImageModal('${fullImageUrl}')">
                        <div class="message-meta ${isMyMessage ? 'text-white-50' : 'text-muted'}">${senderName} - ${messageTime}</div>
                    </div>
                </div>
            `;
        } else {
            // 确保文本消息内容使用p标签包装，以便CSS样式正确应用
            const messageContent = msg.content ? msg.content.replace(/\n/g, '<br>') : '';
            messageHtml = `
                <div class="chat-message ${isMyMessage ? 'chat-message-right' : 'chat-message-left'}">
                    <div class="message-bubble ${isMyMessage ? 'bg-primary text-white' : 'bg-light text-dark'}">
                        <p>${messageContent}</p>
                        <div class="message-meta ${isMyMessage ? 'text-white-50' : 'text-muted'}">${senderName} - ${messageTime}</div>
                    </div>
                </div>
            `;
        }
        // 新顺序：全部append到末尾
        messagesContainer.insertAdjacentHTML('beforeend', messageHtml);
    });

    // 自动滚动到底部
    if (!isLoadMore) {
        scrollToBottom(messagesContainer);
    }
}

function scrollToBottom(element) {
    if (element) {
        element.scrollTop = element.scrollHeight;
    }
}

function handleChatScroll(event) {
    const messagesContainer = event.target;
    if (messagesContainer.scrollTop === 0 && adminChatCurrentOpenUserId && adminChatHasMoreMessages[adminChatCurrentOpenUserId] && !adminChatIsLoadingMore[adminChatCurrentOpenUserId]) {
        console.log('Scrolled to top, loading more messages for user:', adminChatCurrentOpenUserId);
        loadAndDisplayAdminMessages(adminChatCurrentOpenUserId, true, false); // loadMore = true, no full loading indicator
    }
}

// Call initializeAdminChat when the script loads or when appropriate in your admin panel init sequence
document.addEventListener('DOMContentLoaded', () => {
    // Check if we are on a page that requires admin chat, or if it's globally initialized
    // For now, let's assume it's always initialized if this script is loaded.
    customerServiceManager.initializeAdminChat(); 

    // Add event listener to the main chat icon/button that opens the modal
    const openChatModalButton = document.querySelector('[data-bs-target="#admin-customer-chat-modal"]');
    if (openChatModalButton) {
        openChatModalButton.addEventListener('click', () => {
            // When modal is about to be shown, load conversations
            // This ensures fresh conversation list every time modal is opened
            customerServiceManager.loadAdminConversations();
            // Initial message area state
             const messagesContainer = document.getElementById('chat-messages');
            if(messagesContainer) messagesContainer.innerHTML = '<p class="text-muted text-center mt-3">请选择一个用户开始聊天</p>';
        });
    }
});

// Other customer service related functions (listings, add, edit, delete - if they were in this file)
// These seem to be for a different section管理客服账号, not the chat itself.
// window.adminCustomerServiceManager = (function() { ... }) // Original structure if it was like this

// Example of how you might have other manager functions if this file was more than just chat:
/*
const adminCustomerServiceManager = {
    // ... (chat functions we just defined, moved under this object if preferred)
    // ... (other service management functions)
};

if (typeof window.adminCustomerServiceManager === 'undefined') {
    window.adminCustomerServiceManager = adminCustomerServiceManager;
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('customer-service-list-section')) { // Or whatever identifies the non-chat CS page
            // window.adminCustomerServiceManager.initCustomerServicePage(); 
        }
    });
}
*/

const customerServiceManager = {
    // 初始化客服页面
    async initCustomerServicePage() {
        try {
            // 获取客服列表
            const response = await fetch('/api/customer-service/list', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('获取客服列表失败');
            }
            
            const data = await response.json();
            if (data && data.customerServices) { // Check if data and customerServices exist
            this.renderCustomerServiceList(data.customerServices);
            }
            
            // 添加事件监听
            this.addEventListeners();
            
        } catch (error) {
            console.error('初始化客服页面失败:', error);
            if (window.ui) window.ui.showError('加载客服列表失败');
        }
    },
    
    // 渲染客服列表
    renderCustomerServiceList(customerServices) {
        const container = document.getElementById('customer-service-list');
        if (!container) return;
        
        container.innerHTML = customerServices.map(service => `
            <div class="customer-service-item" data-id="${service._id}">
                <div class="service-header">
                    <span class="service-title">${service.title}</span>
                    <span class="service-status ${service.status}">${service.status}</span>
                </div>
                <div class="service-content">${service.content}</div>
                <div class="service-actions">
                    <button class="btn btn-sm btn-primary" onclick="customerServiceManager.editService('${service._id}')">
                        编辑
                    </button>
                    <button class="btn btn-sm btn-success" onclick="customerServiceManager.updateStatus('${service._id}', 'active')">
                        启用
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="customerServiceManager.updateStatus('${service._id}', 'inactive')">
                        禁用
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="customerServiceManager.deleteService('${service._id}')">
                        删除
                    </button>
                </div>
            </div>
        `).join('');
    },
    
    // 添加事件监听器
    addEventListeners() {
        // 添加新客服按钮
        const addButton = document.getElementById('add-service-btn');
        if (addButton) {
            addButton.addEventListener('click', () => this.showAddServiceModal());
        }
        // It's good practice to ensure the modal and its internal elements exist before adding listeners or setting onclicks
        const serviceModal = document.getElementById('service-modal');
        if (serviceModal) {
            const closeButton = serviceModal.querySelector('.close-modal-btn'); // Assuming a class for close button
            if (closeButton) {
                closeButton.addEventListener('click', () => this.hideServiceModal());
            }
            // Handle form submission more safely
            const serviceForm = serviceModal.querySelector('form'); // Assuming there is a form element
            if (serviceForm) {
                serviceForm.addEventListener('submit', (event) => {
                    event.preventDefault(); // Prevent default form submission
                    const submitButton = serviceModal.querySelector('#submit-service');
                    if (submitButton && submitButton.dataset.mode === 'add') {
                         // this.addNewService(); // You'll need an addNewService method
                    } else if (submitButton && submitButton.dataset.mode === 'edit' && submitButton.dataset.id) {
                         this.updateService(submitButton.dataset.id);
                    }
                });
            }
        }
    },
    
    // 显示添加客服模态框
    showAddServiceModal() {
        const modal = document.getElementById('service-modal');
        if (!modal) return;
        // Clear form fields
        const titleInput = modal.querySelector('#service-title');
        const contentInput = modal.querySelector('#service-content');
        if (titleInput) titleInput.value = '';
        if (contentInput) contentInput.value = '';

        const submitButton = modal.querySelector('#submit-service');
        if (submitButton) {
            submitButton.textContent = '添加'; // Or appropriate text
            submitButton.dataset.mode = 'add';
            // submitButton.onclick = () => this.addNewService(); // Or handle via form submit listener
        }
        modal.style.display = 'block';
    },
    
    // 隐藏客服模态框
    hideServiceModal() {
        const modal = document.getElementById('service-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    },
    
    async editService(id) {
        try {
            const response = await fetch(`/api/customer-service/${id}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: '获取客服详情失败' }));
                throw new Error(errorData.message);
            }
            
            const service = await response.json();
            if (service && service.data) { // Assuming service data is nested under 'data'
                this.showEditServiceModal(service.data);
            } else {
                 this.showEditServiceModal(service); // If not nested
            }
            
        } catch (error) {
            console.error('获取客服详情失败:', error);
            if (window.ui) window.ui.showError(`获取客服详情失败: ${error.message}`);
        }
    },
    
    showEditServiceModal(service) {
        const modal = document.getElementById('service-modal');
        if (!modal || !service) return;
        
        const titleInput = modal.querySelector('#service-title');
        const contentInput = modal.querySelector('#service-content');
        if (titleInput) titleInput.value = service.title || '';
        if (contentInput) contentInput.value = service.content || '';
        
        const submitButton = modal.querySelector('#submit-service');
        if (submitButton) {
            submitButton.textContent = '更新'; // Or appropriate text
            submitButton.dataset.mode = 'edit';
            submitButton.dataset.id = service._id;
           // submitButton.onclick = () = > this.updateService(service._id); // Handled by form listener
        }
        modal.style.display = 'block';
    },
    
    async updateService(id) {
        if (!id) {
            console.error('UpdateService: ID is undefined');
            if (window.ui) window.ui.showError('更新客服失败: 无效的ID');
            return;
        }
        try {
            const title = document.getElementById('service-title').value;
            const content = document.getElementById('service-content').value;
            
            const response = await fetch(`/api/customer-service/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                },
                body: JSON.stringify({ title, content })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: '更新客服失败' }));
                throw new Error(errorData.message);
            }
            
            this.hideServiceModal();
            await this.initCustomerServicePage(); // Refresh list
            if (window.ui) window.ui.showSuccess('客服更新成功');
            
        } catch (error) {
            console.error('更新客服失败:', error);
            if (window.ui) window.ui.showError(`更新客服失败: ${error.message}`);
        }
    },
    
    async updateStatus(id, status) {
        try {
            const response = await fetch(`/api/customer-service/${id}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                },
                body: JSON.stringify({ status })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: '更新客服状态失败' }));
                throw new Error(errorData.message);
            }
            
            await this.initCustomerServicePage(); // Refresh list
            if (window.ui) window.ui.showSuccess('状态更新成功');
            
        } catch (error) {
            console.error('更新客服状态失败:', error);
            if (window.ui) window.ui.showError(`更新客服状态失败: ${error.message}`);
        }
    },
    
    async deleteService(id) {
        if (!confirm('确定要删除这个客服吗？')) return;
        
        try {
            const response = await fetch(`/api/customer-service/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: '删除客服失败' }));
                throw new Error(errorData.message);
            }
            
            await this.initCustomerServicePage(); // Refresh list
            if (window.ui) window.ui.showSuccess('客服删除成功');
            
        } catch (error) {
            console.error('删除客服失败:', error);
            if (window.ui) window.ui.showError(`删除客服失败: ${error.message}`);
        }
    },

    // Add initializeAdminChat and loadAdminConversations to the object
    initializeAdminChat,
    loadAdminConversations
};

window.customerServiceManager = customerServiceManager;

// Ensure DOMContentLoaded listener for chat is correctly placed and doesn't conflict
// The previous DOMContentLoaded was for global chat initialization.
// If customerServiceManager.initCustomerServicePage() is for a specific admin page section for managing CS *accounts*,
// it should be called conditionally.

document.addEventListener('DOMContentLoaded', () => {
    // Initialize chat features globally (like background polling, modal listeners)
    window.customerServiceManager.initializeAdminChat(); 

    // Add event listener to the main chat icon/button that opens the modal
    const openChatModalButton = document.querySelector('[data-bs-target="#admin-customer-chat-modal"]');
    if (openChatModalButton) {
        openChatModalButton.addEventListener('click', () => {
            window.customerServiceManager.loadAdminConversations();
            const messagesContainer = document.getElementById('chat-messages');
            if(messagesContainer) messagesContainer.innerHTML = '<p class="text-muted text-center mt-3">请选择一个用户开始聊天</p>';
        });
    }

    // If there's a specific section for managing CS accounts, initialize that too.
    if (document.getElementById('customer-service-list-section')) { // Example ID for the CS management page section
        window.customerServiceManager.initCustomerServicePage();
    }
});
