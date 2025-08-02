import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createBootstrap } from 'bootstrap-vue-next'
import App from './App.vue'
import {Tabs, Tab} from 'vue3-tabs-component';

// Importar estilos de Bootstrap
import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue-next/dist/bootstrap-vue-next.css'

// Importar estilos globales para eliminar subrayados y puntos
import './styles/global-overrides.css'

// Crear instancia de Pinia
const pinia = createPinia()

// Crear aplicación Vue
const app = createApp(App)

// Usar Pinia y Bootstrap Vue
app.use(pinia)
app.use(createBootstrap())

// Montar la aplicación
app.component('tabs', Tabs).component('tab', Tab).mount('#app')
