<script setup>
import LoginBrandPanel from '../components/login/LoginBrandPanel.vue'
import LoginForm from '../components/login/LoginForm.vue'
</script>

<template>
  <main class="login-page page">
    <section class="login-card">
      <LoginBrandPanel />
      <LoginForm />
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
  background: var(--color-white);
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