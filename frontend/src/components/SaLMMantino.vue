<template>
  <div>
    <div 
      v-if="!chatOpen" 
      class="sallmantino-fab" 
      :class="{ 'sidebar-open': isTownSidebarOpen }"
      @click="openChat"
    >
      <img src="/assets/icons/frog.png" alt="SaLLMantino" class="sallmantino-frog" />
    </div>
    <div 
      v-if="chatOpen" 
      class="sallmantino-chat-window"
      :class="{ 'sidebar-open': isTownSidebarOpen }"
    >
      <div class="sallmantino-header">
        <img src="/assets/icons/frog.png" alt="SaLLMantino" class="sallmantino-frog" />
        <span class="sallmantino-title">Chatea con SaLLMantino</span>
        <button class="sallmantino-close" @click="closeChat">×</button>
      </div>
      <div class="sallmantino-messages">
        <div v-for="msg in messages" :key="msg.id" :class="['sallmantino-message', msg.type]">
          <span>{{ msg.text }}</span>
        </div>
        <div v-if="isTyping" class="sallmantino-message bot sallmantino-typing">
          <span>SaLLMantino está escribiendo</span>
          <div class="sallmantino-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
      <div class="sallmantino-input-bar">
        <input
          v-model="userInput"
          class="sallmantino-input"
          placeholder="Escribe tu mensaje..."
          @keyup.enter="sendMessage"
          autocomplete="off"
        />
        <button @click="sendMessage" class="sallmantino-send">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#388e3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"></path><path d="M22 2L15 22L11 13L2 9L22 2Z"></path></svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

// Props
defineProps({
  isTownSidebarOpen: {
    type: Boolean,
    default: false
  }
})

const chatOpen = ref(false)
const messages = ref([])
const userInput = ref('')
const isTyping = ref(false)

function openChat() {
  chatOpen.value = true
  sendInitialMessage()
}
function closeChat() {
  chatOpen.value = false
}

function sendInitialMessage() {
  // Mensaje inicial del bot
  sendMessageToLangflow('Soy SaLLMantino, pregunta lo que quieras')
}

function sendMessage() {
  if (userInput.value.trim() === '') return
  messages.value.push({ id: Date.now(), text: userInput.value, type: 'user' })
  sendMessageToLangflow(userInput.value)
  userInput.value = ''
}

function sendMessageToLangflow(text) {
  isTyping.value = true
  // Usa la API key desde variable de entorno VITE_LANGFLOW_API_KEY
  const apiKey = import.meta.env.VITE_LANGFLOW_API_KEY || ''
  if (!apiKey) {
    console.error('VITE_LANGFLOW_API_KEY no configurada en .env')
    return
  }
  const payload = {
    output_type: 'chat',
    input_type: 'chat',
    input_value: text,
    session_id: 'user_1'
  }
  fetch('http://localhost:7860/api/v1/run/e9807fff-de8f-47b2-9c8a-10b554110d53', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify(payload)
  })
    .then(response => response.json())
    .then(response => {
      // Puedes mostrar la respuesta del bot en el chat
      console.log('Respuesta del bot:', response.outputs[0].outputs[0].artifacts.message)
      if (response && response.outputs) {
        messages.value.push({ id: Date.now() + 1, text: response.outputs[0].outputs[0].artifacts.message, type: 'bot' })
      }
      isTyping.value = false
    })
    .catch(err => {
      console.error(err)
      isTyping.value = false
    })
}
</script>

<style scoped>
/* Chat window compacto y redondeado */
.sallmantino-chat-window {
  position: fixed;
  bottom: 80px;
  right: 32px;
  width: 450px;
  max-width: 140vw;
  height: 600px;
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 24px;
  box-shadow: var(--shadow-lg);
  z-index: 1001;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.sallmantino-chat-window.sidebar-open {
  right: 390px; /* 370px sidebar + 20px margin */
}

.sallmantino-fab {
  position: fixed;
  bottom: 80px;
  right: 63px;
  width: 84px;
  height: 84px;
  background: var(--bg-primary);
  border: 2px solid var(--primary-color);
  border-radius: 50%;
  box-shadow: var(--shadow-md);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 100;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.sallmantino-fab.sidebar-open {
  right: 420px; /* 370px sidebar + 50px margin */
}

.sallmantino-fab:hover {
  box-shadow: var(--shadow-lg);
  transform: scale(1.05);
}
.sallmantino-frog {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 50%;
}
/* Header del chat */
.sallmantino-header {
  display: flex;
  align-items: center;
  padding: 16px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-light);
  gap: 12px;
}
.sallmantino-header .sallmantino-frog {
  width: 24px;
  height: 24px;
}
.sallmantino-title {
  flex: 1;
  font-weight: 600;
  color: var(--text-primary);
  font-size: 1rem;
}
.sallmantino-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-secondary);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}
.sallmantino-close:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}
/* Mensajes del chat */
.sallmantino-messages {
  flex: 1;
  padding: 16px 12px 80px 12px;
  overflow-y: auto;
  background: var(--bg-secondary);
}
.sallmantino-message {
  margin-bottom: 10px;
  padding: 8px 14px;
  border-radius: 12px;
  max-width: 80%;
  word-break: break-word;
  font-size: 1rem;
  box-shadow: var(--shadow-sm);
}
.sallmantino-message.user {
  background: var(--primary-color);
  color: var(--text-light);
  align-self: flex-end;
  margin-left: auto;
}
.sallmantino-message.bot {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  align-self: flex-start;
  margin-right: auto;
  border: 1px solid var(--border-light);
}
.sallmantino-typing {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sallmantino-dots {
  display: flex;
  gap: 4px;
}
.sallmantino-dots span {
  width: 6px;
  height: 6px;
  background: var(--text-secondary);
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out;
}
.sallmantino-dots span:nth-child(2) {
  animation-delay: 0.2s;
}
.sallmantino-dots span:nth-child(3) {
  animation-delay: 0.4s;
}
@keyframes typing {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.5;
  }
  30% {
    transform: translateY(-10px);
    opacity: 1;
  }
}
/* Barra de entrada anclada abajo */
.sallmantino-input-bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  padding: 16px;
  background: var(--bg-primary);
  border-top: 1px solid var(--border-light);
  z-index: 2;
}
.sallmantino-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  font-size: 1rem;
  outline: none;
  margin-right: 10px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  transition: border-color 0.2s ease;
}
.sallmantino-input:focus {
  border-color: var(--primary-color);
}
.sallmantino-input::placeholder {
  color: var(--text-muted);
}
.sallmantino-send {
  background: var(--primary-color);
  border: none;
  border-radius: 50%;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: var(--shadow-sm);
}
.sallmantino-send:hover {
  background: var(--primary-hover);
  transform: scale(1.05);
}
.sallmantino-send svg {
  stroke: var(--text-light);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .sallmantino-chat-window {
    width: calc(100vw - 20px);
    right: 10px;
    bottom: 60px;
    height: calc(100vh - 140px);
  }
  
  .sallmantino-chat-window.sidebar-open {
    right: 10px; /* En móvil mantener posición normal */
  }
  
  .sallmantino-fab {
    right: 20px;
    bottom: 70px;
    width: 60px;
    height: 60px;
  }
  
  .sallmantino-fab.sidebar-open {
    right: 20px; /* En móvil mantener posición normal */
  }
  
  .sallmantino-frog {
    width: 50px;
    height: 50px;
  }
}
</style>