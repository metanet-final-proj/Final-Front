import { createRouter, createWebHistory } from 'vue-router'
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
  },
  {
    path: '/auth/callback',
    name: 'auth-callback',
    component: AuthCallbackView,
  },
  {
    path: '/chat',
    name: 'chat',
    component: ChatView,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const publicPages = ['/login', '/auth/callback']
  const isPublicPage = publicPages.includes(to.path)
  const accessToken = localStorage.getItem('accessToken')

  if (!isPublicPage && !accessToken) {
    return '/login'
  }

  if (to.path === '/login' && accessToken) {
    return '/chat'
  }

  return true
})

export default router