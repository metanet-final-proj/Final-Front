<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import chatbotLogo from '../assets/images/officelink-logo.svg'
import chatbotLogo2 from '../assets/images/officelink-logo-nobg.svg'
import loopIcon from '../assets/images/loop.svg'
import loadingIcon from '../assets/images/loading.svg'
import checkAllIcon from '../assets/images/check-all.svg'
import { useAuthStore } from '../stores/authStore'
import { useChatStore } from '../stores/chatStore'
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import officeLinkTitle from '../assets/images/officelink-logo-title-wide-nobg.svg'
import { useWorkhubStore } from '../stores/workhubStore'
import { speechApi } from '../api/speechApi'
import AdminDashboardPanel from '../components/admin/AdminDashboardPanel.vue'
import MyPagePanel from '../components/mypage/MyPagePanel.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const chatStore = useChatStore()
const workhubStore = useWorkhubStore()

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
})

const THEME_STORAGE_KEY = 'officeLinkTheme'

const getInitialDarkMode = () => {
  if (typeof window === 'undefined') return false

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)

  if (storedTheme === 'dark') return true
  if (storedTheme === 'light') return false

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches || false
}

const applyTheme = (darkMode) => {
  if (typeof document === 'undefined') return

  const theme = darkMode ? 'dark' : 'light'

  document.documentElement.dataset.theme = theme
  window.localStorage.setItem(THEME_STORAGE_KEY, theme)
}

const renderMarkdown = (text) => {
  if (!text) return ''

  const html = markdown.render(String(text))

  return DOMPurify.sanitize(html, {
    USE_PROFILES: {
      html: true,
    },
  })
}

const MAIN_PANEL = {
  CHAT: 'chat',
  ADMIN: 'admin',
  MYPAGE: 'mypage',
}

const ADMIN_DASHBOARD_PERMISSION = 'observability.dashboard.read'

const PANEL_QUERY_VALUES = new Set(Object.values(MAIN_PANEL))

const getPanelFromQuery = (panelQuery) => {
  const rawPanel = Array.isArray(panelQuery) ? panelQuery[0] : panelQuery
  const normalizedPanel = String(rawPanel || '').toLowerCase()

  return PANEL_QUERY_VALUES.has(normalizedPanel) ? normalizedPanel : MAIN_PANEL.CHAT
}

const replacePanelQuery = async (panel) => {
  const nextQuery = { ...route.query }

  if (panel === MAIN_PANEL.CHAT) {
    delete nextQuery.panel
  } else {
    nextQuery.panel = panel
  }

  const currentPanel = getPanelFromQuery(route.query.panel)
  if (currentPanel === panel) return

  await router.replace({
    path: '/chat',
    query: nextQuery,
  })
}

const pushPanelQuery = async (panel) => {
  const nextQuery = { ...route.query }

  if (panel === MAIN_PANEL.CHAT) {
    delete nextQuery.panel
  } else {
    nextQuery.panel = panel
  }

  const currentPanel = getPanelFromQuery(route.query.panel)
  if (currentPanel === panel) return

  await router.push({
    path: '/chat',
    query: nextQuery,
  })
}

const draft = ref('')
const mainPanel = ref(MAIN_PANEL.CHAT)
const panelKey = ref(null)
const threadRef = ref(null)
const composerInputRef = ref(null)
const sidebarCollapsed = ref(false)
const sidebarSectionCollapsed = ref({
  rooms: false,
  shortcuts: true,
  faqs: true,
})
const profileMenuOpen = ref(false)
const logoutLoading = ref(false)
const businessActionLoading = ref(false)
const composingNewChat = ref(true)
const isDarkMode = ref(getInitialDarkMode())
const isRecording = ref(false)
const isTranscribing = ref(false)
const isVoiceSupported = typeof window !== 'undefined' &&
  Boolean(navigator.mediaDevices?.getUserMedia) &&
  typeof window.MediaRecorder !== 'undefined'

const editingRoomId = ref(null)
const editingTitle = ref('')
const roomActionMenuId = ref(null)
const roomActionMenuPlacement = ref('up')
const titleSaving = ref(false)
const timeTick = ref(Date.now())
const skipNextMessageScroll = ref(false)

let timeTimer = null
let mediaRecorder = null
let mediaStream = null
let audioChunks = []
let recordingTimer = null

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

const shortcuts = computed(() => workhubStore.shortcuts)
const panels = computed(() => workhubStore.panelsByKey)

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

const isMenuPanel = computed(() => currentPanel.value?.key === 'menu')

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

const toggleAgentActivity = (message) => {
  const activity = message?.agentActivity
  const conversationId = message?.conversationId || activeRoomId.value

  if (!activity || !conversationId || !message?.id) return

  skipNextMessageScroll.value = true

  chatStore.patchLocalMessage(conversationId, message.id, {
    agentActivity: {
      ...activity,
      collapsed: !activity.collapsed,
    },
  })
}

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
  return panels.value[panelKey.value] || null
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

const canAccessAdminDashboard = computed(() => {
  return authStore.hasPermission(ADMIN_DASHBOARD_PERMISSION)
})

const isAnswering = computed(() => {
  return chatStore.sending
})

const isVoiceBusy = computed(() => {
  return isRecording.value || isTranscribing.value
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

const cleanupVoiceRecording = () => {
  if (recordingTimer) {
    window.clearTimeout(recordingTimer)
    recordingTimer = null
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop())
    mediaStream = null
  }

  mediaRecorder = null
  audioChunks = []
  isRecording.value = false
}

const preferredAudioMimeType = () => {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
  ]

  return candidates.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || ''
}

const applyTranscribedText = async (text) => {
  const nextText = String(text || '').trim()
  if (!nextText) return

  draft.value = draft.value.trim()
    ? `${draft.value.trim()} ${nextText}`
    : nextText

  await nextTick()
  await resizeComposer()

  if (composerInputRef.value) {
    composerInputRef.value.focus()
  }
}

const transcribeRecordedAudio = async (blob) => {
  if (!blob || blob.size === 0) return

  isTranscribing.value = true

  try {
    await authStore.ensureFreshAccessToken()
    const response = await speechApi.transcribeAudio(blob)
    await applyTranscribedText(response.data?.text)
  } catch (error) {
    console.error('Voice transcription failed:', error)
    if (error.response?.status === 401 || error.status === 401) {
      await redirectToLogin()
      return
    }
    window.alert('음성을 텍스트로 변환하지 못했습니다. 잠시 후 다시 시도해 주세요.')
  } finally {
    isTranscribing.value = false
  }
}

const stopVoiceRecording = () => {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return
  mediaRecorder.stop()
}

const startVoiceRecording = async () => {
  if (!isVoiceSupported || isAnswering.value || isTranscribing.value) return

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    audioChunks = []

    const mimeType = preferredAudioMimeType()
    mediaRecorder = new MediaRecorder(
      mediaStream,
      mimeType ? { mimeType } : undefined,
    )

    mediaRecorder.ondataavailable = (event) => {
      if (event.data?.size > 0) {
        audioChunks.push(event.data)
      }
    }

    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, {
        type: mediaRecorder?.mimeType || 'audio/webm',
      })
      cleanupVoiceRecording()
      transcribeRecordedAudio(blob)
    }

    mediaRecorder.start()
    isRecording.value = true
    recordingTimer = window.setTimeout(stopVoiceRecording, 60 * 1000)
  } catch (error) {
    console.error('Voice recording failed:', error)
    cleanupVoiceRecording()
    window.alert('마이크를 사용할 수 없습니다. 브라우저 권한을 확인해 주세요.')
  }
}

const toggleVoiceRecording = () => {
  if (isRecording.value) {
    stopVoiceRecording()
    return
  }

  startVoiceRecording()
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
  mainPanel.value = MAIN_PANEL.CHAT
  await replacePanelQuery(MAIN_PANEL.CHAT)
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

  if (!messageText || isAnswering.value || isTranscribing.value) return
  mainPanel.value = MAIN_PANEL.CHAT
  await replacePanelQuery(MAIN_PANEL.CHAT)

  let conversationId

  try {
    await authStore.ensureFreshAccessToken()
    conversationId = await ensureActiveConversation(messageText)
  } catch (error) {
    console.error('Failed to create conversation before sending:', error)
    if (error.response?.status === 401 || error.status === 401) {
      await redirectToLogin()
    }
    return
  }

  if (!conversationId) return

  const currentRoomTitle = activeRoom.value?.title

  draft.value = ''
    try {
      const result = await chatStore.sendMessage(conversationId, messageText)
      if (result?.refreshTargets?.includes('workhub_sidebar')) {
        refreshWorkhubSidebar()
      }

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
    if (error.response?.status === 401 || error.status === 401) {
      await redirectToLogin()
    }
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
  mainPanel.value = MAIN_PANEL.CHAT
  await replacePanelQuery(MAIN_PANEL.CHAT)
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

const refreshWorkhubSidebar = async () => {
  try {
    await workhubStore.fetchSidebarSummary()
  } catch (error) {
    console.error('Failed to refresh Workhub sidebar summary:', error)
  }
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

const toggleSidebarSection = (section) => {
  sidebarSectionCollapsed.value[section] = !sidebarSectionCollapsed.value[section]
}

const toggleProfileMenu = () => {
  profileMenuOpen.value = !profileMenuOpen.value
}

const toggleDarkMode = () => {
  isDarkMode.value = !isDarkMode.value
}

const openMyPage = () => {
  mainPanel.value = MAIN_PANEL.MYPAGE
  profileMenuOpen.value = false
  panelKey.value = null
  roomActionMenuId.value = null
  pushPanelQuery(MAIN_PANEL.MYPAGE)
}

const openAdminDashboard = async () => {
  if (!canAccessAdminDashboard.value) {
    mainPanel.value = MAIN_PANEL.CHAT
    profileMenuOpen.value = false
    panelKey.value = null
    roomActionMenuId.value = null
    await replacePanelQuery(MAIN_PANEL.CHAT)
    return
  }

  mainPanel.value = MAIN_PANEL.ADMIN
  profileMenuOpen.value = false
  panelKey.value = null
  roomActionMenuId.value = null
  await pushPanelQuery(MAIN_PANEL.ADMIN)
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
    if (skipNextMessageScroll.value) {
      skipNextMessageScroll.value = false
      return
    }

    requestScrollThread()
  },
  {
    deep: true,
    flush: 'post',
  },
)

watch(isDarkMode, (nextValue) => {
  applyTheme(nextValue)
})

watch(
  () => [route.query.panel, canAccessAdminDashboard.value],
  async ([panelQuery]) => {
    const nextPanel = getPanelFromQuery(panelQuery)

    if (nextPanel === MAIN_PANEL.ADMIN && !canAccessAdminDashboard.value) {
      mainPanel.value = MAIN_PANEL.CHAT
      profileMenuOpen.value = false
      panelKey.value = null
      roomActionMenuId.value = null
      await replacePanelQuery(MAIN_PANEL.CHAT)
      return
    }

    mainPanel.value = nextPanel

    if (nextPanel !== MAIN_PANEL.CHAT) {
      profileMenuOpen.value = false
      panelKey.value = null
      roomActionMenuId.value = null
    }
  },
  {
    immediate: true,
  },
)

onMounted(async () => {
  applyTheme(isDarkMode.value)

  const hasUserContext = await ensureUserContext()

  if (!hasUserContext) return

  try {
    await chatStore.fetchConversations()
    refreshWorkhubSidebar()
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
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.onstop = null
    mediaRecorder.stop()
  }

  cleanupVoiceRecording()

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
      <div class="header-actions">
        <button
          class="theme-toggle-button"
          :class="{ dark: isDarkMode }"
          type="button"
          :aria-pressed="isDarkMode"
          :aria-label="isDarkMode ? '라이트 모드로 변경' : '다크 모드로 변경'"
          @click="toggleDarkMode"
        >
          <span class="theme-toggle-knob" aria-hidden="true">
            <svg
              v-if="isDarkMode"
              width="16"
              height="16"
              viewBox="0 0 30 30"
              fill="none"
            >
              <path
                d="M18.8 22.8C12.8 22.8 8 18 8 12c0-2.1.6-4 1.6-5.7A9.9 9.9 0 1 0 23.7 20.4c-1.5 1.5-3.5 2.4-4.9 2.4Z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linejoin="round"
              />
              <path d="M21.8 5.8l.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7.7-1.7Z" fill="currentColor" />
              <path d="M25 12.8l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5.5-1.2Z" fill="currentColor" />
            </svg>

            <svg
              v-else
              width="17"
              height="17"
              viewBox="0 0 32 32"
              fill="none"
            >
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
    </header>

    <div class="chat-body">
      <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }">
        <div class="sidebar-content">
        <template v-if="sidebarCollapsed">
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
              @click="createNewChat"
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

            <button class="new-chat-button" type="button" @click="createNewChat">
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
                @click.stop="refreshWorkhubSidebar"
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
              @click="togglePanel(item.key)"
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
                @click="fillDraftFromStarter(faq.query)"
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
              <span
                class="side-section-toggle"
                aria-hidden="true"
              >
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

            <div v-if="!sidebarSectionCollapsed.rooms && chatStore.loading" class="room-loading">
              채팅을 불러오는 중입니다.
            </div>

            <div v-else-if="!sidebarSectionCollapsed.rooms && rooms.length === 0" class="room-empty">
              <p>아직 채팅이 없습니다.</p>
              <button type="button" @click="createNewChat">
                첫 채팅 시작하기
              </button>
            </div>

            <div v-else-if="!sidebarSectionCollapsed.rooms" class="room-list">
              <article
                v-for="room in rooms"
                :key="room.id"
                class="room-item"
                :class="{ active: room.id === activeRoomId, 'menu-open': roomActionMenuId === room.id }"
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
                  </div>
                </div>

                <div
                  class="room-actions"
                  @click.stop
                >
                  <span class="room-time">{{ formatRelativeTime(room.createdAt) }}</span>
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

        <div class="profile-area sidebar-profile-area" :class="{ collapsed: sidebarCollapsed }">
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
              v-if="canAccessAdminDashboard"
              class="mypage-button admin-dashboard-button"
              type="button"
              @click="openAdminDashboard"
            >
              관리자 대시보드
            </button>

            <button
              class="mypage-button"
              type="button"
              @click="openMyPage"
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

      <main
        class="chat-main"
        :class="{
          'start-mode': mainPanel === MAIN_PANEL.CHAT && showWelcome,
          'admin-mode': mainPanel === MAIN_PANEL.ADMIN && canAccessAdminDashboard,
          'mypage-mode': mainPanel === MAIN_PANEL.MYPAGE,
        }"
      >
  <AdminDashboardPanel v-if="mainPanel === MAIN_PANEL.ADMIN && canAccessAdminDashboard" />

  <MyPagePanel
    v-else-if="mainPanel === MAIN_PANEL.MYPAGE"
    :user="authStore.user"
    :profile="authStore.employeeProfile"
  />

  <template v-else>
  <template v-if="showWelcome">
    <section class="start-screen">
      <div class="start-hero">
        <img
          class="bot-logo hero-logo"
          :src="chatbotLogo2"
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
        <button
          type="button"
          class="voice-button"
          :class="{ recording: isRecording, transcribing: isTranscribing }"
          :disabled="isAnswering || isTranscribing || !isVoiceSupported"
          :title="isRecording ? '녹음 중지' : '음성으로 입력'"
          @click="toggleVoiceRecording"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <path d="M12 19v3" />
          </svg>
        </button>

        <textarea
          ref="composerInputRef"
          v-model="draft"
          rows="1"
          :disabled="isAnswering || isTranscribing"
          :placeholder="isTranscribing ? '음성을 텍스트로 변환하는 중입니다.' : '업무 요청을 입력해 주세요.'"
          @input="resizeComposer"
          @keydown="handleComposerKeydown"
        ></textarea>

        <button
          type="button"
          :disabled="isAnswering || isTranscribing"
          @click="sendMessage()"
          class="send-button"
        >
          <svg
            class="send-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-white)"
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

          <div
            class="message-content"
            :class="{ 'has-agent-activity': message.agentActivity }"
          >
            <span v-if="message.tag" class="message-tag">
              {{ message.tag }}
            </span>

            <div
              v-if="message.agentActivity && message.isLoading"
              class="agent-status-bubble"
              role="status"
            >
              <img class="agent-loop-icon" :src="loopIcon" alt="" />
              <span>{{ message.agentActivity.currentText || message.text }}</span>
            </div>

            <div
              v-if="message.agentActivity?.steps?.length"
              class="agent-activity-card"
              :class="{ collapsed: message.agentActivity.collapsed }"
            >
              <button
                v-if="message.agentActivity.collapsed"
                type="button"
                class="agent-activity-summary"
                :aria-expanded="false"
                @click="toggleAgentActivity(message)"
              >
                <span>Show reasoning summary</span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="18 15 12 9 6 15" />
                </svg>
              </button>

              <template v-else>
                <button
                  type="button"
                  class="agent-activity-header"
                  :aria-expanded="true"
                  @click="toggleAgentActivity(message)"
                >
                  <span>작업 과정</span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                <div class="agent-step-list">
                  <div
                    v-for="step in message.agentActivity.steps"
                    :key="step.id"
                    class="agent-step"
                    :class="step.status"
                  >
                    <img
                      class="agent-step-icon"
                      :class="{ running: step.status !== 'done' }"
                      :src="step.status === 'done' ? checkAllIcon : loadingIcon"
                      alt=""
                    />
                    <div class="agent-step-body">
                      <p>{{ step.title }}</p>
                      <span v-if="step.tool">{{ step.tool }}</span>
                    </div>
                  </div>
                </div>
              </template>
            </div>

            <div
              v-if="!message.agentActivity || !message.isLoading"
              class="assistant-bubble markdown-content"
              :class="{ 'loading-answer': message.isLoading && !message.agentActivity }"
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
        <button
          type="button"
          class="voice-button"
          :class="{ recording: isRecording, transcribing: isTranscribing }"
          :disabled="isAnswering || isTranscribing || !isVoiceSupported"
          :title="isRecording ? '녹음 중지' : '음성으로 입력'"
          @click="toggleVoiceRecording"
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <path d="M12 19v3" />
          </svg>
        </button>

        <textarea
          ref="composerInputRef"
          v-model="draft"
          rows="1"
          :disabled="isAnswering || isTranscribing"
          :placeholder="isTranscribing ? '음성을 텍스트로 변환하는 중입니다.' : isAnswering ? '답변 생성 중입니다. 잠시만 기다려 주세요.' : '채팅을 입력해 주세요.'"
          @input="resizeComposer"
          @keydown="handleComposerKeydown"
        ></textarea>

        <button
          type="button"
          :disabled="isAnswering || isTranscribing"
          @click="sendMessage()"
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-white)"
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
            v-for="(item, index) in currentPanel.items"
            :key="`${currentPanel.key}-${item.title}-${item.meta}-${index}`"
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
  position: relative;
  z-index: 5;
  background: var(--color-surface-raised);
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

.header-title-logo,
.sidebar-title-logo {
  width: 50px;
  height: auto;
  display: block;
  transform: translateX(15px);
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

.theme-toggle-button {
  width: 54px;
  height: 28px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface-disabled);
  color: var(--color-text);
  padding: 3px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  box-shadow: 0 8px 18px rgba(var(--color-primary-rgb), 0.08);
  transition:
    background 0.18s ease,
    color 0.18s ease,
    border-color 0.18s ease;
}

.theme-toggle-button.dark {
  background: var(--color-markdown-pre-bg);
  color: var(--color-white);
  border-color: var(--color-markdown-pre-bg);
}

.theme-toggle-knob {
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  border-radius: 50%;
  background: var(--color-toggle-knob);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 10px rgba(var(--color-primary-rgb), 0.12);
  transform: translateX(0);
  transition:
    transform 0.18s ease,
    color 0.18s ease;
}

.theme-toggle-button.dark .theme-toggle-knob {
  color: var(--color-markdown-pre-bg);
  transform: translateX(26px);
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

.chat-body {
  --chat-body-bottom-padding: 20px;
  flex: 1;
  min-width: 0;
  max-width: none;
  width: 100%;
  margin: 0;
  min-height: 0;
  display: flex;
  gap: 20px;
  padding: 20px 24px 20px 0;
}

.sidebar {
  width: 312px;
  flex-shrink: 0;
  height: calc(100% + 68px + var(--chat-body-bottom-padding));
  margin-top: -68px;
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
  color: var(--color-danger);
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

.chat-main {
  flex: 1;
  min-width: 0;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-main.start-mode {
  position: relative;
  background:
    radial-gradient(circle at 20% 0%, rgba(var(--color-primary-light-rgb), 0.16), transparent 34%),
    radial-gradient(circle at 90% 10%, rgba(var(--color-sky-rgb), 0.16), transparent 30%),
    linear-gradient(180deg, var(--color-page-gradient-start) 0%, var(--color-surface-raised) 62%);
}

.chat-main.mypage-mode {
  background: transparent;
}

.chat-main.admin-mode {
  background: var(--color-page-gradient-start);
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
  filter: drop-shadow(0 12px 24px rgba(var(--color-primary-rgb), 0.14));
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
  border: 1px solid rgba(var(--color-border-muted-rgb), 0.9);
  background: rgba(var(--color-white-rgb), 0.92);
  box-shadow:
    0 22px 55px rgba(var(--color-primary-rgb), 0.14),
    inset 0 1px 0 rgba(var(--color-white-rgb), 0.8);
  backdrop-filter: blur(12px);
  border-radius: 24px;
  padding: 14px 16px 14px 22px;
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) 46px;
  align-items: start;
  gap: 14px;
  overflow: hidden;
}

.start-composer:focus-within {
  border-color: var(--color-primary-light);
  box-shadow:
    0 26px 64px rgba(var(--color-primary-rgb), 0.18),
    0 0 0 4px rgba(var(--color-primary-light-rgb), 0.07);
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

.start-composer > .voice-button {
  justify-self: start;
  align-self: end;
  flex-shrink: 0;
}

.start-composer textarea:focus {
  border: none;
  outline: none;
  box-shadow: none;
}

.start-composer textarea::placeholder {
  color: var(--color-placeholder-strong);
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
  background: var(--color-scrollbar);
  cursor: not-allowed;
  opacity: 0.75;
}

.start-composer .voice-button,
.composer-box .voice-button {
  background: var(--color-surface-muted);
  color: var(--color-muted);
  border: 1px solid var(--color-border);
}

.start-composer .voice-button:hover:not(:disabled),
.composer-box .voice-button:hover:not(:disabled) {
  background: var(--color-surface-hover);
  color: var(--color-primary-light);
  border-color: var(--color-primary-border-soft);
}

.start-composer .voice-button.recording,
.composer-box .voice-button.recording {
  background: var(--color-recording-bg);
  color: var(--color-recording);
  border-color: var(--color-recording-border);
  animation: voiceRecordingPulse 1.2s ease-in-out infinite;
}

.start-composer .voice-button.transcribing,
.composer-box .voice-button.transcribing {
  background: var(--color-loading-shimmer-end);
  color: var(--color-primary-light);
}

.start-chip-list {
  margin-top: 16px;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 9px;
}

.start-chip-list button {
  border: 1px solid rgba(var(--color-border-muted-rgb), 0.75);
  background: rgba(var(--color-white-rgb), 0.74);
  color: var(--color-text-secondary);
  border-radius: 999px;
  padding: 9px 14px;
  font-size: 12.5px;
  font-weight: 700;
  box-shadow: 0 8px 20px rgba(var(--color-primary-rgb), 0.06);
}

.start-chip-list button:hover:not(:disabled) {
  background: var(--color-surface-grid);
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
  background: var(--color-surface-thread);
  padding: 22px 28px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.message-loading {
  align-self: center;
  font-size: 12px;
  color: var(--color-subtle);
  background: var(--color-surface-raised);
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

.message-content.has-agent-activity {
  width: min(620px, 100%);
}

.message-tag {
  align-self: flex-start;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-primary-light);
  background: var(--color-primary-soft);
  border: 1px solid var(--color-primary-border-muted);
  border-radius: 999px;
  padding: 3px 10px;
}

.assistant-bubble {
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: 4px 16px 16px 16px;
  padding: 13px 16px;
  font-size: 14.5px;
  line-height: 1.6;
  font-weight: 400;
  color: var(--color-text);
  white-space: normal;
}

.agent-status-bubble {
  display: flex;
  align-items: center;
  gap: 10px;
  width: fit-content;
  max-width: 100%;
  background: var(--color-agent-bg);
  border: 1px solid var(--color-agent-border);
  border-radius: 4px 14px 14px 14px;
  padding: 9px 13px;
  color: var(--color-agent-text);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
}

.agent-loop-icon {
  width: 22px;
  height: 22px;
  flex: 0 0 22px;
}

.agent-activity-card {
  width: 100%;
  overflow: hidden;
  background: var(--color-agent-card-bg);
  border: 1px solid var(--color-agent-card-border);
  border-radius: 6px;
  color: var(--color-agent-text);
}

.agent-activity-summary,
.agent-activity-header {
  width: 100%;
  min-height: 36px;
  border: none;
  background: transparent;
  color: inherit;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 13px;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
}

.agent-activity-summary:hover,
.agent-activity-header:hover {
  background: rgba(var(--color-white-rgb), 0.28);
}

.agent-activity-summary:focus-visible,
.agent-activity-header:focus-visible {
  outline: 2px solid rgba(var(--color-focus-ring-rgb), 0.24);
  outline-offset: -2px;
}

.agent-activity-header {
  border-bottom: 1px solid rgba(var(--color-white-rgb), 0.6);
  font-weight: 700;
}

.agent-step-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px 14px;
}

.agent-step {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 9px;
  align-items: start;
}

.agent-step-icon {
  width: 16px;
  height: 16px;
  margin-top: 2px;
  flex-shrink: 0;
}

.agent-step-body {
  min-width: 0;
}

.agent-step-body p {
  margin: 0;
  color: var(--color-agent-step-text);
  font-size: 12.5px;
  line-height: 1.45;
}

.agent-step-body span {
  display: inline-flex;
  margin-top: 5px;
  max-width: 100%;
  border-radius: 999px;
  background: rgba(var(--color-white-rgb), 0.52);
  padding: 3px 8px;
  color: var(--color-agent-step-meta);
  font-size: 11.5px;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.assistant-bubble.loading-answer {
  color: var(--color-loading-text);
  background:
    linear-gradient(
      90deg,
      var(--color-white) 0%,
      var(--color-loading-shimmer-mid) 45%,
      var(--color-loading-shimmer-end) 55%,
      var(--color-white) 100%
    );
  background-size: 220% 100%;
  border-color: var(--color-loading-border);
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
  font-weight: 700;
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
  background: var(--color-markdown-code-bg);
  border: 1px solid var(--color-inline-border);
  border-radius: 5px;
  padding: 1px 5px;
  font-size: 12.5px;
  color: var(--color-markdown-code-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.markdown-content :deep(pre) {
  margin: 10px 0;
  background: var(--color-markdown-pre-bg);
  color: var(--color-markdown-pre-text);
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
  background: var(--color-surface-soft);
  color: var(--color-text-secondary);
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
  border: 1px solid var(--color-inline-border);
  padding: 8px 10px;
  text-align: left;
}

.markdown-content :deep(th) {
  background: var(--color-surface-soft);
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
    box-shadow: 0 0 0 rgba(var(--color-primary-light-rgb), 0);
  }

  50% {
    opacity: 1;
    box-shadow: 0 6px 18px rgba(var(--color-primary-light-rgb), 0.08);
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
  font-size: 14.5px;
  line-height: 1.6;
  font-weight: 400;
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
  background: var(--color-surface-raised);
}

.composer-box {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 40px;
  align-items: start;
  gap: 12px;
  border: 1.5px solid var(--color-border);
  border-radius: 14px;
  padding: 8px 8px 8px 16px;
  min-height: 58px;
  overflow: hidden;
}

.composer-box > .voice-button {
  justify-self: start;
  align-self: end;
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
  font-size: 15px;
  line-height: 22px;
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
  background: var(--color-surface-subtle);
  border-color: var(--color-border-light);
}

.composer-box textarea::placeholder {
  color: var(--color-placeholder-soft);
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
  background: var(--color-scrollbar);
  cursor: not-allowed;
  opacity: 0.75;
}

@keyframes voiceRecordingPulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(var(--color-danger-rgb), 0.2);
  }

  50% {
    box-shadow: 0 0 0 5px rgba(var(--color-danger-rgb), 0.08);
  }
}

.faq-list button:disabled {
  background: var(--color-surface-muted);
  border-color: var(--color-disabled-border);
  color: var(--color-placeholder-strong);
  cursor: not-allowed;
  opacity: 1;
}

.faq-list button:disabled:hover {
  background: var(--color-surface-muted);
  border-color: var(--color-disabled-border);
  color: var(--color-placeholder-strong);
}

.detail-footer button:disabled {
  background: var(--color-scrollbar);
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
  background: var(--color-surface-raised);
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

  .theme-toggle-button {
    width: 50px;
    height: 26px;
  }

  .theme-toggle-knob {
    width: 18px;
    height: 18px;
    flex-basis: 18px;
  }

  .theme-toggle-button.dark .theme-toggle-knob {
    transform: translateX(24px);
  }

  .profile-summary strong,
  .profile-summary span {
    max-width: 100px;
  }

  .chat-body {
    padding: 14px 14px 14px 0;
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
  grid-template-columns: 40px minmax(0, 1fr) 40px;
}

.send-button {
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;

  display: flex;
  align-items: center;
  justify-content: center;
}

.send-icon {
  display: block;
  transform: translate(-2px, 1px);
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
    padding: 10px 10px 10px 0;
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
