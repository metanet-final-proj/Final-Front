<script setup>
import { computed } from 'vue'
import ActionResultCallout from './ActionResultCallout.vue'

const props = defineProps({
  registrations: { type: Array, default: () => [] },
  loadingRequestId: { type: [String, Number], default: null },
  actionResult: { type: Object, default: null },
  ownerDisplayName: { type: String, default: '' },
})

const emit = defineEmits(['edit', 'cancel'])
const visibleRegistrations = computed(() => props.registrations.filter((item) => (
  item?.requestId
)))
const actionResultPresentation = computed(() => {
  const result = props.actionResult
  if (!result) return null
  return result.presentation || {
    tone: 'success',
    title: result.message || '방문객 주차 요청이 처리되었습니다.',
    fields: [
      { label: '주차장', value: result.parkingLotName, emphasis: true },
      { label: '방문객', value: result.visitorName },
      { label: '차량 번호', value: result.carNumber, emphasis: true },
      { label: '방문 날짜', value: result.visitDate },
    ].filter((field) => field.value),
  }
})

function isLoading(item) {
  return String(props.loadingRequestId || '') === String(item.requestId)
}

function isEditable(item) {
  return String(item.status || 'REGISTERED').toUpperCase() === 'REGISTERED'
}

function statusText(item) {
  const status = String(item.status || 'REGISTERED').toUpperCase()
  if (status === 'CANCELLED') return '취소됨'
  if (status === 'COMPLETED') return '방문 완료'
  return '등록'
}

function parkingLotText(item) {
  const name = item.parkingLotName || (item.parkingLotId ? `주차장 #${item.parkingLotId}` : '주차장')
  return item.parkingLotLocation ? `${name} · ${item.parkingLotLocation}` : name
}
</script>

<template>
  <section class="parking-list-card">
    <div class="parking-list-heading">
      <strong>
        <span v-if="ownerDisplayName" class="heading-owner">{{ ownerDisplayName }}</span><template v-if="ownerDisplayName">님의 </template><template v-else>내 </template><span class="heading-subject">방문객 주차 등록 현황</span>
      </strong>
      <span>{{ visibleRegistrations.length }}건</span>
    </div>

    <ActionResultCallout
      v-if="actionResultPresentation"
      :presentation="actionResultPresentation"
      compact
    />

    <p v-if="visibleRegistrations.length === 0" class="parking-list-empty">
      표시할 방문객 주차 등록 내역이 없습니다.
    </p>

    <div v-else class="parking-list-table-wrap">
      <table>
        <thead>
          <tr>
            <th>주차장</th>
            <th>방문객</th>
            <th>차량 번호</th>
            <th>방문 날짜</th>
            <th>상태</th>
            <th><span class="sr-only">작업</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in visibleRegistrations" :key="item.requestId">
            <td>{{ parkingLotText(item) }}</td>
            <td>
              <strong>{{ item.visitorName || '-' }}</strong>
              <small v-if="item.visitorPhone">{{ item.visitorPhone }}</small>
            </td>
            <td>{{ item.carNumber || '-' }}</td>
            <td>{{ item.visitDate || '-' }}</td>
            <td><span class="status-chip">{{ statusText(item) }}</span></td>
            <td class="parking-actions">
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
.parking-list-card { margin-top: 12px; border: 1px solid var(--color-border); border-radius: 8px; overflow: hidden; }
.parking-list-heading { display: flex; justify-content: space-between; padding: 11px 13px; background: var(--color-surface-soft); font-size: 12px; }
.parking-list-heading span, .parking-list-empty, small { color: var(--color-subtle); }
.parking-list-heading .heading-owner { color: var(--color-primary); }
.parking-list-heading .heading-subject { color: var(--color-text); }
.parking-list-empty { margin: 0; padding: 14px; font-size: 12px; }
.parking-list-table-wrap { width: 100%; overflow-x: auto; }
table { width: 100%; min-width: 720px; border-collapse: collapse; font-size: 11px; }
th, td { padding: 10px 11px; border-top: 1px solid var(--color-border-light); text-align: left; vertical-align: middle; }
th { background: var(--color-surface-raised); color: var(--color-subtle); font-weight: 700; }
td strong, td small { display: block; }
td small { margin-top: 3px; }
.status-chip { color: var(--color-primary); font-weight: 700; }
.parking-actions { white-space: nowrap; }
.parking-actions button { min-height: 28px; margin-left: 5px; border: 1px solid var(--color-border); border-radius: 5px; background: var(--color-surface-raised); color: var(--color-text); font: inherit; font-weight: 700; cursor: pointer; }
.parking-actions button:last-child { color: var(--color-danger); }
.parking-actions button:disabled { cursor: default; opacity: .55; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }
@media (max-width: 680px) {
  table { min-width: 650px; font-size: 10px; }
  th, td { padding: 8px; }
}
</style>
