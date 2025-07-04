import { marked } from 'marked';
import { supabase } from '../supabaseClient';
import { auth } from '../auth';
import { i18n } from '../i18n';

// --- Types matching your DB schema ---
type Sender = 'user' | 'ai';
interface Message { id?: number; sender: Sender; content: string; }
interface Chat { id: string; title: string; messages: Message[]; dify_conversation_id?: string; }
interface AppState { chats: Chat[]; activeChatId: string | null; }

interface SpeechRecognitionEvent extends Event { results: SpeechRecognitionResultList; }
interface SpeechRecognitionErrorEvent extends Event { error: string; }
declare var webkitSpeechRecognition: any;
declare var SpeechRecognition: any;
declare global {
    interface Window {
        SpeechRecognition?: typeof SpeechRecognition;
        webkitSpeechRecognition?: typeof webkitSpeechRecognition;
    }
}

export function renderAppPage(container: HTMLElement) {
    const DIFY_API_KEY = import.meta.env.VITE_DIFY_API_KEY;
    const GUEST_STORAGE_KEY = 'legalAI.guestChats';
    const GUEST_USER_ID_KEY = 'legalAI.guestUserId';

    let appState: AppState;
    const session = auth.getSession();
    const isGuestMode = session === null;

    const SUGGESTED_QUERIES = ['app_query_1', 'app_query_2', 'app_query_3', 'app_query_4'];

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = SpeechRecognitionAPI ? new SpeechRecognitionAPI() : null;
    const synthesis = window.speechSynthesis;
    let isListening = false;

    function getOrCreateGuestUserId(): string {
        let guestId = localStorage.getItem(GUEST_USER_ID_KEY);
        if (!guestId) {
            guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
            localStorage.setItem(GUEST_USER_ID_KEY, guestId);
        }
        return guestId;
    }
    const userIdentifier = session?.user?.id || getOrCreateGuestUserId();

    // --- HTML Structure ---
    container.innerHTML = `
      <div class="app-layout">
          <aside class="sidebar">
              <div class="sidebar-top">
                <button class="new-chat-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    ${i18n.t('app_newChat')}
                </button>
                <div class="sidebar-role-selector">
                    <label for="role-selector">${i18n.t('app_iAmA')}</label>
                    <select id="role-selector">
                        <option value="General Public">${i18n.t('app_role_general')}</option>
                        <option value="Law Student" selected>${i18n.t('app_role_student')}</option>
                        <option value="Legal Professional">${i18n.t('app_role_professional')}</option>
                    </select>
                </div>
              </div>
              <div class="conversation-list"><h2>${i18n.t('app_history')}</h2></div>
              <div class="sidebar-footer">
                  <div id="dark-mode-toggle">
                       <svg class="icon" id="theme-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>
                       <span id="theme-text">${document.body.classList.contains('dark-mode') ? i18n.t('app_lightMode') : i18n.t('app_darkMode')}</span>
                  </div>
                  <div id="sidebar-lang-switcher" class="language-switcher-sidebar">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                      <span class="lang-en ${i18n.getLanguage() === 'en' ? 'lang-active' : ''}">EN</span>
                      <span>/</span>
                      <span class="lang-bn ${i18n.getLanguage() === 'bn' ? 'lang-active' : ''}">বাং</span>
                  </div>
                  <div id="user-profile-link" class="user-profile-link"></div>
              </div>
          </aside>
          <main class="main-content">
              <div id="chat-window"></div>
              <div class="message-form-container">
                  <form id="message-form">
                      <button type="button" id="upload-doc-btn" class="upload-btn" title="Analyze a document">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                      </button>
                      <input type="file" id="doc-file-input" style="display:none" accept=".pdf,.doc,.docx,.txt,.rtf,.odt,.jpg,.jpeg,.png,.heic,.webp,.csv,.xlsx,.xls,.ppt,.pptx,.zip,.rar,.7z,.tar,.gz,.json,.xml,.eml,.msg,.md,.html,.htm,.epub,.mobi,.azw,.azw3,.fb2,.djvu,.cbz,.cbr,.mp3,.wav,.mp4,.mov,.avi,.mkv,.flv,.wmv,.ogg,.aac,.flac,.m4a,.webm,.ts,.m4v,.3gp,.3g2,.m2ts,.mts,.vob,.dat,.iso,.swf,.svg,.psd,.ai,.indd,.xd,.sketch,.fig,.blend,.dwg,.dxf,.stl,.obj,.fbx,.gltf,.glb,.3ds,.max,.c4d,.lwo,.lws,.ma,.mb,.ase,.aseprite,.spr,.sai,.clip,.kra,.ora,.psb,.tif,.tiff,.bmp,.ico,.icns,.cur,.ani,.exr,.hdr,.dds,.tga,.pal,.act,.thm,.yuv,.cin,.dpx,.rle,.sgi,.bw,.rgb,.rgba,.int,.inta,.sid,.pcx,.pict,.pct,.pic,.mac,.mag,.img,.sun,.ras,.xpm,.xbm,.ppm,.pgm,.pbm,.pnm,.pam,.j2k,.jp2,.jpf,.jpx,.jpm,.mj2,.svgz,.webp,.avif,.apng,.jxl,.heif,.heic,.pdf,.djvu,.xps,.oxps,.cbz,.cbr,.cbt,.cba,.cb7,.zip,.rar,.7z,.tar,.gz,.bz2,.xz,.lz,.lzma,.z,.tz,.tbz,.tgz,.txz,.tlz,.lz4,.lzo,.sz,.zst,.cab,.arj,.ace,.uue,.bz,.bzip2,.gzip,.lz,.lzma,.lzo,.rar,.xz,.z,.zip,.001,.7z,.ace,.alz,.apk,.arj,.bin,.bz2,.cab,.cpio,.deb,.dmg,.egg,.gz,.hqx,.img,.iso,.jar,.lzh,.lzma,.lzo,.msi,.pkg,.rar,.rpm,.sea,.sit,.tar,.tbz2,.tgz,.tlz,.txz,.war,.wim,.xar,.xz,.z,.zip,.zipx" />
                      <button type="button" id="mic-button" class="mic-btn" title="Ask with voice">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line></svg>
                      </button>
                      <input type="text" id="message-input" placeholder="${i18n.t('app_askAnything')}" autocomplete="off" required>
                      <button type="submit" id="send-button">
                          <svg class="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                      </button>
                  </form>
              </div>
          </main>
          <div id="overlay"></div>
      </div>`;

    const uploadDocBtn = document.getElementById('upload-doc-btn') as HTMLButtonElement;
    const docFileInput = document.getElementById('doc-file-input') as HTMLInputElement;
    const sidebar = document.querySelector('.sidebar') as HTMLElement;
    const overlay = document.getElementById('overlay') as HTMLDivElement;
    const chatWindow = document.getElementById('chat-window') as HTMLDivElement;
    const messageForm = document.getElementById('message-form') as HTMLFormElement;
    const messageInput = document.getElementById('message-input') as HTMLInputElement;
    const newChatBtn = document.querySelector('.new-chat-btn') as HTMLButtonElement;
    const conversationList = document.querySelector('.conversation-list') as HTMLDivElement;
    const darkModeToggle = document.getElementById('dark-mode-toggle') as HTMLDivElement;
    const themeText = document.getElementById('theme-text') as HTMLSpanElement;
    const userProfileLink = document.getElementById('user-profile-link') as HTMLDivElement;
    const micButton = document.getElementById('mic-button') as HTMLButtonElement;
    const sidebarLangSwitcher = document.getElementById('sidebar-lang-switcher');

    function speakText(text: string) {
        if (synthesis.speaking) synthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = synthesis.getVoices();
        const langCode = i18n.getLanguage();
        const preferredVoice = voices.find(voice => voice.lang.startsWith(langCode) && voice.name.includes('Google'));
        utterance.voice = preferredVoice || voices.find(voice => voice.lang.startsWith(langCode)) || voices[0];
        const lastMessageAvatar = chatWindow.querySelector('.message-wrapper:last-child .ai-avatar');
        utterance.onstart = () => { lastMessageAvatar?.classList.add('is-speaking'); };
        utterance.onend = () => { lastMessageAvatar?.classList.remove('is-speaking'); };
        utterance.onerror = () => { lastMessageAvatar?.classList.remove('is-speaking'); };
        utterance.rate = 1;
        utterance.pitch = 1;
        synthesis.speak(utterance);
    }

    function getActiveChat(): Chat | undefined {
        if (!appState || !appState.activeChatId) return undefined;
        return appState.chats.find(c => c.id === appState.activeChatId);
    }

    function renderSidebar() {
        if (!conversationList) return;
        conversationList.innerHTML = `<h2>${i18n.t('app_history')}</h2>`;
        (appState.chats || []).forEach(chat => {
            const convoItem = document.createElement('div');
            convoItem.className = 'conversation-item';
            if (chat.id === appState.activeChatId) convoItem.classList.add('active');

            const titleArea = document.createElement('div');
            titleArea.className = 'conversation-title-area';
            titleArea.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 21 1.65-3.8a9 9 0 1 1 3.4 2.9l-5.05.9"></path></svg><span>${chat.title}</span>`;
            titleArea.addEventListener('click', () => setActiveChat(chat.id));
            convoItem.appendChild(titleArea);

            const actionsMenu = document.createElement('div');
            actionsMenu.className = 'conversation-actions';
            actionsMenu.innerHTML = `
                <button class="action-btn rename-btn" title="Rename">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="action-btn share-btn" title="Share">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                </button>
                <button class="action-btn delete-btn" title="Delete">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            `;
            actionsMenu.querySelector('.rename-btn')?.addEventListener('click', (e) => { e.stopPropagation(); renameChat(chat.id); });
            actionsMenu.querySelector('.share-btn')?.addEventListener('click', (e) => { e.stopPropagation(); shareChat(chat.id, e.currentTarget as HTMLButtonElement); });
            actionsMenu.querySelector('.delete-btn')?.addEventListener('click', (e) => { e.stopPropagation(); deleteChat(chat.id); });

            convoItem.appendChild(actionsMenu);
            conversationList.appendChild(convoItem);
        });
    }

    function renderChatWindow() {
        if (!chatWindow) return;
        const activeChat = getActiveChat();
        const showWelcomeScreen = !activeChat || (activeChat.messages.length === 1 && activeChat.messages[0].sender === 'ai');
        if (showWelcomeScreen) {
            const suggestedQueriesHTML = SUGGESTED_QUERIES.map(key => `<div class="suggested-query-item">${i18n.t(key as any)}</div>`).join('');
            chatWindow.innerHTML = `
                <div class="empty-chat-container"> 
                    <div class="empty-chat-logo">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.153.34c-1.325 0-2.59-.523-3.536-1.465l-2.62-2.62m5.156 0l-2.62 2.62m-5.156 0l-2.62-2.62m6.75-10.726C12 4.5 11.25 4.5 10.5 4.5c-1.01 0-2.01.143-3 .52m3-.52l-2.62 10.726" /></svg> 
                    </div> 
                    <h2>${i18n.t('app_emptyChatTitle')}</h2>
                    <div class="suggested-queries-container">
                        ${suggestedQueriesHTML}
                    </div>
                </div>`;
        } else {
            chatWindow.innerHTML = '';
            activeChat.messages.forEach(msg => displayMessage(msg.content, msg.sender));
        }
    }

    function displayMessage(text: string, sender: Sender): HTMLDivElement {
        if (!chatWindow) return document.createElement('div'); // Return an empty div if chatWindow is not found

        const messageWrapper = document.createElement('div');
        messageWrapper.className = `message-wrapper ${sender}`;
        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        if (sender === 'user') {
            avatar.classList.add('user-avatar');
            const user = auth.getSession()?.user;
            avatar.textContent = user?.email?.charAt(0).toUpperCase() || 'G';
        } else {
            avatar.classList.add('ai-avatar');
            avatar.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.153.34c-1.325 0-2.59-.523-3.536-1.465l-2.62-2.62m5.156 0l-2.62 2.62m-5.156 0l-2.62-2.62m6.75-10.726C12 4.5 11.25 4.5 10.5 4.5c-1.01 0-2.01.143-3 .52m3-.52l-2.62 10.726" /></svg>`;
        }
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        if (sender === 'ai') {
            const senderName = document.createElement('div');
            senderName.className = 'sender-name';
            senderName.textContent = i18n.t('app_aiSenderName');
            messageContent.appendChild(senderName);
        }
        const messageBubble = document.createElement('div');
        messageBubble.className = 'message-bubble';

        if (sender === 'ai') {
            const parsed = marked.parse(text, { gfm: true });
            if (parsed instanceof Promise) {
                parsed.then(html => { messageBubble.innerHTML = html; });
            } else {
                messageBubble.innerHTML = parsed;
            }
        } else {
            messageBubble.innerText = text;
        }
        messageContent.appendChild(messageBubble);

        // --- Controls for AI messages ---
        if (sender === 'ai' && text.trim() !== "" && !text.includes('thinking')) {
            const controlsWrapper = document.createElement('div');
            controlsWrapper.className = 'message-controls';

            // Feedback Buttons
            const feedbackControls = document.createElement('div');
            feedbackControls.className = 'feedback-controls';
            const thumbUp = document.createElement('button');
            thumbUp.className = 'feedback-btn';
            thumbUp.innerHTML = '👍';
            thumbUp.title = 'Good response';
            const thumbDown = document.createElement('button');
            thumbDown.className = 'feedback-btn';
            thumbDown.innerHTML = '👎';
            thumbDown.title = 'Bad response';

            thumbUp.addEventListener('click', () => {
                sendFeedback(getActiveChat()?.id ?? '', text, 'good');
                thumbUp.disabled = true;
                thumbDown.disabled = true;
                thumbUp.classList.add('selected');
            });

            thumbDown.addEventListener('click', () => {
                sendFeedback(getActiveChat()?.id ?? '', text, 'bad');
                thumbUp.disabled = true;
                thumbDown.disabled = true;
                thumbDown.classList.add('selected');
            });

            feedbackControls.appendChild(thumbUp);
            feedbackControls.appendChild(thumbDown);

            // Speaker Button
            const speakButton = document.createElement('button');
            speakButton.className = 'speak-btn';
            speakButton.title = 'Read this message aloud';
            speakButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
            speakButton.addEventListener('click', (e) => {
                e.stopPropagation();
                speakText(text);
            });

            controlsWrapper.appendChild(feedbackControls);
            controlsWrapper.appendChild(speakButton);
            messageContent.appendChild(controlsWrapper);
        }
        // --- END OF CONTROLS ---

        if (sender === 'user') {
            messageWrapper.appendChild(messageContent);
            messageWrapper.appendChild(avatar);
        } else {
            messageWrapper.appendChild(avatar);
            messageWrapper.appendChild(messageContent);
        }
        chatWindow.appendChild(messageWrapper);
        chatWindow.scrollTop = chatWindow.scrollHeight;

        return messageWrapper; // Return the created element
    }

    async function setActiveChat(id: string | null) {
        if (!id) { appState.activeChatId = null; renderSidebar(); renderChatWindow(); return; }
        if (appState.activeChatId === id) return;
        appState.activeChatId = id;
        const activeChat = getActiveChat();
        if (activeChat && activeChat.messages.length === 0 && !isGuestMode) {
            const { data, error } = await supabase.from('messages').select('id, content, sender').eq('chat_id', id).order('created_at', { ascending: true });
            if (error) console.error('Error fetching messages:', error);
            else if (data) activeChat.messages = data as Message[];
        }
        renderSidebar();
        renderChatWindow();
        if (window.innerWidth <= 900) { sidebar.classList.remove('is-open'); overlay.classList.remove('is-open'); }
    }

    async function loadState() {
        if (isGuestMode) {
            const savedState = localStorage.getItem(GUEST_STORAGE_KEY);
            appState = savedState ? JSON.parse(savedState) : { chats: [], activeChatId: null };
        } else {
            const { data, error } = await supabase.from('chats').select('id, title').order('created_at', { ascending: false });
            if (error) {
                console.error("Error fetching chats:", error);
                appState = { chats: [], activeChatId: null };
                return;
            }
            appState = { chats: data.map((c: any) => ({ ...c, messages: [] })), activeChatId: null };
        }
    }

    async function createNewChat() {
        const initialMessage = { sender: 'ai' as Sender, content: i18n.t('app_initialGreeting') };
        if (isGuestMode) {
            const newChat: Chat = { id: `guest_${Date.now()}`, title: i18n.t('app_newChat'), messages: [initialMessage] };
            appState.chats.unshift(newChat);
            await setActiveChat(newChat.id);
            localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(appState));
        } else {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data, error } = await supabase.from('chats').insert({ user_id: user.id, title: i18n.t('app_newChat') }).select().single();
            if (error) { console.error("Error creating chat:", error); return; }
            const newChat: Chat = { ...data, messages: [initialMessage] };
            appState.chats.unshift(newChat);
            await setActiveChat(newChat.id);
        }
    }

    async function addMessageToActiveChat(message: Message, difyId?: string) {
        const activeChat = getActiveChat();
        if (!activeChat) return;
        activeChat.messages.push(message);
        if (activeChat.messages.length === 2 && message.sender === 'user') {
            const newTitle = message.content.substring(0, 30) + (message.content.length > 30 ? '...' : '');
            activeChat.title = newTitle;
            if (!isGuestMode) await supabase.from('chats').update({ title: newTitle }).eq('id', activeChat.id);
        }
        if (difyId) activeChat.dify_conversation_id = difyId;
        if (isGuestMode) {
            localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(appState));
        } else {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase.from('messages').insert({
                    chat_id: activeChat.id, user_id: user.id,
                    sender: message.sender, content: message.content
                });
            }
        }
        renderSidebar();
        renderChatWindow();
    }

    async function renameChat(id: string) {
        const chat = appState.chats.find(c => c.id === id);
        if (!chat) return;
        const newTitle = prompt(i18n.t('app_renameTitlePrompt'), chat.title);
        if (newTitle && newTitle.trim() !== "") {
            chat.title = newTitle.trim();
            if (isGuestMode) localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(appState));
            else await supabase.from('chats').update({ title: newTitle.trim() }).eq('id', id);
            renderSidebar();
        }
    }

    async function deleteChat(id: string) {
        if (!confirm(i18n.t('app_deleteConfirm'))) return;
        const index = appState.chats.findIndex(c => c.id === id);
        if (index > -1) {
            appState.chats.splice(index, 1);
            if (isGuestMode) localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(appState));
            else await supabase.from('chats').delete().eq('id', id);
            if (appState.activeChatId === id) {
                const nextId = appState.chats.length > 0 ? appState.chats[0].id : null;
                if (nextId) await setActiveChat(nextId);
                else await createNewChat();
            } else {
                renderSidebar();
            }
        }
    }

    function shareChat(id: string, button: HTMLButtonElement) {
        const chat = appState.chats.find(c => c.id === id);
        if (!chat) return;
        const formattedChat = `Chat: ${chat.title}\n\n` + chat.messages.map(msg => `${msg.sender === 'user' ? 'You' : 'LegalAI'}:\n${msg.content}`).join('\n\n');
        navigator.clipboard.writeText(formattedChat).then(() => {
            const originalContent = button.innerHTML;
            button.innerHTML = '✅';
            button.disabled = true;
            setTimeout(() => { button.innerHTML = originalContent; button.disabled = false; }, 2000);
        }).catch(err => { console.error('Failed to copy chat:', err); alert('Failed to copy chat.'); });
    }

    async function sendFeedback(chatId: string, msgContent: string, rating: 'good' | 'bad') {
        const { error } = await supabase
            .from('message_feedback')
            .insert({
                chat_id: chatId,
                message_content: msgContent,
                rating: rating
            });
        if (error) {
            console.error('Error saving feedback:', error);
        }
    }

    async function handleFormSubmit() {
        const userInput = messageInput.value.trim();
        if (!DIFY_API_KEY || !userInput) return;
        if (!appState.activeChatId) await createNewChat();
        const activeChat = getActiveChat();
        if (!activeChat) return;
        await addMessageToActiveChat({ sender: 'user', content: userInput });
        messageInput.value = '';
        displayMessage(i18n.t('app_thinking'), 'ai');
        const tempBubbles = chatWindow.querySelectorAll('.message-wrapper');
        const tempLastBubble = tempBubbles[tempBubbles.length - 1];
        try {
            const DIFY_CHAT_URL = 'https://api.dify.ai/v1/chat-messages';
            const response = await fetch(DIFY_CHAT_URL, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${DIFY_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    inputs: { "USER_ROLE": "...", "LANGUAGE": "..." },
                    query: userInput, user: userIdentifier,
                    conversation_id: activeChat.dify_conversation_id || "", response_mode: 'streaming'
                })
            });
            if (!response.ok) { const errorBody = await response.text(); throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorBody}`); }
            if (!response.body) { throw new Error("API response was successful but had no body."); }
            if (tempLastBubble) tempLastBubble.remove();
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let done = false; let fullResponse = ""; let finalDifyId = activeChat.dify_conversation_id;
            displayMessage("", 'ai');
            const aiBubbles = chatWindow.querySelectorAll('.message-wrapper.ai .message-bubble');
            const aiLastBubble = aiBubbles[aiBubbles.length - 1] as HTMLDivElement;
            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(line => line.startsWith('data: '));
                for (const line of lines) {
                    try {
                        const jsonStr = line.substring(6);
                        if (jsonStr.trim() === '[DONE]') continue;
                        const parsedJson = JSON.parse(jsonStr);
                        if (parsedJson.conversation_id) finalDifyId = parsedJson.conversation_id;
                        if (parsedJson.event === 'agent_message' || parsedJson.event === 'message') {
                            fullResponse += parsedJson.answer;
                            const parsedMarkdown = marked.parse(fullResponse, { gfm: true });
                            if (parsedMarkdown instanceof Promise) {
                                parsedMarkdown.then(html => { aiLastBubble.innerHTML = html; });
                            } else {
                                aiLastBubble.innerHTML = parsedMarkdown;
                            }
                            chatWindow.scrollTop = chatWindow.scrollHeight;
                        }
                    } catch (e) { }
                }
            }
            await addMessageToActiveChat({ sender: 'ai', content: fullResponse }, finalDifyId);
        } catch (error) {
            if (tempLastBubble) tempLastBubble.remove();
            const errorMessage = `${i18n.t('app_error')} ${error instanceof Error ? error.message : 'Unknown error'}`;
            await addMessageToActiveChat({ sender: 'ai', content: errorMessage });
            speakText(errorMessage);
        }
    }

    async function handleDocumentUpload(event: Event) {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];

        if (!file) return;

        const user = auth.getSession()?.user;
        if (!user) {
            // ... (your existing guest handling logic is fine)
            const guestNotice = chatWindow.querySelector('.guest-analysis-notice');
            if (!guestNotice) {
                displayMessage("Sign in to analyze documents. This feature requires an account to keep your documents secure.", 'ai');
                const newMsg = chatWindow.querySelector('.message-wrapper:last-child');
                newMsg?.classList.add('guest-analysis-notice');
            }
            target.value = '';
            return;
        }

        const processingMsg = `Processing document: **${file.name}**...`;
        displayMessage(processingMsg, 'ai');
        const tempMessageWrapper = chatWindow.querySelector('.message-wrapper:last-child');

        try {
            // --- We will now do the Dify upload FIRST ---

            // Step 1: Send the actual file to Dify to create a knowledge segment
            const DIFY_FILE_UPLOAD_URL = 'https://api.dify.ai/v1/files/upload';
            
            const formData = new FormData();
            formData.append('user', userIdentifier); // Dify requires the user identifier
            formData.append('file', file); // <-- Send the raw file object

            const difyResponse = await fetch(DIFY_FILE_UPLOAD_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${DIFY_API_KEY}`,
                },
                body: formData,
            });

            if (!difyResponse.ok) {
                const errorBody = await difyResponse.json();
                throw new Error(`Dify API Error: ${errorBody.message || 'Failed to upload file to Dify'}`);
            }

            // --- Dify part is successful, now upload to Supabase for our own records ---

            // Step 2: Upload the file to Supabase Storage for long-term storage
            const filePath = `${user.id}/${Date.now()}-${file.name}`;
            const { error: uploadError } = await supabase.storage.from('document-uploads').upload(filePath, file);
            if (uploadError) {
                // This is not a critical failure, as Dify has the file. We can just log it.
                console.warn(`Supabase upload failed, but Dify succeeded: ${uploadError.message}`);
            }
            
            // Step 3: Update the message to "Ready"
            const readyMsg = `Your document **${file.name}** is ready. Ask me anything about it.`;
            if (tempMessageWrapper) {
                const bubbleContent = tempMessageWrapper.querySelector('.message-bubble');
                if (bubbleContent) {
                    const parsed = marked.parse(readyMsg);
                    if (parsed instanceof Promise) {
                        parsed.then(html => { bubbleContent.innerHTML = html; });
                    } else {
                        bubbleContent.innerHTML = parsed;
                    }
                }
            }
            
        } catch (error) {
            const errorMessage = `Failed to process document. ${error instanceof Error ? error.message : 'Unknown error'}`;
            if (tempMessageWrapper) {
                const bubbleContent = tempMessageWrapper.querySelector('.message-bubble');
                if (bubbleContent) {
                    const parsed = marked.parse(errorMessage);
                    if (parsed instanceof Promise) {
                        parsed.then(html => { bubbleContent.innerHTML = html; });
                    } else {
                        bubbleContent.innerHTML = parsed;
                    }
                }
            }
            console.error(error);
        } finally {
            target.value = ''; // Clear the file input
        }
    }

    function renderUserProfileLink() {
        if (!userProfileLink) return;
        if (isGuestMode) {
            userProfileLink.innerHTML = `<a href="/login" class="nav-button nav-button-primary" data-link>${i18n.t('app_signUpToSave')}</a>`;
        } else {
            const user = session?.user;
            const userInitial = user?.email?.charAt(0).toUpperCase() || 'P';
            userProfileLink.innerHTML = `<a href="/profile" data-link><div class="avatar user-avatar">${userInitial}</div><span>${user?.email}</span></a>`;
        }
    }

    async function initApp() {
        function setupSpeechRecognition() {
            if (!recognition) {
                if (micButton) micButton.style.display = 'none';
                console.warn("Speech Recognition not supported in this browser.");
                return;
            }
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = i18n.getLanguage() === 'bn' ? 'bn-BD' : 'en-US';
            recognition.onstart = () => { isListening = true; micButton.classList.add('is-listening'); };
            recognition.onend = () => { isListening = false; micButton.classList.remove('is-listening'); };
            recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
                console.error("Speech recognition error", event.error);
                isListening = false;
                micButton.classList.remove('is-listening');
            };
            recognition.onresult = (event: SpeechRecognitionEvent) => {
                const transcript = event.results[0][0].transcript;
                messageInput.value = transcript;
                handleFormSubmit();
            };
            micButton.addEventListener('click', () => {
                if (synthesis.speaking) { synthesis.cancel(); }
                if (isListening) {
                    recognition.stop();
                } else {
                    recognition.start();
                }
            });
        }
        function toggleSidebar() {
            sidebar.classList.toggle('is-open');
            overlay.classList.toggle('is-open');
        }
        document.addEventListener('toggle-sidebar', toggleSidebar);
        overlay.addEventListener('click', toggleSidebar);
        conversationList.addEventListener('click', (e) => {
            if (window.innerWidth <= 900 && (e.target as HTMLElement).closest('.conversation-item')) {
                toggleSidebar();
            }
        });
        messageForm.addEventListener('submit', (e) => { e.preventDefault(); handleFormSubmit(); });
        chatWindow.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const queryItem = target.closest('.suggested-query-item');
            if (queryItem && queryItem.textContent) {
                messageInput.value = queryItem.textContent;
                handleFormSubmit();
            }
        });
        newChatBtn.addEventListener('click', createNewChat);
        darkModeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            if (themeText) themeText.textContent = document.body.classList.contains('dark-mode') ? i18n.t('app_lightMode') : i18n.t('app_darkMode');
        });
        if (isGuestMode) {
            const guestNotice = document.createElement('div');
            guestNotice.style.cssText = 'background-color: var(--bg-soft); border: 1px solid var(--border-color); color: var(--text-secondary); padding: 8px 12px; text-align: center; font-size: 14px; border-radius: 8px; margin-bottom: 16px;';
            guestNotice.innerHTML = `${i18n.t('app_guestNotice')} <a href="/login" data-link style="color: var(--accent-color-start); font-weight: 500;">${i18n.t('app_guestSignIn')}</a> ${i18n.t('app_guestToSave')}`;
            sidebar.prepend(guestNotice);
        }
        await loadState();
        if (appState.chats.length === 0) {
            await createNewChat();
        } else {
            await setActiveChat(appState.chats[0].id);
        }
        renderUserProfileLink();
        setupSpeechRecognition();
        sidebarLangSwitcher?.querySelector('.lang-en')?.addEventListener('click', () => {
            if (i18n.getLanguage() !== 'en') i18n.setLanguage('en');
        });
        sidebarLangSwitcher?.querySelector('.lang-bn')?.addEventListener('click', () => {
            if (i18n.getLanguage() !== 'bn') i18n.setLanguage('bn');
        });
        uploadDocBtn.addEventListener('click', () => { docFileInput.click(); });
        docFileInput.addEventListener('change', handleDocumentUpload);
    }
    initApp();
}