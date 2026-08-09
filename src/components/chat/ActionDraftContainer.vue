<script setup>
defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, required: true },
  titleId: { type: String, default: 'action-draft-title' },
  executing: { type: Boolean, default: false },
  confirmDisabled: { type: Boolean, default: false },
  confirmLabel: { type: String, required: true },
  width: { type: String, default: '520px' },
})

const emit = defineEmits(['close', 'confirm'])
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="action-draft-backdrop"
      @mousedown.self="emit('close')"
    >
      <section
        class="action-draft-modal"
        :style="{ '--action-draft-width': width }"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
      >
        <header class="action-draft-header">
          <div>
            <span>최종 확인</span>
            <h2 :id="titleId">{{ title }}</h2>
          </div>
          <button
            type="button"
            class="action-draft-close"
            :disabled="executing"
            aria-label="닫기"
            @click="emit('close')"
          >
            ×
          </button>
        </header>

        <form class="action-draft-form" @submit.prevent="emit('confirm')">
          <div class="action-draft-body">
            <slot />
          </div>

          <footer class="action-draft-footer">
            <button
              type="button"
              class="action-draft-secondary"
              :disabled="executing"
              @click="emit('close')"
            >
              닫기
            </button>
            <button
              type="submit"
              class="action-draft-primary"
              :disabled="confirmDisabled"
            >
              {{ confirmLabel }}
            </button>
          </footer>
        </form>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.action-draft-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: grid;
  place-items: center;
  padding:
    calc(20px + env(safe-area-inset-top, 0px))
    20px
    calc(20px + env(safe-area-inset-bottom, 0px));
  background: rgba(15, 23, 42, .42);
}

.action-draft-modal {
  width: min(var(--action-draft-width), 100%);
  max-height: calc(100vh - 40px);
  max-height: calc(
    100dvh - 40px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)
  );
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface-raised);
  box-shadow: 0 18px 48px rgba(15, 23, 42, .22);
}

.action-draft-header {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--color-border-light);
}

.action-draft-header span {
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 700;
}

.action-draft-header h2 {
  margin: 4px 0 0;
  color: var(--color-text);
  font-size: 18px;
  letter-spacing: 0;
}

.action-draft-close {
  border: 0;
  background: transparent;
  color: var(--color-subtle);
  font: inherit;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}

.action-draft-form {
  flex: 1;
  min-height: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}

.action-draft-body {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.action-draft-footer {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px 18px;
  border-top: 1px solid var(--color-border-light);
}

.action-draft-footer button {
  min-height: 38px;
  padding: 0 15px;
  border-radius: 6px;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
}

.action-draft-secondary {
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  color: var(--color-text);
  cursor: pointer;
}

.action-draft-primary {
  border: 1px solid var(--color-primary);
  background: var(--color-primary);
  color: var(--color-white);
  cursor: pointer;
}

.action-draft-footer button:disabled,
.action-draft-close:disabled {
  cursor: default;
  opacity: .55;
}

@media (max-width: 620px) {
  .action-draft-backdrop {
    align-items: end;
    padding: env(safe-area-inset-top, 0px) 0 0;
  }

  .action-draft-modal {
    width: 100%;
    max-height: calc(100dvh - env(safe-area-inset-top, 0px));
    border-radius: 8px 8px 0 0;
  }

  .action-draft-footer {
    padding-bottom: calc(18px + env(safe-area-inset-bottom, 0px));
  }

  .action-draft-body :deep(input),
  .action-draft-body :deep(textarea),
  .action-draft-body :deep(select) {
    font-size: 16px;
  }
}
</style>
