// src/pages/app.ts
import { supabase } from '../supabaseClient';
import { auth } from '../auth';

// --- TYPE DEFINITIONS ---
type Sender = 'user' | 'ai';
interface Message { sender: Sender; text: string; }
interface Conversation { id: string; title: string; messages: Message[]; created_at?: string; user_id?: string; dify_conversation_id?: string; }
interface AppState { conversations: Conversation[]; activeConversationId: string | null; }

// --- The Main Export Function ---
export function renderAppPage(container: HTMLElement) {

  // --- CONFIGURATION ---
  const DIFY_API_KEY = import.meta.env.VITE_DIFY_API_KEY;
  const GUEST_STORAGE_KEY = 'legalAI.guestConversations';
  
  // --- APP STATE & MODE ---
  let appState: AppState;
  const isGuestMode = auth.getSession() === null;

  // --- RENDER HTML SKELETON ---
  container.innerHTML = `
    <div class="app-layout">
        <aside class="sidebar">
            <div class="sidebar-header"><h1>LegalAI<span>.bd</span></h1></div>
            <button class="new-chat-btn">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                New Chat
            </button>
            <div class="conversation-list"><h2>YOUR CONVERSATIONS</h2></div>
            <div class="sidebar-footer">
                <div id="dark-mode-toggle">
                     <svg class="icon" id="theme-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>
                     <span id="theme-text">Dark Mode</span>
                </div>
            </div>
        </aside>
        <main class="main-content">
            <div id="chat-window"></div>
            <div class="role-selector-container">
                <label for="role-selector">Acting as:</label>
                <select id="role-selector">
                    <option value="General Public">General Public</option>
                    <option value="Law Student" selected>Law Student</option>
                    <option value="Legal Professional">Legal Professional</option>
                </select>
            </div>
            <div class="message-form-container">
                <form id="message-form">
                    <input type="text" id="message-input" placeholder="Ask about Bangladeshi law..." autocomplete="off" required>
                    <button type="submit" id="send-button">
                        <svg class="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    </button>
                </form>
            </div>
        </main>
    </div>`;

  // --- GET DOM ELEMENTS ---
  const chatWindow = document.getElementById('chat-window') as HTMLDivElement;
  const messageForm = document.getElementById('message-form') as HTMLFormElement;
  const messageInput = document.getElementById('message-input') as HTMLInputElement;
  const darkModeToggle = document.getElementById('dark-mode-toggle') as HTMLDivElement;
  const themeText = document.getElementById('theme-text') as HTMLSpanElement;
  const roleSelector = document.getElementById('role-selector') as HTMLSelectElement;
  const newChatBtn = document.querySelector('.new-chat-btn') as HTMLButtonElement;
  const conversationList = document.querySelector('.conversation-list') as HTMLDivElement;
  
  // --- UI RENDERING FUNCTIONS ---
  function renderSidebar() {
      const existingItems = conversationList.querySelectorAll('.conversation-item');
      existingItems.forEach(item => item.remove());
      appState.conversations.forEach(convo => {
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
          if (isGuestMode) {
              actionsMenu.querySelectorAll('button').forEach(btn => {
                  (btn as HTMLButtonElement).disabled = true;
                  btn.style.opacity = '0.5'; btn.style.cursor = 'not-allowed';
                  btn.setAttribute('title', 'Sign in to use this feature');
              });
          } else {
              actionsMenu.querySelector('.rename-btn')?.addEventListener('click', (e) => { e.stopPropagation(); renameConversation(convo.id); });
              actionsMenu.querySelector('.share-btn')?.addEventListener('click', (e) => { e.stopPropagation(); shareConversation(convo.id, e.currentTarget as HTMLButtonElement); });
              actionsMenu.querySelector('.delete-btn')?.addEventListener('click', (e) => { e.stopPropagation(); deleteConversation(convo.id); });
          }
          convoItem.appendChild(actionsMenu);
          conversationList.appendChild(convoItem);
      });
  }
  function renderChatWindow() {
      if(!chatWindow) return;
      chatWindow.innerHTML = '';
      const activeConvo = appState.conversations.find(c => c.id === appState.activeConversationId);
      if (activeConvo) activeConvo.messages.forEach(msg => displayMessage(msg.text, msg.sender));
      chatWindow.scrollTop = chatWindow.scrollHeight;
  }
  
  // ===================================================================
  // ===== THE CORRECTED FUNCTION WITH AI ICON =========================
  // ===================================================================
  function displayMessage(text: string, sender: Sender) {
      const messageWrapper = document.createElement('div');
      messageWrapper.className = `message-wrapper ${sender}`;
      const avatar = document.createElement('div');
      avatar.className = 'avatar';
      
      if(sender === 'user') {
          avatar.classList.add('user-avatar');
          avatar.textContent = 'You';
      } else {
          avatar.classList.add('ai-avatar');
          avatar.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.153.34c-1.325 0-2.59-.523-3.536-1.465l-2.62-2.62m5.156 0l-2.62 2.62m-5.156 0l-2.62-2.62m6.75-10.726C12 4.5 11.25 4.5 10.5 4.5c-1.01 0-2.01.143-3 .52m3-.52l-2.62 10.726" /></svg>`;
      }
      const messageContent = document.createElement('div');
      messageContent.className = 'message-content';
      const senderName = document.createElement('div');
      senderName.className = 'sender-name';
      senderName.textContent = sender === 'user' ? 'You' : 'LegalAI';
      const messageBubble = document.createElement('div');
      messageBubble.className = 'message-bubble';
      messageBubble.innerText = text;
      messageContent.appendChild(senderName);
      messageContent.appendChild(messageBubble);
      if (sender === 'user') { messageWrapper.appendChild(messageContent); messageWrapper.appendChild(avatar); }
      else { messageWrapper.appendChild(avatar); messageWrapper.appendChild(messageContent); }
      chatWindow.appendChild(messageWrapper);
  }

  // --- ACTION FUNCTIONS ---
  function setActiveConversation(id: string) {
      appState.activeConversationId = id;
      renderSidebar();
      renderChatWindow();
  }
  async function loadState() {
      if (isGuestMode) {
          const savedState = localStorage.getItem(GUEST_STORAGE_KEY);
          appState = savedState ? JSON.parse(savedState) : { conversations: [], activeConversationId: null };
      } else {
          const { data, error } = await supabase.from('conversations').select('*').order('created_at', { ascending: false });
          if (error) { console.error("Error fetching:", error); appState = { conversations: [], activeConversationId: null }; return; }
          appState = { conversations: data as Conversation[], activeConversationId: null };
      }
      if (appState.conversations.length === 0) {
        await createNewConversation();
      } else if (!appState.activeConversationId) {
        setActiveConversation(appState.conversations[0].id);
      }
  }
  async function createNewConversation() {
      const newConvo: Conversation = { id: Date.now().toString(), title: "New Conversation", messages: [{ sender: 'ai', text: "Hello! I'm ready for a new chat. How can I assist you?" }] };
      if (isGuestMode) {
          appState.conversations.unshift(newConvo);
          localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(appState));
          setActiveConversation(newConvo.id);
      } else {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          const { data, error } = await supabase.from('conversations').insert({ user_id: user.id, title: newConvo.title, messages: newConvo.messages }).select().single();
          if (error) { console.error("Error creating:", error); return; }
          appState.conversations.unshift(data as Conversation);
          setActiveConversation(data.id);
      }
  }
  async function renameConversation(id: string) {
      if (isGuestMode) return;
      const convo = appState.conversations.find(c => c.id === id);
      if (!convo) return;
      const newTitle = prompt("Enter new title:", convo.title);
      if (newTitle && newTitle.trim() !== "") {
          const { error } = await supabase.from('conversations').update({ title: newTitle.trim() }).eq('id', id);
          if (error) { console.error("Error renaming:", error); }
          else { convo.title = newTitle.trim(); renderSidebar(); }
      }
  }
  async function deleteConversation(id: string) {
      if (isGuestMode) return;
      if (!confirm("Are you sure? This action cannot be undone.")) return;
      const { error } = await supabase.from('conversations').delete().eq('id', id);
      if (error) { console.error("Error deleting:", error); return; }
      const index = appState.conversations.findIndex(c => c.id === id);
      if (index > -1) {
          appState.conversations.splice(index, 1);
          if (appState.activeConversationId === id) {
              if (appState.conversations.length > 0) setActiveConversation(appState.conversations[0].id);
              else await createNewConversation();
          } else renderSidebar();
      }
  }
  function shareConversation(id: string, button: HTMLButtonElement): void {
      if (isGuestMode) return;
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
      activeConvo.messages.push(message);
      let newTitle = activeConvo.title;
      if (activeConvo.title === "New Conversation" && message.sender === 'user') {
          newTitle = message.text.substring(0, 25) + (message.text.length > 25 ? '...' : '');
      }
      activeConvo.title = newTitle;
      if (difyConversationId) {
          activeConvo.dify_conversation_id = difyConversationId;
      }
      if (isGuestMode) {
          localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(appState));
      } else {
          const { error } = await supabase.from('conversations').update({ 
              messages: activeConvo.messages, 
              title: newTitle,
              dify_conversation_id: activeConvo.dify_conversation_id 
          }).eq('id', activeConvo.id);
          if (error) console.error("Error saving message:", error);
      }
      renderSidebar();
      renderChatWindow();
  }
  
  async function handleFormSubmit() {
    const userInput = messageInput.value.trim();
    if (!DIFY_API_KEY) {
        alert("Dify API Key is not configured in .env.local file.");
        return;
    }
    if (!userInput) return;
    if (!appState.activeConversationId) await createNewConversation();
    const selectedRole = roleSelector.value;
    const userIdentifier = auth.getUserId() || `guest_${Date.now()}`;
    const activeConvo = appState.conversations.find(c => c.id === appState.activeConversationId);
    if (!activeConvo) return; 

    messageInput.value = '';
    await addMessageToActiveConversation({ sender: 'user', text: userInput });
    
    displayMessage('...', 'ai');
    const tempBubbles = chatWindow.querySelectorAll('.message-wrapper');
    const tempLastBubble = tempBubbles[tempBubbles.length -1];

    try {
        const difyConversationId = activeConvo.dify_conversation_id || undefined;
        const DIFY_CHAT_URL = 'https://api.dify.ai/v1/chat-messages';

        const response = await fetch(DIFY_CHAT_URL, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${DIFY_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                inputs: { "USER_ROLE": selectedRole, "LANGUAGE": "English" },
                query: userInput,
                user: userIdentifier, 
                conversation_id: difyConversationId,
                response_mode: 'streaming' 
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorBody}`);
        }
        if (!response.body) { throw new Error("API response was successful but had no body."); }
        
        tempLastBubble.remove();
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let done = false;
        let fullResponse = "";
        let finalDifyConversationId = difyConversationId;

        displayMessage("", 'ai');
        const aiBubbles = chatWindow.querySelectorAll('.message-wrapper.ai .message-bubble');
        const aiLastBubble = aiBubbles[aiBubbles.length -1] as HTMLDivElement;
        
        while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.startsWith('data: '));
            for (const line of lines) {
                try {
                    const jsonStr = line.substring(6);
                    if (jsonStr.trim() === '[DONE]') continue;
                    const parsed = JSON.parse(jsonStr);
                    if (parsed.conversation_id) { finalDifyConversationId = parsed.conversation_id; }
                    if (parsed.event === 'agent_message' || parsed.event === 'message') {
                        fullResponse += parsed.answer;
                        aiLastBubble.innerText = fullResponse;
                        chatWindow.scrollTop = chatWindow.scrollHeight;
                    }
                } catch (e) { /* Ignore parsing errors */ }
            }
        }

        await addMessageToActiveConversation({ sender: 'ai', text: fullResponse }, finalDifyConversationId);

    } catch (error) {
        console.error("Dify API Error:", error);
        tempLastBubble?.remove();
        await addMessageToActiveConversation({ sender: 'ai', text: `Sorry, an error occurred: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  }

  // --- APP INITIALIZATION ---
  async function initApp() {
      messageForm.addEventListener('submit', (e) => { e.preventDefault(); handleFormSubmit(); });
      darkModeToggle.addEventListener('click', () => {
          document.body.classList.toggle('dark-mode');
          themeText.textContent = document.body.classList.contains('dark-mode') ? 'Light Mode' : 'Dark Mode';
      });
      newChatBtn.addEventListener('click', createNewConversation);
      
      await loadState();
      renderSidebar();
      renderChatWindow();
  }

  initApp();
}