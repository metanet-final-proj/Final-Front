<script setup>
import { computed } from 'vue'
import ActionResultCallout from './ActionResultCallout.vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
  loadingItemId: { type: [String, Number], default: null },
  actionsEnabled: { type: Boolean, default: true },
  actionDraft: { type: Object, default: null },
})

const emit = defineEmits(['request'])
const visibleItems = computed(() => props.items.filter((item) => item?.itemId))
const completedPresentation = computed(() => (
  String(props.actionDraft?.status || '').toUpperCase() === 'COMPLETED'
    ? props.actionDraft?.presentation || null
    : null
))
const completedItemId = computed(() => completedPresentation.value
  ? props.actionDraft?.values?.itemId
  : null)

function stockText(item) {
  const stock = Number(item.stockQuantity ?? 0)
  return stock > 0 ? `${stock}개` : '품절'
}

function canRequest(item) {
  return String(item.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
    && Number(item.stockQuantity || 0) > 0
    && props.actionsEnabled
    && String(completedItemId.value || '') !== String(item.itemId)
}
</script>

<template>
  <section class="supply-card">
    <div class="card-heading">
      <strong>신청 가능한 사무용품</strong>
      <span>{{ visibleItems.length }}개 품목</span>
    </div>
    <p v-if="visibleItems.length === 0" class="empty">현재 신청 가능한 사무용품이 없습니다.</p>
    <div v-else class="table-wrap">
      <table>
        <thead><tr><th>품목</th><th>분류</th><th>재고</th><th><span class="sr-only">작업</span></th></tr></thead>
        <tbody>
          <tr v-for="item in visibleItems" :key="item.itemId">
            <td><strong>{{ item.itemName || '이름 없는 품목' }}</strong></td>
            <td>{{ item.category || '-' }}</td>
            <td :class="{ depleted: !canRequest(item) }">{{ stockText(item) }}</td>
            <td class="actions">
              <button
                type="button"
                :disabled="!canRequest(item) || String(loadingItemId || '') === String(item.itemId)"
                @click="emit('request', item)"
              >{{ String(completedItemId || '') === String(item.itemId) ? '신청 완료' : '신청하기' }}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <ActionResultCallout v-if="completedPresentation" :presentation="completedPresentation" compact />
  </section>
</template>

<style scoped>
.supply-card { margin-top: 12px; border: 1px solid var(--color-border); border-radius: 8px; overflow: hidden; }
.card-heading { display: flex; justify-content: space-between; gap: 12px; padding: 11px 13px; background: var(--color-surface-soft); font-size: 12px; }
.card-heading span, .empty { color: var(--color-subtle); }
.empty { margin: 0; padding: 14px; font-size: 12px; }
.table-wrap { width: 100%; overflow-x: auto; }
table { width: 100%; min-width: 520px; border-collapse: collapse; font-size: 11px; }
th, td { padding: 10px 11px; border-top: 1px solid var(--color-border-light); text-align: left; }
th { color: var(--color-subtle); background: var(--color-surface-raised); }
.depleted { color: var(--color-danger); }
.actions { text-align: right; white-space: nowrap; }
button { min-height: 30px; border: 0; border-radius: 5px; padding: 0 10px; background: var(--color-primary); color: white; font: inherit; font-weight: 700; cursor: pointer; }
button:disabled { cursor: default; opacity: .5; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }
@media (max-width: 680px) { table { min-width: 460px; font-size: 10px; } th, td { padding: 8px; } }
</style>
