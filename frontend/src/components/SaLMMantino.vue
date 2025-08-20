<template>
  <div>
    <!-- Botón principal (rana) -->
    <div 
      class="sallmantino-fab" 
      :class="{ 
        'sidebar-open': isTownSidebarOpen,
        'menu-open': menuOpen 
      }"
      @click="toggleMenu"
    >
      <img src="/assets/icons/frog.png" alt="SaLLMantino" class="sallmantino-frog" />
    </div>

    <!-- Menú de burbujas que se despliega hacia arriba -->
    <div v-if="menuOpen" class="bubble-menu" :class="{ 'sidebar-open': isTownSidebarOpen }">
      <!-- Burbuja para Cultura y Ocio -->
      <div 
        class="bubble-item"
        :class="{ 'active': activeSubmenu === 'cultura' }"
        @click="toggleSubmenu('cultura')"
        title="Cultura y Ocio"
      >
        <div class="bubble-icon">🎭</div>
      </div>

      <!-- Burbuja para Turismo y Compras -->
      <div 
        class="bubble-item"
        :class="{ 'active': activeSubmenu === 'turismo' }"
        @click="toggleSubmenu('turismo')"
        title="Turismo y Compras"
      >
        <div class="bubble-icon">🏛️</div>
      </div>

      <!-- Burbuja para Medio Ambiente -->
      <div 
        class="bubble-item"
        :class="{ 'active': activeSubmenu === 'ambiente' }"
        @click="toggleSubmenu('ambiente')"
        title="Medio Ambiente"
      >
        <div class="bubble-icon">🌿</div>
      </div>

      <!-- Burbuja para Historia -->
      <div 
        class="bubble-item"
        :class="{ 'active': activeSubmenu === 'historia' }"
        @click="toggleSubmenu('historia')"
        title="Historia"
      >
        <div class="bubble-icon">🏰</div>
      </div>

      <!-- Burbuja para Sociedad -->
      <div 
        class="bubble-item"
        :class="{ 'active': activeSubmenu === 'sociedad' }"
        @click="toggleSubmenu('sociedad')"
        title="Sociedad"
      >
        <div class="bubble-icon">👥</div>
      </div>

      <!-- Burbuja para Chatbot -->
      <div 
        class="bubble-item"
        :class="{ 'active': activeSubmenu === 'chat' }"
        @click="toggleSubmenu('chat')"
        title="Chat con SaLLMantino"
      >
        <div class="bubble-icon">💬</div>
      </div>
    </div>

    <!-- Submenú de Chat (Langflow) -->
    <div 
      v-if="activeSubmenu === 'chat'" 
      class="sallmantino-chat-window"
      :class="{ 'sidebar-open': isTownSidebarOpen }"
    >
      <div class="sallmantino-header">
        <img src="/assets/icons/frog.png" alt="SaLLMantino" class="sallmantino-frog" />
        <span class="sallmantino-title">Chatea con SaLLMantino</span>
        <button class="sallmantino-close" @click="closeSubmenu">×</button>
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
import { langflowBaseUrl } from '../services/apiService.js'

// Props
defineProps({
  isTownSidebarOpen: {
    type: Boolean,
    default: false
  }
})

// Emits para comunicarse con el componente padre
const emit = defineEmits(['changeFilters'])

// Estado del menú principal
const menuOpen = ref(false)
const activeSubmenu = ref(null)

// Estado del chat (para el submenú de Langflow)
const messages = ref([])
const userInput = ref('')
const isTyping = ref(false)

// Mapeo de categorías a filtros de leyenda
const categoryFilters = {
  cultura: ['Teatro', 'Exposición', 'Carnet Joven', 'Bibliotecas y Bibliobuses'],
  turismo: ['Tierra de Sabor', 'Pantallas'],
  ambiente: ['Incendios', 'Cotos', 'Tratamiento de Residuos'],
  historia: [], // Sin filtros específicos por ahora
  sociedad: [] // Sin filtros específicos por ahora
}

// Funciones del menú principal
function toggleMenu() {
  menuOpen.value = !menuOpen.value
  // Ya no limpiamos filtros cuando se cierra el menú
  // Los filtros y la categoría activa se mantienen
}

function toggleSubmenu(submenuType) {
  if (activeSubmenu.value === submenuType) {
    // Si clicas la misma categoría, la deseleccionas
    activeSubmenu.value = null
    emit('changeFilters', { category: null, filters: [] })
  } else {
    // Si seleccionas una categoría diferente
    activeSubmenu.value = submenuType
    
    // Si es el chat, enviar mensaje inicial
    if (submenuType === 'chat' && messages.value.length === 0) {
      sendInitialMessage()
    } else if (submenuType !== 'chat') {
      // Para otras categorías, cambiar filtros de leyenda
      const filters = categoryFilters[submenuType] || []
      emit('changeFilters', { category: submenuType, filters: filters })
    }
  }
}

function closeSubmenu() {
  activeSubmenu.value = null
  // Limpiar filtros cuando se cierra
  emit('changeFilters', [])
}

// Funciones del chat (Langflow)
function sendInitialMessage() {
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
  fetch(`${langflowBaseUrl}/api/v1/run/e9807fff-de8f-47b2-9c8a-10b554110d53`, {
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
  z-index: 1002; /* Más alto que el sidebar */
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.sallmantino-fab.sidebar-open {
  right: 420px; /* 370px sidebar + 50px margin */
}

.sallmantino-fab:hover {
  box-shadow: var(--shadow-lg);
  transform: scale(1.05);
}

.sallmantino-fab.menu-open {
  transform: rotate(45deg);
  background: var(--primary-color);
}

.sallmantino-fab.menu-open:hover {
  transform: rotate(45deg) scale(1.05);
}

.sallmantino-frog {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 50%;
}

/* Menú de burbujas */
.bubble-menu {
  position: fixed;
  bottom: 180px; /* Justo encima del FAB principal */
  right: 51px; /* Centrado respecto al botón principal (63px - 12px offset) */
  z-index: 1002; /* Más alto que el sidebar (1000) */
  display: flex;
  flex-direction: column;
  gap: 15px;
  animation: bubbleMenuSlideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  align-items: center; /* Centrar las burbujas */
}

.bubble-menu.sidebar-open {
  right: 408px; /* Mantener centrado cuando sidebar está abierto (420px - 12px offset) */
}

.bubble-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px; /* Tamaño fijo para círculo perfecto */
  height: 60px;
  background: var(--bg-primary);
  border: 2px solid var(--border-light);
  border-radius: 50%; /* Círculo perfecto */
  box-shadow: var(--shadow-md);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform: translateX(100px);
  opacity: 0;
  animation: bubbleSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  position: relative;
}

.bubble-item:nth-child(1) { animation-delay: 0.1s; }
.bubble-item:nth-child(2) { animation-delay: 0.2s; }
.bubble-item:nth-child(3) { animation-delay: 0.3s; }
.bubble-item:nth-child(4) { animation-delay: 0.4s; }
.bubble-item:nth-child(5) { animation-delay: 0.5s; }
.bubble-item:nth-child(6) { animation-delay: 0.6s; }

.bubble-item:hover {
  transform: translateX(0) scale(1.1);
  box-shadow: var(--shadow-lg);
  border-color: var(--primary-color);
}

.bubble-item.active {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

/* Tooltip para las burbujas */
.bubble-item::before {
  content: attr(title);
  position: absolute;
  left: -10px;
  transform: translateX(-100%);
  background: var(--bg-tooltip, rgba(0, 0, 0, 0.8));
  color: white;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease;
  pointer-events: none;
  z-index: 1003;
}

.bubble-item::after {
  content: '';
  position: absolute;
  left: -5px;
  top: 50%;
  transform: translateY(-50%);
  border: 5px solid transparent;
  border-left-color: var(--bg-tooltip, rgba(0, 0, 0, 0.8));
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease;
  pointer-events: none;
  z-index: 1003;
}

.bubble-item:hover::before,
.bubble-item:hover::after {
  opacity: 1;
  visibility: visible;
}

.bubble-icon {
  font-size: 24px; /* Icono más grande */
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Animaciones */
@keyframes bubbleMenuSlideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes bubbleSlideIn {
  from {
    transform: translateX(100px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
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