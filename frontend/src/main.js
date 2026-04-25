import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// Tarkista kirjautumistila heti — onko cookie voimassa?
const { useAuthStore } = await import('./stores/auth')
const authStore = useAuthStore()
await authStore.checkAuth()

app.mount('#app')