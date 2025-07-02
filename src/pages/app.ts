import { marked } from 'marked'; // <-- Add this import at the top
import { supabase } from '../supabaseClient';
import { auth } from '../auth';
import { i18n } from '../i18n';

type Sender = 'user' | 'ai';
interface Message { sender: Sender; text: string; }
interface Conversation { id: string; title: string; messages: Message[]; dify_conversation_id?: string; }
interface AppState { conversations: Conversation[]; activeConversationId: string | null; }

// --- Add type definitions for Web Speech API to avoid TypeScript errors ---
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
    error: string;
}
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
    const GUEST_STORAGE_KEY = 'legalAI.guestConversations';
    const GUEST_USER_ID_KEY = 'legalAI.guestUserId';

    let appState: AppState;
    const session = auth.getSession();
    const isGuestMode = session === null;

    // --- NEW: Define suggested queries using i18n for translation ---
    const SUGGESTED_QUERIES = [
        'app_query_1',
        'app_query_2',
        'app_query_3',
        'app_query_4',
    ];

    // --- Voice Synthesis & Recognition Setup ---
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

              <!-- Language Switcher Sidebar -->
              <div id="sidebar-lang-switcher" class="language-switcher-sidebar">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                  <span class="lang-en ${i18n.getLanguage() === 'en' ? 'lang-active' : ''}">EN</span>
                  <span>/</span>
                  <span class="lang-bn ${i18n.getLanguage() === 'bn' ? 'lang-active' : ''}">বাং</span>
              </div>
              <!-- End Language Switcher Sidebar -->

              <div id="user-profile-link" class="user-profile-link"></div>
          </div>
      </aside>
      <main class="main-content">
          <div id="chat-window"></div>
          <div class="message-form-container">
              <form id="message-form">
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
        if (synthesis.speaking) {
            synthesis.cancel();
        }
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

    // --- UPDATED ---
    function renderSidebar() {
        if (!conversationList) return;
        conversationList.innerHTML = `<h2>${i18n.t('app_history')}</h2>`;
        (appState.conversations || []).forEach(convo => {
            const convoItem = document.createElement('div');
            convoItem.className = 'conversation-item';
            if (convo.id === appState.activeConversationId) convoItem.classList.add('active');

            const titleArea = document.createElement('div');
            titleArea.className = 'conversation-title-area';
            titleArea.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 21 1.65-3.8a9 9 0 1 1 3.4 2.9l-5.05.9"></path></svg><span>${convo.title}</span>`;
            titleArea.addEventListener('click', () => setActiveConversation(convo.id));
            convoItem.appendChild(titleArea);

            const actionsMenu = document.createElement('div');
            actionsMenu.className = 'conversation-actions';
            actionsMenu.innerHTML = `<button class="action-btn rename-btn" title="Rename"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button><button class="action-btn share-btn" title="Share"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg></button><button class="action-btn delete-btn" title="Delete"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>`;

            // Listeners are now added for both guest and logged-in users
            actionsMenu.querySelector('.rename-btn')?.addEventListener('click', (e) => { e.stopPropagation(); renameConversation(convo.id); });
            actionsMenu.querySelector('.share-btn')?.addEventListener('click', (e) => { e.stopPropagation(); shareConversation(convo.id, e.currentTarget as HTMLButtonElement); });
            actionsMenu.querySelector('.delete-btn')?.addEventListener('click', (e) => { e.stopPropagation(); deleteConversation(convo.id); });

            convoItem.appendChild(actionsMenu);
            conversationList.appendChild(convoItem);
        });
    }

    function renderChatWindow() {
        if (!chatWindow) return;
        const activeConvo = appState.conversations.find(c => c.id === appState.activeConversationId);

        if (activeConvo && activeConvo.messages.length <= 1) {
            const suggestedQueriesHTML = SUGGESTED_QUERIES.map(key => `
                <div class="suggested-query-item">${i18n.t(key as any)}</div>
            `).join('');

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
            if (activeConvo) activeConvo.messages.forEach(msg => displayMessage(msg.text, msg.sender));
        }
    }

    function displayMessage(text: string, sender: Sender) {
        if (!chatWindow) return;
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

        // --- COMBINED CONTROLS FOR AI MESSAGES ---
        if (sender === 'ai' && text.trim() !== "" && !text.includes('Sorry, an error occurred')) {
            const controlsWrapper = document.createElement('div');
            controlsWrapper.className = 'message-controls';

            // Speaker Button
            const speakButton = document.createElement('button');
            speakButton.className = 'speak-btn';
            speakButton.title = 'Read this message aloud';
            speakButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
            speakButton.addEventListener('click', (e) => {
                e.stopPropagation();
                speakText(text);
            });
            
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
                sendFeedback(appState.activeConversationId || '', text, 'good');
                thumbUp.disabled = true;
                thumbDown.disabled = true;
                thumbUp.classList.add('selected');
            });

            thumbDown.addEventListener('click', () => {
                sendFeedback(appState.activeConversationId || '', text, 'bad');
                thumbUp.disabled = true;
                thumbDown.disabled = true;
                thumbDown.classList.add('selected');
            });

            feedbackControls.appendChild(thumbUp);
            feedbackControls.appendChild(thumbDown);

            controlsWrapper.appendChild(feedbackControls);
            controlsWrapper.appendChild(speakButton); // Add speak button to the wrapper
            messageContent.appendChild(controlsWrapper);
        }
        // --- END OF COMBINED CONTROLS ---

        if (sender === 'user') { 
            messageWrapper.appendChild(messageContent); 
            messageWrapper.appendChild(avatar); 
        } else { 
            messageWrapper.appendChild(avatar); 
            messageWrapper.appendChild(messageContent); 
        }
        chatWindow.appendChild(messageWrapper);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    function setActiveConversation(id: string) {
        appState.activeConversationId = id;
        if (window.innerWidth <= 900) {
            sidebar.classList.remove('is-open');
            overlay.classList.remove('is-open');
        }
        renderSidebar();
        renderChatWindow();
    }

    // REPLACE with this version
    async function loadState() {
        if (isGuestMode) {
            const savedState = localStorage.getItem(GUEST_STORAGE_KEY);
            appState = savedState ? JSON.parse(savedState) : { conversations: [], activeConversationId: null };
        } else {
            const { data, error } = await supabase.from('conversations').select('*').order('created_at', { ascending: false });
            if (error) { console.error("Error fetching:", error); appState = { conversations: [], activeConversationId: null }; return; }
            appState = { conversations: data as Conversation[], activeConversationId: null };
        }
        // We no longer automatically set an active conversation here.
        // We also don't create a new one here anymore.
    }

    // ADD THIS NEW FUNCTION
    function startNewChatView() {
        // Create a temporary conversation object
        const tempConvo: Conversation = {
            id: 'new-chat-session', // A special ID to identify it
            title: i18n.t('app_newChat'),
            messages: [{ sender: 'ai', text: i18n.t('app_initialGreeting') }]
        };

        // Add it to the top of the list without saving
        appState.conversations.unshift(tempConvo);
        // Make it active
        setActiveConversation(tempConvo.id);
    }

    async function createNewConversation() {
        const newConvo: Conversation = {
            id: Date.now().toString(),
            title: i18n.t('app_newChat'),
            messages: [{ sender: 'ai', text: i18n.t('app_initialGreeting') }]
        };
        if (isGuestMode) {
            appState.conversations.unshift(newConvo);
            localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(appState));
        } else {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data, error } = await supabase.from('conversations').insert({ user_id: user.id, title: newConvo.title, messages: newConvo.messages }).select().single();
            if (error) { console.error("Error creating:", error); return; }
            appState.conversations.unshift(data as Conversation);
        }
        setActiveConversation(newConvo.id);
    }

    // --- UPDATED ---
    async function renameConversation(id: string) {
        const convo = appState.conversations.find(c => c.id === id);
        if (!convo) return;

        const newTitle = prompt(i18n.t('app_renameTitlePrompt'), convo.title);
        if (newTitle && newTitle.trim() !== "") {
            convo.title = newTitle.trim();

            if (isGuestMode) {
                localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(appState));
            } else {
                const { error } = await supabase.from('conversations').update({ title: newTitle.trim() }).eq('id', id);
                if (error) {
                    console.error("Error renaming:", error);
                    return;
                }
            }
            renderSidebar();
        }
    }

    // Add this new function inside renderAppPage
    async function sendFeedback(convoId: string, msgText: string, rating: 'good' | 'bad') {
        const { error } = await supabase
            .from('message_feedback')
            .insert({
                conversation_id: convoId,
                message_text: msgText,
                rating: rating
            });

        if (error) {
            console.error('Error saving feedback:', error);
        }
    }

    // ...rest of

    // --- UPDATED ---
    async function deleteConversation(id: string) {
        if (!confirm(i18n.t('app_deleteConfirm'))) return;

        if (isGuestMode) {
            const index = appState.conversations.findIndex(c => c.id === id);
            if (index > -1) {
                appState.conversations.splice(index, 1);
                localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(appState));
            }
        } else {
            const { error } = await supabase.from('conversations').delete().eq('id', id);
            if (error) { console.error("Error deleting:", error); return; }
            const index = appState.conversations.findIndex(c => c.id === id);
            if (index > -1) {
                appState.conversations.splice(index, 1);
            }
        }

        if (appState.activeConversationId === id) {
            if (appState.conversations.length > 0) {
                setActiveConversation(appState.conversations[0].id);
            } else {
                await createNewConversation();
            }
        } else {
            renderSidebar();
        }
    }

    // --- UPDATED ---
    function shareConversation(id: string, button: HTMLButtonElement): void {
        const convo = appState.conversations.find(c => c.id === id);
        if (!convo) return;
        const formattedChat = `Conversation: ${convo.title}\n\n` + convo.messages.map(msg => `${msg.sender === 'user' ? 'You' : 'LegalAI'}:\n${msg.text}`).join('\n\n');
        navigator.clipboard.writeText(formattedChat).then(() => {
            const originalContent = button.innerHTML;
            button.innerHTML = '✅';
            button.disabled = true;
            setTimeout(() => { button.innerHTML = originalContent; button.disabled = false; }, 2000);
        }).catch(err => { console.error('Failed to copy chat:', err); alert('Failed to copy chat.'); });
    }

    async function addMessageToActiveConversation(message: Message, difyConversationId?: string) {
        const activeConvo = appState.conversations.find(c => c.id === appState.activeConversationId);
        if (!activeConvo) return;
        if (activeConvo.messages[activeConvo.messages.length - 1]?.text !== i18n.t('app_thinking')) {
            activeConvo.messages.push(message);
        }
        let newTitle = activeConvo.title;
        if (activeConvo.title === i18n.t('app_newChat') && message.sender === 'user') {
            newTitle = message.text.substring(0, 25) + (message.text.length > 25 ? '...' : '');
        }
        activeConvo.title = newTitle;
        if (difyConversationId) {
            activeConvo.dify_conversation_id = difyConversationId;
        }
        if (isGuestMode) {
            localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(appState));
        } else {
            await supabase.from('conversations').update({ messages: activeConvo.messages, title: newTitle, dify_conversation_id: activeConvo.dify_conversation_id }).eq('id', activeConvo.id);
        }
        renderSidebar();
        renderChatWindow();
    }

    // REPLACE your handleFormSubmit with this new version
    async function handleFormSubmit() {
        const userInput = messageInput.value.trim();
        if (!DIFY_API_KEY) { alert("Dify API Key is not configured."); return; }
        if (!userInput) return;

        let activeConvo = appState.conversations.find(c => c.id === appState.activeConversationId);
        if (!activeConvo) return;

        // --- NEW LOGIC STARTS HERE ---
        if (activeConvo.id === 'new-chat-session' && !isGuestMode) {
            appState.conversations.shift();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: newDbConvo, error } = await supabase
                    .from('conversations')
                    .insert({
                        user_id: user.id,
                        title: userInput.substring(0, 25) + (userInput.length > 25 ? '...' : ''),
                        messages: [activeConvo.messages[0]]
                    })
                    .select()
                    .single();

                if (error) {
                    console.error("Error creating initial conversation:", error);
                    startNewChatView();
                    return;
                }

                appState.conversations.unshift(newDbConvo as Conversation);
                appState.activeConversationId = newDbConvo.id;
                activeConvo = newDbConvo as Conversation;
            }
        }
        // --- NEW LOGIC ENDS HERE ---

        if (synthesis.speaking) { synthesis.cancel(); }

        const roleSelectorElement = document.getElementById('role-selector') as HTMLSelectElement | null;
        const selectedRole = roleSelectorElement ? roleSelectorElement.value : "General Public";

        messageInput.value = '';
        await addMessageToActiveConversation({ sender: 'user', text: userInput });

        displayMessage(i18n.t('app_thinking'), 'ai');
        const tempBubbles = chatWindow.querySelectorAll('.message-wrapper');
        const tempLastBubble = tempBubbles[tempBubbles.length - 1];

        try {
            const DIFY_CHAT_URL = 'https://api.dify.ai/v1/chat-messages';
            const response = await fetch(DIFY_CHAT_URL, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${DIFY_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    inputs: { "USER_ROLE": selectedRole, "LANGUAGE": i18n.getAiLanguage() },
                    query: userInput, user: userIdentifier, conversation_id: activeConvo.dify_conversation_id || "", response_mode: 'streaming'
                })
            });
            if (!response.ok) { const errorBody = await response.text(); throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorBody}`); }
            if (!response.body) { throw new Error("API response was successful but had no body."); }

            if (tempLastBubble) tempLastBubble.remove();

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let done = false; let fullResponse = ""; let finalDifyConversationId = activeConvo.dify_conversation_id;
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
                        if (parsedJson.conversation_id) finalDifyConversationId = parsedJson.conversation_id;
                        if (parsedJson.event === 'agent_message' || parsedJson.event === 'message') {
                            fullResponse += parsedJson.answer;
                            // --- Streaming Markdown update ---
                            const parsedMarkdown = marked.parse(fullResponse, { gfm: true });
                            if (parsedMarkdown instanceof Promise) {
                                parsedMarkdown.then(html => { aiLastBubble.innerHTML = html; });
                            } else {
                                aiLastBubble.innerHTML = parsedMarkdown;
                            }
                            // --- End streaming Markdown update ---
                            chatWindow.scrollTop = chatWindow.scrollHeight;
                        }
                    } catch (e) { /* Ignore parsing errors */ }
                }
            }
            const finalMessageIndex = activeConvo.messages.length - 1;
            if (activeConvo.messages[finalMessageIndex]?.sender === 'ai') {
                activeConvo.messages[finalMessageIndex].text = fullResponse;
            } else {
                await addMessageToActiveConversation({ sender: 'ai', text: fullResponse }, finalDifyConversationId);
            }

        } catch (error) {
            if (tempLastBubble) tempLastBubble.remove();
            const errorMessage = `${i18n.t('app_error')} ${error instanceof Error ? error.message : 'Unknown error'}`;
            await addMessageToActiveConversation({ sender: 'ai', text: errorMessage });
            speakText(errorMessage);
        }
    }

    // --- UPDATED ---
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

        newChatBtn.addEventListener('click', createNewConversation);
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

        // First, load the user's saved conversations into the state
        await loadState();

        // THEN, create the temporary "new chat" view for the user to see
        if (appState.conversations.find(c => c.id === 'new-chat-session')) {
            // If a temp session already exists (e.g. from language switch), just render
            setActiveConversation('new-chat-session');
        } else {
            startNewChatView();
        }

        renderUserProfileLink();
        setupSpeechRecognition();

        // Add these listeners inside your initApp() function

        sidebarLangSwitcher?.querySelector('.lang-en')?.addEventListener('click', () => {
            if (i18n.getLanguage() !== 'en') {
                i18n.setLanguage('en');
            }
        });

        sidebarLangSwitcher?.querySelector('.lang-bn')?.addEventListener('click', () => {
            if (i18n.getLanguage() !== 'bn') {
                i18n.setLanguage('bn');
            }
        });
    }
    initApp();
}