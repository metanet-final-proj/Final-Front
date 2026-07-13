<script setup>
import loginIcon from '../../assets/images/officelink-logo-nobg.svg'
</script>

<template>
  <aside class="brand-panel">
    <div class="brand-dots">
      <span class="dot sky"></span>
      <span class="dot blue"></span>
      <span class="dot yellow"></span>
      <span class="dot orange"></span>
    </div>

    <div class="brand-title">
      사내 업무지원<br />
      AI 어시스턴트
    </div>

    <p class="brand-description">
      주차 · 회의실 · 식당 · 사무용품 업무를<br />
      대화 한 번으로 처리하세요.
    </p>

    <div class="feature-list">
      <div class="feature-item">
        <span class="check-icon">✓</span>
        자연어로 질문하면 바로 처리
      </div>

      <div class="feature-item">
        <span class="check-icon">✓</span>
        회의실 · 주차 · 비품 시스템 실시간 연동
      </div>

      <div class="feature-item">
        <span class="check-icon">✓</span>
        사내 규정 문서 검색(RAG) 지원
      </div>
    </div>

    <div class="brand-spacer"></div>

    <div class="auth-card">
      <div class="auth-icon-box">
        <img
          class="auth-icon-image"
          :src="loginIcon"
          alt="통합 인증 아이콘"
        />
      </div>

      <div>
        <strong>통합 인증</strong>
        <p>
          별도의 회원가입 없이<br />
          사내 계정으로 바로 접속합니다.
        </p>
      </div>
    </div>

    <div class="system-status">
      <span class="status-dot"></span>
      전 시스템 정상 운영 중
    </div>
  </aside>
</template>

<style scoped>
.brand-panel {
  width: 440px;
  flex-shrink: 0;
  background: var(--color-login-brand-bg);
  color: var(--color-login-brand-text);
  padding: 48px 44px;
  display: flex;
  flex-direction: column;
}

.brand-dots {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.sky {
  background: var(--color-sky);
}

.blue {
  background: #4a78d0;
}

.yellow {
  background: var(--color-yellow);
}

.orange {
  background: var(--color-orange);
}

.brand-title {
  margin-top: 36px;
  font-size: 26px;
  font-weight: 800;
  line-height: 1.4;
  letter-spacing: -0.4px;
}

.brand-description {
  margin: 12px 0 0;
  font-size: 14px;
  color: var(--color-login-brand-muted);
  line-height: 1.65;
}

.feature-list {
  margin-top: 40px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 11px;
  font-size: 13.5px;
  color: var(--color-login-brand-feature);
}

.check-icon {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-login-brand-check);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-weight: 800;
}

.brand-spacer {
  flex: 1;
}

.auth-card {
  margin-bottom: 18px;
  padding: 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  display: flex;
  align-items: center;
  gap: 13px;
}

.auth-icon-box {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.auth-icon-image {
  width: 30px;
  height: 30px;
  object-fit: contain;
  display: block;
}

.auth-card strong {
  display: block;
  font-size: 13.5px;
  font-weight: 800;
  color: var(--color-login-brand-text);
}

.auth-card p {
  margin: 5px 0 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--color-login-brand-card-text);
}

.system-status {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  color: var(--color-login-brand-muted);
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #4cc46f;
  animation: tanetPulse 2.4s ease-in-out infinite;
}

@media (max-width: 860px) {
  .brand-panel {
    width: 100%;
  }
}
</style>
