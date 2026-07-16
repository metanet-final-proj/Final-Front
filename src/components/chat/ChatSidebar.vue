<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import chatbotLogo from '../../assets/images/officelink-logo3.svg'
import chatbotLogo2 from '../../assets/images/officelink-logo-nobg3.svg'
import { useAuthStore } from '../../stores/authStore'
import { useChatStore } from '../../stores/chatStore'
import { useWorkhubStore } from '../../stores/workhubStore'
import { useResponsiveSidebar } from '../../composables/useResponsiveSidebar'
import ChatRoomList from './ChatRoomList.vue'

defineProps({
  canAccessAdminDashboard: {
    type: Boolean,
    default: false,
  },
  isAnswering: {
    type: Boolean,
    default: false,
  },
  isDarkMode: {
    type: Boolean,
    default: false,
  },
  logoutLoading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits([
  'create-new-chat',
  'fill-draft',
  'logout',
  'open-admin',
  'open-mypage',
  'refresh-workhub',
  'room-deleted',
  'select-room',
  'toggle-theme',
  'toggle-panel',
])

const authStore = useAuthStore()
const chatStore = useChatStore()
const workhubStore = useWorkhubStore()

const {
  isMobile,
  presentation,
  open,
  close,
  toggle,
} = useResponsiveSidebar()

const mobileTriggerRef = ref(null)
const sidebarRef = ref(null)
const sidebarToggleRef = ref(null)
const profileMenuOpen = ref(false)
const sidebarSectionCollapsed = ref({
  rooms: false,
  shortcuts: true,
  faqs: true,
})

const rooms = computed(() => chatStore.rooms)
const roomCount = computed(() => rooms.value.length)
const shortcuts = computed(() => workhubStore.shortcuts)
const profileName = computed(() => authStore.displayName || authStore.user?.displayName || '사용자')
const profileInitial = computed(() => profileName.value.slice(0, 1))
const profileJobTitle = computed(() => authStore.jobTitle || authStore.employeeProfile?.jobTitle || '직원')
const profileDepartment = computed(() => authStore.department || authStore.employeeProfile?.department || '소속 정보 없음')
const profileEmail = computed(() => authStore.email || authStore.user?.email || '이메일 정보 없음')
const profileHeaderText = computed(() => `${profileName.value} ${profileJobTitle.value}`.trim())

const faqs = [
  {
    label: '회의실 예약하기 ›',
    query: '내일 오후 2시부터 3시까지 6명이 사용할 수 있는 회의실 예약하고 싶어',
  },
  {
    label: '방문객 주차 등록하기 ›',
    query: '방문객 주차 등록하고 싶어',
  },
  {
    label: '오늘 구내식당 메뉴 보기 ›',
    query: '오늘 모든 식당의 아침 점심 저녁 메뉴 알려줘',
  },
  {
    label: '비품 신청 현황 확인하기 ›',
    query: '내 비품 신청 현황 보여줘',
  },
]

const toggleSidebarSection = (section) => {
  sidebarSectionCollapsed.value[section] = !sidebarSectionCollapsed.value[section]
}

const toggleProfileMenu = () => {
  profileMenuOpen.value = !profileMenuOpen.value
}

const restoreMobileTriggerFocus = async () => {
  await nextTick()
  mobileTriggerRef.value?.focus()
}

const focusMobileTrigger = () => {
  if (!isMobile.value) return
  return restoreMobileTriggerFocus()
}

defineExpose({ focusMobileTrigger })

const closeMobileDrawer = async ({ restoreFocus = true } = {}) => {
  const wasOpen = presentation.value.isDrawerOpen
  close()
  profileMenuOpen.value = false

  if (wasOpen && restoreFocus) {
    await restoreMobileTriggerFocus()
  }
}

const openMobileDrawer = async () => {
  open()
  await nextTick()
  sidebarToggleRef.value?.focus()
}

const toggleSidebar = () => {
  if (isMobile.value) {
    closeMobileDrawer()
    return
  }

  toggle()
}

const emitAndClose = (eventName, payload) => {
  closeMobileDrawer({ restoreFocus: false })
  emit(eventName, payload)
}

const handleCreateNewChat = () => emitAndClose('create-new-chat')
const handleSelectRoom = (roomId) => emitAndClose('select-room', roomId)
const handleShortcut = (key) => emitAndClose('toggle-panel', key)
const handleFaq = (query) => emitAndClose('fill-draft', query)
const handleOpenMyPage = () => emitAndClose('open-mypage')
const handleOpenAdmin = () => emitAndClose('open-admin')
const handleLogout = () => emitAndClose('logout')
const handleRefresh = () => emit('refresh-workhub')
const handleRoomDeleted = () => emit('room-deleted')

const trapFocus = (event) => {
  if (!isMobile.value || !presentation.value.isDrawerOpen || event.key !== 'Tab') return

  const focusableElements = [...sidebarRef.value.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
  )].filter((element) => element.offsetParent !== null)

  if (focusableElements.length === 0) return

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

const handleDocumentKeydown = (event) => {
  if (event.key === 'Escape' && presentation.value.isDrawerOpen) {
    closeMobileDrawer()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleDocumentKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleDocumentKeydown)
})
</script>

<template>
  <button
    v-show="isMobile"
    ref="mobileTriggerRef"
    class="mobile-sidebar-trigger"
    type="button"
    aria-controls="chat-sidebar"
    :aria-expanded="presentation.isDrawerOpen"
    aria-label="사이드바 열기"
    @click="openMobileDrawer"
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="9" y1="4" x2="9" y2="20" />
      <path d="M14 9l3 3-3 3" />
    </svg>
  </button>

  <div
    v-if="presentation.isDrawerOpen"
    class="sidebar-backdrop"
    aria-hidden="true"
    @click="closeMobileDrawer"
  ></div>

  <aside
    id="chat-sidebar"
    ref="sidebarRef"
    class="sidebar"
    :class="{
      collapsed: presentation.showCollapsedRail,
      'mobile-open': presentation.isDrawerOpen,
    }"
    :aria-hidden="isMobile && !presentation.isDrawerOpen"
    :aria-modal="isMobile ? 'true' : undefined"
    :inert="isMobile && !presentation.isDrawerOpen"
    :role="isMobile ? 'dialog' : 'navigation'"
    aria-label="채팅 사이드바"
    @keydown="trapFocus"
  >
    <div class="sidebar-content">
    <template v-if="presentation.showCollapsedRail">
      <div class="collapsed-sidebar">
        <button
          class="sidebar-toggle-button"
          type="button"
          aria-label="사이드바 펼치기"
          @click="toggleSidebar"
        >
          <img
            class="collapsed-sidebar-logo"
            :src="chatbotLogo2"
            alt=""
            aria-hidden="true"
          />
          <svg
            class="collapsed-sidebar-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-text-secondary)"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <line x1="9" y1="4" x2="9" y2="20" />
            <path d="M14 9l3 3-3 3" />
          </svg>
        </button>

        <button
          class="collapsed-new-chat-button"
          type="button"
          aria-label="새 대화 시작"
          @click="handleCreateNewChat"
        >
          ＋
        </button>
      </div>
    </template>

    <template v-else>
      <div class="sidebar-top">
        <div class="sidebar-brand-row">
          <img
            class="sidebar-title-logo"
            :src="chatbotLogo"
            alt="Office Link"
          />

          <button
            class="sidebar-toggle-button"
            type="button"
            aria-label="사이드바 접기"
            @click="toggleSidebar"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-text-secondary)"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <line x1="9" y1="4" x2="9" y2="20" />
              <path d="M16 9l-3 3 3 3" />
            </svg>
          </button>
        </div>

        <button class="new-chat-button" type="button" @click="handleCreateNewChat">
          <span class="side-row-icon side-row-plus">＋</span>
          {{ chatStore.creating ? '생성 중...' : '새 대화 시작' }}
        </button>
      </div>

      <section
        class="side-card shortcut-card"
        :class="{ collapsed: sidebarSectionCollapsed.shortcuts }"
      >
        <div
          class="side-card-header"
          role="button"
          tabindex="0"
          :aria-expanded="!sidebarSectionCollapsed.shortcuts"
          @click="toggleSidebarSection('shortcuts')"
          @keydown.enter.prevent="toggleSidebarSection('shortcuts')"
          @keydown.space.prevent="toggleSidebarSection('shortcuts')"
        >
          <h2>
            <span class="side-row-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M0 0h24v24H0z" fill="none" />
                <path fill="currentColor" d="m10.95 18l5.65-5.65l-1.45-1.45l-4.225 4.225l-2.1-2.1L7.4 14.45zM6 22q-.825 0-1.412-.587T4 20V4q0-.825.588-1.412T6 2h8l6 6v12q0 .825-.587 1.413T18 22zm7-13V4H6v16h12V9zM6 4v5zv16z" />
              </svg>
            </span>
            오늘의 업무 바로가기
          </h2>
          <button
            class="side-refresh-button"
            type="button"
            :disabled="workhubStore.loading"
            aria-label="Refresh workhub sidebar"
            @click.stop="handleRefresh"
          >
            <svg
              :class="{ spinning: workhubStore.loading }"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M21 12a9 9 0 0 1-15.3 6.4" />
              <path d="M3 12A9 9 0 0 1 18.3 5.6" />
              <path d="M18 2v4h-4" />
              <path d="M6 22v-4h4" />
            </svg>
          </button>
          <span
            class="side-section-toggle"
            aria-hidden="true"
          >
            <svg
              class="side-section-chevron"
              :class="{ collapsed: sidebarSectionCollapsed.shortcuts }"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>

        <button
          v-if="!sidebarSectionCollapsed.shortcuts"
          v-for="item in shortcuts"
          :key="item.key"
          class="shortcut-item"
          type="button"
          :disabled="item.disabled || workhubStore.loading"
          @click="handleShortcut(item.key)"
        >
          <span>{{ item.label }}</span>
          <strong :class="item.tone">{{ item.value }} ›</strong>
        </button>
      </section>

      <section
        class="side-card faq-card"
        :class="{ collapsed: sidebarSectionCollapsed.faqs }"
      >
        <div
          class="side-card-header faq-card-header"
          role="button"
          tabindex="0"
          :aria-expanded="!sidebarSectionCollapsed.faqs"
          @click="toggleSidebarSection('faqs')"
          @keydown.enter.prevent="toggleSidebarSection('faqs')"
          @keydown.space.prevent="toggleSidebarSection('faqs')"
        >
          <h2 class="faq-title">
            <span class="side-row-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M0 0h24v24H0z" fill="none" />
                <path fill="currentColor" d="M12 3C6.49 3 2 7.49 2 13v6c0 .55.45 1 1 1h3c.55 0 1-.45 1-1v-5c0-.55-.45-1-1-1H4c0-4.41 3.59-8 8-8s8 3.59 8 8h-2c-.55 0-1 .45-1 1v5c0 .55.45 1 1 1h3c.55 0 1-.45 1-1v-6c0-5.51-4.49-10-10-10" />
              </svg>
            </span>
            자주 묻는 업무
          </h2>
          <span
            class="side-section-toggle"
            aria-hidden="true"
          >
            <svg
              class="side-section-chevron"
              :class="{ collapsed: sidebarSectionCollapsed.faqs }"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>

        <div v-if="!sidebarSectionCollapsed.faqs" class="faq-list">
          <button
            v-for="faq in faqs"
            :key="faq.label"
            type="button"
            :disabled="isAnswering"
            @click="handleFaq(faq.query)"
          >
            {{ faq.label }}
          </button>
        </div>
      </section>

      <section
        class="side-card room-card"
        :class="{ collapsed: sidebarSectionCollapsed.rooms }"
      >
        <div
          class="side-card-header"
          role="button"
          tabindex="0"
          :aria-expanded="!sidebarSectionCollapsed.rooms"
          @click="toggleSidebarSection('rooms')"
          @keydown.enter.prevent="toggleSidebarSection('rooms')"
          @keydown.space.prevent="toggleSidebarSection('rooms')"
        >
          <h2>
            <span class="side-row-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M0 0h24v24H0z" fill="none" />
                <path fill="currentColor" d="M4 20q-.825 0-1.412-.587T2 18V6q0-.825.588-1.412T4 4h16q.825 0 1.413.588T22 6v12q0 .825-.587 1.413T20 20zm8-7L4 8v10h16V8zm0-2l8-5H4zM4 8V6v12z" />
              </svg>
            </span>
            채팅 목록
          </h2>
          <span class="room-count">{{ roomCount }}개</span>
          <span class="side-section-toggle" aria-hidden="true">
            <svg
              class="side-section-chevron"
              :class="{ collapsed: sidebarSectionCollapsed.rooms }"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>

        <ChatRoomList
          :active-room-id="chatStore.activeConversationId"
          :collapsed="sidebarSectionCollapsed.rooms"
          :rooms="rooms"
          @new-chat="handleCreateNewChat"
          @room-deleted="handleRoomDeleted"
          @select-room="handleSelectRoom"
        />
      </section>

      <section class="guide-card">
        <h2>이용 안내</h2>
        <p>
          업무 관련 문의는 자유롭게 질문해 주세요. 개인정보는 안전하게 보호되며,
          부적절한 요청은 처리되지 않을 수 있습니다.
        </p>
        <button type="button">개인정보 처리방침 보기 ↗</button>
        <span>문의: 경영지원팀 02-1234-5678</span>
      </section>
    </template>
    </div>

    <div class="profile-area sidebar-profile-area" :class="{ collapsed: presentation.showCollapsedRail }">
      <button class="profile-box sidebar-profile-box" type="button" @click="toggleProfileMenu">
        <div class="profile-avatar">{{ profileInitial }}</div>

        <div class="profile-summary">
          <strong>{{ profileHeaderText }}</strong>
          <span>{{ profileDepartment }}</span>
        </div>

        <svg
          class="profile-chevron"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-muted)"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          :class="{ open: profileMenuOpen }"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <div v-if="profileMenuOpen" class="profile-menu">
        <div class="profile-menu-user">
          <div class="profile-menu-title-row">
            <strong>{{ profileHeaderText }}</strong>
            <button
              class="profile-theme-toggle"
              :class="{ dark: isDarkMode }"
              type="button"
              :aria-pressed="isDarkMode"
              :aria-label="isDarkMode ? '라이트 모드로 변경' : '다크 모드로 변경'"
              @click.stop="emit('toggle-theme')"
            >
              <span class="profile-theme-knob" aria-hidden="true">
                <svg v-if="isDarkMode" width="13" height="13" viewBox="0 0 30 30" fill="none">
                  <path
                    d="M18.8 22.8C12.8 22.8 8 18 8 12c0-2.1.6-4 1.6-5.7A9.9 9.9 0 1 0 23.7 20.4c-1.5 1.5-3.5 2.4-4.9 2.4Z"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linejoin="round"
                  />
                  <path d="M21.8 5.8l.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7.7-1.7Z" fill="currentColor" />
                </svg>
                <svg v-else width="14" height="14" viewBox="0 0 32 32" fill="none">
                  <circle cx="16" cy="16" r="6.5" stroke="currentColor" stroke-width="2" />
                  <path
                    d="M16 3.5v4M16 24.5v4M3.5 16h4M24.5 16h4M7.2 7.2l2.8 2.8M22 22l2.8 2.8M24.8 7.2 22 10M10 22l-2.8 2.8"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
              </span>
            </button>
          </div>

          <dl class="profile-detail-list">
            <div>
              <dt>소속</dt>
              <dd>{{ profileDepartment }}</dd>
            </div>

            <div>
              <dt>이메일</dt>
              <dd>{{ profileEmail }}</dd>
            </div>
          </dl>
        </div>

        <button
          v-if="canAccessAdminDashboard"
          class="mypage-button admin-dashboard-button"
          type="button"
          @click="handleOpenAdmin"
        >
          관리자 대시보드
        </button>

        <button
          class="mypage-button"
          type="button"
          @click="handleOpenMyPage"
        >
          마이페이지
        </button>

        <button
          class="logout-button"
          type="button"
          :disabled="logoutLoading"
          @click="handleLogout"
        >
          {{ logoutLoading ? '로그아웃 중...' : '로그아웃' }}
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.profile-area {
  position: relative;
}

.profile-box {
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 6px;
  border-radius: 10px;
}

.profile-box:hover {
  background: var(--color-bg);
}

.profile-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-primary);
  color: var(--color-white);
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.profile-summary {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  min-width: 0;
}

.profile-summary strong {
  max-width: 150px;
  font-size: 13px;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.profile-summary span {
  max-width: 150px;
  font-size: 11.5px;
  color: var(--color-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.profile-chevron {
  flex-shrink: 0;
  transition: transform 0.15s ease;
}

.profile-chevron.open {
  transform: rotate(180deg);
}

.profile-menu {
  position: absolute;
  top: 48px;
  right: 0;
  width: 270px;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  box-shadow: 0 18px 40px rgba(var(--color-primary-rgb), 0.14);
  padding: 12px;
  z-index: 60;
}

.profile-menu-user {
  padding: 8px 8px 12px;
  border-bottom: 1px solid var(--color-border-light);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.profile-menu-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.profile-menu-title-row > strong {
  min-width: 0;
  font-size: 14px;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-theme-toggle {
  width: 46px;
  height: 24px;
  flex: 0 0 46px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 2px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface-disabled);
  color: var(--color-text);
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease;
}

.profile-theme-toggle.dark {
  border-color: var(--color-markdown-pre-bg);
  background: var(--color-markdown-pre-bg);
  color: var(--color-white);
}

.profile-theme-knob {
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  display: grid;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  background: var(--color-toggle-knob);
  color: var(--color-text);
  box-shadow: 0 3px 8px rgba(var(--color-primary-rgb), 0.12);
  transform: translateX(0);
  transition: transform 0.18s ease, color 0.18s ease;
}

.profile-theme-toggle.dark .profile-theme-knob {
  color: var(--color-markdown-pre-bg);
  transform: translateX(22px);
}

.profile-detail-list {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.profile-detail-list div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.profile-detail-list dt {
  font-size: 11px;
  font-weight: 800;
  color: var(--color-subtle);
}

.profile-detail-list dd {
  margin: 0;
  font-size: 12.5px;
  color: var(--color-muted);
  word-break: break-all;
}

.logout-button {
  width: 100%;
  margin-top: 10px;
  border: none;
  background: var(--color-danger-bg);
  color: var(--color-danger);
  border-radius: 10px;
  padding: 11px 12px;
  font-size: 13px;
  font-weight: 800;
  text-align: left;
}

.mypage-button {
  width: 100%;
  margin-top: 10px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  color: var(--color-text);
  border-radius: 10px;
  padding: 11px 12px;
  font-size: 13px;
  font-weight: 800;
  text-align: left;
}

.admin-dashboard-button {
  border-color: var(--color-primary-border-soft);
  background: var(--color-surface-soft);
  color: var(--color-primary);
}

.mypage-button:hover {
  background: var(--color-bg);
}

.admin-dashboard-button:hover {
  background: var(--color-surface-hover);
}

.logout-button:hover {
  background: var(--color-danger-border);
}

.logout-button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}


.sidebar {
  width: 312px;
  flex-shrink: 0;
  height: auto;
  min-height: 0;
  margin-top: 0;
  align-self: stretch;
  position: relative;
  z-index: 10;
  background: var(--color-surface-raised);
  box-shadow:
    -100vw 0 0 100vw var(--color-surface-raised),
    inset -1px 0 0 var(--color-border-light);
  display: flex;
  flex-direction: column;
  overflow: visible;
  transition:
    width 0.2s ease,
    padding 0.2s ease;
  border-right: 1px solid var(--color-border);
}

.sidebar.collapsed {
  width: 50px;
  padding-right: 0;
  overflow: visible;
  align-items: center;
}

.sidebar-content {
  width: 100%;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 2px;
  scrollbar-width: thin;
  scrollbar-color: var(--color-scrollbar) transparent;
}

.sidebar-content::-webkit-scrollbar {
  width: 6px;
}

.sidebar-content::-webkit-scrollbar-button {
  display: none;
  width: 0;
  height: 0;
}

.sidebar-content::-webkit-scrollbar-thumb {
  background: var(--color-scrollbar);
  border-radius: 999px;
}

.sidebar-content::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar.collapsed .sidebar-content {
  align-items: center;
  padding-right: 0;
  overflow: hidden;
}

.collapsed-sidebar {
  width: 100%;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  padding: 8px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.sidebar-top {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  flex-shrink: 0;
  margin-bottom: 0;
}

.sidebar-brand-row {
  width: 100%;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.sidebar-title-logo {
  flex-shrink: 0;
}

.new-chat-button {
  width: calc(100% - 28px);
  flex: none;
  min-width: 0;
  height: 40px;
  margin: 0 14px;
  border: none;
  background: transparent;
  color: var(--color-text);
  font-size: 14px;
  font-weight: 700;
  border-radius: 10px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  white-space: nowrap;
}

.new-chat-button:hover {
  background: var(--color-bg);
}

.sidebar-toggle-button {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  border-radius: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar-toggle-button:hover {
  background: var(--color-surface-soft);
  border-color: var(--color-primary-light);
}

.sidebar-brand-row .sidebar-toggle-button {
  margin-right: 6px;
}

.collapsed-sidebar .sidebar-toggle-button {
  position: relative;
  overflow: hidden;
}

.collapsed-sidebar-logo,
.collapsed-sidebar-icon {
  position: absolute;
  inset: 50% auto auto 50%;
  transform: translate(-50%, -50%);
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.collapsed-sidebar-logo {
  width: 22px;
  height: 22px;
  object-fit: contain;
  opacity: 1;
}

.collapsed-sidebar-icon {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.92);
}

.collapsed-sidebar .sidebar-toggle-button:hover .collapsed-sidebar-logo,
.collapsed-sidebar .sidebar-toggle-button:focus-visible .collapsed-sidebar-logo {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.92);
}

.collapsed-sidebar .sidebar-toggle-button:hover .collapsed-sidebar-icon,
.collapsed-sidebar .sidebar-toggle-button:focus-visible .collapsed-sidebar-icon {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}

.collapsed-new-chat-button {
  width: 36px;
  height: 36px;
  border: none;
  background: var(--color-primary-light);
  color: var(--color-white);
  border-radius: 11px;
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
}

.collapsed-new-chat-button:hover {
  background: var(--color-primary);
}

.sidebar-profile-area {
  position: relative;
  width: 100%;
  flex-shrink: 0;
  background: var(--color-surface-raised);
  border-top: 1px solid rgba(var(--color-white-rgb), 0.9);
  padding: 10px 14px 8px 0;
  z-index: 50;
}

.sidebar-profile-box {
  width: 100%;
  min-width: 0;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  justify-content: flex-start;
  padding: 8px 10px;
}

.sidebar-profile-box:hover {
  background: var(--color-surface-soft);
  border-color: var(--color-border);
}

.sidebar-profile-area.collapsed {
  display: flex;
  justify-content: center;
  border-top: none;
  padding: 8px 0;
}

.sidebar-profile-area.collapsed .sidebar-profile-box {
  width: 36px;
  height: 36px;
  padding: 0;
  justify-content: center;
  border-radius: 11px;
}

.sidebar-profile-area.collapsed .profile-avatar {
  width: 28px;
  height: 28px;
  font-size: 12px;
}

.sidebar-profile-area.collapsed .profile-summary,
.sidebar-profile-area.collapsed .profile-chevron {
  display: none;
}

.sidebar-profile-area .profile-menu {
  top: auto;
  right: 14px;
  bottom: calc(100% + 10px);
}

.sidebar-profile-area.collapsed .profile-menu {
  right: auto;
  left: calc(100% + 10px);
  bottom: 12px;
}

.side-card,
.guide-card {
  flex-shrink: 0;
  background: var(--color-surface-raised);
  border: none;
  border-radius: var(--radius-lg);
}

.side-card {
  padding: 14px;
}

.room-card {
  margin-top: 14px;
}

.shortcut-card,
.faq-card {
  padding: 0 14px;
}

.shortcut-card:not(.collapsed),
.faq-card:not(.collapsed) {
  padding-bottom: 8px;
}

.side-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0;
  min-height: 40px;
  border-radius: 10px;
  padding: 0 10px;
  transition: background 0.15s ease;
}

.room-card .side-card-header,
.shortcut-card:not(.collapsed) .side-card-header,
.faq-card:not(.collapsed) .side-card-header {
  margin-bottom: 10px;
}

.side-card-header:hover {
  background: var(--color-bg);
}

.side-card-header:focus-visible {
  background: var(--color-bg);
  outline: 2px solid rgba(var(--color-focus-ring-rgb), 0.18);
  outline-offset: 1px;
}

.side-card h2,
.side-card-header h2,
.guide-card h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text);
}

.side-card-header h2 {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  line-height: 1;
}

.side-row-icon {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: currentColor;
  line-height: 1;
}

.side-row-icon svg {
  width: 16px;
  height: 16px;
  display: block;
}

.side-row-plus {
  font-size: 14px;
  font-weight: 800;
}

.side-card-header span {
  font-size: 12px;
  color: var(--color-subtle);
}

.side-card-header .room-count {
  margin-left: 8px;
}

.side-card-header h2 .side-row-icon {
  color: var(--color-text);
}

.side-refresh-button {
  width: 26px;
  height: 26px;
  margin-left: auto;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--color-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.55;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    opacity 0.15s ease;
}

.side-refresh-button:hover:not(:disabled),
.side-refresh-button:focus-visible {
  background: var(--color-bg);
  color: var(--color-primary);
  opacity: 1;
}

.side-refresh-button:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.side-refresh-button .spinning {
  animation: refreshSpin 0.9s linear infinite;
}

.side-refresh-button + .side-section-toggle {
  margin-left: 4px;
}

.side-section-toggle {
  width: 26px;
  height: 26px;
  margin-left: auto;
  color: var(--color-subtle);
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.35;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    opacity 0.15s ease;
}

.side-card-header:hover .side-section-toggle,
.side-card-header:focus-visible .side-section-toggle,
.side-card-header[aria-expanded='true'] .side-section-toggle {
  opacity: 1;
}

.side-card-header:hover .side-section-toggle,
.side-card-header:focus-visible .side-section-toggle {
  background: var(--color-bg);
  color: var(--color-primary);
}

.side-section-chevron {
  transition: transform 0.16s ease;
}

.side-section-chevron.collapsed {
  transform: rotate(-90deg);
}

@keyframes refreshSpin {
  to {
    transform: rotate(360deg);
  }
}

.shortcut-item {
  width: calc(100% - 16px);
  margin: 0 8px;
  border: none;
  border-bottom: 1px solid var(--color-divider-subtle);
  background: transparent;
  border-radius: 8px;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.shortcut-item:hover {
  background: var(--color-surface-soft);
}

.shortcut-item span {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.shortcut-item strong {
  font-size: 13px;
  color: var(--color-primary-light);
}

.shortcut-item strong.orange {
  color: var(--color-orange);
}

.faq-card .faq-title {
  margin: 0;
}

.faq-card-header {
  margin-bottom: 0;
}

.faq-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 10px;
}

.faq-list button {
  width: fit-content;
  max-width: 100%;
  text-align: left;
  border: 1px solid var(--color-panel-border);
  background: var(--color-surface-subtle);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12.5px;
  color: var(--color-text-secondary);
}

.faq-list button:hover {
  border-color: var(--color-primary-light);
  color: var(--color-primary);
}

.guide-card {
  background: var(--color-primary-soft);
  border-color: var(--color-primary-border-muted);
  padding: 18px;
}

.guide-card p {
  margin: 7px 0 0;
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.guide-card button {
  margin-top: 9px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-primary-light);
  font-size: 12px;
  font-weight: 700;
}

.guide-card span {
  display: block;
  margin-top: 10px;
  font-size: 11.5px;
  color: var(--color-subtle);
}

.faq-list button:disabled,
.faq-list button:disabled:hover {
  background: var(--color-surface-muted);
  border-color: var(--color-disabled-border);
  color: var(--color-placeholder-strong);
  cursor: not-allowed;
  opacity: 1;
}





.sidebar-title-logo {
  width: 50px;
  height: auto;
  display: block;
  transform: translateX(15px);
}

.mobile-sidebar-trigger,
.sidebar-backdrop {
  display: none;
}

@media (max-width: 1100px) {
  .sidebar:not(.collapsed) {
    width: 280px;
  }
}

@media (max-width: 820px) {
  .mobile-sidebar-trigger {
    position: fixed;
    top: calc(env(safe-area-inset-top, 0px) + 20px);
    left: 18px;
    z-index: 50;
    width: 38px;
    height: 30px;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    background: var(--color-surface-raised);
    color: var(--color-text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 6px 16px rgba(var(--color-primary-rgb), 0.1);
  }

  .sidebar-backdrop {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: block;
    background: rgba(14, 17, 24, 0.44);
    backdrop-filter: blur(2px);
  }

  .sidebar,
  .sidebar:not(.collapsed) {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 70;
    width: min(320px, 88vw);
    height: 100dvh;
    margin: 0;
    transform: translateX(-105%);
    box-shadow: 20px 0 48px rgba(14, 17, 24, 0.2);
    transition: transform 0.22s ease;
  }

  .sidebar.mobile-open {
    transform: translateX(0);
  }

  .sidebar-content {
    padding-top: calc(env(safe-area-inset-top, 0px) + 16px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sidebar {
    transition: none;
  }
}
</style>
