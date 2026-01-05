const socket = io();

let currentUser = null;
let activePartnerId = null;
let chats = {};
let allUsers = [];
let currentGenderFilter = 'all';
let registeredProfilePic = null;
let selectedFile = null;

const entryScreen = document.getElementById('entry-screen');
const appScreen = document.getElementById('app-screen');
const registrationForm = document.getElementById('registration-form');
const chatList = document.getElementById('chat-list');
const onlineUsersRoll = document.getElementById('online-users-roll');
const messagesArea = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const chatActiveSection = document.getElementById('chat-active');
const chatEmptySection = document.getElementById('chat-empty');
const emojiTrigger = document.getElementById('emoji-trigger');
const emojiPicker = document.getElementById('emoji-picker');
const typingIndicator = document.getElementById('typing-indicator');
const mediaPreviewContainer = document.getElementById('media-preview-container');
const infoSidebar = document.getElementById('info-sidebar');
const navHome = document.querySelector('.nav-links a');
const headerMenuTrigger = document.getElementById('header-menu-trigger');
const headerDropdown = document.getElementById('header-dropdown');
const fileUpload = document.getElementById('file-upload');

const homeStartMatchBtn = document.getElementById('home-start-match-btn');
const homeMatchType = document.getElementById('home-match-type');

const profilePicUpload = document.getElementById('profile-pic-upload');
const registerAvatarPreview = document.getElementById('register-avatar-preview');

navHome.onclick = (e) => {
    e.preventDefault();
    activePartnerId = null;
    navHome.classList.add('active');
    renderChatList();
    renderActiveChat();
    infoSidebar.classList.add('hidden');
};

function selectChat(partnerId) {
    activePartnerId = partnerId;
    const chat = chats[partnerId];
    if (!chat) return;

    chat.unreadCount = 0;
    navHome.classList.remove('active');

    socket.emit('messageSeen', { fromId: partnerId });

    renderChatList();
    renderActiveChat();
    renderOnlineRoll();
    updateInfoSidebar(chat.partner);
    if (window.innerWidth <= 768) document.querySelector('.chat-view').classList.add('active');
}

function renderChatList() {
    chatList.innerHTML = '';
    const entries = Object.values(chats).filter(c => {
        if (currentGenderFilter === 'all') return true;
        return c.partner.gender === currentGenderFilter;
    }).sort((a, b) => b.lastActivity - a.lastActivity);

    entries.forEach(chat => {
        const partner = chat.partner;
        const lastMsgObj = chat.messages[chat.messages.length - 1];
        const lastMsg = lastMsgObj ? (lastMsgObj.file ? 'Sent a file' : lastMsgObj.message) : 'No messages yet';
        const time = lastMsgObj ? new Date(lastMsgObj.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const isActive = activePartnerId === partner.socketId;

        const avatarHtml = partner.profilePic
            ? `<img src="${partner.profilePic}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`
            : partner.name[0].toUpperCase();

        const div = document.createElement('div');
        div.className = `contact-item ${isActive ? 'active' : ''}`;
        div.innerHTML = `
            <div class="avatar-circle" style="background: ${partner.profilePic ? 'transparent' : getRandomColor()}">
                ${avatarHtml}
            </div>
            <div class="contact-info">
                <div class="contact-header"><h4>${partner.name}</h4><span class="time">${time}</span></div>
                <p>${lastMsg.substring(0, 25)}${lastMsg.length > 25 ? '...' : ''}</p>
            </div>
            ${chat.unreadCount > 0 ? `<div class="unread-badge">${chat.unreadCount}</div>` : ''}
        `;
        div.onclick = () => selectChat(partner.socketId);
        chatList.appendChild(div);
    });
}

function renderOnlineRoll() {
    onlineUsersRoll.innerHTML = '';
    allUsers.forEach(user => {
        if (user.socketId === socket.id) return;
        if (chats[user.socketId]) return;

        const item = document.createElement('div');
        item.className = 'roll-item';

        const avatarSrc = user.profilePic || `https://ui-avatars.com/api/?name=${user.name}&background=random&size=50`;

        item.innerHTML = `
            <div class="roll-avatar">
                <img src="${avatarSrc}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">
            </div>
            <div class="roll-info">
                <h5>${user.name}</h5>
                <span>${user.country || 'Unknown'}</span>
            </div>
        `;
        item.onclick = () => startPersonalChat(user);
        onlineUsersRoll.appendChild(item);
    });
}

function renderActiveChat() {
    if (!activePartnerId || !chats[activePartnerId]) {
        chatEmptySection.classList.remove('hidden');
        chatActiveSection.classList.add('hidden');
        return;
    }
    const chat = chats[activePartnerId];
    chatEmptySection.classList.add('hidden');
    chatActiveSection.classList.remove('hidden');

    document.getElementById('partner-name').innerText = chat.partner.name;

    const activeAvatar = document.getElementById('active-partner-avatar');
    if (chat.partner.profilePic) {
        activeAvatar.innerHTML = `<img src="${chat.partner.profilePic}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        activeAvatar.style.background = 'transparent';
    } else {
        activeAvatar.innerText = chat.partner.name[0].toUpperCase();
        activeAvatar.style.background = '#eee';
    }

    document.getElementById('next-match-btn').classList.toggle('hidden', !chat.isRandomMatch);

    messagesArea.innerHTML = '';
    chat.messages.forEach(msg => {
        const wrap = document.createElement('div');
        wrap.className = `message-wrap ${msg.type}`;

        let tickIcon = '';
        if (msg.type === 'sent') {
            if (msg.status === 'sending') tickIcon = '<i class="fas fa-clock"></i>';
            else if (msg.status === 'delivered') tickIcon = '<i class="fas fa-check"></i>';
            else if (msg.status === 'seen') tickIcon = '<i class="fas fa-check-double"></i>';
        }

        wrap.innerHTML = `
            <div class="msg-bubble">
                ${msg.file ? `
                    <div class="file-link">
                        ${msg.file.type.startsWith('image/') ? `<img src="${msg.file.data}" style="max-width:200px; border-radius:8px; display:block; margin-bottom:5px;">` : ''}
                        <a href="${msg.file.data}" download="${msg.file.name}" style="color:inherit; font-weight:700;">
                            <i class="fas fa-file"></i> ${msg.file.name}
                        </a>
                    </div>` : ''}
                <span>${msg.message.replace(/\n/g, '<br>')}</span>
                <div class="msg-meta">
                    ${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    ${msg.type === 'sent' ? `<span class="tick ${msg.status}">${tickIcon}</span>` : ''}
                </div>
            </div>
        `;
        messagesArea.appendChild(wrap);
    });
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text && !selectedFile) return;
    if (!activePartnerId) return;

    const msgId = Date.now() + Math.random().toString(36).substr(2, 9);
    const timestamp = new Date();

    const chat = chats[activePartnerId];
    const newMsg = {
        id: msgId,
        type: 'sent',
        message: text,
        file: selectedFile,
        timestamp,
        status: 'sending'
    };
    chat.messages.push(newMsg);
    chat.lastActivity = timestamp.getTime();

    messageInput.value = '';
    messageInput.style.height = 'auto';
    selectedFile = null;
    mediaPreviewContainer.innerHTML = '';
    mediaPreviewContainer.style.display = 'none';

    renderChatList();
    renderActiveChat();

    socket.emit('sendMessage', { toId: activePartnerId, message: text, file: newMsg.file, msgId }, (ack) => {
        const m = chat.messages.find(m => m.id === msgId);
        if (m) {
            m.status = 'delivered';
            renderActiveChat();
        }
    });
}

fileUpload.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            selectedFile = {
                name: file.name,
                type: file.type,
                data: event.target.result
            };
            mediaPreviewContainer.innerHTML = `
                <div class="preview-item">
                    ${file.type.startsWith('image/') ? `<img src="${selectedFile.data}">` : `<div style="display:flex; align-items:center; justify-content:center; height:100%; font-size:1.5rem;"><i class="fas fa-file"></i></div>`}
                    <div style="position:absolute; top:2px; right:2px; background:rgba(0,0,0,0.5); color:white; border-radius:50%; width:18px; height:18px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:10px;" onclick="cancelFileUpload()">×</div>
                </div>
            `;
            mediaPreviewContainer.style.display = 'flex';
        };
        reader.readAsDataURL(file);
    }
};

function cancelFileUpload() {
    selectedFile = null;
    mediaPreviewContainer.innerHTML = '';
    mediaPreviewContainer.style.display = 'none';
    fileUpload.value = '';
}

messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';
    if (activePartnerId) socket.emit('typing', { toId: activePartnerId });
});

socket.on('chatStarted', (partner) => {
    if (!chats[partner.socketId]) chats[partner.socketId] = { partner, messages: [], unreadCount: 0, isRandomMatch: true, lastActivity: Date.now() };
    selectChat(partner.socketId);
    renderChatList();
});

socket.on('receiveMessage', (data) => {
    const fromId = data.from;
    if (!chats[fromId]) {
        chats[fromId] = { partner: { socketId: fromId, name: data.fromName, gender: 'unknown', country: data.country || 'Unknown', profilePic: data.fromAvatar, age: data.fromAge }, messages: [], unreadCount: 0, isRandomMatch: false, lastActivity: Date.now() };
    }
    const chat = chats[fromId];
    chat.messages.push({ type: 'received', message: data.message, file: data.file, timestamp: data.timestamp });
    chat.lastActivity = Date.now();

    if (activePartnerId !== fromId) {
        chat.unreadCount++;
    } else {
        socket.emit('messageSeen', { fromId: fromId });
    }

    renderChatList();
    renderOnlineRoll();
    if (activePartnerId === fromId) renderActiveChat();
});

socket.on('userListUpdate', (users) => { allUsers = users; renderOnlineRoll(); });

socket.on('messageSeenUpdate', ({ byId }) => {
    if (chats[byId]) {
        chats[byId].messages.forEach(m => {
            if (m.type === 'sent') m.status = 'seen';
        });
        if (activePartnerId === byId) renderActiveChat();
    }
});

socket.on('joined', (user) => {
    currentUser = user;
    showScreen('app-screen');
    updateSelfUI();
});

profilePicUpload.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            registeredProfilePic = event.target.result;
            registerAvatarPreview.src = registeredProfilePic;
        };
        reader.readAsDataURL(file);
    }
};

registrationForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!registeredProfilePic) {
        alert("Please upload a Profile Picture to proceed. 📸");
        return;
    }
    const details = {
        name: document.getElementById('name').value,
        age: document.getElementById('age').value,
        gender: document.getElementById('gender').value,
        country: document.getElementById('country').value,
        profilePic: registeredProfilePic
    };
    socket.emit('join', details);
});

headerMenuTrigger.onclick = (e) => { e.stopPropagation(); headerDropdown.classList.toggle('hidden'); };
window.onclick = () => { headerDropdown.classList.add('hidden'); };

document.getElementById('block-user-btn').onclick = () => {
    if (activePartnerId) {
        alert(chats[activePartnerId].partner.name + " has been blocked.");
        delete chats[activePartnerId];
        activePartnerId = null;
        navHome.classList.add('active');
        renderChatList();
        renderActiveChat();
        renderOnlineRoll();
        infoSidebar.classList.add('hidden');
    }
};

document.getElementById('active-partner-avatar').onclick = (e) => { e.stopPropagation(); infoSidebar.classList.toggle('hidden'); };
document.getElementById('self-avatar').onclick = (e) => { e.stopPropagation(); infoSidebar.classList.toggle('hidden'); };

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelector('.filter-btn.active').classList.remove('active');
        btn.classList.add('active');
        currentGenderFilter = btn.dataset.filter;
        renderChatList();
    };
});

emojiTrigger.onclick = (e) => { e.stopPropagation(); emojiPicker.classList.toggle('hidden'); };
document.querySelectorAll('.emoji-grid span').forEach(s => {
    s.onclick = () => { messageInput.value += s.innerText; emojiPicker.classList.add('hidden'); messageInput.focus(); }
});

homeStartMatchBtn.onclick = () => socket.emit('startRandomChat', homeMatchType.value);

document.getElementById('next-match-btn').onclick = () => socket.emit('startRandomChat', homeMatchType.value);

function showScreen(id) { entryScreen.classList.add('hidden'); appScreen.classList.add('hidden'); document.getElementById(id).classList.remove('hidden'); }

function updateSelfUI() {
    const selfAvatar = document.getElementById('self-avatar');
    if (currentUser.profilePic) {
        selfAvatar.src = currentUser.profilePic;
    } else {
        selfAvatar.src = `https://ui-avatars.com/api/?name=${currentUser.name}&background=random`;
    }
}

function startPersonalChat(user) {
    if (!chats[user.socketId]) chats[user.socketId] = { partner: user, messages: [], unreadCount: 0, isRandomMatch: false, lastActivity: Date.now() };
    selectChat(user.socketId);
    renderChatList();
}

function getRandomColor() { return ['#007bff', '#6f42c1', '#e83e8c', '#fd7e14', '#20c997'][Math.floor(Math.random() * 5)]; }

function updateInfoSidebar(partner) {
    document.getElementById('info-name').innerText = partner.name;
    document.getElementById('info-age').innerText = partner.age || '??';
    const infoAvatar = document.getElementById('info-avatar');
    if (partner.profilePic) {
        infoAvatar.innerHTML = `<img src="${partner.profilePic}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
    } else {
        infoAvatar.innerText = partner.name[0].toUpperCase();
    }
    document.getElementById('info-location').innerText = partner.country || 'Global';

    const mediaGrid = document.getElementById('info-media-grid');
    mediaGrid.innerHTML = '<div class="media-placeholder">No media shared yet</div>';
}

socket.on('userTyping', (data) => { if (activePartnerId === data.from) { typingIndicator.innerText = 'typing...'; setTimeout(() => typingIndicator.innerText = '', 2000); } });
