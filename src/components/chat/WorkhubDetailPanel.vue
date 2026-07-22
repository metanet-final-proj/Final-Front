<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  panel: {
    type: Object,
    default: null,
  },
  actionLoading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['action', 'close', 'manage'])

const isMobile = ref(false)
const panelRef = ref(null)
const closeButtonRef = ref(null)
let mobileMediaQuery = null

const panelItems = computed(() => props.panel?.items || [])
const isMenuPanel = computed(() => props.panel?.key === 'menu')
const hasManageAction = computed(() => Boolean(props.panel?.manageActionQuery))
const panelTitleId = computed(() => `workhub-panel-${props.panel?.key || 'detail'}-title`)

const parseMealMenus = (description = '') => {
  const mealLabels = ['아침', '점심', '저녁']

  return mealLabels.map((label, index) => {
    const nextLabel = mealLabels[index + 1]
    const pattern = nextLabel
      ? new RegExp(`${label}:\\s*(.*?)\\s*/\\s*${nextLabel}:`)
      : new RegExp(`${label}:\\s*(.*)$`)
    const match = description.match(pattern)
    const menu = match?.[1]?.trim() || '-'

    return {
      label,
      menu,
      empty: menu === '-',
    }
  })
}

const focusCloseButton = async () => {
  if (!props.panel || !isMobile.value) return
  await nextTick()
  closeButtonRef.value?.focus()
}

const syncMobileViewport = () => {
  isMobile.value = mobileMediaQuery?.matches || false
}

const handlePanelKeydown = (event) => {
  if (!isMobile.value || !props.panel) return

  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }

  if (event.key !== 'Tab') return

  const focusableElements = [...panelRef.value.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => element.offsetParent !== null)

  if (focusableElements.length === 0) {
    event.preventDefault()
    panelRef.value.focus()
    return
  }

  const firstElement = focusableElements[0]
  const lastElement = focusableElements.at(-1)

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault()
    lastElement.focus()
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault()
    firstElement.focus()
  }
}

watch(() => props.panel, focusCloseButton)
watch(isMobile, focusCloseButton)

onMounted(() => {
  mobileMediaQuery = window.matchMedia('(max-width: 820px)')
  syncMobileViewport()
  mobileMediaQuery.addEventListener('change', syncMobileViewport)
  focusCloseButton()
})

onBeforeUnmount(() => {
  mobileMediaQuery?.removeEventListener('change', syncMobileViewport)
})
</script>

<template>
  <Transition name="workhub-detail">
    <div v-if="panel" class="workhub-detail-layer">
      <button
        class="detail-backdrop"
        type="button"
        tabindex="-1"
        aria-label="업무 상세 패널 닫기"
        @click="emit('close')"
      ></button>

      <aside
        ref="panelRef"
        class="detail-panel"
        tabindex="-1"
        :role="isMobile ? 'dialog' : 'complementary'"
        :aria-modal="isMobile ? 'true' : undefined"
        :aria-labelledby="panelTitleId"
        @keydown="handlePanelKeydown"
      >
        <div class="detail-header">
          <h2 :id="panelTitleId">{{ panel.title }}</h2>
          <span>{{ panel.badge }}</span>

          <button
            ref="closeButtonRef"
            type="button"
            aria-label="업무 상세 패널 닫기"
            @click="emit('close')"
          >
            ×
          </button>
        </div>

        <div class="detail-content">
          <article
            v-for="(item, index) in panelItems"
            :key="`${panel.key}-${item.title}-${item.meta}-${index}`"
            class="panel-item"
          >
            <div class="panel-item-top">
              <h3>{{ item.title }}</h3>
              <span
                v-if="item.badge"
                class="panel-badge"
                :class="item.tone"
              >
                {{ item.badge }}
              </span>
            </div>

            <div v-if="isMenuPanel" class="meal-menu-list">
              <div
                v-for="meal in parseMealMenus(item.desc)"
                :key="`${item.title}-${meal.label}`"
                class="meal-menu-row"
                :class="{ empty: meal.empty }"
              >
                <span class="meal-label">{{ meal.label }}</span>
                <strong>{{ meal.menu }}</strong>
              </div>
            </div>
            <p v-else>{{ item.desc }}</p>
            <small>{{ item.meta }}</small>
          </article>

          <div v-if="panelItems.length === 0" class="empty-panel" role="status">
            <div aria-hidden="true">⌕</div>
            <p>{{ panel.emptyText }}</p>
          </div>
        </div>

        <div class="detail-footer">
          <button
            v-if="hasManageAction"
            type="button"
            class="secondary"
            :disabled="actionLoading"
            @click="emit('manage')"
          >
            {{ panel.manageActionLabel }}
          </button>
          <button
            type="button"
            class="primary"
            :disabled="actionLoading"
            @click="emit('action')"
          >
            {{ actionLoading ? '처리 중...' : panel.actionLabel }}
          </button>
        </div>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
.workhub-detail-layer {
  width: 336px;
  min-width: 0;
  flex-shrink: 0;
  display: flex;
}

.detail-backdrop {
  display: none;
}

.detail-panel {
  width: 100%;
  min-width: 0;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  outline: none;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 18px 14px;
  border-bottom: 1px solid var(--color-border-light);
}

.detail-header h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  color: var(--color-primary);
}

.detail-header > span {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--color-primary-light);
  background: var(--color-primary-soft);
  border: 1px solid var(--color-primary-border-muted);
  border-radius: 999px;
  padding: 3px 10px;
}

.detail-header button {
  margin-left: auto;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--color-muted);
  font-size: 20px;
  line-height: 1;
}

.detail-header button:hover,
.detail-header button:focus-visible {
  background: var(--color-bg);
}

.detail-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel-item {
  border: 1px solid var(--color-panel-border);
  background: var(--color-surface-subtle);
  border-radius: 12px;
  padding: 14px 15px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.panel-item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.panel-item h3 {
  margin: 0;
  font-size: 13.5px;
  font-weight: 800;
  color: var(--color-text);
}

.panel-item p {
  margin: 0;
  font-size: 12.5px;
  color: var(--color-text-secondary);
  line-height: 1.55;
}

.meal-menu-list {
  display: grid;
  gap: 8px;
  margin-top: 2px;
}

.meal-menu-row {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  align-items: start;
  gap: 8px;
  border: 1px solid var(--color-panel-border-soft);
  border-radius: 8px;
  background: var(--color-meal-bg);
  padding: 8px 9px;
}

.meal-menu-row.empty {
  background: var(--color-meal-empty-bg);
}

.meal-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 22px;
  border-radius: 6px;
  background: var(--color-meal-label-bg);
  color: var(--color-meal-label-text);
  font-size: 11px;
  font-weight: 800;
}

.meal-menu-row strong {
  min-width: 0;
  color: var(--color-meal-text);
  font-size: 12.5px;
  font-weight: 700;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.meal-menu-row.empty .meal-label {
  background: var(--color-meal-empty-label-bg);
  color: var(--color-meal-empty-label-text);
}

.meal-menu-row.empty strong {
  color: var(--color-meal-empty-text);
  font-weight: 600;
}

.panel-item small {
  font-size: 11.5px;
  color: var(--color-subtle);
}

.panel-badge {
  flex-shrink: 0;
  border-radius: 999px;
  padding: 3px 9px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.panel-badge.blue {
  color: var(--color-primary-light);
  background: var(--color-primary-soft);
  border: 1px solid var(--color-primary-border-muted);
}

.panel-badge.green {
  color: var(--color-green);
  background: var(--color-success-bg);
  border: 1px solid var(--color-success-border);
}

.panel-badge.yellow {
  color: var(--color-warning-text);
  background: var(--color-warning-bg);
  border: 1px solid var(--color-warning-border);
}

.panel-badge.gray {
  color: var(--color-muted);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
}

.empty-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 34px 0 26px;
  text-align: center;
}

.empty-panel div {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: var(--color-bg);
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-panel p {
  margin: 0;
  font-size: 13px;
  color: var(--color-muted);
  white-space: pre-line;
}

.detail-footer {
  flex-shrink: 0;
  display: grid;
  gap: 8px;
  padding: 14px 18px 18px;
  border-top: 1px solid var(--color-border-light);
  background: var(--color-surface-raised);
}

.detail-footer button {
  width: 100%;
  border: none;
  border: 1px solid transparent;
  font-size: 13.5px;
  font-weight: 700;
  border-radius: 11px;
  padding: 12px;
}

.detail-footer .primary {
  background: var(--color-primary-light);
  color: var(--color-white);
}

.detail-footer .secondary {
  border-color: var(--color-primary-border-muted);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.detail-footer .primary:hover:not(:disabled) {
  background: var(--color-primary);
}

.detail-footer .secondary:hover:not(:disabled) {
  border-color: var(--color-primary-light);
  background: var(--color-surface-hover);
  color: var(--color-primary-light);
}

.detail-footer button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.workhub-detail-enter-active,
.workhub-detail-leave-active {
  transition: opacity 0.2s ease;
}

.workhub-detail-enter-from,
.workhub-detail-leave-to {
  opacity: 0;
}

@media (max-width: 1100px) {
  .workhub-detail-layer {
    width: 300px;
  }
}

@media (max-width: 820px) {
  .workhub-detail-layer {
    position: fixed;
    inset: 0;
    z-index: 80;
    width: auto;
    align-items: flex-end;
    justify-content: center;
    padding-top: calc(env(safe-area-inset-top, 0px) + 8px);
  }

  .detail-backdrop {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    padding: 0;
    border: none;
    border-radius: 0;
    background: rgba(14, 17, 24, 0.48);
    backdrop-filter: blur(2px);
  }

  .detail-panel {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 640px;
    max-height: min(88dvh, 720px);
    border-radius: 18px 18px 0 0;
    border-bottom: none;
    box-shadow: 0 -18px 48px rgba(14, 17, 24, 0.2);
  }

  .detail-header {
    flex-shrink: 0;
    padding: 16px;
  }

  .detail-content {
    padding: 16px;
    overscroll-behavior: contain;
  }

  .detail-footer {
    padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  }

  .workhub-detail-enter-from .detail-panel,
  .workhub-detail-leave-to .detail-panel {
    transform: translateY(100%);
  }

  .workhub-detail-enter-active .detail-panel,
  .workhub-detail-leave-active .detail-panel {
    transition: transform 0.22s ease;
  }
}

@media (max-width: 360px) {
  .detail-panel {
    max-height: calc(100dvh - env(safe-area-inset-top, 0px) - 8px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .workhub-detail-enter-active,
  .workhub-detail-leave-active,
  .workhub-detail-enter-active .detail-panel,
  .workhub-detail-leave-active .detail-panel {
    transition: none;
  }
}
</style>
