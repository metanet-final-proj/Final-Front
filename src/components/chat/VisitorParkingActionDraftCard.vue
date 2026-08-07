<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { workhubApi } from '../../api/workhubApi'
import ActionDraftContainer from './ActionDraftContainer.vue'
import ActionResultCallout from './ActionResultCallout.vue'

const props = defineProps({
  draft: { type: Object, required: true },
  loading: { type: Boolean, default: false },
  externalError: { type: [String, Object], default: '' },
})

const emit = defineEmits(['confirm', 'dismiss'])
const isOpen = ref(false)
const parkingLots = ref([])
const parkingLotsLoading = ref(false)
const parkingLotsError = ref('')
const form = reactive({
  requestId: '',
  parkingLotId: '',
  parkingLotName: '',
  parkingLotLocation: '',
  visitorName: '',
  visitorPhone: '',
  carNumber: '',
  visitDate: '',
})

const actionType = computed(() => String(props.draft?.actionType || 'visitor_parking.register'))
const status = computed(() => String(props.draft?.status || 'DRAFT').toUpperCase())
const isRegister = computed(() => actionType.value === 'visitor_parking.register')
const isUpdate = computed(() => actionType.value === 'visitor_parking.update')
const isCancel = computed(() => actionType.value === 'visitor_parking.cancel')
const completed = computed(() => status.value === 'COMPLETED')
const executing = computed(() => status.value === 'EXECUTING' || props.loading)
const fromRegistrationList = computed(() => props.draft?.values?.origin === 'visitor_parking_list')
const hiddenAfterCompletion = computed(() => completed.value && fromRegistrationList.value)
const showInlineTrigger = computed(() => !fromRegistrationList.value)
const quickExecutable = computed(() => (
  isRegister.value && Boolean(props.draft?.quickExecutable)
))
const quickValues = computed(() => props.draft?.values || {})
const quickParkingLot = computed(() => {
  const name = quickValues.value.parkingLotName || '선택된 주차장'
  const location = quickValues.value.parkingLotLocation
  return location ? `${name} · ${location}` : name
})
const actionLabel = computed(() => {
  if (isUpdate.value) return '방문객 주차 등록 수정'
  if (isCancel.value) return '방문객 주차 등록 취소'
  return '방문객 주차 등록'
})
const confirmLabel = computed(() => {
  if (isUpdate.value) return '수정하기'
  if (isCancel.value) return '등록 취소하기'
  return '등록하기'
})
const selectedParkingLot = computed(() => parkingLots.value.find(
  (lot) => String(lot.parkingLotId) === String(form.parkingLotId),
))
const today = computed(() => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
})
const normalizeText = (value) => String(value || '').trim()
const normalizedCarNumber = computed(() => normalizeText(form.carNumber).replace(/[\s-]+/g, ''))
const hasValidCarNumber = computed(() => (
  /^(?:[가-힣]{2})?\d{1,3}[가-힣]\d{4}$/.test(normalizedCarNumber.value)
))
const hasChanges = computed(() => {
  if (!isUpdate.value) return true
  const values = props.draft?.values || {}
  return String(form.parkingLotId || '') !== String(values.parkingLotId || '')
    || normalizeText(form.visitorName) !== normalizeText(values.visitorName)
    || normalizeText(form.visitorPhone) !== normalizeText(values.visitorPhone)
    || normalizeText(form.carNumber) !== normalizeText(values.carNumber)
    || String(form.visitDate || '') !== String(values.visitDate || '')
})
const canConfirm = computed(() => {
  if (executing.value) return false
  if (isCancel.value) return Boolean(form.requestId)
  return Boolean(
    form.parkingLotId && form.visitorName.trim() && hasValidCarNumber.value
      && form.visitDate && form.visitDate >= today.value && hasChanges.value,
  )
})
const parkingLotDisplay = computed(() => {
  const lot = selectedParkingLot.value
  const name = lot?.name || form.parkingLotName || (form.parkingLotId ? `주차장 #${form.parkingLotId}` : '-')
  const location = lot?.location || form.parkingLotLocation
  return location ? `${name} · ${location}` : name
})
const completionFields = computed(() => {
  const values = props.draft?.values || {}
  return [
    { label: '주차장', value: values.parkingLotName || '', emphasis: true },
    { label: '방문객', value: values.visitorName || '', emphasis: false },
    { label: '차량 번호', value: values.carNumber || '', emphasis: true },
    { label: '방문 날짜', value: values.visitDate || '', emphasis: false },
  ].filter((field) => field.value)
})
const completionMessage = computed(() => {
  if (isCancel.value) return '방문객 주차 등록이 취소되었습니다.'
  if (isUpdate.value) return '방문객 주차 등록 정보가 수정되었습니다.'
  return '방문객 주차 등록이 완료되었습니다.'
})
const completionPresentation = computed(() => props.draft?.presentation || ({
  tone: 'success',
  title: completionMessage.value,
  fields: completionFields.value,
}))
const errorPresentation = computed(() => {
  const externalMessage = typeof props.externalError === 'string'
    ? props.externalError
    : props.externalError?.message
  const message = externalMessage || props.draft?.errorMessage
  const tone = typeof props.externalError === 'object'
    ? (props.externalError?.tone || 'error')
    : 'error'
  return message ? { tone, title: message, fields: [] } : null
})

function syncForm() {
  const values = props.draft?.values || {}
  form.requestId = values.requestId ? String(values.requestId) : ''
  form.parkingLotId = values.parkingLotId ? String(values.parkingLotId) : ''
  form.parkingLotName = values.parkingLotName || ''
  form.parkingLotLocation = values.parkingLotLocation || ''
  form.visitorName = values.visitorName || ''
  form.visitorPhone = values.visitorPhone || ''
  form.carNumber = values.carNumber || ''
  form.visitDate = values.visitDate || ''
}

function normalizeParkingLot(lot) {
  return {
    parkingLotId: lot.parkingLotId ?? lot.parking_lot_id ?? lot.id,
    name: lot.name ?? lot.parkingLotName ?? '이름 없는 주차장',
    location: lot.location ?? lot.parkingLotLocation ?? '',
    availableSpaces: lot.availableSpaces ?? lot.available_spaces,
  }
}

async function loadParkingLots() {
  parkingLotsLoading.value = true
  parkingLotsError.value = ''
  try {
    const response = await workhubApi.getParkingLots()
    parkingLots.value = (Array.isArray(response?.data) ? response.data : []).map(normalizeParkingLot)
    if (!form.parkingLotId && form.parkingLotName) {
      const match = parkingLots.value.find((lot) => lot.name === form.parkingLotName)
      if (match) form.parkingLotId = String(match.parkingLotId)
    }
  } catch (error) {
    console.error('Failed to load parking lots:', error)
    parkingLots.value = []
    parkingLotsError.value = '주차장 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
  } finally {
    parkingLotsLoading.value = false
  }
}

async function openForm() {
  if (completed.value || executing.value) return
  syncForm()
  isOpen.value = true
  await loadParkingLots()
}

function closeForm() {
  if (executing.value) return
  isOpen.value = false
  if (fromRegistrationList.value && !completed.value) emit('dismiss', props.draft)
}

function confirm() {
  if (!canConfirm.value) return
  const lot = selectedParkingLot.value
  emit('confirm', {
    draftId: props.draft.draftId,
    version: props.draft.version,
    values: {
      ...(props.draft.values || {}),
      requestId: form.requestId ? Number(form.requestId) : null,
      parkingLotId: form.parkingLotId ? Number(form.parkingLotId) : null,
      parkingLotName: lot?.name || form.parkingLotName || null,
      parkingLotLocation: lot?.location || form.parkingLotLocation || null,
      visitorName: form.visitorName.trim() || null,
      visitorPhone: form.visitorPhone.trim() || null,
      carNumber: form.carNumber.trim() || null,
      visitDate: form.visitDate || null,
    },
  })
}

function quickConfirm() {
  if (!quickExecutable.value || executing.value || completed.value) return
  syncForm()
  confirm()
}

watch(() => props.draft, syncForm, { immediate: true, deep: true })
watch(selectedParkingLot, (lot) => {
  if (!lot) return
  form.parkingLotName = lot.name
  form.parkingLotLocation = lot.location
})
watch(completed, (value) => {
  if (value) isOpen.value = false
}, { immediate: true })
watch(
  () => props.draft?.draftId,
  () => {
    if (props.draft?.autoOpen && !completed.value) openForm()
  },
  { immediate: true },
)
</script>

<template>
  <section v-if="quickExecutable && !hiddenAfterCompletion" class="parking-quick-action">
    <p v-if="draft.resolutionMessage" class="parking-quick-notice">
      {{ draft.resolutionMessage }}
    </p>
    <div class="parking-quick-heading">
      <div>
        <span>빠른 실행</span>
        <strong>방문객 주차 등록</strong>
      </div>
      <span class="parking-quick-ready">등록 가능</span>
    </div>
    <dl class="parking-quick-summary">
      <div><dt>주차장</dt><dd>{{ quickParkingLot }}</dd></div>
      <div><dt>방문 날짜</dt><dd>{{ quickValues.visitDate }}</dd></div>
      <div><dt>담당자 또는 방문객</dt><dd>{{ quickValues.visitorName }}</dd></div>
      <div><dt>차량 번호</dt><dd>{{ quickValues.carNumber }}</dd></div>
    </dl>
    <div class="parking-quick-buttons">
      <button type="button" class="secondary" :disabled="executing || completed" @click="openForm">
        내용 확인·수정
      </button>
      <button type="button" class="primary" :disabled="executing || completed" @click="quickConfirm">
        {{ completed ? '등록 완료' : executing ? '등록 처리 중...' : '바로 등록하기' }}
      </button>
    </div>
  </section>

  <section v-if="showInlineTrigger && !quickExecutable && !hiddenAfterCompletion" class="parking-draft-action">
    <button
      type="button"
      class="parking-draft-open"
      :disabled="completed || executing"
      @click="openForm"
    >
      {{ completed ? '처리 완료' : executing ? '처리 중...' : actionLabel }}
    </button>
  </section>

  <ActionResultCallout
    v-if="completed && !hiddenAfterCompletion"
    :presentation="completionPresentation"
  />

  <ActionDraftContainer
    :open="isOpen"
    :title="actionLabel"
    title-id="parking-action-title"
    :executing="executing"
    :confirm-disabled="!canConfirm"
    :confirm-label="executing ? '처리 중...' : confirmLabel"
    @close="closeForm"
    @confirm="confirm"
  >
        <div class="parking-form">
          <label>
            <span>방문 날짜</span>
            <input v-model="form.visitDate" type="date" :min="today" :disabled="isCancel" />
          </label>

          <label v-if="!isCancel">
            <span>주차장</span>
            <select v-model="form.parkingLotId" :disabled="parkingLotsLoading">
              <option value="">{{ parkingLotsLoading ? '불러오는 중...' : '주차장을 선택해 주세요' }}</option>
              <option v-for="lot in parkingLots" :key="lot.parkingLotId" :value="String(lot.parkingLotId)">
                {{ lot.name }}{{ lot.location ? ` · ${lot.location}` : '' }}{{ Number.isFinite(Number(lot.availableSpaces)) ? ` · ${lot.availableSpaces}자리` : '' }}
              </option>
            </select>
          </label>
          <label v-else>
            <span>주차장</span>
            <input :value="parkingLotDisplay" type="text" readonly />
          </label>

          <label>
            <span>담당자 또는 방문객</span>
            <input v-model="form.visitorName" type="text" maxlength="50" :readonly="isCancel" placeholder="담당자 또는 방문객 이름" />
          </label>

          <label>
            <span>차량 번호</span>
            <input v-model="form.carNumber" type="text" maxlength="30" :readonly="isCancel" placeholder="예: 12가 3456" />
          </label>
          <p
            v-if="!isCancel && form.carNumber.trim() && !hasValidCarNumber"
            class="parking-error"
          >
            차량 번호 형식을 확인해 주세요. 예: 12가 3456, 서울 12가 3456
          </p>

          <label>
            <span>전화번호 <em>선택</em></span>
            <input v-model="form.visitorPhone" type="tel" maxlength="30" :readonly="isCancel" placeholder="예: 010-1234-5678" />
          </label>

          <p v-if="parkingLotsError" class="parking-error">{{ parkingLotsError }}</p>
          <ActionResultCallout
            v-if="errorPresentation"
            :presentation="errorPresentation"
          />
          <p v-if="form.visitDate && form.visitDate < today" class="parking-error">방문 날짜는 오늘 이후로 선택해 주세요.</p>
          <p v-if="isUpdate && !hasChanges" class="parking-notice" role="status">
            변경된 내용이 없습니다. 내용을 변경하면 수정 버튼이 활성화됩니다.
          </p>
        </div>

  </ActionDraftContainer>
</template>

<style scoped>
.parking-draft-action { margin-top: 12px; }
.parking-draft-open { min-height: 34px; padding: 7px 14px; border: 1px solid var(--color-border); border-radius: 18px; background: var(--color-surface-raised); color: var(--color-text); font: inherit; font-weight: 700; cursor: pointer; }
.parking-draft-open:disabled { cursor: default; opacity: .62; }
.parking-quick-action { display: grid; width: 100%; max-width: none; box-sizing: border-box; gap: 14px; margin-top: 12px; padding: 16px; border: 1px solid var(--color-border-light); border-radius: 8px; background: var(--color-surface-soft); }
.parking-quick-notice { margin: 0; padding: 10px 12px; border-left: 3px solid var(--color-primary-light); border-radius: 4px; background: var(--color-surface-raised); color: var(--color-text); font-size: 12px; line-height: 1.55; }
.parking-quick-heading, .parking-quick-buttons { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.parking-quick-heading > div { display: grid; gap: 2px; }
.parking-quick-heading span { color: var(--color-subtle); font-size: 11px; font-weight: 700; }
.parking-quick-heading strong { color: var(--color-text); font-size: 15px; }
.parking-quick-heading .parking-quick-ready { color: var(--color-primary-light); }
.parking-quick-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 0; }
.parking-quick-summary > div { min-width: 0; padding: 10px; border-radius: 6px; background: var(--color-surface-raised); }
.parking-quick-summary dt { color: var(--color-subtle); font-size: 10.5px; }
.parking-quick-summary dd { margin: 4px 0 0; overflow-wrap: anywhere; color: var(--color-text); font-size: 12px; font-weight: 700; }
.parking-quick-buttons { justify-content: flex-end; }
.parking-quick-buttons button { min-height: 36px; padding: 8px 15px; border-radius: 6px; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.parking-quick-buttons .secondary { border: 1px solid var(--color-border); background: var(--color-surface-raised); color: var(--color-text); }
.parking-quick-buttons .primary { border: 1px solid var(--color-primary); background: var(--color-primary); color: var(--color-white); }
.parking-quick-buttons button:disabled { cursor: default; opacity: .55; }
.parking-form { display: grid; gap: 14px; padding: 18px 20px; }
.parking-form label { display: grid; gap: 6px; color: var(--color-text); font-size: 12px; font-weight: 700; }
.parking-form label em { color: var(--color-subtle); font-size: 10px; font-style: normal; font-weight: 500; }
.parking-form input, .parking-form select { width: 100%; min-height: 40px; box-sizing: border-box; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); font: inherit; font-weight: 500; }
.parking-form input:read-only, .parking-form select:disabled { background: var(--color-surface-soft); color: var(--color-subtle); }
.parking-form small { color: var(--color-subtle); font-weight: 500; }
.parking-error { margin: 0; color: var(--color-danger); font-size: 12px; }
.parking-notice { margin: 0; color: var(--color-subtle); font-size: 12px; }
@media (max-width: 560px) {
  .parking-quick-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .parking-quick-buttons { align-items: stretch; flex-direction: column-reverse; }
  .parking-quick-buttons button { width: 100%; }
}
</style>
