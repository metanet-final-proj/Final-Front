<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useChatStore } from '../../stores/chatStore'

defineProps({
  activeRoomId: {
    type: [String, Number],
    default: null,
  },
  collapsed: {
    type: Boolean,
    default: false,
  },
  rooms: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['new-chat', 'room-deleted', 'select-room'])

const chatStore = useChatStore()
const editingRoomId = ref(null)
const editingTitle = ref('')
const roomActionMenuId = ref(null)
const roomActionMenuPlacement = ref('up')
const titleSaving = ref(false)
const timeTick = ref(Date.now())
const roomListRef = ref(null)

let timeTimer = null

const formatRelativeTime = (value) => {
  timeTick.value

  if (!value) return '방금 전'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '방금 전'

  const diffMs = Date.now() - date.getTime()
  const diffSeconds = Math.max(0, Math.floor(diffMs / 1000))
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)

  if (diffSeconds < 60) return '방금 전'
  if (diffMinutes < 60) return `${diffMinutes}분 전`
  if (diffHours < 24) return `${diffHours}시간 전`
  if (diffDays < 30) return `${diffDays}일 전`
  if (diffMonths < 12) return `${diffMonths}달 전`

  return `${diffYears}년 전`
}

const startEditRoomTitle = async (room) => {
  roomActionMenuId.value = null
  chatStore.setActiveConversation(room.id)
  editingRoomId.value = room.id
  editingTitle.value = room.title || ''

  await nextTick()

  const input = roomListRef.value?.querySelector?.(`[data-room-title-input="${room.id}"]`)
  input?.focus()
  input?.select()
}

const cancelEditRoomTitle = () => {
  editingRoomId.value = null
  editingTitle.value = ''
}

const toggleRoomActionMenu = (roomId, event) => {
  if (roomActionMenuId.value === roomId) {
    roomActionMenuId.value = null
    return
  }

  const trigger = event?.currentTarget
  const list = trigger?.closest?.('.room-list')
  const triggerRect = trigger?.getBoundingClientRect?.()
  const listRect = list?.getBoundingClientRect?.()
  const menuHeight = 98

  if (triggerRect && listRect) {
    const spaceAbove = triggerRect.top - listRect.top
    const spaceBelow = listRect.bottom - triggerRect.bottom
    roomActionMenuPlacement.value =
      spaceAbove < menuHeight && spaceBelow > spaceAbove ? 'down' : 'up'
  } else {
    roomActionMenuPlacement.value = 'up'
  }

  roomActionMenuId.value = roomId
}

const saveEditRoomTitle = async (room) => {
  if (!room || titleSaving.value) return

  const nextTitle = editingTitle.value.trim()

  if (!nextTitle || nextTitle === room.title) {
    cancelEditRoomTitle()
    return
  }

  titleSaving.value = true

  try {
    await chatStore.updateConversationTitle(room.id, nextTitle)
  } catch (error) {
    console.error('Failed to update chat conversation title:', error)
    window.alert('채팅방 이름 수정에 실패했습니다.')
  } finally {
    titleSaving.value = false
    cancelEditRoomTitle()
  }
}

const deleteChatRoom = async (roomId) => {
  if (!roomId || chatStore.deleting) return

  roomActionMenuId.value = null

  if (!window.confirm('이 채팅방을 삭제할까요?')) return

  try {
    await chatStore.deleteConversation(roomId)
    emit('room-deleted')
  } catch (error) {
    console.error('Failed to delete chat conversation:', error)
  }
}

onMounted(() => {
  timeTimer = window.setInterval(() => {
    timeTick.value = Date.now()
  }, 60 * 1000)
})

onBeforeUnmount(() => {
  if (timeTimer) window.clearInterval(timeTimer)
})
</script>

<template>
  <div v-if="!collapsed && chatStore.loading" class="room-loading">
    채팅을 불러오는 중입니다.
  </div>

  <div v-else-if="!collapsed && rooms.length === 0" class="room-empty">
    <p>아직 채팅이 없습니다.</p>
    <button type="button" @click="emit('new-chat')">첫 채팅 시작하기</button>
  </div>

  <div v-else-if="!collapsed" ref="roomListRef" class="room-list">
    <article
      v-for="room in rooms"
      :key="room.id"
      class="room-item"
      :class="{ active: room.id === activeRoomId, 'menu-open': roomActionMenuId === room.id }"
      @click="emit('select-room', room.id)"
    >
      <div class="room-select-body">
        <div class="room-top">
          <input
            v-if="editingRoomId === room.id"
            v-model="editingTitle"
            class="room-title-input"
            type="text"
            maxlength="255"
            :data-room-title-input="room.id"
            :disabled="titleSaving"
            @click.stop
            @blur="saveEditRoomTitle(room)"
            @keydown.enter.stop.prevent="saveEditRoomTitle(room)"
            @keydown.esc.stop.prevent="cancelEditRoomTitle"
          />
          <span v-else class="room-title-text">{{ room.title }}</span>
        </div>
      </div>

      <div class="room-actions" @click.stop>
        <span class="room-time">{{ formatRelativeTime(room.createdAt) }}</span>
        <button
          class="room-menu-button"
          type="button"
          aria-label="채팅방 메뉴 열기"
          :aria-expanded="roomActionMenuId === room.id"
          @click="toggleRoomActionMenu(room.id, $event)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        </button>

        <div
          v-if="roomActionMenuId === room.id"
          class="room-action-menu"
          :class="{ down: roomActionMenuPlacement === 'down' }"
        >
          <button class="room-action-item" type="button" @click="startEditRoomTitle(room)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
            </svg>
            <span>이름 변경</span>
          </button>

          <button class="room-action-item danger" type="button" @click="deleteChatRoom(room.id)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            <span>삭제</span>
          </button>
        </div>
      </div>
    </article>
  </div>
</template>

<style scoped>
.room-loading,
.room-empty {
  padding: 18px 10px;
  text-align: center;
  font-size: 12.5px;
  color: var(--color-muted);
}

.room-empty p {
  margin: 0 0 12px;
}

.room-empty button {
  border: none;
  background: var(--color-primary-light);
  color: var(--color-white);
  border-radius: 20px;
  padding: 10px 12px;
  font-size: 12.5px;
  font-weight: 800;
}

.room-list {
  max-height: 400px;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 4px;
  scrollbar-width: thin;
  scrollbar-color: var(--color-scrollbar) transparent;
}

.room-list::-webkit-scrollbar {
  width: 6px;
}

.room-list::-webkit-scrollbar-button {
  display: none;
  width: 0;
  height: 0;
}

.room-list::-webkit-scrollbar-thumb {
  background: var(--color-scrollbar);
  border-radius: 999px;
}

.room-list::-webkit-scrollbar-track {
  background: transparent;
}

.room-item {
  width: 100%;
  min-height: 50px;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 11px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  position: relative;
  cursor: pointer;
}

.room-item:hover {
  background: var(--color-surface-soft);
}

.room-item.active {
  border-color: var(--color-primary-light);
  background: var(--color-primary-soft);
}

.room-item.menu-open {
  z-index: 20;
}

.room-select-body {
  flex: 1;
  min-width: 0;
  padding: 8px 72px 8px 12px;
  border-radius: 11px;
}

.room-actions {
  position: absolute;
  top: 50%;
  right: 6px;
  transform: translateY(-50%);
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 4px;
}

.room-item.menu-open .room-actions {
  z-index: 25;
}

.room-menu-button {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--color-placeholder);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: background 0.15s ease, color 0.15s ease, opacity 0.15s ease;
}

.room-item:hover .room-menu-button,
.room-item:focus-within .room-menu-button,
.room-menu-button[aria-expanded='true'] {
  opacity: 1;
  pointer-events: auto;
}

.room-menu-button:hover,
.room-menu-button[aria-expanded='true'] {
  background: var(--color-surface-selected);
  color: var(--color-primary);
}

.room-action-menu {
  position: absolute;
  bottom: 28px;
  right: 0;
  z-index: 30;
  min-width: 128px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  border-radius: 10px;
  padding: 6px;
  box-shadow: 0 12px 28px rgba(var(--color-primary-rgb), 0.14);
}

.room-action-menu.down {
  top: 28px;
  bottom: auto;
}

.room-action-item {
  width: 100%;
  border: none;
  background: transparent;
  border-radius: 8px;
  padding: 8px 9px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-secondary);
  font-size: 12.5px;
  font-weight: 700;
  white-space: nowrap;
  text-align: left;
}

.room-action-item:hover {
  background: var(--color-surface-soft);
  color: var(--color-primary);
}

.room-action-item.danger {
  color: var(--color-danger);
}

.room-action-item.danger:hover {
  background: var(--color-danger-bg);
}

.room-top {
  display: flex;
  align-items: center;
  min-width: 0;
}

.room-title-text {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.room-item.active .room-title-text {
  color: var(--color-primary);
  font-weight: 700;
}

.room-title-input {
  flex: 1;
  min-width: 0;
  height: 26px;
  border: 1px solid var(--color-primary-light);
  background: var(--color-surface-raised);
  color: var(--color-text);
  border-radius: 7px;
  padding: 0 8px;
  font-size: 13px;
  font-weight: 700;
  outline: none;
}

.room-title-input:disabled {
  opacity: 0.65;
}

.room-time {
  font-size: 11px;
  line-height: 1;
  color: var(--color-placeholder);
  text-align: right;
  white-space: nowrap;
}
</style>
