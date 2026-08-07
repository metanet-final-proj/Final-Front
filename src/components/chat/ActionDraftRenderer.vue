<script setup>
import { computed } from 'vue'
import ActionDraftCard from './ActionDraftCard.vue'
import SupplyActionDraftCard from './SupplyActionDraftCard.vue'
import VisitorParkingActionDraftCard from './VisitorParkingActionDraftCard.vue'

const props = defineProps({
  draft: { type: Object, required: true },
  loading: { type: Boolean, default: false },
  externalError: { type: [String, Object], default: '' },
})

const emit = defineEmits(['confirm', 'dismiss'])

const renderer = computed(() => {
  const actionType = String(props.draft?.actionType || '')
  if (actionType.startsWith('visitor_parking.')) return VisitorParkingActionDraftCard
  if (actionType.startsWith('supply.')) return SupplyActionDraftCard
  return ActionDraftCard
})
</script>

<template>
  <component
    :is="renderer"
    :draft="draft"
    :loading="loading"
    :external-error="externalError"
    @confirm="emit('confirm', $event)"
    @dismiss="emit('dismiss', $event)"
  />
</template>
