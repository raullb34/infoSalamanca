import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

// Crear instancia de Pinia
const pinia = createPinia()

// Crear aplicación Vue
const app = createApp(App)

// Usar Pinia
app.use(pinia)

// Montar la aplicación
app.mount('#app')
