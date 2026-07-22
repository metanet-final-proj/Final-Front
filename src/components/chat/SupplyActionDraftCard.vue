<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { workhubApi } from '../../api/workhubApi'
import ActionResultCallout from './ActionResultCallout.vue'

const props = defineProps({
  draft: { type: Object, required: true },
  loading: { type: Boolean, default: false },
  externalError: { type: [String, Object], default: '' },
})
const emit = defineEmits(['confirm', 'dismiss'])

const isOpen = ref(false)
const items = ref([])
const itemsLoading = ref(false)
const itemsError = ref('')
let nextRowId = 1
const createItemRow = (values = {}) => ({
  rowId: nextRowId++,
  itemId: values.itemId ? String(values.itemId) : '',
  itemName: values.itemName || '',
  category: values.category || '',
  quantity: Number(values.quantity || 1),
})
const form = reactive({ requestId: '', rows: [createItemRow()], reason: '' })

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
const quickExecutable = computed(() => (
  isCreate.value && !fromList.value && Boolean(props.draft?.quickExecutable)
))
const quickItems = computed(() => (
  Array.isArray(props.draft?.values?.items) ? props.draft.values.items : []
))
const adjustmentFor = (item) => (Array.isArray(props.draft?.adjustments)
  ? props.draft.adjustments.find((adjustment) => (
      String(adjustment?.itemId || '') === String(item?.itemId || '')
      && adjustment?.code === 'SUPPLY_QUANTITY_ADJUSTED'
    ))
  : null)
const originalItemId = computed(() => props.draft?.values?.itemId)
const originalQuantity = computed(() => Number(props.draft?.values?.quantity || 0))
const selectedItemIds = computed(() => form.rows.map((row) => String(row.itemId || '')).filter(Boolean))
const actionLabel = computed(() => isUpdate.value ? '사무용품 신청 수정' : isCancel.value ? '사무용품 신청 취소' : '사무용품 신청')
const confirmLabel = computed(() => isUpdate.value ? '수정하기' : isCancel.value ? '신청 취소하기' : '신청하기')
const hasChanges = computed(() => {
  if (!isUpdate.value) return true
  const values = props.draft?.values || {}
  const row = form.rows[0]
  return String(row?.itemId || '') !== String(values.itemId || '')
    || Number(row?.quantity || 0) !== Number(values.quantity || 0)
})
const canConfirm = computed(() => {
  if (executing.value) return false
  if (isCancel.value) return Boolean(form.requestId)
  if (isCreate.value && (form.rows.length < 1 || form.rows.length > 5)) return false
  const uniqueIds = new Set(selectedItemIds.value)
  return Boolean(
    uniqueIds.size === form.rows.length
      && form.rows.every((row) => row.itemId && Number(row.quantity) > 0 && !rowExceedsStock(row))
      && hasChanges.value,
  )
})
const completionPresentation = computed(() => props.draft?.presentation || null)
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
function selectedItemFor(row) {
  return items.value.find((item) => String(item.itemId) === String(row?.itemId))
}
function maxRequestQuantityFor(row) {
  if (isCancel.value) return null
  const selectedItem = selectedItemFor(row)
  if (!selectedItem) return null
  const currentStock = Number(selectedItem.stockQuantity || 0)
  return isUpdate.value && String(selectedItem.itemId) === String(originalItemId.value)
    ? currentStock + originalQuantity.value
    : currentStock
}
function rowExceedsStock(row) {
  const maxQuantity = maxRequestQuantityFor(row)
  return maxQuantity !== null && Number(row?.quantity || 0) > maxQuantity
}
function isItemOptionDisabled(item, rowIndex) {
  if (item.status !== 'ACTIVE' || item.stockQuantity <= 0) return true
  const currentItemId = String(form.rows[rowIndex]?.itemId || '')
  return selectedItemIds.value.some(
    (selectedId) => selectedId === String(item.itemId) && selectedId !== currentItemId,
  )
}
function addItemRow() {
  if (!isCreate.value || form.rows.length >= 5) return
  form.rows.push(createItemRow())
}
function removeItemRow(index) {
  if (!isCreate.value || form.rows.length <= 1) return
  form.rows.splice(index, 1)
}
function syncForm() {
  const values = props.draft?.values || {}
  form.requestId = values.requestId ? String(values.requestId) : ''
  const draftItems = isCreate.value && Array.isArray(values.items) && values.items.length
    ? values.items.slice(0, 5)
    : [{
        itemId: values.itemId,
        itemName: values.itemName,
        category: values.category,
        quantity: values.quantity,
      }]
  form.rows.splice(0, form.rows.length, ...draftItems.map(createItemRow))
  form.reason = values.reason || ''
}
async function loadItems() {
  if (isCancel.value) return
  itemsLoading.value = true
  itemsError.value = ''
  try {
    const response = await workhubApi.getSupplyItems()
    items.value = (Array.isArray(response?.data) ? response.data : []).map(normalizeItem)
    form.rows.forEach((row) => {
      if (row.itemId || !row.itemName) return
      const matched = resolveItemByName(row.itemName)
      if (matched && !selectedItemIds.value.includes(String(matched.itemId))) {
        row.itemId = String(matched.itemId)
      }
    })
  } catch (error) {
    console.error('Failed to load supply items:', error)
    itemsError.value = '사무용품 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
  } finally {
    itemsLoading.value = false
  }
}
async function openForm() {
  if (completed.value || executing.value) return
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
  const normalizedItems = form.rows.map((row) => {
    const item = selectedItemFor(row)
    return {
      itemId: row.itemId ? Number(row.itemId) : null,
      itemName: item?.itemName || row.itemName || null,
      category: item?.category || row.category || null,
      quantity: Number(row.quantity || 0),
      stockQuantity: Number(item?.stockQuantity ?? row.stockQuantity ?? 0),
    }
  })
  const firstItem = normalizedItems[0] || {}
  emit('confirm', {
    draftId: props.draft.draftId,
    version: props.draft.version,
    values: {
      ...(props.draft.values || {}),
      requestId: form.requestId ? Number(form.requestId) : null,
      itemId: isCreate.value ? null : firstItem.itemId,
      itemName: isCreate.value ? null : firstItem.itemName,
      category: isCreate.value ? null : firstItem.category,
      quantity: isCreate.value ? null : firstItem.quantity,
      items: isCreate.value ? normalizedItems : undefined,
      reason: form.reason.trim() || null,
    },
  })
}

function quickConfirm() {
  if (!quickExecutable.value || executing.value || completed.value) return
  emit('confirm', {
    draftId: props.draft.draftId,
    version: props.draft.version,
    values: {
      ...(props.draft.values || {}),
      items: quickItems.value.map((item) => ({
        itemId: Number(item.itemId),
        itemName: item.itemName || null,
        category: item.category || null,
        quantity: Number(item.quantity || 1),
        stockQuantity: Number(item.stockQuantity ?? 0),
      })),
    },
  })
}

watch(() => props.draft, syncForm, { immediate: true, deep: true })
watch(completed, (value) => { if (value) isOpen.value = false }, { immediate: true })
watch(() => props.draft?.draftId, () => {
  if (props.draft?.autoOpen && !completed.value) openForm()
}, { immediate: true })
</script>

<template>
  <section v-if="quickExecutable" class="supply-quick-action">
    <p v-if="draft.resolutionMessage" class="supply-quick-notice">
      {{ draft.resolutionMessage }}
    </p>
    <div class="supply-quick-heading">
      <div>
        <span>빠른 실행</span>
        <strong>사무용품 신청</strong>
      </div>
      <span class="supply-quick-ready">신청 가능</span>
    </div>
    <div class="supply-quick-items">
      <div v-for="item in quickItems" :key="item.itemId" class="supply-quick-item">
        <div class="supply-quick-item-name">
          <span>사무용품</span>
          <strong>{{ item.itemName }}</strong>
        </div>
        <div>
          <span>신청 수량</span>
          <strong>{{ item.quantity }}개</strong>
        </div>
        <div>
          <span>확인 시 재고</span>
          <strong>{{ item.stockQuantity }}개</strong>
        </div>
        <p v-if="adjustmentFor(item)" class="supply-quick-adjustment">
          요청한 {{ adjustmentFor(item).requestedQuantity }}개에서 신청 가능한
          {{ adjustmentFor(item).resolvedQuantity }}개로 조정했어요.
        </p>
      </div>
    </div>
    <div class="supply-quick-buttons">
      <button type="button" class="secondary" :disabled="completed || executing" @click="openForm">
        내용 확인·수정
      </button>
      <button type="button" class="primary" :disabled="completed || executing" @click="quickConfirm">
        {{ completed ? '신청 완료' : executing ? '신청 처리 중...' : '바로 신청하기' }}
      </button>
    </div>
  </section>

  <section v-if="showInlineTrigger && !quickExecutable" class="draft-trigger">
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
          <div class="item-list">
            <div v-for="(row, rowIndex) in form.rows" :key="row.rowId" class="item-row">
              <label>
                <span>사무용품{{ isCreate && form.rows.length > 1 ? ` ${rowIndex + 1}` : '' }}</span>
                <select v-if="!isCancel" v-model="row.itemId" :disabled="itemsLoading">
                  <option value="">{{ itemsLoading ? '불러오는 중...' : '품목을 선택해 주세요' }}</option>
                  <option
                    v-for="item in items"
                    :key="item.itemId"
                    :value="String(item.itemId)"
                    :disabled="isItemOptionDisabled(item, rowIndex)"
                  >{{ item.itemName }} · 재고 {{ item.stockQuantity }}개</option>
                </select>
                <input v-else :value="row.itemName || `품목 #${row.itemId}`" disabled />
              </label>
              <label>
                <span>수량</span>
                <input
                  v-model.number="row.quantity"
                  type="number"
                  min="1"
                  :max="maxRequestQuantityFor(row) || undefined"
                  step="1"
                  :disabled="isCancel"
                />
              </label>
              <button
                v-if="isCreate && form.rows.length > 1"
                type="button"
                class="remove-item"
                :aria-label="`${rowIndex + 1}번째 사무용품 삭제`"
                :disabled="executing"
                @click="removeItemRow(rowIndex)"
              >삭제</button>
              <p v-if="rowExceedsStock(row)" class="row-error">
                선택한 품목의 현재 재고는 {{ maxRequestQuantityFor(row) }}개입니다.
              </p>
            </div>
            <button
              v-if="isCreate"
              type="button"
              class="add-item"
              :disabled="executing || form.rows.length >= 5"
              @click="addItemRow"
            >+ 사무용품 추가 <span>{{ form.rows.length }}/5</span></button>
          </div>
          <label class="wide">
            <span>신청 사유 <small>{{ isCreate ? '(선택)' : '(기존 신청 사유)' }}</small></span>
            <textarea v-model="form.reason" rows="3" :disabled="!isCreate" placeholder="사용 목적이나 필요한 이유를 입력해 주세요."></textarea>
          </label>
          <p v-if="itemsError" class="form-error">{{ itemsError }}</p>
          <p v-if="isCreate && draft.resolutionMessage" class="form-note">{{ draft.resolutionMessage }}</p>
          <p v-if="isUpdate && !hasChanges" class="form-note">품목이나 수량을 변경해야 수정할 수 있습니다.</p>
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
.draft-trigger button { min-height: 36px; padding: 0 15px; border: 1px solid var(--color-border); border-radius: 18px; background: var(--color-surface-raised); color: var(--color-text); font-weight: 700; cursor: pointer; }
.draft-trigger button:hover:not(:disabled) { border-color: var(--color-primary-light); color: var(--color-primary-light); }
.supply-quick-action { display: grid; width: 100%; max-width: none; box-sizing: border-box; gap: 14px; margin-top: 12px; padding: 16px; border: 1px solid var(--color-border-light); border-radius: 8px; background: var(--color-surface-soft); }
.supply-quick-notice { margin: 0; padding: 10px 12px; border-left: 3px solid var(--color-primary-light); border-radius: 4px; background: var(--color-surface-raised); color: var(--color-text); font-size: 12px; line-height: 1.55; }
.supply-quick-heading, .supply-quick-buttons { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.supply-quick-heading > div { display: grid; gap: 2px; }
.supply-quick-heading span, .supply-quick-item span { color: var(--color-subtle); font-size: 11px; font-weight: 700; }
.supply-quick-heading strong { color: var(--color-text); font-size: 15px; }
.supply-quick-heading .supply-quick-ready { color: var(--color-primary-light); }
.supply-quick-items { display: grid; gap: 8px; }
.supply-quick-item { display: grid; grid-template-columns: minmax(0, 1fr) 90px 100px; gap: 10px; padding: 10px; border: 1px solid var(--color-border-light); border-radius: 6px; background: var(--color-surface-raised); }
.supply-quick-item > div { display: grid; min-width: 0; gap: 4px; }
.supply-quick-item strong { overflow-wrap: anywhere; color: var(--color-text); font-size: 12.5px; }
.supply-quick-adjustment { grid-column: 1 / -1; margin: 0; padding-top: 8px; border-top: 1px solid var(--color-border-light); color: var(--color-primary-light); font-size: 11.5px; line-height: 1.5; }
.supply-quick-buttons { justify-content: flex-end; }
.supply-quick-buttons button { min-height: 36px; padding: 8px 15px; border-radius: 6px; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.supply-quick-buttons .secondary { border: 1px solid var(--color-border); background: var(--color-surface-raised); color: var(--color-text); }
.supply-quick-buttons .primary { border: 1px solid var(--color-primary); background: var(--color-primary); color: var(--color-white); }
.primary { border: 1px solid var(--color-primary); border-radius: 6px; background: var(--color-primary); color: var(--color-white); font-weight: 700; cursor: pointer; }
button:disabled { cursor: default; opacity: .55; }
.modal-backdrop { position: fixed; inset: 0; z-index: 2000; display: grid; place-items: center; padding: 20px; background: rgba(15, 23, 42, .42); }
.modal { width: min(680px, 100%); max-height: calc(100vh - 40px); overflow: auto; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface-raised); box-shadow: 0 18px 48px rgba(15, 23, 42, .22); }
.modal header { display: flex; justify-content: space-between; align-items: flex-start; padding: 18px 20px 14px; border-bottom: 1px solid var(--color-border-light); }
.modal header span { color: var(--color-primary); font-size: 11px; font-weight: 700; }
.modal h2 { margin: 4px 0 0; color: var(--color-text); font-size: 18px; letter-spacing: 0; }
.close { border: 0; background: transparent; color: var(--color-subtle); font-size: 24px; line-height: 1; cursor: pointer; }
.form-grid { display: grid; grid-template-columns: 1fr 130px; gap: 14px; padding: 18px 20px; }
.item-list { grid-column: 1 / -1; display: grid; gap: 12px; }
.item-row { display: grid; grid-template-columns: minmax(0, 1fr) 130px auto; align-items: end; gap: 12px; }
label { display: grid; gap: 6px; color: var(--color-text); font-size: 12px; font-weight: 700; }
label > span small { color: var(--color-subtle); font-weight: 500; }
.wide, .form-error, .form-note, .form-grid :deep(.action-result-callout) { grid-column: 1 / -1; }
input, select, textarea { width: 100%; min-height: 40px; box-sizing: border-box; border: 1px solid var(--color-border); border-radius: 6px; padding: 8px 10px; background: var(--color-surface); color: var(--color-text); font: inherit; }
textarea { resize: vertical; }
.form-error { margin: 0; color: var(--color-danger); font-size: 12px; }
.row-error { grid-column: 1 / -1; margin: -4px 0 0; color: var(--color-danger); font-size: 12px; }
.form-note { margin: 0; color: var(--color-warning-text); font-size: 12px; }
.add-item { justify-self: start; min-height: 34px; padding: 0 12px; border: 1px dashed var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-primary); font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
.add-item span { margin-left: 5px; color: var(--color-subtle); font-weight: 500; }
.remove-item { min-height: 38px; padding: 0 11px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface-raised); color: var(--color-danger); font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
.modal footer { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 20px 18px; border-top: 1px solid var(--color-border-light); }
.modal footer button { min-height: 38px; padding: 0 15px; border-radius: 6px; font: inherit; font-size: 13px; font-weight: 700; }
.secondary { border: 1px solid var(--color-border); background: var(--color-surface-raised); color: var(--color-text); }
@media (max-width: 620px) { .supply-quick-item { grid-template-columns: repeat(2, minmax(0, 1fr)); } .supply-quick-item-name { grid-column: 1 / -1; } .supply-quick-buttons { align-items: stretch; flex-direction: column-reverse; } .supply-quick-buttons button { width: 100%; } .modal-backdrop { align-items: end; padding: 0; } .modal { width: 100%; max-height: 92vh; border-radius: 8px 8px 0 0; } .form-grid { grid-template-columns: 1fr; padding: 16px 20px; } .item-row { grid-template-columns: minmax(0, 1fr) 100px; } .remove-item { grid-column: 1 / -1; justify-self: end; min-height: 32px; } .wide, .form-error, .form-note { grid-column: 1; } }
</style>
