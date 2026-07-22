<script setup>
import { computed } from 'vue'
import ActionResultCallout from './ActionResultCallout.vue'

const props = defineProps({
  requests: { type: Array, default: () => [] },
  loadingRequestId: { type: [String, Number], default: null },
  actionResult: { type: Object, default: null },
  ownerDisplayName: { type: String, default: '' },
  actionsEnabled: { type: Boolean, default: true },
})

const emit = defineEmits(['edit', 'cancel'])
const visibleRequests = computed(() => props.requests.filter((item) => (
  item?.requestId
)))
const actionResultPresentation = computed(() => props.actionResult?.presentation || null)

function isEditable(item) {
  return props.actionsEnabled && String(item.status || '').toUpperCase() === 'REQUESTED'
}
function isLoading(item) {
  return String(props.loadingRequestId || '') === String(item.requestId)
}
function statusText(item) {
  return ({ REQUESTED: '신청', APPROVED: '승인', REJECTED: '반려', CANCELLED: '취소됨' })[
    String(item.status || 'REQUESTED').toUpperCase()
  ] || String(item.status || '-')
}
function requestedDate(value) {
  if (!value) return '-'
  return String(value).slice(0, 10)
}
</script>

<template>
  <section class="supply-card">
    <div class="card-heading">
      <strong><span v-if="ownerDisplayName" class="owner">{{ ownerDisplayName }}</span><template v-if="ownerDisplayName">님의 </template>사무용품 신청 내역</strong>
      <span>{{ visibleRequests.length }}건</span>
    </div>
    <ActionResultCallout v-if="actionResultPresentation" :presentation="actionResultPresentation" compact />
    <p v-if="visibleRequests.length === 0" class="empty">표시할 사무용품 신청 내역이 없습니다.</p>
    <div v-else class="table-wrap">
      <table>
        <thead><tr><th>품목</th><th>수량</th><th>신청일</th><th>상태</th><th>작업</th></tr></thead>
        <tbody>
          <tr v-for="item in visibleRequests" :key="item.requestId">
            <td><strong>{{ item.itemName || `품목 #${item.itemId}` }}</strong><small v-if="item.reason">{{ item.reason }}</small></td>
            <td>{{ item.quantity || 0 }}개</td>
            <td>{{ requestedDate(item.requestedAt) }}</td>
            <td><span class="status-chip">{{ statusText(item) }}</span></td>
            <td class="actions">
              <button type="button" :disabled="!isEditable(item) || isLoading(item)" @click="emit('edit', item)">수정</button>
              <button type="button" :disabled="!isEditable(item) || isLoading(item)" @click="emit('cancel', item)">취소</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.supply-card { margin-top: 12px; border: 1px solid var(--color-border); border-radius: 8px; overflow: hidden; }
.card-heading { display: flex; justify-content: space-between; gap: 12px; padding: 11px 13px; background: var(--color-surface-soft); font-size: 12px; }
.card-heading span, .empty, small { color: var(--color-subtle); }
.card-heading .owner { color: var(--color-primary); }
.empty { margin: 0; padding: 14px; font-size: 12px; }
.table-wrap { width: 100%; overflow-x: auto; }
table { width: 100%; min-width: 620px; border-collapse: collapse; font-size: 11px; }
th, td { padding: 10px 11px; border-top: 1px solid var(--color-border-light); text-align: left; vertical-align: middle; }
th { color: var(--color-subtle); background: var(--color-surface-raised); }
td strong, td small { display: block; } td small { margin-top: 3px; }
.status-chip { color: var(--color-primary); font-weight: 700; }
.actions { white-space: nowrap; }
.actions button { min-height: 28px; margin-right: 5px; border: 1px solid var(--color-border); border-radius: 5px; background: var(--color-surface-raised); color: var(--color-text); font: inherit; font-weight: 700; cursor: pointer; }
.actions button:last-child { color: var(--color-danger); }
.actions button:disabled { cursor: default; opacity: .45; }
@media (max-width: 680px) { table { min-width: 560px; font-size: 10px; } th, td { padding: 8px; } }
</style>
