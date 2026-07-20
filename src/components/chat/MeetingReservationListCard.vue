<script setup>
import { computed } from 'vue'
import ActionResultCallout from './ActionResultCallout.vue'

const props = defineProps({
  reservations: {
    type: Array,
    default: () => [],
  },
  loadingReservationId: {
    type: [String, Number],
    default: null,
  },
  actionResult: {
    type: Object,
    default: null,
  },
  ownerDisplayName: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['edit', 'cancel'])
const visibleReservations = computed(() => props.reservations.filter((reservation) => (
  reservation?.reservationId && !isCancelled(reservation)
)))

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date)
}

function formatRange(reservation) {
  const start = formatDateTime(reservation.startAt)
  if (!reservation.endAt) return start
  const end = new Date(reservation.endAt)
  const endTime = Number.isNaN(end.getTime())
    ? reservation.endAt
    : new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(end)
  return `${start} - ${endTime}`
}

function isLoading(reservation) {
  return String(props.loadingReservationId || '') === String(reservation.reservationId)
}

function isCancelled(reservation) {
  return String(reservation.status || '').toUpperCase() === 'CANCELLED'
}

function statusText(reservation) {
  return isCancelled(reservation) ? '취소됨' : '확정'
}

function locationText(reservation) {
  const building = String(reservation.building || '').trim()
  const detail = String(reservation.locationDetail || '').trim()
  if (!building) return detail
  if (!detail || detail === building) return building
  if (detail.includes(building)) return detail
  if (building.includes(detail)) return building
  return `${building} ${detail}`
}

const actionResultPresentation = computed(() => {
  const result = props.actionResult
  if (!result) return null
  const time = result.startTime && result.endTime
    ? `${result.startTime} - ${result.endTime}`
    : ''
  return result.presentation || {
    tone: 'success',
    title: result.message || '회의실 예약 요청이 처리되었습니다.',
    fields: [
      { label: '회의실', value: result.roomName, emphasis: true },
      { label: '날짜', value: result.date },
      { label: '시간', value: time, emphasis: true },
    ].filter((field) => field.value),
  }
})
</script>

<template>
  <section class="reservation-list-card">
    <div class="reservation-list-heading">
      <strong>
        <span v-if="ownerDisplayName" class="heading-owner">{{ ownerDisplayName }}</span><template v-if="ownerDisplayName">님의 </template><template v-else>내 </template><span class="heading-subject">회의실 예약 내역</span>
      </strong>
      <span>{{ visibleReservations.length }}건</span>
    </div>

    <ActionResultCallout
      v-if="actionResultPresentation"
      :presentation="actionResultPresentation"
      compact
    />

    <p v-if="visibleReservations.length === 0" class="reservation-list-empty">
      변경하거나 취소할 수 있는 회의실 예약이 없습니다.
    </p>

    <div v-else class="reservation-list-table-wrap">
      <table>
        <thead>
          <tr>
            <th>회의실</th>
            <th>예약 시간</th>
            <th>상태</th>
            <th><span class="sr-only">작업</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="reservation in visibleReservations" :key="reservation.reservationId">
            <td>
              <strong>{{ reservation.roomName || `회의실 #${reservation.roomId}` }}</strong>
              <small v-if="locationText(reservation)">
                {{ locationText(reservation) }}
              </small>
            </td>
            <td>{{ formatRange(reservation) }}</td>
            <td><span class="status-chip" :class="{ cancelled: isCancelled(reservation) }">{{ statusText(reservation) }}</span></td>
            <td class="reservation-actions">
              <button type="button" :disabled="isLoading(reservation) || isCancelled(reservation)" @click="emit('edit', reservation)">수정</button>
              <button type="button" :disabled="isLoading(reservation) || isCancelled(reservation)" @click="emit('cancel', reservation)">취소</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.reservation-list-card { margin-top: 12px; border: 1px solid var(--color-border); border-radius: 8px; overflow: hidden; }
.reservation-list-heading { display: flex; justify-content: space-between; padding: 11px 13px; background: var(--color-surface-soft); font-size: 12px; }
.heading-owner { color: var(--color-primary); }
.heading-subject { color: var(--color-text); }
.reservation-list-heading span, .reservation-list-empty, small { color: var(--color-subtle); }
.reservation-list-heading .heading-owner { color: var(--color-primary); }
.reservation-list-heading .heading-subject { color: var(--color-text); }
.reservation-list-empty { margin: 0; padding: 14px; font-size: 12px; }
.reservation-list-table-wrap { overflow-x: auto; }
table { width: 100%; min-width: 0; table-layout: fixed; border-collapse: collapse; font-size: 11px; }
th, td { padding: 10px 12px; border-top: 1px solid var(--color-border-light); text-align: left; vertical-align: middle; }
th { color: var(--color-subtle); font-weight: 700; background: var(--color-surface-raised); }
th:nth-child(1) { width: 31%; }
th:nth-child(2) { width: 29%; }
th:nth-child(3) { width: 12%; }
th:nth-child(4) { width: 28%; }
td strong, td small { display: block; }
td small { margin-top: 3px; }
td { overflow-wrap: anywhere; }
.status-chip { color: var(--color-primary); font-weight: 700; }
.status-chip.cancelled { color: var(--color-subtle); }
.reservation-actions { white-space: nowrap; }
.reservation-actions button { min-height: 28px; margin-left: 5px; border: 1px solid var(--color-border); border-radius: 5px; background: var(--color-surface-raised); color: var(--color-text); font: inherit; font-weight: 700; cursor: pointer; }
.reservation-actions button:last-child { color: var(--color-danger); }
.reservation-actions button:disabled { cursor: default; opacity: .55; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }
@media (max-width: 680px) {
  table { font-size: 10px; }
  th, td { padding: 8px 6px; }
  th:nth-child(1) { width: 29%; }
  th:nth-child(2) { width: 28%; }
  th:nth-child(3) { width: 13%; }
  th:nth-child(4) { width: 30%; }
  .reservation-actions { white-space: normal; }
  .reservation-actions button { min-height: 26px; margin: 2px 0 2px 3px; font-size: 10px; }
}
</style>
