<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { adminOrganizationApi } from '../../api/adminOrganizationApi'

const emit = defineEmits(['close', 'created'])

const nameInputRef = ref(null)
const name = ref('')
const tenantId = ref('')
const isSubmitting = ref(false)
const formError = ref('')

const close = () => {
  if (isSubmitting.value) return
  emit('close')
}

const submit = async () => {
  const normalizedName = name.value.trim()
  const normalizedTenantId = tenantId.value.trim()

  if (!normalizedName || !normalizedTenantId) {
    formError.value = '조직명과 Tenant ID를 모두 입력해 주세요.'
    return
  }

  isSubmitting.value = true
  formError.value = ''

  try {
    const response = await adminOrganizationApi.createOrganization({
      name: normalizedName,
      azureTenantId: normalizedTenantId,
    })
    emit('created', response.data)
  } catch (error) {
    const errorCode = error.response?.data?.error?.code
    if (error.response?.status === 409 || errorCode === 'CONFLICT') {
      formError.value = '이미 등록된 Azure Tenant ID입니다.'
    } else {
      formError.value = error.response?.data?.error?.message || '조직을 추가하지 못했습니다.'
    }
  } finally {
    isSubmitting.value = false
  }
}

const handleKeydown = (event) => {
  if (event.key === 'Escape') close()
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)
  await nextTick()
  nameInputRef.value?.focus()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="create-dialog-backdrop" role="presentation" @click.self="close">
    <section
      class="create-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-organization-title"
    >
      <header class="create-dialog-header">
        <div>
          <span>Add Organization</span>
          <h3 id="create-organization-title">조직 추가</h3>
        </div>

        <button type="button" aria-label="조직 추가 팝업 닫기" @click="close">×</button>
      </header>

      <form @submit.prevent="submit">
        <div class="form-field">
          <label for="organization-name">조직명</label>
          <input
            id="organization-name"
            ref="nameInputRef"
            v-model="name"
            type="text"
            maxlength="100"
            placeholder="조직명을 입력하세요"
            required
          />
        </div>

        <div class="form-field">
          <label for="organization-tenant-id">Tenant ID</label>
          <input
            id="organization-tenant-id"
            v-model="tenantId"
            type="text"
            maxlength="100"
            placeholder="Azure Tenant ID를 입력하세요"
            required
          />
        </div>

        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>

        <footer class="form-actions">
          <button type="button" class="secondary-button" :disabled="isSubmitting" @click="close">
            취소
          </button>
          <button type="submit" class="primary-button" :disabled="isSubmitting">
            {{ isSubmitting ? '추가 중...' : '조직 추가' }}
          </button>
        </footer>
      </form>
    </section>
  </div>
</template>

<style scoped>
.create-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 120;
  padding: 20px;
  background: rgba(23, 31, 49, 0.34);
  display: flex;
  align-items: center;
  justify-content: center;
}

.create-dialog {
  width: min(480px, 100%);
  border: 1px solid rgba(var(--color-border-muted-rgb), 0.92);
  border-radius: 10px;
  background: var(--color-surface-raised);
  box-shadow: 0 30px 80px rgba(var(--color-primary-rgb), 0.28);
  overflow: hidden;
}

.create-dialog-header {
  padding: 20px 22px 16px;
  border-bottom: 1px solid var(--color-border-light);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.create-dialog-header span {
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 800;
}

.create-dialog-header h3 {
  margin: 4px 0 0;
  color: var(--color-primary);
  font-size: 20px;
  font-weight: 850;
}

.create-dialog-header button {
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface-raised);
  color: var(--color-muted);
  font-size: 20px;
  line-height: 1;
}

.create-dialog form {
  padding: 22px;
}

.form-field {
  display: grid;
  gap: 8px;
}

.form-field + .form-field {
  margin-top: 18px;
}

.form-field label {
  color: var(--color-text);
  font-size: 13px;
  font-weight: 800;
}

.form-field input {
  width: 100%;
  height: 42px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface-subtle);
  color: var(--color-text);
  padding: 0 12px;
  font: inherit;
  font-size: 13px;
}

.form-field input:focus {
  outline: none;
  border-color: var(--color-primary-light);
  background: var(--color-surface-raised);
  box-shadow: 0 0 0 3px rgba(var(--color-primary-light-rgb), 0.16);
}

.form-error {
  margin: 16px 0 0;
  padding: 10px 12px;
  border: 1px solid var(--color-danger-border);
  border-radius: 8px;
  background: var(--color-danger-bg);
  color: var(--color-danger);
  font-size: 12.5px;
  font-weight: 700;
}

.form-actions {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.form-actions button {
  min-height: 38px;
  padding: 0 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 800;
}

.secondary-button {
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  color: var(--color-muted);
}

.primary-button {
  border: 1px solid var(--color-primary-light);
  background: var(--color-primary-light);
  color: var(--color-white);
}

.form-actions button:disabled,
.create-dialog-header button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

@media (max-width: 520px) {
  .create-dialog-backdrop {
    padding: 14px;
  }

  .create-dialog-header,
  .create-dialog form {
    padding-right: 16px;
    padding-left: 16px;
  }
}
</style>
