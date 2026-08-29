import { ApiClient } from './api-client.js';
import { escapeHtml, showToast } from './utils.js';

  /* ============================================================
     🧑‍🚀 NOVA — FIXED GEMINI CAREER CHATBOT
  ============================================================ */
  export function initAICompanion(switchView) {
    const companion = document.getElementById('ai-companion');
    const avatar = document.getElementById('ai-companion-avatar');
    const sourceImage = document.getElementById('ai-companion-source');
    const spriteCanvas = document.getElementById('ai-companion-canvas');
    const hint = document.getElementById('ai-companion-hint');
    const panel = document.getElementById('ai-companion-chat');
    const closeButton = document.getElementById('ai-companion-close');
    const historyButton = document.getElementById('ai-companion-history');
    const newChatButton = document.getElementById('ai-companion-new-chat');
    const historyPanel = document.getElementById('ai-companion-history-panel');
    const historyList = document.getElementById('ai-companion-history-list');
    const statusText = document.getElementById('ai-companion-status-text');
    const messagesElement = document.getElementById('ai-companion-messages');
    const form = document.getElementById('ai-companion-form');
    const input = document.getElementById('ai-companion-input');
    const sendButton = document.getElementById('ai-companion-send');
    if (!companion || !avatar || !panel || !messagesElement || !form || !input) return;

    let isOpen = false;
    let conversationHistory = [];
    let currentConversationId = null;
    let historyOpen = false;

    function getAssistantUnavailableMessage() {
      return 'Nova đang tạm thời chưa sẵn sàng. Bạn có thể thử lại sau hoặc tiếp tục dùng các công cụ Match CV, tối ưu CV và luyện phỏng vấn trong ứng dụng.';
    }

    function resetConversation() {
      currentConversationId = null;
      conversationHistory = [];
      messagesElement.innerHTML = '';
      appendChatMessage(
        'assistant',
        'Chào bạn! Mình có thể hỗ trợ CV, Gap Analysis và luyện phỏng vấn STAR. Bạn muốn bắt đầu từ đâu?'
      );
      setHistoryOpen(false);
      input.focus();
    }

    function setHistoryOpen(open) {
      historyOpen = Boolean(open);
      if (historyPanel) historyPanel.hidden = !historyOpen;
      historyButton?.setAttribute('aria-expanded', String(historyOpen));
      panel.classList.toggle('history-open', historyOpen);
    }

    function formatConversationDate(value) {
      if (!value) return '';
      return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value));
    }

    function renderConversationHistory(conversations) {
      if (!historyList) return;
      historyList.innerHTML = '';
      if (!conversations.length) {
        const empty = document.createElement('div');
        empty.className = 'ai-chat-history-empty';
        empty.textContent = 'Chưa có lịch sử. Hãy bắt đầu cuộc trò chuyện đầu tiên với Nova.';
        historyList.appendChild(empty);
        return;
      }
      conversations.forEach(conversation => {
        const row = document.createElement('div');
        row.className = `ai-chat-history-item${conversation.id === currentConversationId ? ' is-active' : ''}`;

        const openButton = document.createElement('button');
        openButton.type = 'button';
        openButton.className = 'ai-chat-history-open';
        openButton.dataset.conversationId = conversation.id;
        const title = document.createElement('strong');
        title.textContent = conversation.title || 'Cuộc trò chuyện với Nova';
        const meta = document.createElement('span');
        meta.textContent = `${conversation.message_count} tin nhắn · ${formatConversationDate(conversation.updated_at)}`;
        openButton.append(title, meta);

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'ai-chat-history-delete';
        deleteButton.dataset.deleteConversationId = conversation.id;
        deleteButton.setAttribute('aria-label', `Xóa ${conversation.title || 'cuộc hội thoại'}`);
        deleteButton.textContent = '×';
        row.append(openButton, deleteButton);
        historyList.appendChild(row);
      });
    }

    async function loadConversationHistory() {
      if (!historyList) return;
      if (!ApiClient.isAuthenticated()) {
        historyList.innerHTML = '<div class="ai-chat-history-empty">Đăng nhập để xem lịch sử hội thoại.</div>';
        return;
      }
      historyList.innerHTML = '<div class="ai-chat-history-empty">Đang tải lịch sử…</div>';
      try {
        renderConversationHistory(await ApiClient.listAssistantConversations());
      } catch (err) {
        historyList.innerHTML = `<div class="ai-chat-history-empty">Không thể tải lịch sử: ${escapeHtml(err.message)}</div>`;
      }
    }

    async function openSavedConversation(conversationId) {
      const conversation = await ApiClient.getAssistantConversation(conversationId);
      currentConversationId = conversation.id;
      conversationHistory = conversation.messages
        .map(message => ({ role: message.role, content: message.content }))
        .slice(-12);
      messagesElement.innerHTML = '';
      conversation.messages.forEach(message => {
        appendChatMessage(message.role, message.content, message.suggested_actions || []);
      });
      setHistoryOpen(false);
      input.focus();
    }

    function restoreCompanionPosition() {
      localStorage.removeItem('nova_companion_position');
      companion.style.removeProperty('left');
      companion.style.removeProperty('top');
      companion.style.removeProperty('right');
      companion.style.removeProperty('bottom');
    }

    function placeChatPanel() {
      if (!isOpen) return;
      const edge = window.innerWidth < 560 ? 10 : 24;
      panel.style.left = 'auto';
      panel.style.top = 'auto';
      panel.style.right = `${edge}px`;
      panel.style.bottom = `${edge}px`;
    }

    function toggleChat(forceOpen) {
      isOpen = typeof forceOpen === 'boolean' ? forceOpen : !isOpen;
      panel.hidden = !isOpen;
      panel.setAttribute('aria-hidden', String(!isOpen));
      avatar.setAttribute('aria-expanded', String(isOpen));
      companion.classList.toggle('chat-open', isOpen);
      hint?.classList.add('is-hidden');
      companion.hidden = isOpen;
      if (isOpen) {
        requestAnimationFrame(() => {
          placeChatPanel();
          input.focus();
        });
      }
    }

    function appendActionList(message, actions = []) {
      if (!actions || !actions.length) return;
      const actionList = document.createElement('div');
      actionList.className = 'ai-chat-actions';
      actions.forEach(action => {
        if (!ALL_VIEWS.includes(action.page)) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.assistantTarget = action.page;
        button.textContent = action.label;
        actionList.appendChild(button);
      });
      message.appendChild(actionList);
    }

    function appendChatMessage(role, text, actions = []) {
      const message = document.createElement('div');
      message.className = `ai-chat-message ${role}`;
      const name = document.createElement('span');
      name.className = 'ai-chat-message-name';
      name.textContent = role === 'assistant' ? 'Nova' : 'Bạn';
      const paragraph = document.createElement('p');
      paragraph.textContent = text;
      message.append(name, paragraph);

      if (role === 'assistant' && actions.length) {
        appendActionList(message, actions);
      }
      messagesElement.appendChild(message);
      messagesElement.scrollTop = messagesElement.scrollHeight;
      return message;
    }

    function appendTypingIndicator() {
      const message = document.createElement('div');
      message.className = 'ai-chat-message assistant';
      message.dataset.typing = 'true';
      message.innerHTML = '<span class="ai-chat-message-name">Nova</span><span class="ai-chat-typing"><i></i><i></i><i></i></span>';
      messagesElement.appendChild(message);
      messagesElement.scrollTop = messagesElement.scrollHeight;
      return message;
    }

    async function loadAssistantStatus() {
      try {
        const status = await ApiClient.getAssistantStatus();
        companion.classList.toggle('is-online', Boolean(status.configured));
        if (statusText) {
          statusText.textContent = status.configured
            ? 'Đang sẵn sàng hỗ trợ'
            : 'Dịch vụ AI tạm thời chưa sẵn sàng';
        }
      } catch (_err) {
        companion.classList.remove('is-online');
        if (statusText) statusText.textContent = 'Dịch vụ AI tạm thời chưa sẵn sàng';
      }
    }

    avatar.addEventListener('pointerdown', event => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      toggleChat(true);
      event.preventDefault();
    });

    avatar.addEventListener('click', event => {
      if (event.detail === 0) toggleChat(true);
    });
    closeButton?.addEventListener('click', () => toggleChat(false));
    historyButton?.addEventListener('click', async () => {
      setHistoryOpen(!historyOpen);
      if (historyOpen) await loadConversationHistory();
    });
    newChatButton?.addEventListener('click', resetConversation);

    historyList?.addEventListener('click', async event => {
      const deleteButton = event.target.closest('[data-delete-conversation-id]');
      if (deleteButton) {
        const conversationId = deleteButton.dataset.deleteConversationId;
        if (!window.confirm('Xóa cuộc hội thoại này? AI audit log dành cho Admin vẫn được giữ lại.')) return;
        try {
          await ApiClient.deleteAssistantConversation(conversationId);
          if (currentConversationId === conversationId) resetConversation();
          await loadConversationHistory();
        } catch (err) {
          showToast(`Không thể xóa hội thoại: ${err.message}`, 'error');
        }
        return;
      }
      const openButton = event.target.closest('[data-conversation-id]');
      if (!openButton) return;
      try {
        await openSavedConversation(openButton.dataset.conversationId);
      } catch (err) {
        showToast(`Không thể mở hội thoại: ${err.message}`, 'error');
      }
    });

    window.addEventListener('career:session-cleared', () => {
      input.value = '';
      input.style.height = 'auto';
      resetConversation();
      toggleChat(false);
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text || sendButton?.disabled) return;
      if (!ApiClient.isAuthenticated()) {
        appendChatMessage('assistant', 'Bạn cần đăng nhập để Nova có thể sử dụng hồ sơ và bảo vệ phiên chat.');
        openAuthModal();
        return;
      }

      const previousHistory = conversationHistory.slice(-6);
      appendChatMessage('user', text);
      conversationHistory.push({ role: 'user', content: text });
      input.value = '';
      input.style.height = 'auto';
      if (sendButton) sendButton.disabled = true;
      const typing = appendTypingIndicator();

      let streamMessageElement = null;
      let streamParagraph = null;
      let hasReceivedFirstChunk = false;

      const onChunk = (chunk, accumulated) => {
        if (!hasReceivedFirstChunk) {
          hasReceivedFirstChunk = true;
          typing.remove();
          streamMessageElement = document.createElement('div');
          streamMessageElement.className = 'ai-chat-message assistant';
          const name = document.createElement('span');
          name.className = 'ai-chat-message-name';
          name.textContent = 'Nova';
          streamParagraph = document.createElement('p');
          streamMessageElement.append(name, streamParagraph);
          messagesElement.appendChild(streamMessageElement);
        }
        if (streamParagraph) {
          streamParagraph.textContent = accumulated;
        }
        messagesElement.scrollTop = messagesElement.scrollHeight;
      };

      try {
        const result = await ApiClient.chatWithAssistantStream(
          text,
          previousHistory,
          currentViewName,
          currentConversationId,
          null,
          {
            onChunk,
            onMetadata: data => {
              if (data.conversation_id) {
                currentConversationId = data.conversation_id;
              }
            },
          }
        );

        if (!hasReceivedFirstChunk) {
          typing.remove();
        }

        currentConversationId = result.conversation_id || currentConversationId;
        const response = result.llm_succeeded
          ? result.response
          : getAssistantUnavailableMessage();

        if (streamMessageElement) {
          if (streamParagraph) streamParagraph.textContent = response;
          if (result.suggested_actions && result.suggested_actions.length) {
            appendActionList(streamMessageElement, result.suggested_actions);
          }
        } else {
          appendChatMessage('assistant', response, result.llm_succeeded ? (result.suggested_actions || []) : []);
        }

        conversationHistory.push({ role: 'assistant', content: response });
        companion.classList.toggle('is-online', Boolean(result.llm_succeeded));
        if (statusText) {
          statusText.textContent = result.llm_succeeded
            ? 'Đang sẵn sàng hỗ trợ'
            : 'Dịch vụ AI tạm thời chưa sẵn sàng';
        }
      } catch (err) {
        typing.remove();
        if (streamMessageElement && !streamParagraph?.textContent) {
          streamMessageElement.remove();
        }
        if (err.status === 401) {
          performLogout({ notify: false });
          appendChatMessage('assistant', 'Phiên đăng nhập đã hết hạn. Bạn hãy đăng nhập lại rồi gửi câu hỏi.');
          openAuthModal();
          return;
        }
        const message = err.status === 404
          ? 'Nova hoặc dữ liệu bạn chọn hiện chưa sẵn sàng. Hãy thử lại sau.'
          : 'Nova chưa thể hoàn tất yêu cầu này. Hãy thử lại sau.';
        appendChatMessage('assistant', message);
      } finally {
        if (sendButton) sendButton.disabled = false;
        input.focus();
      }
    });

    input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
      }
    });
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = `${Math.min(input.scrollHeight, 100)}px`;
    });

    panel.addEventListener('click', event => {
      const promptButton = event.target.closest('[data-assistant-prompt]');
      if (promptButton) {
        input.value = promptButton.dataset.assistantPrompt;
        form.requestSubmit();
        return;
      }
      const actionButton = event.target.closest('[data-assistant-target]');
      if (actionButton && ALL_VIEWS.includes(actionButton.dataset.assistantTarget)) {
        switchView(actionButton.dataset.assistantTarget);
        toggleChat(false);
      }
    });

    window.addEventListener('resize', () => {
      placeChatPanel();
    });

    if (sourceImage && spriteCanvas) {
      const spriteContext = spriteCanvas.getContext('2d', { willReadFrequently: true });
      let lastSpriteFrame = 0;
      function renderSprite(timestamp) {
        if (spriteContext && sourceImage.complete && sourceImage.naturalWidth && timestamp - lastSpriteFrame > 70) {
          lastSpriteFrame = timestamp;
          try {
            spriteContext.clearRect(0, 0, 64, 64);
            spriteContext.imageSmoothingEnabled = false;
            spriteContext.drawImage(sourceImage, 0, 0, 64, 64);
            const frame = spriteContext.getImageData(0, 0, 64, 64);
            for (let index = 0; index < frame.data.length; index += 4) {
              const red = frame.data[index];
              const green = frame.data[index + 1];
              const blue = frame.data[index + 2];
              if (green > 105 && green > red * 1.35 && green > blue * 1.28) {
                frame.data[index + 3] = 0;
              }
            }
            spriteContext.putImageData(frame, 0, 0);
          } catch (_err) {
            spriteCanvas.classList.add('is-hidden');
            sourceImage.classList.add('is-fallback');
          }
        }
        requestAnimationFrame(renderSprite);
      }
      requestAnimationFrame(renderSprite);
      sourceImage.addEventListener('error', () => {
        spriteCanvas.classList.add('is-hidden');
        sourceImage.classList.add('is-fallback');
      });
    }

    restoreCompanionPosition();
    loadAssistantStatus();
    window.setTimeout(() => hint?.classList.add('is-hidden'), 6500);
  }

  
