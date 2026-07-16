<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { workhubApi } from '../../api/workhubApi'

const props = defineProps({
  draft: {
    type: Object,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  externalError: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['confirm'])
const isOpen = ref(false)
const rooms = ref([])
const roomsLoading = ref(false)
const roomsError = ref('')
const completionText = ref('')
const completionStreaming = ref(false)
let completionTimer = null
const form = reactive({
  date: '',
  startTime: '',
  endTime: '',
  roomName: '',
  roomId: '',
  capacity: '',
})

const syncForm = () => {
  const values = props.draft?.values || {}
  form.date = values.date || ''
  form.startTime = values.startTime || ''
  form.endTime = values.endTime || defaultEndTime(values.startTime) || ''
  form.roomName = values.roomName || ''
  form.roomId = values.roomId ? String(values.roomId) : ''
  form.capacity = values.capacity || ''
}

function defaultEndTime(startTime) {
  const start = timeToMinutes(startTime)
  if (start === null || start + 60 >= 24 * 60) return ''
  const end = start + 60
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
}

watch(() => props.draft, syncForm, { immediate: true, deep: true })

const status = computed(() => String(props.draft?.status || 'DRAFT').toUpperCase())
const completed = computed(() => status.value === 'COMPLETED')
const executing = computed(() => status.value === 'EXECUTING' || props.loading)
const hasValidTimeRange = computed(() => (
  Boolean(form.startTime && form.endTime) && form.startTime < form.endTime
))
const hasValidTimeStep = computed(() => (
  isTenMinuteTime(form.startTime) && isTenMinuteTime(form.endTime)
))
const filteredRooms = computed(() => {
  const requiredCapacity = Number(form.capacity) || 0
  return rooms.value.filter((room) => !requiredCapacity || Number(room.capacity) >= requiredCapacity)
})
const selectedRoom = computed(() => rooms.value.find(
  (room) => String(room.roomId) === String(form.roomId),
))
const hourOptions = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'))
const minuteOptions = ['00', '10', '20', '30', '40', '50']
const startHour = computed({
  get: () => timePart(form.startTime, 0),
  set: (value) => setTimePart('startTime', value, startMinute.value || '00'),
})
const startMinute = computed({
  get: () => timePart(form.startTime, 1),
  set: (value) => setTimePart('startTime', startHour.value, value),
})
const endHour = computed({
  get: () => timePart(form.endTime, 0),
  set: (value) => setTimePart('endTime', value, endMinute.value || '00'),
})
const endMinute = computed({
  get: () => timePart(form.endTime, 1),
  set: (value) => setTimePart('endTime', endHour.value, value),
})
const canConfirm = computed(() => {
  return Boolean(
    form.date && hasValidTimeRange.value && hasValidTimeStep.value
      && form.roomId && !executing.value,
  )
})

function isTenMinuteTime(value) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return false
  return Number(value.slice(3, 5)) % 10 === 0
}

function timePart(value, index) {
  return /^\d{2}:\d{2}$/.test(value || '') ? value.split(':')[index] : ''
}

function setTimePart(field, hour, minute) {
  form[field] = hour && minute ? `${hour}:${minute}` : ''
}

function timeToMinutes(value) {
  if (!/^\d{2}:\d{2}$/.test(value || '')) return null
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

function candidateMinutes(hour, minute) {
  return Number(hour) * 60 + Number(minute)
}

function isStartOptionDisabled(hour, minute) {
  const end = timeToMinutes(form.endTime)
  return end !== null && candidateMinutes(hour, minute) > end - 10
}

function isEndOptionDisabled(hour, minute) {
  const start = timeToMinutes(form.startTime)
  return start !== null && candidateMinutes(hour, minute) < start + 10
}

function isStartHourDisabled(hour) {
  return minuteOptions.every((minute) => isStartOptionDisabled(hour, minute))
}

function isEndHourDisabled(hour) {
  return minuteOptions.every((minute) => isEndOptionDisabled(hour, minute))
}

const normalizeRoom = (room) => ({
  roomId: room.roomId ?? room.room_id ?? room.id,
  name: room.name ?? room.roomName ?? room.meetingRoomName ?? '이름 없는 회의실',
  building: room.building || '',
  floor: room.floor,
  locationDetail: room.locationDetail || room.location_detail || '',
  capacity: room.capacity,
  status: room.status,
})

const loadRooms = async () => {
  roomsLoading.value = true
  roomsError.value = ''
  try {
    const response = await workhubApi.getMeetingRooms(form.date)
    rooms.value = (response?.data || []).map(normalizeRoom)

    if (!form.roomId && form.roomName) {
      const match = rooms.value.find((room) => room.name === form.roomName)
      if (match) form.roomId = String(match.roomId)
    }
    if (form.roomId && !rooms.value.some((room) => String(room.roomId) === String(form.roomId))) {
      form.roomId = ''
    }
  } catch (error) {
    console.error('Failed to load meeting rooms:', error)
    rooms.value = []
    roomsError.value = '회의실 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
  } finally {
    roomsLoading.value = false
  }
}

const roomSummary = computed(() => {
  const values = props.draft?.values || {}
  if (values.roomName) return values.roomName
  if (values.selectionNumber) return `${values.selectionNumber}번 회의실`
  if (values.roomId) return `회의실 #${values.roomId}`
  return '회의실 미선택'
})

const completionMessage = computed(() => {
  const values = props.draft?.values || {}
  const room = values.roomName || roomSummary.value
  const date = values.date || ''
  const time = values.startTime && values.endTime
    ? `${values.startTime} - ${values.endTime}`
    : ''
  const detail = [room, date, time].filter(Boolean).join(' · ')
  return detail
    ? `회의실 예약이 완료되었습니다.\n${detail}`
    : '회의실 예약이 완료되었습니다.'
})

const showCompletionImmediately = () => {
  completionText.value = completionMessage.value
  completionStreaming.value = false
}

const streamCompletion = () => {
  if (completionTimer) clearInterval(completionTimer)
  completionText.value = ''
  completionStreaming.value = true
  let index = 0
  completionTimer = setInterval(() => {
    completionText.value += completionMessage.value[index] || ''
    index += 1
    if (index >= completionMessage.value.length) {
      clearInterval(completionTimer)
      completionTimer = null
      completionStreaming.value = false
    }
  }, 18)
}

const openForm = async () => {
  syncForm()
  isOpen.value = true
  await loadRooms()
}

watch(() => form.date, (date, previousDate) => {
  if (isOpen.value && date !== previousDate) loadRooms()
})

watch(() => form.capacity, () => {
  if (form.roomId && !filteredRooms.value.some((room) => String(room.roomId) === String(form.roomId))) {
    form.roomId = ''
  }
})

watch(selectedRoom, (room) => {
  form.roomName = room?.name || ''
})

const closeForm = () => {
  if (!executing.value) isOpen.value = false
}

watch(completed, (isCompleted, wasCompleted) => {
  if (!isCompleted) return
  isOpen.value = false
  if (wasCompleted === false) streamCompletion()
  else showCompletionImmediately()
}, { immediate: true })

onBeforeUnmount(() => {
  if (completionTimer) clearInterval(completionTimer)
})

const confirm = () => {
  if (!canConfirm.value) return
  emit('confirm', {
    draftId: props.draft.draftId,
    version: props.draft.version,
    values: {
      ...(props.draft.values || {}),
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      roomId: selectedRoom.value?.roomId ?? Number(form.roomId),
      roomName: selectedRoom.value?.name || null,
      selectionNumber: null,
      capacity: form.capacity ? Number(form.capacity) : null,
    },
  })
}
</script>

<template>
  <section class="action-draft-action">
    <button
      type="button"
      class="action-draft-open"
      :disabled="completed || executing"
      @click="openForm"
    >
      {{ completed ? '예약 완료' : executing ? '예약 처리 중...' : '회의실 예약' }}
    </button>
  </section>

  <p v-if="completed" class="action-completion-message" aria-live="polite">
    {{ completionText }}<span v-if="completionStreaming" class="stream-cursor" aria-hidden="true"></span>
  </p>

  <Teleport to="body">
    <div v-if="isOpen" class="action-modal-backdrop" @mousedown.self="closeForm">
      <section class="action-modal" role="dialog" aria-modal="true" aria-labelledby="meeting-action-title">
        <header>
          <div>
            <span>최종 승인</span>
            <h2 id="meeting-action-title">회의실 예약</h2>
          </div>
          <button type="button" class="action-modal-close" :disabled="executing" aria-label="닫기" @click="closeForm">×</button>
        </header>

        <form @submit.prevent="confirm">
          <div class="action-form-grid">
            <label>
              <span>예약 날짜</span>
              <input v-model="form.date" type="date" required />
            </label>
            <label>
              <span>회의실 이름</span>
              <select v-model="form.roomId" :disabled="roomsLoading" required>
                <option value="">{{ roomsLoading ? '회의실을 불러오는 중...' : '회의실을 선택하세요' }}</option>
                <option v-for="room in filteredRooms" :key="room.roomId" :value="String(room.roomId)">
                  {{ room.name }} · {{ room.building }} {{ room.floor ? `${room.floor}층` : '' }} · {{ room.capacity }}명
                </option>
              </select>
              <small v-if="roomsError" class="field-error">{{ roomsError }}</small>
              <small v-else-if="!roomsLoading && filteredRooms.length === 0">
                입력한 인원을 수용할 수 있는 회의실이 없습니다.
              </small>
            </label>
            <label>
              <span>사용 인원</span>
              <input v-model="form.capacity" type="number" min="1" placeholder="예: 6" />
            </label>
            <label>
              <span>시작 시간</span>
              <div class="time-picker">
                <select v-model="startHour" aria-label="시작 시" required>
                  <option value="">시</option>
                  <option
                    v-for="hour in hourOptions"
                    :key="`start-hour-${hour}`"
                    :value="hour"
                    :disabled="isStartHourDisabled(hour)"
                  >{{ hour }}</option>
                </select>
                <span>:</span>
                <select v-model="startMinute" aria-label="시작 분" :disabled="!startHour" required>
                  <option value="">분</option>
                  <option
                    v-for="minute in minuteOptions"
                    :key="`start-minute-${minute}`"
                    :value="minute"
                    :disabled="isStartOptionDisabled(startHour, minute)"
                  >{{ minute }}</option>
                </select>
              </div>
            </label>
            <label>
              <span>종료 시간</span>
              <div class="time-picker">
                <select v-model="endHour" aria-label="종료 시" required>
                  <option value="">시</option>
                  <option
                    v-for="hour in hourOptions"
                    :key="`end-hour-${hour}`"
                    :value="hour"
                    :disabled="isEndHourDisabled(hour)"
                  >{{ hour }}</option>
                </select>
                <span>:</span>
                <select v-model="endMinute" aria-label="종료 분" :disabled="!endHour" required>
                  <option value="">분</option>
                  <option
                    v-for="minute in minuteOptions"
                    :key="`end-minute-${minute}`"
                    :value="minute"
                    :disabled="isEndOptionDisabled(endHour, minute)"
                  >{{ minute }}</option>
                </select>
              </div>
            </label>
          </div>

          <p v-if="form.startTime && form.endTime && !hasValidTimeRange" class="action-form-error" role="alert">
            종료 시간은 시작 시간보다 이후여야 합니다.
          </p>
          <p v-else-if="form.startTime && form.endTime && !hasValidTimeStep" class="action-form-error" role="alert">
            시작 시간과 종료 시간은 10분 단위로 선택해 주세요.
          </p>

          <p v-if="externalError || draft.errorMessage" class="action-form-error" role="alert">
            {{ externalError || draft.errorMessage }}
          </p>

          <footer>
            <button type="button" class="action-secondary" :disabled="executing" @click="closeForm">취소</button>
            <button type="submit" class="action-primary" :disabled="!canConfirm">
              {{ executing ? '예약 처리 중...' : '이 내용으로 예약' }}
            </button>
          </footer>
        </form>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.action-draft-action { margin-top: 10px; }

.action-draft-open,
.action-primary,
.action-secondary,
.action-modal-close {
  font: inherit;
  cursor: pointer;
}

.action-draft-open {
  min-height: 36px;
  padding: 0 15px;
  border: 1px solid var(--color-border);
  border-radius: 18px;
  background: var(--color-surface-raised);
  color: var(--color-text);
  font-size: 12px;
  font-weight: 700;
}

.action-draft-open:hover:not(:disabled) {
  border-color: var(--color-primary-light);
  color: var(--color-primary-light);
}

.action-draft-open:disabled { cursor: default; opacity: 0.62; }

.action-completion-message {
  margin: 12px 0 0;
  color: var(--color-text);
  font-size: inherit;
  line-height: 1.65;
  white-space: pre-line;
}

.stream-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  vertical-align: -0.12em;
  background: var(--color-primary-light);
  animation: stream-cursor-blink 0.8s steps(1) infinite;
}

@keyframes stream-cursor-blink {
  50% { opacity: 0; }
}

.action-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.44);
}

.action-modal {
  width: min(520px, 100%);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface-raised);
  box-shadow: 0 22px 60px rgba(15, 23, 42, 0.22);
}

.action-modal header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 22px 14px;
  border-bottom: 1px solid var(--color-border-light);
}

.action-modal header span { color: var(--color-primary-light); font-size: 11px; font-weight: 700; }
.action-modal h2 { margin: 3px 0 0; color: var(--color-text); font-size: 19px; letter-spacing: 0; }
.action-modal-close { border: 0; background: transparent; color: var(--color-subtle); font-size: 24px; line-height: 1; }
.action-modal form { padding: 18px 22px 22px; }

.action-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 15px;
}

.action-form-grid label { display: flex; min-width: 0; flex-direction: column; gap: 6px; }
.action-form-grid label > span { color: var(--color-text); font-size: 12px; font-weight: 700; }
.action-form-grid input,
.action-form-grid select {
  width: 100%;
  min-height: 40px;
  box-sizing: border-box;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface-soft);
  color: var(--color-text);
  padding: 8px 10px;
  font: inherit;
}
.action-form-grid select { appearance: auto; }
.time-picker {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 7px;
}
.time-picker > span { color: var(--color-subtle); font-weight: 700; }
.action-form-grid small { color: var(--color-subtle); font-size: 10.5px; line-height: 1.4; }
.action-form-grid .field-error { color: var(--color-danger); }
.action-form-error { margin: 14px 0 0; color: var(--color-danger); font-size: 12px; }

.action-modal footer { display: flex; justify-content: flex-end; gap: 9px; margin-top: 22px; }
.action-secondary,
.action-primary { min-height: 38px; border-radius: 6px; padding: 0 15px; font-size: 12px; font-weight: 700; }
.action-secondary { border: 1px solid var(--color-border); background: transparent; color: var(--color-text); }
.action-primary { border: 1px solid var(--color-primary); background: var(--color-primary); color: var(--color-white); }
.action-primary:disabled { cursor: not-allowed; opacity: 0.5; }

@media (max-width: 640px) {
  .action-form-grid { grid-template-columns: 1fr; }
}
</style>
