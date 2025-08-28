import * as vscode from "vscode";
import { analyzeCodebaseTask, validateConfiguration } from "./codeBaseAgent";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface ChatbotState {
  view?: vscode.WebviewView;
  messages: ChatMessage[];
  extensionUri: vscode.Uri;
}

let chatbotState: ChatbotState = {
  messages: [],
  extensionUri: vscode.Uri.file(""),
};

/**
 * Main function to create and register the chatbot view provider
 */
export function createChatbotViewProvider(
  extensionUri: vscode.Uri
): vscode.WebviewViewProvider {
  chatbotState.extensionUri = extensionUri;

  return {
    resolveWebviewView: (
      webviewView: vscode.WebviewView,
      context: vscode.WebviewViewResolveContext,
      _token: vscode.CancellationToken
    ) => {
      chatbotState.view = webviewView;
      setupWebview(webviewView);
      setupMessageListener(webviewView);
    },
  };
}

/**
 * Setup webview configuration and HTML
 */
function setupWebview(webviewView: vscode.WebviewView): void {
  webviewView.webview.options = {
    enableScripts: true,
    localResourceRoots: [chatbotState.extensionUri],
  };
  webviewView.webview.html = generateWebviewHTML();
}

/**
 * Setup message listener for webview communication
 */
function setupMessageListener(webviewView: vscode.WebviewView): void {
  webviewView.webview.onDidReceiveMessage(async (data) => {
    switch (data.type) {
      case "sendMessage":
        await handleUserMessage(data.message);
        break;
      case "clearChat":
        clearChatMessages();
        break;
    }
  }, undefined);
}

/**
 * Handle incoming user messages
 */
async function handleUserMessage(message: string): Promise<void> {
  if (!message.trim()) return;

  // Add user message to chat
  addUserMessage(message);

  try {
    // Validate configuration
    if (!validateConfig()) return;

    // Show typing indicator and get AI response
    showTypingIndicator();
    const aiResponse = await getAIResponse(message);
    hideTypingIndicator();
    addAssistantMessage(aiResponse);
  } catch (error) {
    hideTypingIndicator();
    handleError(error);
  }
}

/**
 * Add user message to chat
 */
function addUserMessage(message: string): void {
  const userMessage: ChatMessage = {
    id: Date.now().toString(),
    role: "user",
    content: message,
    timestamp: Date.now(),
  };
  chatbotState.messages.push(userMessage);
  updateWebview();
}

/**
 * Add assistant message to chat
 */
function addAssistantMessage(content: string): void {
  const aiMessage: ChatMessage = {
    id: (Date.now() + Math.random()).toString(),
    role: "assistant",
    content: content,
    timestamp: Date.now(),
  };
  chatbotState.messages.push(aiMessage);
  updateWebview();
}

/**
 * Validate configuration and show error if invalid
 */
function validateConfig(): boolean {
  const configValidation = validateConfiguration();
  if (!configValidation.valid) {
    addAssistantMessage(
      `⚠️ **Configuration Error**\n\n${configValidation.message}\n\nPlease configure your OpenAI API key in the extension settings.`
    );
    return false;
  }
  return true;
}

/**
 * Get AI response from the codebase agent
 */
async function getAIResponse(message: string): Promise<string> {
  const result = await analyzeCodebaseTask(message);
  return result[0]?.text || "Sorry, I could not generate a response.";
}

/**
 * Handle errors in message processing
 */
function handleError(error: unknown): void {
  const errorMessage = `❌ **Error**: ${
    error instanceof Error ? error.message : "An unknown error occurred"
  }`;
  addAssistantMessage(errorMessage);
}

/**
 * Show typing indicator
 */
function showTypingIndicator(): void {
  chatbotState.view?.webview.postMessage({ type: "showTyping" });
}

/**
 * Hide typing indicator
 */
function hideTypingIndicator(): void {
  chatbotState.view?.webview.postMessage({ type: "hideTyping" });
}

/**
 * Clear all chat messages
 */
function clearChatMessages(): void {
  chatbotState.messages = [];
  updateWebview();
}

/**
 * Update webview with current messages
 */
function updateWebview(): void {
  if (chatbotState.view) {
    chatbotState.view.webview.postMessage({
      type: "updateMessages",
      messages: chatbotState.messages,
    });
  }
}

/**
 * Public method to clear chat (called from extension)
 */
export function clearChat(): void {
  clearChatMessages();
}

/**
 * Generate CSS styles for the webview
 */
function generateWebviewCSS(): string {
  return `
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      margin: 0;
      padding: 0;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .header {
      padding: 10px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background-color: var(--vscode-sideBar-background);
    }

    .header h3 {
      margin: 0;
      color: var(--vscode-sideBarTitle-foreground);
    }

    .chat-container {
      flex: 1;
      overflow-y: auto;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 15px;
    }

    .message {
      max-width: 85%;
      padding: 8px 12px;
      border-radius: 8px;
      word-wrap: break-word;
    }

    .user-message {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      align-self: flex-end;
      margin-left: auto;
    }

    .assistant-message {
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      align-self: flex-start;
    }

    .message-content {
      margin: 0;
      white-space: pre-wrap;
    }

    .message-content h1, .message-content h2, .message-content h3 {
      margin-top: 0;
      margin-bottom: 8px;
      color: var(--vscode-textPreformat-foreground);
    }

    .message-content code {
      background-color: var(--vscode-textCodeBlock-background);
      color: var(--vscode-textPreformat-foreground);
      padding: 2px 4px;
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family);
    }

    .message-content pre {
      background-color: var(--vscode-textCodeBlock-background);
      padding: 8px;
      border-radius: 4px;
      overflow-x: auto;
      border: 1px solid var(--vscode-panel-border);
    }

    .message-content pre code {
      background: none;
      padding: 0;
    }

    .typing-indicator {
      display: flex;
      align-items: center;
      gap: 5px;
      color: var(--vscode-descriptionForeground);
      font-style: italic;
      padding: 8px 12px;
    }

    .typing-dots {
      display: flex;
      gap: 2px;
    }

    .typing-dot {
      width: 4px;
      height: 4px;
      background-color: var(--vscode-descriptionForeground);
      border-radius: 50%;
      animation: typing 1.4s infinite;
    }

    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes typing {
      0%, 60%, 100% { opacity: 0.3; }
      30% { opacity: 1; }
    }

    .input-container {
      border-top: 1px solid var(--vscode-panel-border);
      padding: 10px;
      display: flex;
      gap: 8px;
      background-color: var(--vscode-sideBar-background);
    }

    .input-box {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      resize: none;
      min-height: 20px;
      max-height: 100px;
    }

    .input-box:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }

    .send-button {
      padding: 8px 16px;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
    }

    .send-button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    .send-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      color: var(--vscode-descriptionForeground);
      gap: 10px;
    }

    .empty-state-icon {
      font-size: 48px;
      opacity: 0.5;
    }
  `;
}

/**
 * Generate JavaScript code for the webview - Fixed for Service Worker issues
 */
function generateWebviewJS(): string {
  return `
    // Prevent service worker registration attempts
    if ('serviceWorker' in navigator) {
      // Disable service worker in VS Code webview
      Object.defineProperty(navigator, 'serviceWorker', {
        value: undefined,
        writable: false
      });
    }

    // Clear any existing service worker registrations
    if ('serviceWorker' in navigator && navigator.serviceWorker) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) {
          registration.unregister();
        }
      }).catch(err => {
        console.log('Service worker cleanup failed: ', err);
      });
    }

    const vscode = acquireVsCodeApi();
    const chatContainer = document.getElementById('chatContainer');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');

    let messages = [];
    let isTyping = false;

    // Auto-resize textarea
    function autoResize() {
      messageInput.style.height = 'auto';
      messageInput.style.height = Math.min(messageInput.scrollHeight, 100) + 'px';
    }

    // Event listeners
    messageInput.addEventListener('input', autoResize);
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    sendButton.addEventListener('click', sendMessage);

    // Send message to extension
    function sendMessage() {
      const message = messageInput.value.trim();
      if (!message || isTyping) return;

      vscode.postMessage({
        type: 'sendMessage',
        message: message
      });

      messageInput.value = '';
      autoResize();
    }

    // Basic markdown parsing
    function parseMarkdown(text) {
      return text
        .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
        .replace(/\\*(.*?)\\*/g, '<em>$1</em>')
        .replace(/\`(.*?)\`/g, '<code>$1</code>')
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        .replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>')
        .replace(/\\n/g, '<br>');
    }

    // Render messages in chat container
    function renderMessages() {
      const hasMessages = messages.length > 0;
      
      if (!hasMessages && !isTyping) {
        chatContainer.innerHTML = \`
          <div class="empty-state">
            <div class="empty-state-icon">💬</div>
            <p>Start a conversation with your AI assistant!</p>
            <p>Ask questions about your codebase, request code analysis, or get help with development tasks.</p>
          </div>
        \`;
        return;
      }

      let html = '';
      messages.forEach(message => {
        const messageClass = message.role === 'user' ? 'user-message' : 'assistant-message';
        const content = message.role === 'assistant' ? parseMarkdown(message.content) : message.content;
        
        html += \`
          <div class="message \${messageClass}">
            <div class="message-content">\${content}</div>
          </div>
        \`;
      });

      if (isTyping) {
        html += \`
          <div class="typing-indicator">
            <span>AI is thinking</span>
            <div class="typing-dots">
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
            </div>
          </div>
        \`;
      }

      chatContainer.innerHTML = html;
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // Listen for messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      
      switch (message.type) {
        case 'updateMessages':
          messages = message.messages;
          renderMessages();
          break;
        case 'showTyping':
          isTyping = true;
          renderMessages();
          break;
        case 'hideTyping':
          isTyping = false;
          renderMessages();
          break;
      }
    });

    // Prevent any potential service worker related errors
    window.addEventListener('error', (e) => {
      if (e.message.includes('service worker') || e.message.includes('ServiceWorker')) {
        e.preventDefault();
        console.log('Service worker error prevented in VS Code webview');
      }
    });
  `;
}

/**
 * Generate complete HTML for the webview
 */
function generateWebviewHTML(): string {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src vscode-resource: https: data:;">
      <title>AI Codebase Assistant</title>
      <style>
          ${generateWebviewCSS()}
      </style>
  </head>
  <body>
      <div class="header">
          <h3>🤖 AI Assistant</h3>
      </div>
      
      <div class="chat-container" id="chatContainer">
          <div class="empty-state">
              <div class="empty-state-icon">💬</div>
              <p>Start a conversation with your AI assistant!</p>
              <p>Ask questions about your codebase, request code analysis, or get help with development tasks.</p>
          </div>
      </div>
      
      <div class="input-container">
          <textarea class="input-box" id="messageInput" placeholder="Ask about your codebase..." rows="1"></textarea>
          <button class="send-button" id="sendButton">Send</button>
      </div>

      <script>
          ${generateWebviewJS()}
      </script>
  </body>
  </html>`;
}

// Export the view type constant for use in extension.ts
export const VIEW_TYPE = "codebase-analyzer.chatView";
