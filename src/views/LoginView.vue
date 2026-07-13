<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import LoginBrandPanel from '../components/login/LoginBrandPanel.vue'
import LoginForm from '../components/login/LoginForm.vue'
import { useAuthStore } from '../stores/authStore'

const router = useRouter()
const authStore = useAuthStore()

const loginFormKey = ref(0)

const hasAccessToken = () => {
  const token = localStorage.getItem('accessToken')
  return Boolean(token && token.replace(/^"|"$/g, '').trim())
}

const goToChatIfAuthenticated = () => {
  if (authStore.isAuthenticated || hasAccessToken()) {
    router.replace('/chat')
    return true
  }

  return false
}

const resetLoginForm = async () => {
  loginFormKey.value += 1
  await nextTick()
}

const handlePageShow = async () => {
  await resetLoginForm()
  goToChatIfAuthenticated()
}

onMounted(() => {
  resetLoginForm()
  goToChatIfAuthenticated()

  window.addEventListener('pageshow', handlePageShow)
})

onBeforeUnmount(() => {
  window.removeEventListener('pageshow', handlePageShow)
})
</script>

<template>
  <main class="login-page page">
    <section class="login-card">
      <LoginBrandPanel />
      <LoginForm :key="loginFormKey" />
    </section>
  </main>
</template>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
}

.login-card {
  width: 980px;
  max-width: 100%;
  min-height: 640px;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  overflow: hidden;
  display: flex;
  box-shadow: var(--shadow-card);
}

@media (max-width: 860px) {
  .login-card {
    flex-direction: column;
  }
}
</style>