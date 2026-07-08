import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import LoginView from '../views/LoginView.vue'
import ChatView from '../views/ChatView.vue'
import AuthCallbackView from '../views/AuthCallbackView.vue'

const routes = [
  {
    path: '/',
    redirect: '/login',
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: {
      public: true,
    },
  },
  {
    path: '/auth/callback',
    name: 'auth-callback',
    component: AuthCallbackView,
    meta: {
      public: true,
    },
  },
  {
    path: '/chat',
    name: 'chat',
    component: ChatView,
    meta: {
      requiresAuth: true,
    },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

const getAccessToken = () => {
  const token = localStorage.getItem('accessToken')

  if (!token) {
    return ''
  }

  return token.replace(/^"|"$/g, '').trim()
}

const clearAuthState = (authStore) => {
  if (typeof authStore.clearAuth === 'function') {
    authStore.clearAuth()
    return
  }

  authStore.user = null
  authStore.employeeProfile = null

  if ('accessToken' in authStore) {
    authStore.accessToken = null
  }

  if ('refreshToken' in authStore) {
    authStore.refreshToken = null
  }

  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('tokenType')
}

const hasValidUserContext = (authStore) => {
  return Boolean(authStore.user && authStore.employeeProfile)
}

const ensureAuthenticated = async () => {
  const authStore = useAuthStore()
  const accessToken = getAccessToken()

  if (!accessToken) {
    clearAuthState(authStore)
    return false
  }

  try {
    if (
      typeof authStore.fetchUserContext === 'function' &&
      !hasValidUserContext(authStore)
    ) {
      await authStore.fetchUserContext()
    }

    if (!hasValidUserContext(authStore)) {
      throw new Error('User context is empty')
    }

    return true
  } catch (error) {
    console.warn('Route auth check failed:', error)
    clearAuthState(authStore)
    return false
  }
}

router.beforeEach(async (to) => {
  const isPublicPage = to.meta.public === true
  const requiresAuth = to.meta.requiresAuth === true

  if (to.path === '/auth/callback') {
    return true
  }

  if (requiresAuth) {
    const authenticated = await ensureAuthenticated()

    if (!authenticated) {
      return {
        path: '/login',
        query: {
          redirect: to.fullPath,
        },
      }
    }

    return true
  }

  if (to.path === '/login') {
    const accessToken = getAccessToken()

    if (!accessToken) {
      return true
    }

    const authenticated = await ensureAuthenticated()

    if (authenticated) {
      return '/chat'
    }

    return true
  }

  if (!isPublicPage) {
    const authenticated = await ensureAuthenticated()

    if (!authenticated) {
      return {
        path: '/login',
        query: {
          redirect: to.fullPath,
        },
      }
    }
  }

  return true
})

export default router