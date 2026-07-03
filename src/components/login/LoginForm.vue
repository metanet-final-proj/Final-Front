<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import loginIcon from '../../assets/images/login-logo.svg'

const router = useRouter()

const loading = ref(false)
const error = ref('')

const loginWithAzure = () => {
  if (loading.value) return

  error.value = ''
  loading.value = true

  // TODO: Azure SSO 연동 시 실제 SSO 요청 URL로 교체
  setTimeout(() => {
    router.push('/chat')
  }, 500)
}
</script>

<template>
  <section class="login-form-panel">
    <div class="logo-row">
      <img
        class="logo-image"
        :src="loginIcon"
        alt="METANET 로고"
      />
      <strong>METANET</strong>
    </div>

    <div class="login-content">
      <div class="login-heading">
        <h1>업무지원 서비스 접속</h1>
        <p>
          METANET Azure 계정 인증 후<br />
          AI 업무지원 서비스를 이용할 수 있습니다.
        </p>
      </div>

      <p v-if="error" class="error-message">
        {{ error }}
      </p>

      <button
        class="azure-login-button"
        type="button"
        :disabled="loading"
        @click="loginWithAzure"
      >
        <span class="azure-icon">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </span>

        {{ loading ? '서비스로 이동 중...' : '사내 계정으로 계속하기' }}
      </button>

      <p class="sub-guide">
        인증이 완료되면 메인 채팅 화면으로 이동합니다.
      </p>
    </div>

    <div class="form-spacer"></div>

    <p class="help-text">
      계정 관련 문의: 경영지원팀 02-1234-5678 · IT헬프데스크 #1588
    </p>
  </section>
</template>

<style scoped>
.login-form-panel {
  flex: 1;
  padding: 48px 52px;
  display: flex;
  flex-direction: column;
}

.logo-row {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--color-primary);
  font-size: 20px;
  font-weight: 900;
  letter-spacing: -0.5px;
}

.logo-image {
  width: 38px;
  height: 38px;
  object-fit: contain;
  display: block;
  flex-shrink: 0;
}

.login-content {
  margin-top: 92px;
}

.login-heading h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 800;
  color: var(--color-primary);
  letter-spacing: -0.5px;
}

.login-heading p {
  margin: 12px 0 0;
  font-size: 15px;
  color: var(--color-muted);
  line-height: 1.65;
}

.error-message {
  margin: 22px 0 0;
  font-size: 12.5px;
  color: var(--color-danger);
  background: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  border-radius: 9px;
  padding: 10px 13px;
}

.azure-login-button {
  margin-top: 36px;
  width: 100%;
  border: none;
  background: var(--color-primary-light);
  color: var(--color-white);
  font-size: 16px;
  font-weight: 800;
  border-radius: 14px;
  padding: 17px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 11px;
  transition:
    background 0.15s ease,
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.azure-login-button:hover {
  background: var(--color-primary);
  box-shadow: 0 12px 24px rgba(27, 67, 150, 0.16);
  transform: translateY(-1px);
}

.azure-login-button:disabled {
  cursor: not-allowed;
  opacity: 0.75;
  transform: none;
  box-shadow: none;
}

.azure-icon {
  width: 18px;
  height: 18px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2px;
  flex-shrink: 0;
}

.azure-icon span {
  border-radius: 2px;
}

.azure-icon span:nth-child(1) {
  background: #f25022;
}

.azure-icon span:nth-child(2) {
  background: #7fba00;
}

.azure-icon span:nth-child(3) {
  background: #00a4ef;
}

.azure-icon span:nth-child(4) {
  background: #ffb900;
}

.sub-guide {
  margin: 14px 0 0;
  text-align: center;
  font-size: 12.5px;
  color: var(--color-subtle);
}

.form-spacer {
  flex: 1;
}

.help-text {
  margin: 26px 0 0;
  font-size: 12px;
  color: var(--color-placeholder);
  text-align: center;
}

@media (max-width: 860px) {
  .login-form-panel {
    padding: 36px 28px;
  }

  .login-content {
    margin-top: 56px;
  }

  .login-heading h1 {
    font-size: 24px;
  }
}
</style>