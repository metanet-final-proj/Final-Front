<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { workhubApi } from '../../api/workhubApi'
import ActionResultCallout from './ActionResultCallout.vue'

const props = defineProps({
  draft: { type: Object, required: true },
  loading: { type: Boolean, default: false },
  externalError: { type: String, default: '' },
})
const emit = defineEmits(['confirm', 'dismiss'])

const isOpen = ref(false)
const items = ref([])
const itemsLoading = ref(false)
const itemsError = ref('')
const form = reactive({ requestId: '', itemId: '', itemName: '', category: '', quantity: 1, reason: '' })

const actionType = computed(() => String(props.draft?.actionType || 'supply.request'))
const isCreate = computed(() => actionType.value === 'supply.request')
const isUpdate = computed(() => actionType.value === 'supply.update')
const isCancel = computed(() => actionType.value === 'supply.cancel')
const status = computed(() => String(props.draft?.status || 'DRAFT').toUpperCase())
const completed = computed(() => status.value === 'COMPLETED')
const executing = computed(() => status.value === 'EXECUTING' || props.loading)
const origin = computed(() => String(props.draft?.values?.origin || ''))
const fromList = computed(() => ['supply_item_list', 'supply_request_list'].includes(origin.value))
const showInlineTrigger = computed(() => !fromList.value)
const selectedItem = computed(() => items.value.find((item) => String(item.itemId) === String(form.itemId)))
const originalItemId = computed(() => props.draft?.values?.itemId)
const originalQuantity = computed(() => Number(props.draft?.values?.quantity || 0))
const maxRequestQuantity = computed(() => {
  if (isCancel.value || !selectedItem.value) return null
  const currentStock = Number(selectedItem.value.stockQuantity || 0)
  return isUpdate.value && String(selectedItem.value.itemId) === String(originalItemId.value)
    ? currentStock + originalQuantity.value
    : currentStock
})
const quantityExceedsStock = computed(() => (
  maxRequestQuantity.value !== null && Number(form.quantity || 0) > maxRequestQuantity.value
))
const actionLabel = computed(() => isUpdate.value ? '사무용품 신청 수정' : isCancel.value ? '사무용품 신청 취소' : '사무용품 신청')
const confirmLabel = computed(() => isUpdate.value ? '수정하기' : isCancel.value ? '신청 취소하기' : '신청하기')
const hasChanges = computed(() => {
  if (!isUpdate.value) return true
  const values = props.draft?.values || {}
  return String(form.itemId || '') !== String(values.itemId || '')
    || Number(form.quantity || 0) !== Number(values.quantity || 0)
})
const canConfirm = computed(() => {
  if (executing.value) return false
  if (isCancel.value) return Boolean(form.requestId)
  return Boolean(
    form.itemId
      && Number(form.quantity) > 0
      && !quantityExceedsStock.value
      && hasChanges.value,
  )
})
const completionPresentation = computed(() => props.draft?.presentation || null)
const errorPresentation = computed(() => {
  const message = props.externalError || props.draft?.errorMessage
  return message ? { tone: 'error', title: message, fields: [] } : null
})

function normalizeItem(item) {
  return {
    itemId: item.itemId ?? item.item_id ?? item.id,
    itemName: item.itemName ?? item.name ?? item.supplyItemName ?? '이름 없는 품목',
    category: item.category ?? '',
    stockQuantity: Number(item.stockQuantity ?? item.stock_quantity ?? 0),
    status: item.status ?? 'ACTIVE',
  }
}

function normalizeItemName(value) {
  return String(value || '')
    .toLocaleLowerCase('ko-KR')
    .replace(/[^0-9a-z가-힣]/g, '')
}

function itemNameTokens(value) {
  return String(value || '')
    .toLocaleLowerCase('ko-KR')
    .match(/[0-9a-z]+|[가-힣]+/g) || []
}

function itemNameScore(query, candidate) {
  const normalizedQuery = normalizeItemName(query)
  const normalizedCandidate = normalizeItemName(candidate)
  if (!normalizedQuery || !normalizedCandidate) return 0
  if (normalizedQuery === normalizedCandidate) return 100
  if (normalizedCandidate.includes(normalizedQuery) || normalizedQuery.includes(normalizedCandidate)) return 80

  const queryTokens = itemNameTokens(query)
  const candidateTokens = itemNameTokens(candidate)
  if (queryTokens.length === 0) return 0
  const matched = queryTokens.filter((token) => candidateTokens.some(
    (candidateToken) => candidateToken.includes(token) || token.includes(candidateToken),
  ))
  return matched.length === queryTokens.length ? 50 + matched.length : 0
}

function resolveItemByName(itemName) {
  const ranked = items.value
    .map((item) => ({ item, score: itemNameScore(itemName, item.itemName) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
  if (ranked.length === 0) return null
  if (ranked.length > 1 && ranked[0].score === ranked[1].score) return null
  return ranked[0].item
}
function syncForm() {
  const values = props.draft?.values || {}
  form.requestId = values.requestId ? String(values.requestId) : ''
  form.itemId = values.itemId ? String(values.itemId) : ''
  form.itemName = values.itemName || ''
  form.category = values.category || ''
  form.quantity = Number(values.quantity || 1)
  form.reason = values.reason || ''
}
async function loadItems() {
  if (isCancel.value) return
  itemsLoading.value = true
  itemsError.value = ''
  try {
    const response = await workhubApi.getSupplyItems()
    items.value = (Array.isArray(response?.data) ? response.data : []).map(normalizeItem)
    if (!form.itemId && form.itemName) {
      const matched = resolveItemByName(form.itemName)
      if (matched) form.itemId = String(matched.itemId)
    }
  } catch (error) {
    console.error('Failed to load supply items:', error)
    itemsError.value = '사무용품 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
  } finally {
    itemsLoading.value = false
  }
}
async function openForm() {
  syncForm()
  isOpen.value = true
  await loadItems()
}
function closeForm() {
  if (executing.value) return
  isOpen.value = false
  if (fromList.value && !completed.value) emit('dismiss', props.draft)
}
function confirm() {
  if (!canConfirm.value) return
  const item = selectedItem.value
  emit('confirm', {
    draftId: props.draft.draftId,
    version: props.draft.version,
    values: {
      ...(props.draft.values || {}),
      requestId: form.requestId ? Number(form.requestId) : null,
      itemId: form.itemId ? Number(form.itemId) : null,
      itemName: item?.itemName || form.itemName || null,
      category: item?.category || form.category || null,
      quantity: Number(form.quantity || 0),
      reason: form.reason.trim() || null,
    },
  })
}

watch(() => props.draft, syncForm, { immediate: true, deep: true })
watch(selectedItem, (item) => {
  if (!item) return
  form.itemName = item.itemName
  form.category = item.category
})
watch(completed, (value) => { if (value) isOpen.value = false }, { immediate: true })
watch(() => props.draft?.draftId, () => {
  if (props.draft?.autoOpen && !completed.value) openForm()
}, { immediate: true })
</script>

<template>
  <section v-if="showInlineTrigger" class="draft-trigger">
    <button type="button" :disabled="completed || executing" @click="openForm">
      {{ completed ? '처리 완료' : executing ? '처리 중...' : actionLabel }}
    </button>
  </section>
  <ActionResultCallout v-if="completed && !fromList" :presentation="completionPresentation" />

  <Teleport to="body">
    <div v-if="isOpen" class="modal-backdrop" @mousedown.self="closeForm">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="supply-action-title">
        <header>
          <div><span>최종 확인</span><h2 id="supply-action-title">{{ actionLabel }}</h2></div>
          <button type="button" class="close" aria-label="닫기" :disabled="executing" @click="closeForm">×</button>
        </header>

        <div class="form-grid">
          <label>
            <span>사무용품</span>
            <select v-if="!isCancel" v-model="form.itemId" :disabled="itemsLoading">
              <option value="">{{ itemsLoading ? '불러오는 중...' : '품목을 선택해 주세요' }}</option>
              <option
                v-for="item in items"
                :key="item.itemId"
                :value="String(item.itemId)"
                :disabled="item.status !== 'ACTIVE' || item.stockQuantity <= 0"
              >{{ item.itemName }} · 재고 {{ item.stockQuantity }}개</option>
            </select>
            <input v-else :value="form.itemName || `품목 #${form.itemId}`" disabled />
          </label>
          <label>
            <span>수량</span>
            <input
              v-model.number="form.quantity"
              type="number"
              min="1"
              :max="maxRequestQuantity || undefined"
              step="1"
              :disabled="isCancel"
            />
            <small v-if="!isCancel && maxRequestQuantity !== null" class="stock-hint">
              {{ isUpdate ? '수정 가능' : '신청 가능' }} 최대 {{ maxRequestQuantity }}개
            </small>
          </label>
          <label class="wide">
            <span>신청 사유 <small>{{ isCreate ? '(선택)' : '(기존 신청 사유)' }}</small></span>
            <textarea v-model="form.reason" rows="3" :disabled="!isCreate" placeholder="사용 목적이나 필요한 이유를 입력해 주세요."></textarea>
          </label>
          <p v-if="itemsError" class="form-error">{{ itemsError }}</p>
          <p v-if="isUpdate && !hasChanges" class="form-note">품목이나 수량을 변경해야 수정할 수 있습니다.</p>
          <p v-if="quantityExceedsStock" class="form-error">
            신청 가능한 수량은 최대 {{ maxRequestQuantity }}개입니다.
          </p>
          <ActionResultCallout v-if="errorPresentation" :presentation="errorPresentation" compact />
        </div>

        <footer>
          <button type="button" class="secondary" :disabled="executing" @click="closeForm">닫기</button>
          <button type="button" class="primary" :disabled="!canConfirm" @click="confirm">
            {{ executing ? '처리 중...' : confirmLabel }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.draft-trigger { margin-top: 12px; }
.draft-trigger button, .primary { border: 0; border-radius: 6px; background: var(--color-primary); color: white; font-weight: 800; cursor: pointer; }
.draft-trigger button { min-height: 34px; padding: 0 13px; }
button:disabled { cursor: default; opacity: .55; }
.modal-backdrop { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 20px; background: rgba(15, 23, 42, .48); }
.modal { width: min(560px, 100%); max-height: calc(100vh - 40px); overflow: auto; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface-raised); box-shadow: 0 18px 50px rgba(15, 23, 42, .22); }
.modal header { display: flex; justify-content: space-between; align-items: flex-start; padding: 18px 20px; border-bottom: 1px solid var(--color-border-light); }
.modal header span { color: var(--color-primary); font-size: 11px; font-weight: 800; }
.modal h2 { margin: 4px 0 0; font-size: 18px; }
.close { border: 0; background: transparent; color: var(--color-subtle); font-size: 24px; cursor: pointer; }
.form-grid { display: grid; grid-template-columns: 1fr 130px; gap: 14px; padding: 20px; }
label { display: grid; gap: 6px; font-size: 12px; font-weight: 700; }
label > span small { color: var(--color-subtle); font-weight: 500; }
.stock-hint { color: var(--color-subtle); font-size: 11px; font-weight: 500; }
.wide, .form-error, .form-note, .form-grid :deep(.action-result-callout) { grid-column: 1 / -1; }
input, select, textarea { width: 100%; box-sizing: border-box; border: 1px solid var(--color-border); border-radius: 6px; padding: 9px 10px; background: var(--color-surface); color: var(--color-text); font: inherit; }
textarea { resize: vertical; }
.form-error { margin: 0; color: var(--color-danger); font-size: 12px; }
.form-note { margin: 0; color: var(--color-warning-text); font-size: 12px; }
.modal footer { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 20px; border-top: 1px solid var(--color-border-light); }
.modal footer button { min-height: 36px; padding: 0 14px; border-radius: 6px; font: inherit; font-weight: 800; }
.secondary { border: 1px solid var(--color-border); background: var(--color-surface-raised); color: var(--color-text); }
@media (max-width: 520px) { .modal-backdrop { padding: 10px; } .form-grid { grid-template-columns: 1fr; padding: 16px; } .wide, .form-error, .form-note { grid-column: 1; } }
</style>
