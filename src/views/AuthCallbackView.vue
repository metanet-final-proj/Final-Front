<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const error = ref('')

onMounted(async () => {
  const code = route.query.code

  if (!code || Array.isArray(code)) {
    error.value = '로그인 코드가 없습니다. 다시 로그인해 주세요.'
    return
  }

  try {
    await authStore.exchangeCode(code)

    try {
      await authStore.fetchMe()
    } catch {
      // 토큰 발급은 성공했지만 사용자 정보 조회가 실패한 경우에도
      // 우선 채팅 화면으로 이동한다.
    }

    router.replace('/chat')
  } catch (e) {
    authStore.clearAuth()

    if (e.response?.status === 401) {
      error.value = '로그인 코드가 만료되었거나 유효하지 않습니다. 다시 로그인해 주세요.'
      return
    }

    error.value = '로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
  }
})

const goLogin = () => {
  router.replace('/login')
}
</script>

<template>
  <main class="callback-page page">
    <section class="callback-card">
      <template v-if="!error">
        <div class="loading-mark">
          <span></span>
          <span></span>
          <span></span>
        </div>

        <h1>로그인 처리 중입니다</h1>
        <p>인증 정보를 확인하고 있어요. 잠시만 기다려 주세요.</p>
      </template>

      <template v-else>
        <div class="error-mark">!</div>

        <h1>로그인 처리 실패</h1>
        <p>{{ error }}</p>

        <button type="button" @click="goLogin">
          로그인 화면으로 돌아가기
        </button>
      </template>
    </section>
  </main>
</template>

<style scoped>
.callback-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  background: var(--color-bg);
}

.callback-card {
  width: 420px;
  max-width: 100%;
  padding: 42px 36px;
  border-radius: 24px;
  background: var(--color-white);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-card);
  text-align: center;
}

.loading-mark {
  width: 58px;
  height: 58px;
  margin: 0 auto 24px;
  border-radius: 20px;
  background: var(--color-primary-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}

.loading-mark span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary-light);
  animation: tanetPulse 1.1s ease-in-out infinite;
}

.loading-mark span:nth-child(2) {
  animation-delay: 0.2s;
}

.loading-mark span:nth-child(3) {
  animation-delay: 0.4s;
}

.error-mark {
  width: 58px;
  height: 58px;
  margin: 0 auto 24px;
  border-radius: 20px;
  background: var(--color-danger-bg);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  font-weight: 900;
}

.callback-card h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 850;
  color: var(--color-primary);
  letter-spacing: -0.4px;
}

.callback-card p {
  margin: 12px 0 0;
  font-size: 14px;
  color: var(--color-muted);
  line-height: 1.6;
}

.callback-card button {
  margin-top: 28px;
  width: 100%;
  border: none;
  background: var(--color-primary-light);
  color: var(--color-white);
  font-size: 14px;
  font-weight: 800;
  border-radius: 13px;
  padding: 14px;
}

.callback-card button:hover {
  background: var(--color-primary);
}
</style>