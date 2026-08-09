<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { adminOrganizationApi } from '../../api/adminOrganizationApi'
import CreateOrganizationDialog from './CreateOrganizationDialog.vue'

const emit = defineEmits(['close'])

const PAGE_SIZE = 10
const ORGANIZATION_STATUSES = [
  { value: 'ACTIVE', label: '정상' },
  { value: 'SUSPENDED', label: '이용 정지' },
]

const closeButtonRef = ref(null)
const createButtonRef = ref(null)
const organizations = ref([])
const currentPage = ref(1)
const pagination = ref({
  page: 1,
  pageSize: PAGE_SIZE,
  totalItems: 0,
  totalPages: 0,
})
const isLoading = ref(false)
const loadError = ref('')
const actionError = ref('')
const createDialogOpen = ref(false)
const updatingOrganizationIds = ref(new Set())

const pageNumbers = computed(() => {
  return Array.from({ length: pagination.value.totalPages }, (_, index) => index + 1)
})

const fetchOrganizations = async () => {
  isLoading.value = true
  loadError.value = ''

  try {
    const response = await adminOrganizationApi.getOrganizations(currentPage.value, PAGE_SIZE)
    organizations.value = response.data?.data ?? []
    pagination.value = response.data?.pagination ?? {
      page: currentPage.value,
      pageSize: PAGE_SIZE,
      totalItems: organizations.value.length,
      totalPages: organizations.value.length > 0 ? 1 : 0,
    }
  } catch (error) {
    loadError.value = error.response?.data?.error?.message || '조직 목록을 불러오지 못했습니다.'
  } finally {
    isLoading.value = false
  }
}

const goToPage = async (page) => {
  if (page === currentPage.value || page < 1 || page > pagination.value.totalPages) return

  currentPage.value = page
  await fetchOrganizations()
}

const close = () => {
  emit('close')
}

const openCreateDialog = () => {
  createDialogOpen.value = true
}

const closeCreateDialog = async () => {
  createDialogOpen.value = false
  await nextTick()
  createButtonRef.value?.focus()
}

const handleCreated = async () => {
  createDialogOpen.value = false
  currentPage.value = 1
  await fetchOrganizations()
  await nextTick()
  createButtonRef.value?.focus()
}

const updateOrganizationStatus = async (organization, event) => {
  const previousStatus = organization.status
  const nextStatus = event.target.value

  if (previousStatus === nextStatus) return

  updatingOrganizationIds.value = new Set([
    ...updatingOrganizationIds.value,
    organization.organizationId,
  ])
  actionError.value = ''

  try {
    const response = await adminOrganizationApi.updateOrganizationStatus(
      organization.organizationId,
      nextStatus,
    )
    organizations.value = organizations.value.map((item) => (
      item.organizationId === organization.organizationId
        ? { ...item, ...response.data }
        : item
    ))
  } catch (error) {
    event.target.value = previousStatus
    actionError.value = error.response?.data?.error?.message || '조직 상태를 변경하지 못했습니다.'
  } finally {
    const nextUpdatingIds = new Set(updatingOrganizationIds.value)
    nextUpdatingIds.delete(organization.organizationId)
    updatingOrganizationIds.value = nextUpdatingIds
  }
}

const handleKeydown = (event) => {
  if (createDialogOpen.value) return
  if (event.key === 'Escape') close()
}

const formatDateTime = (value) => {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)
  await Promise.all([
    fetchOrganizations(),
    nextTick(() => closeButtonRef.value?.focus()),
  ])
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="organization-modal-backdrop" role="presentation" @click.self="close">
    <section
      class="organization-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="organization-modal-title"
    >
      <header class="organization-modal-header">
        <div>
          <span>Organizations</span>
          <h2 id="organization-modal-title">조직 관리</h2>
        </div>

        <button
          ref="closeButtonRef"
          class="organization-modal-close"
          type="button"
          aria-label="조직 관리 팝업 닫기"
          @click="close"
        >
          ×
        </button>
      </header>

      <div class="organization-toolbar">
        <span>전체 {{ pagination.totalItems }}개 조직</span>
        <button
          ref="createButtonRef"
          class="create-organization-button"
          type="button"
          @click="openCreateDialog"
        >
          조직 추가
        </button>
      </div>

      <p v-if="loadError" class="organization-message error" role="alert">
        {{ loadError }}
      </p>
      <p v-if="actionError" class="organization-message error" role="alert">
        {{ actionError }}
      </p>

      <div class="organization-table-wrap" :aria-busy="isLoading">
        <table>
          <thead>
            <tr>
              <th>조직 ID</th>
              <th>조직명</th>
              <th>Azure Tenant ID</th>
              <th>생성일</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="5" class="organization-empty">조직 목록을 불러오는 중입니다.</td>
            </tr>
            <tr v-for="organization in organizations" v-else :key="organization.organizationId">
              <td>#{{ organization.organizationId }}</td>
              <td class="organization-name">{{ organization.name }}</td>
              <td>{{ organization.azureTenantId }}</td>
              <td>{{ formatDateTime(organization.createdAt) }}</td>
              <td>
                <select
                  class="organization-status-select"
                  :value="organization.status"
                  :disabled="updatingOrganizationIds.has(organization.organizationId)"
                  :aria-label="`${organization.name} 상태`"
                  @change="updateOrganizationStatus(organization, $event)"
                >
                  <option
                    v-if="organization.status === 'INACTIVE'"
                    value="INACTIVE"
                    disabled
                    hidden
                  >
                    비활성화
                  </option>
                  <option
                    v-for="status in ORGANIZATION_STATUSES"
                    :key="status.value"
                    :value="status.value"
                  >
                    {{ status.label }}
                  </option>
                </select>
              </td>
            </tr>
            <tr v-if="!isLoading && organizations.length === 0">
              <td colspan="5" class="organization-empty">등록된 조직이 없습니다.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer class="organization-pagination" aria-label="조직 목록 페이지">
        <button
          v-for="page in pageNumbers"
          :key="page"
          type="button"
          :class="{ active: currentPage === page }"
          :aria-current="currentPage === page ? 'page' : undefined"
          @click="goToPage(page)"
        >
          {{ page }}
        </button>
      </footer>
    </section>

    <CreateOrganizationDialog
      v-if="createDialogOpen"
      @close="closeCreateDialog"
      @created="handleCreated"
    />
  </div>
</template>

<style scoped>
.organization-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 110;
  padding:
    calc(32px + env(safe-area-inset-top, 0px))
    32px
    calc(32px + env(safe-area-inset-bottom, 0px));
  background: rgba(23, 31, 49, 0.38);
  display: flex;
  align-items: center;
  justify-content: center;
}

.organization-modal {
  width: min(1080px, 100%);
  max-height: min(760px, calc(100vh - 64px));
  max-height: min(
    760px,
    calc(100dvh - 64px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))
  );
  border: 1px solid rgba(var(--color-border-muted-rgb), 0.92);
  border-radius: 10px;
  background: var(--color-surface-raised);
  box-shadow: 0 30px 80px rgba(var(--color-primary-rgb), 0.24);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.organization-modal-header {
  flex-shrink: 0;
  padding: 20px 22px 16px;
  border-bottom: 1px solid var(--color-border-light);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.organization-modal-header span,
.organization-toolbar span {
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 800;
}

.organization-modal-header h2 {
  margin: 4px 0 0;
  color: var(--color-primary);
  font-size: 20px;
  font-weight: 850;
}

.organization-modal-close {
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface-raised);
  color: var(--color-muted);
  font-size: 20px;
  line-height: 1;
}

.organization-modal-close:hover {
  background: var(--color-bg);
  color: var(--color-primary);
}

.organization-toolbar {
  min-height: 69px;
  flex-shrink: 0;
  padding: 16px 22px;
  border-bottom: 1px solid var(--color-border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.create-organization-button {
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid var(--color-primary-light);
  border-radius: 8px;
  background: var(--color-primary-light);
  color: var(--color-white);
  font-size: 13px;
  font-weight: 800;
}

.create-organization-button:hover {
  border-color: var(--color-primary);
  background: var(--color-primary);
}

.organization-message {
  margin: 0 22px 12px;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 700;
}

.organization-message.error {
  border: 1px solid var(--color-danger-border);
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.organization-table-wrap {
  flex: 1;
  min-height: 0;
  margin: 0 22px 4px;
  overflow: auto;
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
}

.organization-table-wrap table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.organization-table-wrap th,
.organization-table-wrap td {
  padding: 12px 14px;
  text-align: left;
  border-bottom: 1px solid var(--color-border-light);
  white-space: nowrap;
}

.organization-table-wrap th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--color-surface-soft);
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 800;
}

.organization-table-wrap td {
  color: var(--color-text);
}

.organization-name {
  font-weight: 800;
}

.organization-status-select {
  min-width: 128px;
  height: 34px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface-raised);
  color: var(--color-primary);
  padding: 0 30px 0 10px;
  font-size: 12px;
  font-weight: 800;
}

.organization-status-select:focus {
  outline: none;
  border-color: var(--color-primary-light);
  box-shadow: 0 0 0 3px rgba(var(--color-primary-light-rgb), 0.16);
}

.organization-status-select:disabled {
  cursor: wait;
  opacity: 0.6;
}

.organization-empty {
  height: 160px;
  text-align: center;
  color: var(--color-subtle);
}

.organization-pagination {
  min-height: 65px;
  flex-shrink: 0;
  padding: 14px 22px 18px;
  border-top: 1px solid var(--color-border-light);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.organization-pagination button {
  min-width: 32px;
  height: 32px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface-raised);
  color: var(--color-muted);
  font-size: 13px;
  font-weight: 800;
}

.organization-pagination button:hover {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.organization-pagination button.active {
  border-color: var(--color-primary-light);
  background: var(--color-primary-light);
  color: var(--color-white);
}

@media (max-width: 720px) {
  .organization-modal-backdrop {
    padding:
      calc(14px + env(safe-area-inset-top, 0px))
      14px
      calc(14px + env(safe-area-inset-bottom, 0px));
  }

  .organization-modal {
    max-height: calc(
      100dvh - 28px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)
    );
  }

  .organization-modal-header,
  .organization-toolbar {
    padding-right: 16px;
    padding-left: 16px;
  }

  .organization-table-wrap {
    margin-right: 16px;
    margin-left: 16px;
  }

  .organization-status-select {
    font-size: 16px;
  }
}
</style>
