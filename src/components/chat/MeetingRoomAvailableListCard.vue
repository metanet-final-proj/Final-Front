<script setup>
import { computed } from 'vue'
import ActionResultCallout from './ActionResultCallout.vue'

const props = defineProps({
  data: { type: Object, default: () => ({}) },
  actionsEnabled: { type: Boolean, default: true },
  actionsLoading: { type: Boolean, default: false },
  actionDraft: { type: Object, default: null },
})
const emit = defineEmits(['reserve', 'detail'])

const rooms = computed(() => Array.isArray(props.data?.rooms) ? props.data.rooms : [])
const condition = computed(() => props.data?.condition || {})
const requestedTime = computed(() => {
  const start = condition.value.start_time || condition.value.startTime
  const end = condition.value.end_time || condition.value.endTime
  return start && end ? `${start} - ${end}` : ''
})
const equipmentText = (room) => Array.isArray(room.equipment) ? room.equipment.join(', ') : ''
const locationText = (room) => [room.location || room.building].filter(Boolean).join(' ')
const draftValues = computed(() => props.actionDraft?.values || {})
const isReservationDraft = computed(() => props.actionDraft?.actionType === 'meeting_room.reserve')
const isCompleted = computed(() => String(props.actionDraft?.status || '').toUpperCase() === 'COMPLETED')
const isDraftForRoom = (room) => isReservationDraft.value
  && String(draftValues.value.roomId || '') === String(room.roomId || '')
const reserveLabel = (room) => isDraftForRoom(room) && isCompleted.value ? '예약 완료' : '예약하기'
const reserveDisabled = (room) => !props.actionsEnabled || props.actionsLoading
  || (isDraftForRoom(room) && isCompleted.value)
const completionDetail = computed(() => {
  if (!isReservationDraft.value || !isCompleted.value) return ''
  const values = draftValues.value
  const time = values.startTime && values.endTime ? `${values.startTime} - ${values.endTime}` : ''
  return [values.roomName, values.date, time].filter(Boolean).join(' · ')
})
const completionPresentation = computed(() => {
  if (!completionDetail.value) return null
  const values = draftValues.value
  const time = values.startTime && values.endTime ? `${values.startTime} - ${values.endTime}` : ''
  return props.actionDraft?.presentation || {
    tone: 'success',
    title: '회의실 예약이 완료되었습니다.',
    fields: [
      { label: '회의실', value: values.roomName, emphasis: true },
      { label: '날짜', value: values.date },
      { label: '시간', value: time, emphasis: true },
    ].filter((field) => field.value),
  }
})
</script>

<template>
  <section class="meeting-query-card">
    <header>
      <strong>예약 가능한 회의실</strong>
      <span>{{ rooms.length }}개</span>
    </header>
    <p v-if="condition.date || requestedTime" class="condition">
      {{ [condition.date, requestedTime].filter(Boolean).join(' · ') }} 기준
    </p>
    <p v-if="rooms.length === 0" class="empty">조건에 맞는 회의실이 없습니다.</p>
    <div v-else class="table-wrap">
      <table>
        <thead><tr><th>회의실</th><th>위치</th><th>수용</th><th>장비</th><th>작업</th></tr></thead>
        <tbody>
          <tr v-for="room in rooms" :key="room.roomId">
            <td><strong>{{ room.roomName }}</strong></td>
            <td>{{ locationText(room) || '-' }}</td>
            <td>{{ room.capacity ? `${room.capacity}명` : '-' }}</td>
            <td>{{ equipmentText(room) || '-' }}</td>
            <td class="actions">
              <button type="button" :disabled="!actionsEnabled || actionsLoading" @click="emit('detail', room)">상세 보기</button>
              <button type="button" class="primary" :disabled="reserveDisabled(room)" @click="emit('reserve', room)">{{ reserveLabel(room) }}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="completionPresentation" class="completion-region">
      <ActionResultCallout
        :presentation="completionPresentation"
        compact
      />
    </div>
  </section>
</template>

<style scoped>
.meeting-query-card { margin-top: 12px; overflow: hidden; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface-raised); }
header { display: flex; align-items: center; justify-content: space-between; padding: 11px 13px; background: var(--color-surface-soft); font-size: 12px; }
header span, .condition, .empty { color: var(--color-subtle); }
.condition, .empty { margin: 0; padding: 9px 13px; font-size: 12px; }
.table-wrap { overflow-x: auto; }
table { width: 100%; min-width: 0; table-layout: fixed; border-collapse: collapse; font-size: 11px; }
th, td { padding: 10px 12px; border-top: 1px solid var(--color-border-light); text-align: left; vertical-align: middle; }
th { color: var(--color-subtle); background: var(--color-surface-raised); font-weight: 700; }
th:nth-child(1) { width: 16%; }
th:nth-child(2) { width: 20%; }
th:nth-child(3) { width: 8%; }
th:nth-child(4) { width: 31%; }
th:nth-child(5) { width: 25%; }
td { overflow-wrap: anywhere; }
.actions { white-space: nowrap; }
button { min-height: 28px; margin-left: 5px; border: 1px solid var(--color-border); border-radius: 5px; background: var(--color-surface-raised); color: var(--color-text); font: inherit; font-weight: 700; cursor: pointer; }
button.primary { border-color: var(--color-primary); background: var(--color-primary); color: white; }
button:disabled { cursor: default; opacity: .55; }
.completion-region { border-top: 1px solid var(--color-border-light); }
@media (max-width: 680px) {
  table { font-size: 10px; }
  th, td { padding: 8px 6px; }
  th:nth-child(1) { width: 18%; }
  th:nth-child(2) { width: 18%; }
  th:nth-child(3) { width: 9%; }
  th:nth-child(4) { width: 27%; }
  th:nth-child(5) { width: 28%; }
  .actions { white-space: normal; }
  button { min-height: 26px; margin: 2px 0 2px 3px; font-size: 10px; }
}
</style>
