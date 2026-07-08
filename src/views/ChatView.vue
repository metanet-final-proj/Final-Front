<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import chatbotLogo from '../assets/images/officelink-logo.svg'
import { useAuthStore } from '../stores/authStore'
import { useChatStore } from '../stores/chatStore'
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import officeLinkTitle from '../assets/images/officelink-logo-title-wide-nobg.svg'

const router = useRouter()
const authStore = useAuthStore()
const chatStore = useChatStore()

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
})

const renderMarkdown = (text) => {
  if (!text) return ''

  const html = markdown.render(String(text))

  return DOMPurify.sanitize(html, {
    USE_PROFILES: {
      html: true,
    },
  })
}

const draft = ref('')
const panelKey = ref(null)
const threadRef = ref(null)
const composerInputRef = ref(null)
const sidebarCollapsed = ref(false)
const profileMenuOpen = ref(false)
const logoutLoading = ref(false)
const businessActionLoading = ref(false)
const composingNewChat = ref(true)

const editingRoomId = ref(null)
const editingTitle = ref('')
const roomActionMenuId = ref(null)
const roomActionMenuPlacement = ref('up')
const titleSaving = ref(false)
const timeTick = ref(Date.now())

let timeTimer = null

const resizeComposer = async () => {
  await nextTick()

  const textarea = composerInputRef.value
  if (!textarea) return

  const maxHeight = 80

  textarea.style.height = 'auto'
  textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`
  textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden'
}

watch(
  draft,
  () => {
    resizeComposer()
  },
  {
    flush: 'post',
  },
)

const shortcuts = [
  {
    key: 'meetings',
    label: '오늘 회의 일정',
    value: '2건',
    tone: 'blue',
  },
  {
    key: 'reservations',
    label: '회의실 예약 현황',
    value: '1건',
    tone: 'blue',
  },
  {
    key: 'parking',
    label: '내 주차 등록 현황',
    value: '0건',
    tone: 'blue',
  },
  {
    key: 'menu',
    label: '구내식당 메뉴',
    value: '오늘 돈까스',
    tone: 'orange',
  },
  {
    key: 'supplies',
    label: '비품 신청 현황',
    value: '1건',
    tone: 'blue',
  },
]

const faqs = [
  {
    label: '회의실 예약 및 변경/취소 방법 ›',
    query: '회의실 예약 및 변경/취소 방법 알려줘',
  },
  {
    label: '방문객 주차 등록은 언제까지 가능한가요? ›',
    query: '방문객 주차 등록은 언제까지 가능해?',
  },
  {
    label: '구내식당 운영시간은 어떻게 되나요? ›',
    query: '구내식당 운영시간 알려줘',
  },
  {
    label: '비품은 얼마나 걸려서 받을 수 있나요? ›',
    query: '비품은 얼마나 걸려서 받을 수 있어?',
  },
]

const starterCards = [
  {
    icon: '📅',
    title: '회의실 예약',
    desc: '시간과 인원을 기준으로 회의실을 찾아볼게요.',
    query: '내일 오후 2시에 6명이 사용할 수 있는 회의실 예약하고 싶어',
  },
  {
    icon: '🚗',
    title: '방문객 주차 등록',
    desc: '방문 일시와 차량 정보를 기준으로 등록을 도와드릴게요.',
    query: '방문객 주차 등록하고 싶어',
  },
  {
    icon: '🍽️',
    title: '구내식당 메뉴',
    desc: '오늘 메뉴와 운영시간을 확인해볼게요.',
    query: '오늘 구내식당 메뉴와 운영시간 알려줘',
  },
  {
    icon: '📦',
    title: '비품 신청',
    desc: '필요한 비품 신청 방법을 안내해드릴게요.',
    query: 'A4 용지와 볼펜 비품 신청하고 싶어',
  },
  {
    icon: '📄',
    title: '사내 규정 검색',
    desc: '휴가, 복리후생, 총무 규정을 찾아볼게요.',
    query: '연차 사용 규정 알려줘',
  },
]

const panels = {
  meetings: {
    title: '오늘 회의 일정',
    badge: '2건',
    actionLabel: '회의실 예약하기',
    actionQuery: '회의실 예약하고 싶어',
    items: [
      {
        title: '주간 업무 회의',
        desc: '10:00 – 11:00 · 중회의실2 (8석)',
        meta: '참석 6명 · 주최 박성호 팀장',
        badge: '완료',
        tone: 'gray',
      },
      {
        title: '신규 프로젝트 킥오프',
        desc: '15:00 – 16:00 · 대회의실 (20석)',
        meta: '참석 12명 · 주최 이수진 부장',
        badge: '예정',
        tone: 'blue',
      },
    ],
  },
  reservations: {
    title: '회의실 예약 현황',
    badge: '1건',
    actionLabel: '새 회의실 예약',
    actionQuery: '회의실 예약하고 싶어',
    items: [
      {
        title: '회의실 A (12석)',
        desc: '7월 3일(금) 14:00 – 15:00',
        meta: '예약자: 김지현 대리 · 경영지원팀',
        badge: '확정',
        tone: 'green',
      },
    ],
  },
  parking: {
    title: '내 주차 등록 현황',
    badge: '0건',
    actionLabel: '방문객 주차 등록',
    actionQuery: '방문객 주차 등록하고 싶어',
    emptyText: '등록된 주차 내역이 없습니다.\n방문객 주차를 등록해 보세요.',
    items: [],
  },
  menu: {
    title: '구내식당 메뉴',
    badge: '오늘',
    actionLabel: '실시간 혼잡도 확인',
    actionQuery: '구내식당 지금 혼잡해?',
    items: [
      {
        title: '중식 A코스',
        desc: '돈까스 · 된장찌개 · 잡곡밥 · 샐러드',
        meta: '11:30 – 13:30',
        badge: '혼잡도 보통',
        tone: 'yellow',
      },
      {
        title: '중식 B코스',
        desc: '제육볶음 · 미역국 · 쌀밥 · 김치',
        meta: '11:30 – 13:30',
        badge: '혼잡도 여유',
        tone: 'green',
      },
      {
        title: '석식',
        desc: '치킨마요덮밥 · 우동 · 단무지',
        meta: '17:30 – 19:00',
        badge: '준비 중',
        tone: 'gray',
      },
    ],
  },
  supplies: {
    title: '비품 신청 현황',
    badge: '1건',
    actionLabel: '비품 신청하기',
    actionQuery: '비품 신청 방법 알려줘',
    items: [
      {
        title: 'A4 용지 (2박스)',
        desc: '신청일 7월 1일 · 경영지원팀 검토',
        meta: '예상 수령일 7월 3일(금)',
        badge: '결재 진행 중',
        tone: 'yellow',
      },
    ],
  },
}

const redirectToLogin = async () => {
  if (typeof authStore.clearAuth === 'function') {
    authStore.clearAuth()
  }

  router.replace({
    path: '/login',
    query: {
      redirect: router.currentRoute.value.fullPath,
    },
  })
}

const ensureUserContext = async () => {
  try {
    if (
      authStore.isAuthenticated &&
      typeof authStore.fetchUserContext === 'function' &&
      (!authStore.user || !authStore.employeeProfile)
    ) {
      await authStore.fetchUserContext()
    }

    if (!authStore.user || !authStore.employeeProfile) {
      await redirectToLogin()
      return false
    }

    return true
  } catch (error) {
    console.warn('사용자 인증 정보 조회 실패:', error)
    await redirectToLogin()
    return false
  }
}

const rooms = computed(() => chatStore.rooms)

const activeRoomId = computed(() => chatStore.activeConversationId)

const activeRoom = computed(() => chatStore.activeRoom)

const activeMessages = computed(() => {
  if (composingNewChat.value) return []

  return activeRoom.value?.messages || []
})

const DEFAULT_ASSISTANT_PROMPTS = ['무엇을 도와드릴까요?', '무엇을 도와드릴까요']

const isDefaultAssistantPrompt = (message) => {
  const role = String(message?.role || '').toLowerCase()
  const text = String(message?.text || message?.content || '').trim()

  return role === 'assistant' && DEFAULT_ASSISTANT_PROMPTS.includes(text)
}

const visibleMessages = computed(() => {
  return activeMessages.value.filter((message) => !isDefaultAssistantPrompt(message))
})

const normalizeId = (value) => {
  if (value === null || value === undefined) return ''
  return String(value)
}

const extractConversationId = (payload) => {
  const candidates = [
    payload?.conversationId,
    payload?.conversation_id,
    payload?.id,
    payload?.data?.conversationId,
    payload?.data?.conversation_id,
    payload?.data?.id,
    payload?.data?.data?.conversationId,
    payload?.data?.data?.conversation_id,
    payload?.data?.data?.id,
    payload?.conversation?.conversationId,
    payload?.conversation?.conversation_id,
    payload?.conversation?.id,
    payload?.data?.conversation?.conversationId,
    payload?.data?.conversation?.conversation_id,
    payload?.data?.conversation?.id,
  ]

  return candidates.find((candidate) => {
    return candidate !== null && candidate !== undefined && candidate !== ''
  })
}

const resetMessagesForConversation = (conversationId) => {
  if (!conversationId || !chatStore.messagesByConversationId) return

  const key = String(conversationId)

  chatStore.messagesByConversationId = {
    ...chatStore.messagesByConversationId,
    [key]: [],
  }
}

const showWelcome = computed(() => {
  if (chatStore.loading || chatStore.messagesLoading) {
    return false
  }

  return composingNewChat.value || visibleMessages.value.length === 0
})

const currentPanel = computed(() => {
  if (!panelKey.value) return null
  return panels[panelKey.value] || null
})

const roomCount = computed(() => rooms.value.length)

const profileName = computed(() => {
  return authStore.displayName || authStore.user?.displayName || '사용자'
})

const profileInitial = computed(() => {
  return profileName.value.slice(0, 1)
})

const profileJobTitle = computed(() => {
  return authStore.jobTitle || authStore.employeeProfile?.jobTitle || '직원'
})

const profileDepartment = computed(() => {
  return authStore.department || authStore.employeeProfile?.department || '소속 정보 없음'
})

const profileEmail = computed(() => {
  return authStore.email || authStore.user?.email || '이메일 정보 없음'
})

const profileHeaderText = computed(() => {
  return `${profileName.value} ${profileJobTitle.value}`.trim()
})

const isAnswering = computed(() => {
  return chatStore.sending
})

const nowTime = () => {
  const date = new Date()
  const hour = date.getHours()
  const minute = String(date.getMinutes()).padStart(2, '0')
  const period = hour < 12 ? '오전' : '오후'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12

  return `${period} ${String(displayHour).padStart(2, '0')}:${minute}`
}

const formatRelativeTime = (value) => {
  timeTick.value

  if (!value) return '방금 전'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '방금 전'
  }

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

const scrollThread = async () => {
  await nextTick()

  if (threadRef.value) {
    threadRef.value.scrollTop = threadRef.value.scrollHeight
  }
}

const fillDraftFromStarter = async (query) => {
  if (isAnswering.value) return

  draft.value = query

  await nextTick()

  if (composerInputRef.value) {
    composerInputRef.value.focus()
  }
}

let scrollAnimationFrameId = null

const requestScrollThread = () => {
  if (scrollAnimationFrameId) return

  scrollAnimationFrameId = window.requestAnimationFrame(async () => {
    scrollAnimationFrameId = null
    await scrollThread()
  })
}

const selectRoom = async (roomId) => {
  composingNewChat.value = false
  roomActionMenuId.value = null
  chatStore.setActiveConversation(roomId)

  try {
    await chatStore.fetchMessages(roomId)
    await scrollThread()
  } catch (error) {
    console.error('Failed to fetch chat messages:', error)
  }
}

const ensureActiveConversation = async (initialMessage = '') => {
  if (activeRoomId.value && !composingNewChat.value) {
    return activeRoomId.value
  }

  return createNewChat(initialMessage)
}

const sendMessage = async (text = draft.value) => {
  const messageText = text.trim()

  if (!messageText || isAnswering.value) return

  let conversationId

  try {
    conversationId = await ensureActiveConversation(messageText)
  } catch (error) {
    console.error('Failed to create conversation before sending:', error)
    return
  }

  if (!conversationId) return

  const currentRoomTitle = activeRoom.value?.title

  draft.value = ''
  try {
    await chatStore.sendMessage(conversationId, messageText)

    if (
      currentRoomTitle === '새 채팅' ||
      currentRoomTitle === '새 대화' ||
      !currentRoomTitle
    ) {
      chatStore.updateConversationTitle(conversationId, messageText.slice(0, 18))
        .catch((error) => {
          console.error('Failed to update conversation title:', error)
        })
    }

    await scrollThread()
  } catch (error) {
    console.error('Failed to send chat message:', error)
  } finally {
    await scrollThread()
  }
}

const handleComposerKeydown = (event) => {
  if (event.key !== 'Enter') return

  if (event.shiftKey) {
    return
  }

  event.preventDefault()
  sendMessage()
}

const createNewChat = async (initialTitle = '') => {
  const titleText = typeof initialTitle === 'string' ? initialTitle.trim() : ''

  if (!titleText) {
    composingNewChat.value = true
    chatStore.setActiveConversation(null)
    panelKey.value = null
    draft.value = ''

    await nextTick()

    if (composerInputRef.value) {
      composerInputRef.value.focus()
    }

    return null
  }

  if (chatStore.creating) return null

  try {
    const previousConversationId = activeRoomId.value

    const conversation = await chatStore.createConversation({
      chatType: 'GENERAL',
      title: titleText.slice(0, 255),
    })

    await nextTick()

    const conversationId =
      extractConversationId(conversation) ||
      (normalizeId(activeRoomId.value) !== normalizeId(previousConversationId)
        ? activeRoomId.value
        : null)

    if (conversationId) {
      composingNewChat.value = false
      chatStore.setActiveConversation(conversationId)
      resetMessagesForConversation(conversationId)
    } else {
      console.warn('Created conversation id was not found:', conversation)
    }

    panelKey.value = null
    draft.value = ''

    await nextTick()

    if (composerInputRef.value) {
      composerInputRef.value.focus()
    }

    await scrollThread()

    return conversationId
  } catch (error) {
    console.error('Failed to create chat conversation:', error)
    throw error
  }
}

const deleteChatRoom = async (roomId) => {
  if (!roomId || chatStore.deleting) return
  roomActionMenuId.value = null

  const ok = window.confirm('이 채팅방을 삭제할까요?')

  if (!ok) return

  try {
    await chatStore.deleteConversation(roomId)
    draft.value = ''
    await scrollThread()
  } catch (error) {
    console.error('Failed to delete chat conversation:', error)
  }
}

const startEditRoomTitle = async (room) => {
  roomActionMenuId.value = null
  chatStore.setActiveConversation(room.id)

  editingRoomId.value = room.id
  editingTitle.value = room.title || ''

  await nextTick()

  const input = document.querySelector(`[data-room-title-input="${room.id}"]`)

  if (input) {
    input.focus()
    input.select()
  }
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

  if (!nextTitle) {
    cancelEditRoomTitle()
    return
  }

  if (nextTitle === room.title) {
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

const togglePanel = (key) => {
  panelKey.value = panelKey.value === key ? null : key
}

const closePanel = () => {
  panelKey.value = null
}

const runPanelAction = async () => {
  if (!currentPanel.value || businessActionLoading.value) return

  businessActionLoading.value = true

  try {
    // TODO: 업무 처리용 백엔드 API가 연결되면 이 부분을 businessApi 호출로 교체
    // 예: await businessApi.createMeetingRoomReservation(...)
    // 현재는 임시로 패널 액션을 채팅 메시지로 전달
    const query = currentPanel.value.actionQuery
    closePanel()
    await sendMessage(query)
  } catch (error) {
    console.error('Failed to run panel action:', error)
  } finally {
    businessActionLoading.value = false
  }
}

const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

const toggleProfileMenu = () => {
  profileMenuOpen.value = !profileMenuOpen.value
}

const handleLogout = async () => {
  if (logoutLoading.value) return

  logoutLoading.value = true

  try {
    await authStore.logout()
    router.replace('/login')
  } finally {
    logoutLoading.value = false
    profileMenuOpen.value = false
  }
}

watch(
  activeMessages,
  () => {
    requestScrollThread()
  },
  {
    deep: true,
    flush: 'post',
  },
)

onMounted(async () => {
  const hasUserContext = await ensureUserContext()

  if (!hasUserContext) return

  try {
    await chatStore.fetchConversations()
    composingNewChat.value = true
    chatStore.setActiveConversation(null)

    await scrollThread()
  } catch (error) {
    console.error('Failed to fetch chat data:', error)

    if (error.response?.status === 401 || error.status === 401) {
      await redirectToLogin()
      return
    }
  }

  timeTimer = window.setInterval(() => {
    timeTick.value = Date.now()
  }, 60 * 1000)
})

onBeforeUnmount(() => {
  if (timeTimer) {
    window.clearInterval(timeTimer)
  }

  if (scrollAnimationFrameId) {
    window.cancelAnimationFrame(scrollAnimationFrameId)
  }
})
</script>

<template>
  <div class="chat-shell page">
    <header class="app-header">
      <div class="header-title-area">
        <div>
          <img
            class="header-title-logo"
            :src="officeLinkTitle"
            alt="Office Link"
          />
        </div>
      </div>

      <div class="header-actions">
        <div class="system-badge">
          <span></span>
          시스템 정상
        </div>

        <div class="profile-area">
          <button class="profile-box" type="button" @click="toggleProfileMenu">
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
              stroke="#6B7690"
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
              <strong>{{ profileHeaderText }}</strong>

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
              class="logout-button"
              type="button"
              :disabled="logoutLoading"
              @click="handleLogout"
            >
              {{ logoutLoading ? '로그아웃 중...' : '로그아웃' }}
            </button>
          </div>
        </div>
      </div>
    </header>

    <div class="chat-body">
      <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }">
        <template v-if="sidebarCollapsed">
          <div class="collapsed-sidebar">
            <button
              class="sidebar-toggle-button"
              type="button"
              aria-label="사이드바 펼치기"
              @click="toggleSidebar"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#4A5570"
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
              @click="createNewChat"
            >
              ＋
            </button>
          </div>
        </template>

        <template v-else>
          <div class="sidebar-top">
            <button class="new-chat-button" type="button" @click="createNewChat">
              <span>＋</span>
              {{ chatStore.creating ? '생성 중...' : '새 대화 시작' }}
            </button>

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
                stroke="#4A5570"
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

          <section class="side-card">
            <div class="side-card-header">
              <h2>채팅 목록</h2>
              <span>{{ roomCount }}개</span>
            </div>

            <div v-if="chatStore.loading" class="room-loading">
              채팅을 불러오는 중입니다.
            </div>

            <div v-else-if="rooms.length === 0" class="room-empty">
              <p>아직 채팅이 없습니다.</p>
              <button type="button" @click="createNewChat">
                첫 채팅 시작하기
              </button>
            </div>

            <div v-else class="room-list">
              <article
                v-for="room in rooms"
                :key="room.id"
                class="room-item"
                :class="{ active: room.id === activeRoomId }"
                @click="selectRoom(room.id)"
              >
                <div class="room-select-body">
                  <div class="room-top">
                    <template v-if="editingRoomId === room.id">
                      <input
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
                    </template>

                    <template v-else>
                      <span
                        class="room-title-text"
                      >
                        {{ room.title }}
                      </span>
                    </template>

                    <span class="room-time">{{ formatRelativeTime(room.createdAt) }}</span>
                  </div>
                </div>

                <div
                  class="room-actions"
                  @click.stop
                >
                  <button
                    class="room-menu-button"
                    type="button"
                    aria-label="채팅방 메뉴 열기"
                    :aria-expanded="roomActionMenuId === room.id"
                    @click="toggleRoomActionMenu(room.id, $event)"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.4"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
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
                    <button
                      class="room-action-item"
                      type="button"
                      @click="startEditRoomTitle(room)"
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                      </svg>
                      <span>이름 변경</span>
                    </button>

                    <button
                      class="room-action-item danger"
                      type="button"
                      @click="deleteChatRoom(room.id)"
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                      <span>삭제</span>
                    </button>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section class="side-card shortcut-card">
            <div class="side-card-header">
              <h2>오늘의 업무 바로가기</h2>
              <button type="button">편집</button>
            </div>

            <button
              v-for="item in shortcuts"
              :key="item.key"
              class="shortcut-item"
              type="button"
              @click="togglePanel(item.key)"
            >
              <span>{{ item.label }}</span>
              <strong :class="item.tone">{{ item.value }} ›</strong>
            </button>
          </section>

          <section class="side-card faq-card">
            <h2 class="faq-title">자주 묻는 업무</h2>

            <div class="faq-list">
              <button
                v-for="faq in faqs"
                :key="faq.label"
                type="button"
                :disabled="isAnswering"
                @click="sendMessage(faq.query)"
              >
                {{ faq.label }}
              </button>
            </div>
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
      </aside>

      <main class="chat-main" :class="{ 'start-mode': showWelcome }">
  <template v-if="showWelcome">
    <section class="start-screen">
      <div class="start-hero">
        <img
          class="bot-logo hero-logo"
          :src="chatbotLogo"
          alt="AI 어시스턴트 로고"
        />

        <p class="start-eyebrow">사내 업무지원 AI 어시스턴트</p>

        <h2>
          안녕하세요, {{ profileName }} 님!<br />
          어떤 업무를 도와드릴까요?
        </h2>

        <p class="start-description">
          회의실 예약, 주차 등록, 식당 정보, 비품 신청, 사내 규정 검색까지<br />
          자연어로 편하게 요청해 주세요.
        </p>
      </div>

      <div class="start-composer">
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#9AA4BC"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M21.4 11.05l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"
          />
        </svg>

        <textarea
          ref="composerInputRef"
          v-model="draft"
          rows="1"
          :disabled="isAnswering"
          placeholder="업무 요청을 입력해 주세요."
          @input="resizeComposer"
          @keydown="handleComposerKeydown"
        ></textarea>

        <button
          type="button"
          :disabled="isAnswering"
          @click="sendMessage()"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFFFFF"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <path d="M22 2L15 22l-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>

      <div class="start-chip-list">
        <button
          v-for="card in starterCards"
          :key="`chip-${card.title}`"
          type="button"
          :disabled="isAnswering"
          @click="fillDraftFromStarter(card.query)"
        >
          {{ card.title }}
        </button>
      </div>
    </section>
  </template>

  <template v-else>
    <section ref="threadRef" class="thread-area">
      <div v-if="chatStore.messagesLoading" class="message-loading">
        이전 메시지를 불러오는 중입니다.
      </div>

      <div
        v-for="message in visibleMessages"
        :key="message.id"
        class="message-row"
        :class="message.role"
      >
        <template v-if="message.role === 'assistant'">
          <img
            class="bot-logo small"
            :src="chatbotLogo"
            alt="AI 어시스턴트 로고"
          />

          <div class="message-content">
            <span v-if="message.tag" class="message-tag">
              {{ message.tag }}
            </span>

            <div
              class="assistant-bubble markdown-content"
              :class="{ 'loading-answer': message.isLoading }"
              v-html="message.isLoading ? message.text : renderMarkdown(message.text)"
            ></div>

            <time>{{ message.time }}</time>
          </div>
        </template>

        <template v-else>
          <div class="user-message-content">
            <div class="user-bubble">
              {{ message.text }}
            </div>
            <time>{{ message.time }}</time>
          </div>
        </template>
      </div>
    </section>

    <section class="composer-area">
      <div class="composer-box">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#9AA4BC"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M21.4 11.05l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"
          />
        </svg>

        <textarea
          ref="composerInputRef"
          v-model="draft"
          rows="1"
          :disabled="isAnswering"
          :placeholder="isAnswering ? '답변 생성 중입니다. 잠시만 기다려 주세요.' : '채팅을 입력해 주세요.'"
          @input="resizeComposer"
          @keydown="handleComposerKeydown"
        ></textarea>

        <button
          type="button"
          :disabled="isAnswering"
          @click="sendMessage()"
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFFFFF"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <path d="M22 2L15 22l-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>

      <p>AI가 생성한 답변은 참고용으로 활용해 주세요.</p>
    </section>
  </template>
</main>

      <aside v-if="currentPanel" class="detail-panel">
        <div class="detail-header">
          <h2>{{ currentPanel.title }}</h2>
          <span>{{ currentPanel.badge }}</span>

          <button type="button" @click="closePanel">
            ×
          </button>
        </div>

        <div class="detail-content">
          <article
            v-for="item in currentPanel.items"
            :key="item.title"
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

            <p>{{ item.desc }}</p>
            <small>{{ item.meta }}</small>
          </article>

          <div v-if="currentPanel.items.length === 0" class="empty-panel">
            <div>🚗</div>
            <p>{{ currentPanel.emptyText }}</p>
          </div>
        </div>

        <div class="detail-footer">
          <button
            type="button"
            :disabled="businessActionLoading"
            @click="runPanelAction"
          >
            {{ businessActionLoading ? '처리 중...' : currentPanel.actionLabel }}
          </button>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.chat-shell {
  height: 100vh;
  color: var(--color-text);
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
}

.app-header {
  height: 68px;
  min-width: 0;
  flex-shrink: 0;
  background: var(--color-white);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 0 28px;
}

.header-title-area h1 {
  font-family: 'BBH Hegarty';
  margin: 0;
  font-size: 40px;
  font-weight: 800;
  letter-spacing: -0.3px;
  display: flex;
  gap: 6px;
  align-items: baseline;
}

.header-title-logo {
  width: 230px;
  height: auto;
  display: block;
}

.header-title-area p {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--color-subtle);
}

.header-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 18px;
}

.system-badge {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  color: #4a5570;
  background: #f3f9f4;
  border: 1px solid #dceedf;
  border-radius: 999px;
  padding: 5px 12px;
}

.system-badge span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-green);
  animation: tanetPulse 2.4s ease-in-out infinite;
}

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
  background: var(--color-white);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  box-shadow: 0 18px 40px rgba(23, 48, 110, 0.14);
  padding: 12px;
  z-index: 20;
}

.profile-menu-user {
  padding: 8px 8px 12px;
  border-bottom: 1px solid var(--color-border-light);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.profile-menu-user > strong {
  font-size: 14px;
  color: var(--color-text);
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

.logout-button:hover {
  background: #fde6e4;
}

.logout-button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.chat-body {
  flex: 1;
  min-width: 0;
  max-width: 1720px;
  width: 100%;
  margin: 0 auto;
  min-height: 0;
  display: flex;
  gap: 20px;
  padding: 20px 24px;
}

.sidebar {
  width: 312px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 2px;
  transition:
    width 0.2s ease,
    padding 0.2s ease;
}

.sidebar.collapsed {
  width: 56px;
  padding-right: 0;
  overflow: hidden;
}

.collapsed-sidebar {
  width: 100%;
  background: var(--color-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.sidebar-top {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.new-chat-button {
  flex: 1;
  min-width: 0;
  height: 48px;
  border: none;
  background: var(--color-primary-light);
  color: var(--color-white);
  font-size: 14px;
  font-weight: 700;
  border-radius: 14px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  white-space: nowrap;
}

.new-chat-button:hover {
  background: var(--color-primary);
}

.sidebar-toggle-button {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border: 1px solid var(--color-border);
  background: var(--color-white);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar-toggle-button:hover {
  background: #f6f9ff;
  border-color: var(--color-primary-light);
}

.collapsed-sidebar .sidebar-toggle-button {
  width: 40px;
  height: 40px;
  border-radius: 12px;
}

.collapsed-new-chat-button {
  width: 40px;
  height: 40px;
  border: none;
  background: var(--color-primary-light);
  color: var(--color-white);
  border-radius: 12px;
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
}

.collapsed-new-chat-button:hover {
  background: var(--color-primary);
}

.side-card,
.guide-card {
  flex-shrink: 0;
  background: var(--color-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.side-card {
  padding: 14px;
}

.side-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  padding: 0 4px;
}

.side-card h2,
.side-card-header h2,
.guide-card h2 {
  margin: 0;
  font-size: 14.5px;
  font-weight: 800;
  color: var(--color-primary);
}

.side-card-header span {
  font-size: 12px;
  color: var(--color-subtle);
}

.side-card-header button {
  border: none;
  background: transparent;
  color: var(--color-subtle);
  font-size: 12px;
  padding: 0;
}

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
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 12.5px;
  font-weight: 800;
}

.room-list {
  max-height: 326px;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 4px;
}

.room-list::-webkit-scrollbar {
  width: 6px;
}

.room-list::-webkit-scrollbar-thumb {
  background: #c9d2e4;
  border-radius: 999px;
}

.room-list::-webkit-scrollbar-track {
  background: transparent;
}

.room-item {
  width: 100%;
  min-height: 52px;
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
  background: #f6f9ff;
}

.room-item.active {
  border-color: var(--color-primary-light);
  background: var(--color-primary-soft);
}

.room-select-body {
  flex: 1;
  min-width: 0;
  padding: 9px 34px 9px 12px;
  border-radius: 11px;
}

.room-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 5;
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
  transition:
    background 0.15s ease,
    color 0.15s ease,
    opacity 0.15s ease;
}

.room-item:hover .room-menu-button,
.room-item:focus-within .room-menu-button,
.room-menu-button[aria-expanded='true'] {
  opacity: 1;
  pointer-events: auto;
}

.room-menu-button:hover,
.room-menu-button[aria-expanded='true'] {
  background: #eaf1ff;
  color: var(--color-primary);
}

.room-action-menu {
  position: absolute;
  bottom: 28px;
  right: 0;
  min-width: 128px;
  border: 1px solid var(--color-border);
  background: var(--color-white);
  border-radius: 10px;
  padding: 6px;
  box-shadow: 0 12px 28px rgba(23, 48, 110, 0.14);
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
  color: #4a5570;
  font-size: 12.5px;
  font-weight: 700;
  white-space: nowrap;
  text-align: left;
}

.room-action-item:hover {
  background: #f6f9ff;
  color: var(--color-primary);
}

.room-action-item.danger {
  color: var(--color-danger);
}

.room-action-item.danger:hover {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.room-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.room-title-text {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.room-item.active .room-title-text {
  color: var(--color-primary);
  font-weight: 800;
}

.room-title-input {
  flex: 1;
  min-width: 0;
  height: 26px;
  border: 1px solid var(--color-primary-light);
  background: var(--color-white);
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
  flex-shrink: 0;
  font-size: 11px;
  color: var(--color-placeholder);
}

.shortcut-card {
  padding: 18px 18px 10px;
}

.shortcut-item {
  width: calc(100% + 16px);
  margin: 0 -8px;
  border: none;
  border-bottom: 1px solid #f0f3f9;
  background: transparent;
  border-radius: 8px;
  padding: 11px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.shortcut-item:hover {
  background: #f6f9ff;
}

.shortcut-item span {
  font-size: 13px;
  color: #4a5570;
}

.shortcut-item strong {
  font-size: 13px;
  color: var(--color-primary-light);
}

.shortcut-item strong.orange {
  color: var(--color-orange);
}

.faq-card {
  padding: 16px 14px;
}

.faq-card .faq-title {
  margin: 0 0 12px 4px;
}

.faq-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.faq-list button {
  width: fit-content;
  text-align: left;
  border: 1px solid #e9edf6;
  background: #f8fafd;
  border-radius: 999px;
  padding: 9px 14px;
  font-size: 12.5px;
  color: #4a5570;
}

.faq-list button:hover {
  border-color: var(--color-primary-light);
  color: var(--color-primary);
}

.guide-card {
  background: var(--color-primary-soft);
  border-color: #d4e2fb;
  padding: 18px;
}

.guide-card p {
  margin: 7px 0 0;
  font-size: 12px;
  color: #4a5570;
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

.chat-main {
  flex: 1;
  min-width: 0;
  background: var(--color-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-main.start-mode {
  position: relative;
  background:
    radial-gradient(circle at 20% 0%, rgba(27, 67, 150, 0.16), transparent 34%),
    radial-gradient(circle at 90% 10%, rgba(18, 165, 222, 0.16), transparent 30%),
    linear-gradient(180deg, #f7faff 0%, #ffffff 62%);
}

.start-screen {
  flex: 1;
  min-height: 0;
  padding: 52px 56px 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow-y: auto;
}

.start-hero {
  margin-top: 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hero-logo {
  width: 64px;
  height: 64px;
  margin-bottom: 18px;
  filter: drop-shadow(0 12px 24px rgba(23, 48, 110, 0.14));
}

.start-eyebrow {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 800;
  color: var(--color-primary-light);
  letter-spacing: -0.1px;
}

.start-hero h2 {
  margin: 0;
  font-size: 32px;
  font-weight: 850;
  line-height: 1.28;
  letter-spacing: -0.8px;
  color: var(--color-primary);
}

.start-description {
  margin: 14px 0 0;
  font-size: 14px;
  line-height: 1.65;
  color: var(--color-muted);
}

.start-composer {
  width: min(720px, 100%);
  margin-top: 30px;
  min-height: 76px;
  border: 1px solid rgba(201, 210, 228, 0.9);
  background: rgba(255, 255, 255, 0.92);
  box-shadow:
    0 22px 55px rgba(23, 48, 110, 0.14),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
  border-radius: 24px;
  padding: 14px 16px 14px 22px;
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) 46px;
  align-items: start;
  gap: 14px;
  overflow: hidden;
}

.start-composer:focus-within {
  border-color: var(--color-primary-light);
  box-shadow:
    0 26px 64px rgba(23, 48, 110, 0.18),
    0 0 0 4px rgba(27, 67, 150, 0.07);
}

.start-composer textarea {
  width: 100%;
  min-width: 0;
  height: 40px;
  min-height: 40px;
  max-height: 80px;
  border: none;
  outline: none;
  box-shadow: none;
  background: transparent;
  color: var(--color-text);
  font-size: 16px;
  line-height: 20px;
  padding: 6px 0 14px;
  resize: none;
  overflow-y: auto;
  box-sizing: border-box;
  font-family: inherit;
  appearance: none;
  align-self: start;
}

.start-composer > svg {
  justify-self: start;
  align-self: end;
  margin-bottom: 13px;
  flex-shrink: 0;
}

.start-composer textarea:focus {
  border: none;
  outline: none;
  box-shadow: none;
}

.start-composer textarea::placeholder {
  color: #a2adbf;
}

.start-composer textarea:disabled {
  cursor: not-allowed;
  color: var(--color-muted);
}

.start-composer button {
  width: 46px;
  height: 46px;
  flex-shrink: 0;
  border: none;
  border-radius: 15px;
  background: var(--color-primary-light);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  justify-self: end;
  align-self: end;
}

.start-composer button:hover:not(:disabled) {
  background: var(--color-primary);
}

.start-composer button:disabled {
  background: #c9d2e4;
  cursor: not-allowed;
  opacity: 0.75;
}

.start-chip-list {
  margin-top: 16px;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 9px;
}

.start-chip-list button {
  border: 1px solid rgba(201, 210, 228, 0.75);
  background: rgba(255, 255, 255, 0.74);
  color: #4a5570;
  border-radius: 999px;
  padding: 9px 14px;
  font-size: 12.5px;
  font-weight: 700;
  box-shadow: 0 8px 20px rgba(23, 48, 110, 0.06);
}

.start-chip-list button:hover:not(:disabled) {
  background: #f4f8ff;
  border-color: var(--color-primary-light);
  color: var(--color-primary);
}

.start-chip-list button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.starter-section {
  margin-top: 18px;
}

.starter-section-title {
  margin-bottom: 10px;
  font-size: 12.5px;
  font-weight: 800;
  color: var(--color-subtle);
}

.bot-logo {
  flex-shrink: 0;
  object-fit: contain;
  display: block;
}

.bot-logo.large {
  width: 56px;
  height: 56px;
}

.bot-logo.small {
  width: 34px;
  height: 34px;
}

.welcome-top h2 {
  margin: 0;
  font-size: 19px;
  font-weight: 800;
  color: var(--color-primary);
  letter-spacing: -0.3px;
}

.welcome-top p {
  margin: 5px 0 0;
  font-size: 13.5px;
  color: var(--color-muted);
  line-height: 1.55;
}

.thread-area {
  flex: 1;
  min-height: 280px;
  overflow-y: auto;
  background: #fbfcfe;
  padding: 22px 28px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.message-loading {
  align-self: center;
  font-size: 12px;
  color: var(--color-subtle);
  background: var(--color-white);
  border: 1px solid var(--color-border-light);
  border-radius: 999px;
  padding: 6px 12px;
}

.message-row {
  display: flex;
  flex-direction: column;
}

.message-row.assistant {
  flex-direction: row;
  gap: 12px;
  align-items: flex-start;
  max-width: 78%;
}

.message-row.user {
  width: 100%;
  align-items: stretch;
}

.message-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.message-tag {
  align-self: flex-start;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-primary-light);
  background: var(--color-primary-soft);
  border: 1px solid #d4e2fb;
  border-radius: 999px;
  padding: 3px 10px;
}

.assistant-bubble {
  background: var(--color-white);
  border: 1px solid var(--color-border);
  border-radius: 4px 16px 16px 16px;
  padding: 13px 16px;
  font-size: 13.5px;
  line-height: 1.65;
  color: var(--color-text);
  white-space: normal;
}

.assistant-bubble.loading-answer {
  color: #8d98ad;
  background:
    linear-gradient(
      90deg,
      #ffffff 0%,
      #f7faff 45%,
      #eef5ff 55%,
      #ffffff 100%
    );
  background-size: 220% 100%;
  border-color: #dce6f5;
  font-weight: 600;
  animation:
    assistantLoadingShimmer 1.8s ease-in-out infinite,
    assistantLoadingPulse 1.4s ease-in-out infinite;
}

.assistant-bubble.loading-answer::after {
  content: '...';
  display: inline-block;
  width: 0;
  overflow: hidden;
  vertical-align: bottom;
  animation: assistantLoadingDots 1.2s steps(4, end) infinite;
}

.markdown-content {
  white-space: normal;
}

.markdown-content :deep(p) {
  margin: 0 0 10px;
}

.markdown-content :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-content :deep(strong) {
  font-weight: 800;
  color: var(--color-text);
}

.markdown-content :deep(em) {
  font-style: italic;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin: 8px 0 10px;
  padding-left: 20px;
}

.markdown-content :deep(li) {
  margin: 4px 0;
}

.markdown-content :deep(a) {
  color: var(--color-primary-light);
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
  word-break: break-all;
}

.markdown-content :deep(code) {
  background: #f2f5fa;
  border: 1px solid #e4eaf4;
  border-radius: 5px;
  padding: 1px 5px;
  font-size: 12.5px;
  color: #d14;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.markdown-content :deep(pre) {
  margin: 10px 0;
  background: #172033;
  color: #f7faff;
  border-radius: 10px;
  padding: 12px 14px;
  overflow-x: auto;
  font-size: 12.5px;
  line-height: 1.6;
}

.markdown-content :deep(pre code) {
  background: transparent;
  border: none;
  color: inherit;
  padding: 0;
  font-size: inherit;
}

.markdown-content :deep(blockquote) {
  margin: 10px 0;
  padding: 8px 12px;
  border-left: 4px solid var(--color-primary-light);
  background: #f6f9ff;
  color: #4a5570;
  border-radius: 8px;
}

.markdown-content :deep(hr) {
  border: none;
  border-top: 1px solid var(--color-border-light);
  margin: 14px 0;
}

.markdown-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0;
  font-size: 12.5px;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  border: 1px solid #e4eaf4;
  padding: 8px 10px;
  text-align: left;
}

.markdown-content :deep(th) {
  background: #f6f9ff;
  font-weight: 800;
}

@keyframes assistantLoadingShimmer {
  0% {
    background-position: 120% 0;
  }

  100% {
    background-position: -120% 0;
  }
}

@keyframes assistantLoadingPulse {
  0%,
  100% {
    opacity: 0.72;
    box-shadow: 0 0 0 rgba(27, 67, 150, 0);
  }

  50% {
    opacity: 1;
    box-shadow: 0 6px 18px rgba(27, 67, 150, 0.08);
  }
}

@keyframes assistantLoadingDots {
  0% {
    width: 0;
  }

  100% {
    width: 1.2em;
  }
}

@media (prefers-reduced-motion: reduce) {
  .assistant-bubble.loading-answer {
    animation: none;
  }

  .assistant-bubble.loading-answer::after {
    animation: none;
    width: 1.2em;
  }
}

.user-message-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
}

.user-bubble {
  width: fit-content;
  max-width: min(70%, 640px);
  background: var(--color-primary-light);
  color: var(--color-white);
  border-radius: 16px 4px 16px 16px;
  padding: 11px 16px;
  font-size: 13.5px;
  line-height: 1.55;
  white-space: pre-line;
  word-break: keep-all;
  overflow-wrap: break-word;
}

.message-row time {
  font-size: 11px;
  color: var(--color-placeholder);
}

.composer-area {
  padding: 16px 24px 12px;
  border-top: 1px solid var(--color-border-light);
  background: var(--color-white);
}

.composer-box {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) 40px;
  align-items: start;
  gap: 12px;
  border: 1.5px solid var(--color-border);
  border-radius: 14px;
  padding: 8px 8px 8px 16px;
  min-height: 58px;
  overflow: hidden;
}

.composer-box > svg {
  justify-self: start;
  align-self: end;
  margin-bottom: 11px;
  flex-shrink: 0;
}

.composer-box textarea {
  width: 100%;
  min-width: 0;
  height: 40px;
  min-height: 40px;
  max-height: 80px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--color-text);
  font-size: 14px;
  line-height: 20px;
  padding: 6px 0 14px;
  resize: none;
  overflow-y: auto;
  box-sizing: border-box;
  font-family: inherit;
  appearance: none;
  box-shadow: none;
  align-self: start;
}

.composer-box textarea:focus {
  border: none;
  outline: none;
  box-shadow: none;
}

.composer-box:focus-within {
  border-color: var(--color-primary-light);
}

.composer-box:has(textarea:disabled) {
  background: #f8fafd;
  border-color: var(--color-border-light);
}

.composer-box textarea::placeholder {
  color: #b5bfd0;
}

.composer-box textarea:disabled {
  color: var(--color-muted);
  cursor: not-allowed;
}

.composer-box button {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border: none;
  border-radius: 11px;
  background: var(--color-primary-light);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 1;
  justify-self: end;
  align-self: end;
}

.composer-box button:hover:not(:disabled) {
  background: var(--color-primary);
}

.composer-box button:disabled {
  background: #c9d2e4;
  cursor: not-allowed;
  opacity: 0.75;
}

.faq-list button:disabled {
  background: #f3f6fb;
  border-color: #e5ebf5;
  color: #a2adbf;
  cursor: not-allowed;
  opacity: 1;
}

.faq-list button:disabled:hover {
  background: #f3f6fb;
  border-color: #e5ebf5;
  color: #a2adbf;
}

.detail-footer button:disabled {
  background: #c9d2e4;
  color: var(--color-white);
  cursor: not-allowed;
  opacity: 0.75;
}

.composer-area p {
  margin: 9px 0 0;
  text-align: center;
  font-size: 11px;
  color: var(--color-placeholder);
}

.detail-panel {
  width: 336px;
  flex-shrink: 0;
  background: var(--color-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
  border: 1px solid #d4e2fb;
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

.detail-header button:hover {
  background: var(--color-bg);
}

.detail-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel-item {
  border: 1px solid #e9edf6;
  background: #f8fafd;
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
  color: #4a5570;
  line-height: 1.55;
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
  border: 1px solid #d4e2fb;
}

.panel-badge.green {
  color: var(--color-green);
  background: #f3f9f4;
  border: 1px solid #dceedf;
}

.panel-badge.yellow {
  color: #b0731f;
  background: #fdf7e7;
  border: 1px solid #f3e4b8;
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
  padding: 14px 18px 18px;
  border-top: 1px solid var(--color-border-light);
}

.detail-footer button {
  width: 100%;
  border: none;
  background: var(--color-primary-light);
  color: var(--color-white);
  font-size: 13.5px;
  font-weight: 700;
  border-radius: 11px;
  padding: 12px;
}

.detail-footer button:hover {
  background: var(--color-primary);
}

@media (max-width: 1100px) {
  .start-screen {
    padding: 42px 34px 34px;
  }

  .start-hero h2 {
    font-size: 28px;
  }

  .start-card-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    padding-top: 36px;
  }

  .app-header {
    padding: 0 18px;
  }

  .header-title-area p {
    display: none;
  }

  .system-badge {
    display: none;
  }

  .profile-summary strong,
  .profile-summary span {
    max-width: 100px;
  }

  .chat-body {
    padding: 14px;
    gap: 14px;
  }

  .sidebar:not(.collapsed) {
    width: 280px;
  }

  .welcome-area {
    padding: 22px 24px 18px;
  }

  .welcome-top p br {
    display: none;
  }

  .detail-panel {
    width: 300px;
  }
}

@media (max-width: 820px) {
  .start-screen {
  padding: 32px 20px 26px;
}

.start-hero {
  margin-top: 4px;
}

.hero-logo {
  width: 54px;
  height: 54px;
}

.start-hero h2 {
  font-size: 23px;
}

.start-description br {
  display: none;
}

.start-composer {
  min-height: 64px;
  border-radius: 19px;
  padding: 10px 12px 10px 16px;
  grid-template-columns: 24px minmax(0, 1fr) 40px;
}

.start-composer textarea {
  font-size: 14px;
}

  .start-composer button {
    width: 40px;
    height: 40px;
    border-radius: 13px;
  }

  .start-card-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    padding-top: 26px;
  }

  .start-card {
    min-height: 130px;
    border-radius: 16px;
    padding: 15px 14px;
  }
  .chat-body {
    padding: 10px;
    gap: 10px;
  }

  .sidebar:not(.collapsed) {
    width: 248px;
  }

  .welcome-area {
    padding: 18px 20px;
  }

  .welcome-top {
    gap: 12px;
  }

  .welcome-top h2 {
    font-size: 17px;
  }

  .welcome-top p {
    font-size: 12.5px;
  }

  .detail-panel {
    display: none;
  }

  .thread-area {
    padding: 18px 20px;
  }
}
</style>
