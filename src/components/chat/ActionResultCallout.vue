<script setup>
import { computed } from 'vue'

const props = defineProps({
  presentation: { type: Object, default: null },
  tone: { type: String, default: 'success' },
  title: { type: String, default: '' },
  fields: { type: Array, default: () => [] },
  compact: { type: Boolean, default: false },
})

const normalizedTone = computed(() => {
  const value = String(props.presentation?.tone || props.tone || 'info').toLowerCase()
  return ['success', 'rejected', 'error', 'info'].includes(value) ? value : 'info'
})
const normalizedTitle = computed(() => props.presentation?.title || props.title || '')
const normalizedFields = computed(() => {
  const source = Array.isArray(props.presentation?.fields)
    ? props.presentation.fields
    : props.fields
  return source.filter((field) => field?.value !== null && field?.value !== undefined && field.value !== '')
})
const toneLabel = computed(() => ({
  success: '처리 완료',
  rejected: '확인 필요',
  error: '처리 실패',
  info: '안내',
})[normalizedTone.value])
</script>

<template>
  <section
    v-if="normalizedTitle"
    class="action-result-callout"
    :class="[`tone-${normalizedTone}`, { compact }]"
    :role="normalizedTone === 'error' ? 'alert' : 'status'"
    aria-live="polite"
  >
    <header>
      <span>{{ toneLabel }}</span>
      <strong>{{ normalizedTitle }}</strong>
    </header>
    <dl v-if="normalizedFields.length">
      <div v-for="field in normalizedFields" :key="`${field.label}-${field.value}`">
        <dt>{{ field.label }}</dt>
        <dd :class="{ emphasized: field.emphasis }">{{ field.value }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.action-result-callout {
  --callout-accent: var(--color-primary);
  --callout-bg: var(--color-primary-soft);
  --callout-border: var(--color-primary-border-muted);
  display: grid;
  gap: 10px;
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px solid var(--callout-border);
  border-left: 4px solid var(--callout-accent);
  border-radius: 6px;
  background: var(--callout-bg);
  color: var(--color-text);
  font-size: 12px;
  line-height: 1.45;
}

.action-result-callout.tone-success {
  --callout-accent: var(--color-green);
  --callout-bg: var(--color-success-bg);
  --callout-border: var(--color-success-border);
}

.action-result-callout.tone-rejected {
  --callout-accent: var(--color-warning-text);
  --callout-bg: var(--color-warning-bg);
  --callout-border: var(--color-warning-border);
}

.action-result-callout.tone-error {
  --callout-accent: var(--color-danger);
  --callout-bg: var(--color-danger-bg);
  --callout-border: var(--color-danger-border);
}

.action-result-callout.compact {
  margin: 10px 12px;
  border: 1px solid var(--callout-border);
  border-left: 4px solid var(--callout-accent);
  border-radius: 6px;
}

header {
  display: grid;
  gap: 3px;
}

header span {
  color: var(--callout-accent);
  font-size: 10px;
  font-weight: 800;
}

header strong {
  font-size: 13px;
}

dl {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin: 0;
}

dl div {
  display: grid;
  gap: 2px;
  min-width: 88px;
}

dt,
dd {
  margin: 0;
}

dt {
  color: var(--color-subtle);
  font-size: 10px;
}

dd {
  overflow-wrap: anywhere;
}

dd.emphasized {
  color: var(--callout-accent);
  font-weight: 800;
}

@media (max-width: 520px) {
  .action-result-callout.compact {
    margin: 8px;
  }

  dl {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px 12px;
  }
}
</style>
