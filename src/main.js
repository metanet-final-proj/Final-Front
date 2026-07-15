import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import { configureAuthRefreshInterceptor } from './api/client.js'
import { createAuthFailureHandler } from './router/authSession.js'
import { useAuthStore } from './stores/authStore.js'

import './styles/variables.css'
import './styles/base.css'
import './styles/layout.css'

const THEME_STORAGE_KEY = 'officeLinkTheme'
const storedTheme = localStorage.getItem(THEME_STORAGE_KEY)
const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
const initialTheme = storedTheme || (prefersDark ? 'dark' : 'light')

document.documentElement.dataset.theme = initialTheme

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

const authStore = useAuthStore(pinia)
const handleAuthFailure = createAuthFailureHandler({
  clearAuth: () => authStore.clearAuth(),
  getCurrentRoute: () => router.currentRoute.value,
  replaceRoute: (route) => router.replace(route),
})

configureAuthRefreshInterceptor({
  refreshAccessToken: () => authStore.refreshAccessToken(),
  clearAuth: handleAuthFailure,
})

app.use(router)

app.mount('#app')
