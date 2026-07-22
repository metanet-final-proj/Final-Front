<script setup>
import { computed } from 'vue'
import ActionResultCallout from './ActionResultCallout.vue'

const props = defineProps({
  data: { type: Object, default: () => ({}) },
  actionsEnabled: { type: Boolean, default: true },
  actionsLoading: { type: Boolean, default: false },
  actionDraft: { type: Object, default: null },
})
const emit = defineEmits(['reserve'])
const equipmentText = computed(() => {
  const items = Array.isArray(props.data?.equipment) ? props.data.equipment : []
  return items.map((item) => {
    if (typeof item === 'string') return item
    if (item && typeof item === 'object') return item.name || item.equipmentName || ''
    return ''
  }).filter(Boolean).join(', ')
})
const ranges = computed(() => Array.isArray(props.data?.availableTimeRanges) ? props.data.availableTimeRanges : [])
const operatingHoursText = computed(() => {
  const hours = props.data?.operatingHours
  if (typeof hours === 'string') return hours
  if (!hours || typeof hours !== 'object') return '-'
  const start = hours.startTime || hours.start || ''
  const end = hours.endTime || hours.end || ''
  return start && end ? `${start} - ${end}` : '-'
})
const locationText = computed(() => {
  const building = String(props.data?.building || '').trim()
  const floor = String(props.data?.floor || '').trim()
  const location = String(props.data?.location || '').trim()
  if (location) {
    const normalizedLocation = location.replaceAll(' ', '')
    const buildingPart = building && !normalizedLocation.includes(building.replaceAll(' ', '')) ? building : ''
    const floorPart = floor && !normalizedLocation.includes(floor.replaceAll(' ', '')) ? floor : ''
    return [buildingPart, floorPart, location].filter(Boolean).join(' ')
  }
  return [building, floor].filter(Boolean).join(' ') || '-'
})
const rangeText = (range) => typeof range === 'string'
  ? range
  : `${range.startTime || range.start || ''} - ${range.endTime || range.end || ''}`.trim()
const draftValues = computed(() => props.actionDraft?.values || {})
const isCompletedReservation = computed(() => (
  props.actionDraft?.actionType === 'meeting_room.reserve'
  && String(props.actionDraft?.status || '').toUpperCase() === 'COMPLETED'
  && String(draftValues.value.roomId || '') === String(props.data?.roomId || '')
))
const completionDetail = computed(() => {
  if (!isCompletedReservation.value) return ''
  const time = draftValues.value.startTime && draftValues.value.endTime
    ? `${draftValues.value.startTime} - ${draftValues.value.endTime}`
    : ''
  return [draftValues.value.date, time].filter(Boolean).join(' · ')
})
const completionPresentation = computed(() => {
  if (!completionDetail.value) return null
  const values = draftValues.value
  const time = values.startTime && values.endTime ? `${values.startTime} - ${values.endTime}` : ''
  return props.actionDraft?.presentation || {
    tone: 'success',
    title: '회의실 예약이 완료되었습니다.',
    fields: [
      { label: '회의실', value: values.roomName || props.data?.roomName, emphasis: true },
      { label: '날짜', value: values.date },
      { label: '시간', value: time, emphasis: true },
    ].filter((field) => field.value),
  }
})
</script>

<template>
  <section class="meeting-detail-card">
    <header><strong>{{ data.roomName || '회의실 상세' }}</strong><span>{{ data.capacity ? `정원 ${data.capacity}명` : '' }}</span></header>
    <dl>
      <div><dt>위치</dt><dd>{{ locationText }}</dd></div>
      <div><dt>장비</dt><dd>{{ equipmentText || '-' }}</dd></div>
      <div><dt>운영 시간</dt><dd>{{ operatingHoursText }}</dd></div>
      <div v-if="ranges.length"><dt>예약 가능 시간</dt><dd>{{ ranges.map(rangeText).filter(Boolean).join(', ') }}<small v-if="data.availabilityDate">{{ data.availabilityDate }} 기준</small></dd></div>
      <div v-if="data.description"><dt>안내</dt><dd>{{ data.description }}</dd></div>
    </dl>
    <footer><button type="button" :disabled="!actionsEnabled || actionsLoading || isCompletedReservation" @click="emit('reserve', data)">{{ isCompletedReservation ? '예약 완료' : '예약하기' }}</button></footer>
    <ActionResultCallout
      v-if="completionPresentation"
      :presentation="completionPresentation"
      compact
    />
  </section>
</template>

<style scoped>
.meeting-detail-card { margin-top: 12px; border: 1px solid var(--color-border); border-radius: 8px; overflow: hidden; background: var(--color-surface-raised); font-size: 12px; }
header { display: flex; justify-content: space-between; padding: 11px 13px; background: var(--color-surface-soft); }
header span, dt { color: var(--color-subtle); }
dl { margin: 0; padding: 4px 13px; }
dl div { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--color-border-light); }
dt, dd { margin: 0; line-height: 1.45; }
dd small { display: block; margin-top: 3px; color: var(--color-subtle); font-size: 11px; }
footer { display: flex; justify-content: flex-end; padding: 10px 13px; }
button { min-height: 30px; border: 1px solid var(--color-primary); border-radius: 5px; background: var(--color-primary); color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
button:disabled { cursor: default; opacity: .55; }
@media (max-width: 680px) {
  dl div { grid-template-columns: 76px minmax(0, 1fr); gap: 8px; }
  footer { padding: 9px 10px; }
}
</style>
