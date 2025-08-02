<template>
  <div>
    <div v-if="!chatOpen" class="sallmantino-fab" @click="openChat">
      <img src="/assets/icons/frog.png" alt="SaLLMantino" class="sallmantino-frog" />
    </div>
    <div v-if="chatOpen" class="sallmantino-chat-window">
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
  bottom: 32px;
  right: 32px;
  width: 450px;
  max-width: 140vw;
  height: 650px;
  background: #fff;
  border-radius: 24px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.18);
  z-index: 1001;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
}
.sallmantino-fab {
  position: fixed;
  bottom: 32px;
  right: 63px;
  width: 84px;
  height: 84px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 100;
  transition: box-shadow 0.2s;
}
.sallmantino-fab:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.25);
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
  background: #fff;
  border-bottom: 1px solid #eee;
  gap: 12px;
}
.sallmantino-header .sallmantino-frog {
  width: 24px;
  height: 24px;
}
.sallmantino-title {
  flex: 1;
  font-weight: 600;
  color: #333;
  font-size: 1rem;
}
.sallmantino-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background 0.2s;
}
.sallmantino-close:hover {
  background: #f0f0f0;
}
/* Mensajes del chat */
.sallmantino-messages {
  flex: 1;
  padding: 16px 12px 80px 12px;
  overflow-y: auto;
  background: #fafafa;
}
.sallmantino-message {
  margin-bottom: 10px;
  padding: 8px 14px;
  border-radius: 12px;
  max-width: 80%;
  word-break: break-word;
  font-size: 1rem;
  box-shadow: 0 1px 4px rgba(0,0,0,0.07);
}
.sallmantino-message.user {
  background: #e0ffe0;
  color: #222;
  align-self: flex-end;
  margin-left: auto;
}
.sallmantino-message.bot {
  background: #f0f0f0;
  color: #333;
  align-self: flex-start;
  margin-right: auto;
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
  background: #666;
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
  background: #fff;
  border-top: 1px solid #eee;
  z-index: 2;
}
.sallmantino-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 1rem;
  outline: none;
  margin-right: 10px;
  background: #f9f9f9;
}
.sallmantino-send {
  background: #e0ffe0;
  border: none;
  border-radius: 50%;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
  box-shadow: 0 1px 4px rgba(0,0,0,0.10);
}
.sallmantino-send:hover {
  background: #c8e6c9;
}
</style>