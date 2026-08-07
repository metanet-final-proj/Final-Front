<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import chatbotLogo from '../assets/images/officelink-logo3.svg'
import chatbotLogo2 from '../assets/images/officelink-logo-nobg3.svg'
import loopIcon from '../assets/images/loop.svg'
import loadingIcon from '../assets/images/loading.svg'
import checkAllIcon from '../assets/images/check-all.svg'
import { useAuthStore } from '../stores/authStore'
import { useChatStore } from '../stores/chatStore'
import { useWorkhubStore } from '../stores/workhubStore'
import { speechApi } from '../api/speechApi'
import AdminDashboardPanel from '../components/admin/AdminDashboardPanel.vue'
import ChatSidebar from '../components/chat/ChatSidebar.vue'
import WorkhubDetailPanel from '../components/chat/WorkhubDetailPanel.vue'
import MyPagePanel from '../components/mypage/MyPagePanel.vue'
import ActionDraftRenderer from '../components/chat/ActionDraftRenderer.vue'
import MeetingReservationListCard from '../components/chat/MeetingReservationListCard.vue'
import MeetingRoomAvailableListCard from '../components/chat/MeetingRoomAvailableListCard.vue'
import MeetingRoomDetailCard from '../components/chat/MeetingRoomDetailCard.vue'
import VisitorParkingRegistrationListCard from '../components/chat/VisitorParkingRegistrationListCard.vue'
import SupplyItemListCard from '../components/chat/SupplyItemListCard.vue'
import SupplyRequestListCard from '../components/chat/SupplyRequestListCard.vue'
import {
  ADMIN_DASHBOARD_PERMISSION,
  MAIN_PANEL,
  applyTheme,
  getInitialDarkMode,
  getPanelFromRoute,
  panelRouteLocation,
  renderMarkdown,
} from '../utils/chatView'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const chatStore = useChatStore()
const workhubStore = useWorkhubStore()

const replacePanelQuery = async (panel) => {
  const currentPanel = getPanelFromRoute(route)
  if (currentPanel === panel) return

  if (panel !== MAIN_PANEL.CHAT) {
    await router.replace(panelRouteLocation(panel))
    return
  }
  await router.replace(panelRouteLocation(panel, route.params.conversationId))
}

const pushPanelQuery = async (panel) => {
  const currentPanel = getPanelFromRoute(route)
  if (currentPanel === panel) return

  if (panel !== MAIN_PANEL.CHAT) {
    await router.push(panelRouteLocation(panel))
    return
  }
  await router.push(panelRouteLocation(panel, route.params.conversationId))
}

const draft = ref('')
const mainPanel = ref(MAIN_PANEL.CHAT)
const panelKey = ref(null)
const threadRef = ref(null)
const composerInputRef = ref(null)
const chatSidebarRef = ref(null)
const logoutLoading = ref(false)
const businessActionLoading = ref(false)
const confirmingActionDraftId = ref(null)
const actionDraftErrors = ref({})
const preparingReservationId = ref(null)
const preparingParkingRequestId = ref(null)
const preparingSupplyRequestId = ref(null)
const composingNewChat = ref(true)
const isDarkMode = ref(getInitialDarkMode())
const isRecording = ref(false)
const isTranscribing = ref(false)
const isVoiceSupported = typeof window !== 'undefined' &&
  Boolean(navigator.mediaDevices?.getUserMedia) &&
  typeof window.MediaRecorder !== 'undefined'

const skipNextMessageScroll = ref(false)
const autoFollowThread = ref(true)
const chatDataReady = ref(false)

const THREAD_BOTTOM_THRESHOLD_PX = 72
const COMPOSER_MAX_LINES = 3
const SCROLL_HEIGHT_TOLERANCE_PX = 1
const VOICE_RECORDING_LIMIT_SECONDS = 60

let mediaRecorder = null
let mediaStream = null
let audioChunks = []
let recordingTimer = null
let recordingElapsedTimer = null
let lastThreadScrollTop = 0
let threadMutationObserver = null
let threadResizeObserver = null
let threadUserScrollIntentUntil = 0
const recordingElapsedSeconds = ref(0)

const formatVoiceDuration = (seconds) => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

const voiceStatusText = computed(() => {
  if (isRecording.value) {
    return `녹음 중 ${formatVoiceDuration(recordingElapsedSeconds.value)} · 마이크를 다시 누르면 입력됩니다. (최대 ${VOICE_RECORDING_LIMIT_SECONDS}초)`
  }
  if (isTranscribing.value) return '녹음을 마쳤습니다. 음성을 텍스트로 변환하는 중입니다.'
  return ''
})

const resizeComposer = async () => {
  await nextTick()

  const textarea = composerInputRef.value
  if (!textarea) return

  textarea.style.height = 'auto'

  const styles = window.getComputedStyle(textarea)
  const toPixels = (value) => Number.parseFloat(value) || 0
  const lineHeight = toPixels(styles.lineHeight) || 22
  const verticalPadding = toPixels(styles.paddingTop) + toPixels(styles.paddingBottom)
  const verticalBorder = toPixels(styles.borderTopWidth) + toPixels(styles.borderBottomWidth)
  const maxHeight = Math.ceil(
    lineHeight * COMPOSER_MAX_LINES + verticalPadding + verticalBorder,
  )
  const contentHeight = textarea.scrollHeight + verticalBorder

  textarea.style.height = `${Math.min(contentHeight, maxHeight)}px`
  textarea.style.overflowY =
    contentHeight > maxHeight + SCROLL_HEIGHT_TOLERANCE_PX ? 'auto' : 'hidden'
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

watch(
  composerInputRef,
  () => {
    resizeComposer()
  },
  {
    flush: 'post',
  },
)

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

const panels = computed(() => workhubStore.panelsByKey)

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

const profileName = computed(() => {
  return authStore.displayName || authStore.user?.displayName || '사용자'
})

const canAccessAdminDashboard = computed(() => {
  return authStore.hasPermission(ADMIN_DASHBOARD_PERMISSION)
})

const isAnswering = computed(() => {
  return chatStore.isConversationAnswering(activeRoomId.value)
})

watch(isAnswering, async (isNowAnswering, wasAnswering) => {
  if (!wasAnswering || isNowAnswering || mainPanel.value !== MAIN_PANEL.CHAT) return

  await nextTick()
  composerInputRef.value?.focus({ preventScroll: true })
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

const isThreadNearBottom = () => {
  const thread = threadRef.value
  if (!thread) return true

  return thread.scrollHeight - thread.scrollTop - thread.clientHeight <= THREAD_BOTTOM_THRESHOLD_PX
}

const handleThreadScroll = () => {
  const thread = threadRef.value
  if (!thread) return

  const scrollTopChanged = Math.abs(thread.scrollTop - lastThreadScrollTop) > 1
  lastThreadScrollTop = thread.scrollTop

  // Layout changes can move the scroll position through browser scroll anchoring.
  // Only explicit wheel/touch/scrollbar interaction may release auto-follow.
  if (!scrollTopChanged || window.performance.now() > threadUserScrollIntentUntil) return

  autoFollowThread.value = isThreadNearBottom()
}

const markThreadScrollIntent = () => {
  threadUserScrollIntentUntil = window.performance.now() + 500
}

const scrollThread = async ({ force = false } = {}) => {
  await nextTick()

  if (!threadRef.value || (!force && !autoFollowThread.value)) return

  threadRef.value.scrollTop = threadRef.value.scrollHeight
  lastThreadScrollTop = threadRef.value.scrollTop
  autoFollowThread.value = true
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

  if (recordingElapsedTimer) {
    window.clearInterval(recordingElapsedTimer)
    recordingElapsedTimer = null
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
    recordingElapsedSeconds.value = 0
    recordingElapsedTimer = window.setInterval(() => {
      recordingElapsedSeconds.value = Math.min(
        recordingElapsedSeconds.value + 1,
        VOICE_RECORDING_LIMIT_SECONDS,
      )
    }, 1000)
    recordingTimer = window.setTimeout(
      stopVoiceRecording,
      VOICE_RECORDING_LIMIT_SECONDS * 1000,
    )
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
  if (scrollAnimationFrameId || !autoFollowThread.value) return

  scrollAnimationFrameId = window.requestAnimationFrame(async () => {
    scrollAnimationFrameId = null
    await scrollThread()
  })
}

const observeThreadContent = () => {
  threadMutationObserver?.disconnect()
  threadResizeObserver?.disconnect()
  threadMutationObserver = null
  threadResizeObserver = null

  if (!threadRef.value) return

  if (typeof ResizeObserver !== 'undefined') {
    threadResizeObserver = new ResizeObserver(() => {
      requestScrollThread()
    })
  }

  const observeMessageRows = () => {
    if (!threadResizeObserver || !threadRef.value) return
    Array.from(threadRef.value.children).forEach((element) => {
      threadResizeObserver.observe(element)
    })
  }

  observeMessageRows()

  if (typeof MutationObserver === 'undefined') return

  threadMutationObserver = new MutationObserver(() => {
    observeMessageRows()
    requestScrollThread()
  })
  threadMutationObserver.observe(threadRef.value, {
    childList: true,
    subtree: true,
    characterData: true,
  })
}

watch(
  threadRef,
  () => {
    observeThreadContent()
  },
  { flush: 'post' },
)

const conversationRouteLocation = (conversationId = null, query = route.query) => ({
  name: 'chat',
  params: conversationId ? { conversationId: String(conversationId) } : {},
  query,
})

const activateConversation = async (roomId) => {
  const conversation = chatStore.conversations.find(
    (item) => normalizeId(item.conversationId) === normalizeId(roomId),
  )

  if (!conversation) return false

  mainPanel.value = MAIN_PANEL.CHAT
  composingNewChat.value = false
  autoFollowThread.value = true
  chatStore.setActiveConversation(conversation.conversationId)

  try {
    await chatStore.fetchMessages(conversation.conversationId)
    await scrollThread({ force: true })
    return true
  } catch (error) {
    console.error('Failed to fetch chat messages:', error)
    return false
  }
}

const selectRoom = async (roomId) => {
  const nextQuery = { ...route.query }
  delete nextQuery.panel

  await router.push(conversationRouteLocation(roomId, nextQuery))
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

  autoFollowThread.value = true
  await scrollThread({ force: true })

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
  const titleText = typeof initialTitle === 'string' ? initialTitle.trim() : ''

  if (!titleText) {
    const nextQuery = { ...route.query }
    delete nextQuery.panel
    await router.push(conversationRouteLocation(null, nextQuery))

    composingNewChat.value = true
    autoFollowThread.value = true
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
      autoFollowThread.value = true
      chatStore.setActiveConversation(conversationId)
      resetMessagesForConversation(conversationId)
      await router.replace(conversationRouteLocation(conversationId, {}))
    } else {
      console.warn('Created conversation id was not found:', conversation)
    }

    panelKey.value = null
    draft.value = ''

    await nextTick()

    if (composerInputRef.value) {
      composerInputRef.value.focus()
    }

    await scrollThread({ force: true })

    return conversationId
  } catch (error) {
    console.error('Failed to create chat conversation:', error)
    throw error
  }
}

const handleRoomDeleted = async () => {
  draft.value = ''

  const nextConversationId = activeRoomId.value
  if (nextConversationId) {
    await router.replace(conversationRouteLocation(nextConversationId, {}))
    await activateConversation(nextConversationId)
    return
  }

  composingNewChat.value = true
  await router.replace(conversationRouteLocation(null, {}))
}

const togglePanel = (key) => {
  panelKey.value = panelKey.value === key ? null : key
}

const closePanel = () => {
  panelKey.value = null
}

const closePanelAndRestoreFocus = async () => {
  closePanel()
  await nextTick()
  chatSidebarRef.value?.focusMobileTrigger?.()
}

const refreshWorkhubSidebar = async () => {
  try {
    await workhubStore.fetchSidebarSummary()
  } catch (error) {
    console.error('Failed to refresh Workhub sidebar summary:', error)
  }
}

const confirmActionDraft = async (payload) => {
  if (!payload?.draftId || confirmingActionDraftId.value) return

  confirmingActionDraftId.value = payload.draftId
  actionDraftErrors.value = {
    ...actionDraftErrors.value,
    [payload.draftId]: '',
  }

  try {
    const result = await chatStore.confirmActionDraft(payload)
    if (String(result?.status || '').toUpperCase() === 'COMPLETED') {
      const actionType = String(result?.actionType || '')
      if (
        (actionType === 'meeting_room.update' || actionType === 'meeting_room.cancel')
        && result?.sourceAssistantMessageId
        && Array.isArray(result?.meetingReservations)
      ) {
        chatStore.setMessageMeetingReservations(
          activeRoomId.value,
          result.sourceAssistantMessageId,
          result.meetingReservations,
        )
        chatStore.setMessageMeetingReservationActionResult(
          activeRoomId.value,
          result.sourceAssistantMessageId,
          result.meetingReservationActionResult || null,
        )
        chatStore.setMessageActionDraft(activeRoomId.value, result.sourceAssistantMessageId, null)
      }
      if (
        (actionType === 'visitor_parking.update' || actionType === 'visitor_parking.cancel')
        && result?.sourceAssistantMessageId
        && Array.isArray(result?.visitorParkingRegistrations)
      ) {
        chatStore.setMessageVisitorParkingRegistrations(
          activeRoomId.value,
          result.sourceAssistantMessageId,
          result.visitorParkingRegistrations,
        )
        chatStore.setMessageVisitorParkingActionResult(
          activeRoomId.value,
          result.sourceAssistantMessageId,
          result.visitorParkingActionResult || null,
        )
        chatStore.setMessageActionDraft(activeRoomId.value, result.sourceAssistantMessageId, null)
      }
      if (
        actionType === 'supply.request'
        && result?.sourceAssistantMessageId
        && Array.isArray(result?.supplyItems)
      ) {
        chatStore.setMessageSupplyItems(
          activeRoomId.value,
          result.sourceAssistantMessageId,
          result.supplyItems,
        )
        chatStore.setMessageSupplyItemActionResult(
          activeRoomId.value,
          result.sourceAssistantMessageId,
          result.supplyItemActionResult || null,
        )
      }
      if (
        (actionType === 'supply.update' || actionType === 'supply.cancel')
        && result?.sourceAssistantMessageId
        && Array.isArray(result?.supplyRequests)
      ) {
        chatStore.setMessageSupplyRequests(
          activeRoomId.value,
          result.sourceAssistantMessageId,
          result.supplyRequests,
        )
        chatStore.setMessageSupplyRequestActionResult(
          activeRoomId.value,
          result.sourceAssistantMessageId,
          result.supplyRequestActionResult || null,
        )
        chatStore.setMessageActionDraft(activeRoomId.value, result.sourceAssistantMessageId, null)
      }
      await refreshWorkhubSidebar()
    }
  } catch (error) {
    const status = Number(error.response?.status || error.status || 0)
    const code =
      error.response?.data?.code ||
      error.response?.data?.error?.code ||
      ''
    const message =
      error.response?.data?.message ||
      error.response?.data?.error?.message ||
      '요청 처리에 실패했습니다. 입력 내용을 확인한 뒤 다시 시도해 주세요.'
    actionDraftErrors.value = {
      ...actionDraftErrors.value,
      [payload.draftId]: {
        message,
        status,
        code,
        tone: status === 409 ? 'rejected' : 'error',
      },
    }
  } finally {
    confirmingActionDraftId.value = null
  }
}

const formatDraftDate = (value) => {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime())
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    : ''
}

const formatDraftTime = (value) => {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime())
    ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    : ''
}

const createMeetingRoomDraft = async (message, actionType, values, loadingId = null) => {
  if (!message?.id || preparingReservationId.value) return
  preparingReservationId.value = loadingId || values.reservationId || values.roomId || 'meeting-room-draft'
  try {
    const draft = await chatStore.createMeetingRoomActionDraft({
      conversationId: activeRoomId.value,
      actionType,
      sourceAssistantMessageId: Number(message.messageId || message.id),
      ...values,
    })
    chatStore.setMessageActionDraft(activeRoomId.value, message.id, { ...draft, autoOpen: true })
  } catch (error) {
    console.error('Failed to prepare meeting room action draft:', error)
  } finally {
    preparingReservationId.value = null
  }
}

const prepareMeetingReservationAction = async (message, actionType, reservation) => {
  if (!reservation?.reservationId) return
  return createMeetingRoomDraft(message, actionType, {
    origin: 'meeting_reservation_list',
    reservationId: Number(reservation.reservationId),
    roomId: reservation.roomId ? Number(reservation.roomId) : null,
    roomName: reservation.roomName || null,
    date: formatDraftDate(reservation.startAt),
    startTime: formatDraftTime(reservation.startAt),
    endTime: formatDraftTime(reservation.endAt),
  }, reservation.reservationId)
}

const createVisitorParkingDraft = async (message, actionType, values, loadingId = null) => {
  if (!message?.id || preparingParkingRequestId.value) return
  preparingParkingRequestId.value = loadingId || values.requestId || 'visitor-parking-draft'
  try {
    const draft = await chatStore.createVisitorParkingActionDraft({
      conversationId: activeRoomId.value,
      actionType,
      sourceAssistantMessageId: Number(message.messageId || message.id),
      ...values,
    })
    chatStore.setMessageActionDraft(activeRoomId.value, message.id, { ...draft, autoOpen: true })
  } catch (error) {
    console.error('Failed to prepare visitor parking action draft:', error)
  } finally {
    preparingParkingRequestId.value = null
  }
}

const prepareVisitorParkingAction = async (message, actionType, registration) => {
  if (!registration?.requestId) return
  return createVisitorParkingDraft(message, actionType, {
    origin: 'visitor_parking_list',
    requestId: Number(registration.requestId),
    parkingLotId: registration.parkingLotId ? Number(registration.parkingLotId) : null,
    parkingLotName: registration.parkingLotName || null,
    parkingLotLocation: registration.parkingLotLocation || null,
    visitorName: registration.visitorName || null,
    visitorPhone: registration.visitorPhone || null,
    carNumber: registration.carNumber || null,
    visitDate: registration.visitDate || null,
  }, registration.requestId)
}

const shouldRenderActionDraft = (message) => {
  const draft = message?.actionDraft
  if (!draft) return false
  if (!String(draft.actionType || '').startsWith('meeting_room.')) return true
  return (
    (!message.meetingRoomAvailableList && !message.meetingRoomDetail)
    || (
      draft.values?.origin === 'meeting_room_query_card'
      && String(draft.status || '').toUpperCase() !== 'COMPLETED'
    )
  )
}

const createSupplyDraft = async (message, actionType, values, loadingId = null) => {
  if (!message?.id || preparingSupplyRequestId.value) return
  preparingSupplyRequestId.value = loadingId || values.requestId || values.itemId || 'supply-draft'
  try {
    const draft = await chatStore.createSupplyActionDraft({
      conversationId: activeRoomId.value,
      actionType,
      sourceAssistantMessageId: Number(message.messageId || message.id),
      ...values,
    })
    chatStore.setMessageActionDraft(activeRoomId.value, message.id, { ...draft, autoOpen: true })
  } catch (error) {
    console.error('Failed to prepare supply action draft:', error)
  } finally {
    preparingSupplyRequestId.value = null
  }
}

const prepareSupplyRequestFromItem = (message, item) => createSupplyDraft(message, 'supply.request', {
  origin: 'supply_item_list',
  requestId: null,
  itemId: item.itemId ? Number(item.itemId) : null,
  itemName: item.itemName || null,
  category: item.category || null,
  quantity: 1,
  reason: null,
}, item.itemId)

const prepareSupplyRequestAction = (message, actionType, request) => createSupplyDraft(message, actionType, {
  origin: 'supply_request_list',
  requestId: request.requestId ? Number(request.requestId) : null,
  itemId: request.itemId ? Number(request.itemId) : null,
  itemName: request.itemName || null,
  category: request.category || null,
  quantity: Number(request.quantity || 1),
  reason: request.reason || null,
}, request.requestId)

const hasStructuredMessageContent = (message) => Boolean(
  message?.actionDraft
  || message?.meetingReservations
  || message?.meetingRoomAvailableList
  || message?.meetingRoomDetail
  || message?.visitorParkingRegistrations
  || message?.supplyItems
  || message?.supplyRequests
)

const dismissListActionDraft = (message, actionDraft) => {
  const origin = String(actionDraft?.values?.origin || '')
  if (!['meeting_reservation_list', 'visitor_parking_list', 'supply_item_list', 'supply_request_list'].includes(origin)) return
  chatStore.setMessageActionDraft(activeRoomId.value, message.id, null)
}

const prepareRoomReservationFromQuery = async (message, room, condition = {}) => {
  if (!message?.messageId) return
  const startTime = condition.startTime || condition.start_time || room.availableStartTime || ''
  const endTime = condition.endTime || condition.end_time || room.availableEndTime || ''
  return createMeetingRoomDraft(message, 'meeting_room.reserve', {
    origin: 'meeting_room_query_card',
    reservationId: null,
    roomId: room.roomId ? Number(room.roomId) : null,
    roomName: room.roomName || null,
    date: condition.date || room.availabilityDate || '',
    startTime,
    endTime,
    capacity: condition.capacity || room.capacity || null,
  }, room.roomId)
}

const requestMeetingRoomDetail = async (room, condition = {}) => {
  if (!room?.roomName || isAnswering.value) return
  const date = condition.date ? ` ${condition.date}` : ''
  await sendMessage(`${room.roomName} 회의실의${date} 상세 정보와 예약 가능 시간을 알려줘`)
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

const runPanelManageAction = async () => {
  if (!currentPanel.value?.manageActionQuery || businessActionLoading.value) return

  businessActionLoading.value = true
  try {
    const query = currentPanel.value.manageActionQuery
    closePanel()
    await sendMessage(query)
  } catch (error) {
    console.error('Failed to run panel management action:', error)
  } finally {
    businessActionLoading.value = false
  }
}

const toggleDarkMode = () => {
  isDarkMode.value = !isDarkMode.value
}

const openMyPage = async () => {
  panelKey.value = null
  await pushPanelQuery(MAIN_PANEL.MYPAGE)
}

const openAdminDashboard = async () => {
  if (!canAccessAdminDashboard.value) {
    mainPanel.value = MAIN_PANEL.CHAT
    panelKey.value = null
    await replacePanelQuery(MAIN_PANEL.CHAT)
    return
  }

  panelKey.value = null
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

watch(
  () => [route.params.conversationId, route.name, route.query.panel],
  async ([conversationId]) => {
    if (
      !chatDataReady.value ||
      getPanelFromRoute(route) !== MAIN_PANEL.CHAT
    ) return

    if (!conversationId) {
      composingNewChat.value = true
      autoFollowThread.value = true
      chatStore.setActiveConversation(null)
      return
    }

    if (
      !composingNewChat.value &&
      normalizeId(activeRoomId.value) === normalizeId(conversationId)
    ) {
      return
    }

    const activated = await activateConversation(conversationId)
    if (!activated) {
      composingNewChat.value = true
      chatStore.setActiveConversation(null)
      await router.replace(conversationRouteLocation(null, {}))
    }
  },
)

watch(isDarkMode, (nextValue) => {
  applyTheme(nextValue)
})

watch(
  () => [route.name, route.query.panel, canAccessAdminDashboard.value],
  async () => {
    const nextPanel = getPanelFromRoute(route)

    if (nextPanel === MAIN_PANEL.ADMIN && !canAccessAdminDashboard.value) {
      mainPanel.value = MAIN_PANEL.CHAT
      panelKey.value = null
      await replacePanelQuery(MAIN_PANEL.CHAT)
      return
    }

    mainPanel.value = nextPanel

    if (nextPanel !== MAIN_PANEL.CHAT) {
      panelKey.value = null
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

    const routeConversationId = route.params.conversationId
    if (routeConversationId) {
      const activated = await activateConversation(routeConversationId)

      if (!activated) {
        composingNewChat.value = true
        chatStore.setActiveConversation(null)
        await router.replace(conversationRouteLocation(null, {}))
      }
    } else {
      composingNewChat.value = true
      chatStore.setActiveConversation(null)
    }

    chatDataReady.value = true
    await scrollThread({ force: true })
  } catch (error) {
    console.error('Failed to fetch chat data:', error)

    if (error.response?.status === 401 || error.status === 401) {
      await redirectToLogin()
      return
    }
  }

})

onBeforeUnmount(() => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.onstop = null
    mediaRecorder.stop()
  }

  cleanupVoiceRecording()

  if (scrollAnimationFrameId) {
    window.cancelAnimationFrame(scrollAnimationFrameId)
  }

  threadMutationObserver?.disconnect()
  threadResizeObserver?.disconnect()
})
</script>

<template>
  <div class="chat-shell page">
    <div class="chat-body">
      <ChatSidebar
        ref="chatSidebarRef"
        :can-access-admin-dashboard="canAccessAdminDashboard"
        :is-dark-mode="isDarkMode"
        :is-answering="isAnswering"
        :logout-loading="logoutLoading"
        @create-new-chat="createNewChat"
        @fill-draft="fillDraftFromStarter"
        @logout="handleLogout"
        @open-admin="openAdminDashboard"
        @open-mypage="openMyPage"
        @refresh-workhub="refreshWorkhubSidebar"
        @room-deleted="handleRoomDeleted"
        @select-room="selectRoom"
        @toggle-theme="toggleDarkMode"
        @toggle-panel="togglePanel"
      />

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
          회의실 예약, 방문객 주차 등록, 식당 정보, 비품 신청, 사내 규정 검색까지<br />
          자연어로 편하게 요청해 주세요.
        </p>
      </div>

      <div class="start-composer">
        <button
          type="button"
          class="voice-button"
          :class="{ recording: isRecording, transcribing: isTranscribing }"
          :disabled="isAnswering || isTranscribing || !isVoiceSupported"
          :title="isRecording ? '녹음을 마치고 입력하기' : '음성으로 입력'"
          :aria-label="isRecording ? '녹음을 마치고 입력하기' : '음성으로 입력'"
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
          :disabled="isRecording || isTranscribing"
          :placeholder="isRecording ? '녹음 중입니다. 마이크를 다시 누르면 입력됩니다.' : isTranscribing ? '음성을 텍스트로 변환하는 중입니다.' : isAnswering ? '답변 생성 중입니다.' : '업무 요청을 입력해 주세요.'"
          @input="resizeComposer"
          @keydown="handleComposerKeydown"
        ></textarea>

        <button
          type="button"
          aria-label="메시지 전송"
          :disabled="isAnswering || isRecording || isTranscribing"
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
            <path d="M12 19V5" />
            <path d="m5 12 7-7 7 7" />
          </svg>
        </button>
      </div>

      <p v-if="voiceStatusText" class="voice-status" role="status" aria-live="polite">
        {{ voiceStatusText }}
      </p>

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
    <section
      ref="threadRef"
      class="thread-area"
      @scroll.passive="handleThreadScroll"
      @wheel.passive="markThreadScrollIntent"
      @touchmove.passive="markThreadScrollIntent"
      @pointerdown.self="markThreadScrollIntent"
    >
      <div v-if="chatStore.messagesLoading" class="message-loading">
        이전 메시지를 불러오는 중입니다.
      </div>

      <div
        v-for="message in visibleMessages"
        :key="message.id"
        class="message-row"
        :class="[
          message.role,
          { 'has-structured-content': hasStructuredMessageContent(message) },
        ]"
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
                      <p>
                        {{ step.title }}
                        <span v-if="step.repeatCount > 1" class="agent-step-repeat">
                          ({{ step.repeatCount }})
                        </span>
                      </p>
                      <span v-if="step.tool">{{ step.tool }}</span>
                    </div>
                  </div>
                </div>
              </template>
            </div>

            <div
              v-if="!message.agentActivity || !message.isLoading"
              class="assistant-bubble"
              :class="{ 'loading-answer': message.isLoading && !message.agentActivity }"
            >
              <div
                class="markdown-content"
                v-html="message.isLoading ? message.text : renderMarkdown(message.text)"
              ></div>

              <ActionDraftRenderer
                v-if="shouldRenderActionDraft(message)"
                :draft="message.actionDraft"
                :loading="confirmingActionDraftId === message.actionDraft.draftId"
                :external-error="actionDraftErrors[message.actionDraft.draftId] || ''"
                @confirm="confirmActionDraft"
                @dismiss="(draft) => dismissListActionDraft(message, draft)"
              />

              <MeetingReservationListCard
                v-if="message.meetingReservations"
                :reservations="message.meetingReservations"
                :action-result="message.meetingReservationActionResult"
                :loading-reservation-id="preparingReservationId"
                :owner-display-name="message.ownerDisplayName"
                @edit="(reservation) => prepareMeetingReservationAction(message, 'meeting_room.update', reservation)"
                @cancel="(reservation) => prepareMeetingReservationAction(message, 'meeting_room.cancel', reservation)"
              />

              <MeetingRoomAvailableListCard
                v-if="message.meetingRoomAvailableList"
                :data="message.meetingRoomAvailableList"
                :actions-enabled="Boolean(message.messageId)"
                :actions-loading="Boolean(preparingReservationId)"
                :action-draft="message.actionDraft"
                @reserve="(room) => prepareRoomReservationFromQuery(message, room, message.meetingRoomAvailableList.condition || {})"
                @detail="(room) => requestMeetingRoomDetail(room, message.meetingRoomAvailableList.condition || {})"
              />

              <MeetingRoomDetailCard
                v-if="message.meetingRoomDetail"
                :data="message.meetingRoomDetail"
                :actions-enabled="Boolean(message.messageId)"
                :actions-loading="Boolean(preparingReservationId)"
                :action-draft="message.actionDraft"
                @reserve="(room) => prepareRoomReservationFromQuery(message, room, message.meetingRoomDetail.requestedCondition || {})"
              />

              <VisitorParkingRegistrationListCard
                v-if="message.visitorParkingRegistrations"
                :registrations="message.visitorParkingRegistrations"
                :action-result="message.visitorParkingActionResult"
                :loading-request-id="preparingParkingRequestId"
                :owner-display-name="message.ownerDisplayName"
                @edit="(registration) => prepareVisitorParkingAction(message, 'visitor_parking.update', registration)"
                @cancel="(registration) => prepareVisitorParkingAction(message, 'visitor_parking.cancel', registration)"
              />

              <SupplyItemListCard
                v-if="message.supplyItems"
                :items="message.supplyItems"
                :loading-item-id="preparingSupplyRequestId"
                :actions-enabled="Boolean(message.messageId)"
                :action-draft="message.actionDraft"
                :action-result="message.supplyItemActionResult"
                @request="(item) => prepareSupplyRequestFromItem(message, item)"
              />

              <SupplyRequestListCard
                v-if="message.supplyRequests"
                :requests="message.supplyRequests"
                :action-result="message.supplyRequestActionResult"
                :loading-request-id="preparingSupplyRequestId"
                :owner-display-name="message.ownerDisplayName"
                :actions-enabled="Boolean(message.messageId)"
                @edit="(request) => prepareSupplyRequestAction(message, 'supply.update', request)"
                @cancel="(request) => prepareSupplyRequestAction(message, 'supply.cancel', request)"
              />
            </div>

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
          :title="isRecording ? '녹음을 마치고 입력하기' : '음성으로 입력'"
          :aria-label="isRecording ? '녹음을 마치고 입력하기' : '음성으로 입력'"
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
          :disabled="isRecording || isTranscribing"
          :placeholder="isRecording ? '녹음 중입니다. 마이크를 다시 누르면 입력됩니다.' : isTranscribing ? '음성을 텍스트로 변환하는 중입니다.' : isAnswering ? '답변 생성 중입니다.' : '채팅을 입력해 주세요.'"
          @input="resizeComposer"
          @keydown="handleComposerKeydown"
        ></textarea>

        <button
          type="button"
          aria-label="메시지 전송"
          :disabled="isAnswering || isRecording || isTranscribing"
          @click="sendMessage()"
          class="send-button"
        >
          <svg
            class="send-icon"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-white)"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 19V5" />
            <path d="m5 12 7-7 7 7" />
          </svg>
        </button>
      </div>

      <p v-if="voiceStatusText" class="voice-status" role="status" aria-live="polite">
        {{ voiceStatusText }}
      </p>

      <p>AI가 생성한 답변은 참고용으로 활용해 주세요.</p>
    </section>
  </template>
  </template>
</main>

      <WorkhubDetailPanel
        :panel="currentPanel"
        :action-loading="businessActionLoading"
        @action="runPanelAction"
        @manage="runPanelManageAction"
        @close="closePanelAndRestoreFocus"
      />
    </div>
  </div>
</template>

<style scoped>
:global(html),
:global(body),
:global(#app) {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.chat-shell {
  height: 100%;
  color: var(--color-text);
  display: flex;
  flex-direction: column;
  /* Keep scrolling inside the chat, sidebar, and panel containers. */
  overflow: hidden;
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
  gap: 0;
  padding: 0;
}

.chat-main {
  flex: 1;
  min-width: 0;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: 0;
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
  overflow-y: hidden;
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
  min-height: 0;
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
  max-width: min(88%, 1120px);
}

.message-row.assistant.has-structured-content {
  width: min(96%, 1320px);
  max-width: none;
}

.message-row.user {
  width: 100%;
  align-items: stretch;
}

.message-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
}

.message-content.has-agent-activity {
  width: 100%;
}

.message-row.has-structured-content .message-content {
  width: 100%;
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
  max-height: 86px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--color-text);
  font-size: 15px;
  line-height: 22px;
  padding: 6px 0 14px;
  resize: none;
  overflow-y: hidden;
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

.send-button {
  padding: 0;
  display: grid;
  place-items: center;
}

.send-icon {
  display: block;
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

.start-screen > .voice-status,
.composer-area .voice-status {
  color: var(--color-recording);
  font-size: 11.5px;
  font-weight: 700;
  line-height: 1.5;
}

.start-screen > .voice-status {
  width: min(720px, 100%);
  margin: 8px 0 0;
  text-align: center;
}

@media (max-width: 1100px) {
  .message-row.assistant {
    max-width: 92%;
  }

  .message-row.assistant.has-structured-content {
    width: 98%;
  }

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

  .chat-body {
    padding: 0;
    gap: 0;
  }

  .welcome-area {
    padding: 22px 24px 18px;
  }

  .welcome-top p br {
    display: none;
  }

}

@media (max-width: 820px) {
  .message-row.assistant,
  .message-row.assistant.has-structured-content {
    width: 100%;
    max-width: none;
  }

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
  border: none;
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
    padding: 0;
    gap: 0;
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

  .thread-area {
    padding: 16px 14px;
                                             }
}
</style>
