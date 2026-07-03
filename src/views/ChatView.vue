<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import chatbotLogo from '../assets/images/chatbot-logo.svg'
import { useAuthStore } from '../stores/authStore'
import { useChatStore } from '../stores/chatStore'

const router = useRouter()
const authStore = useAuthStore()
const chatStore = useChatStore()

const draft = ref('')
const typing = ref(false)
const panelKey = ref(null)
const threadRef = ref(null)
const sidebarCollapsed = ref(false)
const profileMenuOpen = ref(false)
const logoutLoading = ref(false)

const editingRoomId = ref(null)
const editingTitle = ref('')
const titleSaving = ref(false)
const timeTick = ref(Date.now())

let timeTimer = null

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

const replies = [
  {
    keys: ['회의실', '예약'],
    tag: '회의실 예약',
    text:
      '회의실 예약을 도와드릴게요.\n' +
      '1. 원하시는 날짜와 시간, 인원을 말씀해 주세요.\n' +
      '2. 가용 회의실을 조회해 드립니다.\n' +
      '3. 선택하시면 바로 예약이 완료됩니다.\n\n' +
      '예) "내일 오후 2시, 6인 회의실 예약해줘"',
  },
  {
    keys: ['주차', '방문객', '차량'],
    tag: '주차',
    text:
      '방문객 주차 등록 방법을 안내해 드릴게요.\n' +
      '1. [주차 관리] > [방문객 주차 등록] 메뉴로 이동합니다.\n' +
      '2. 방문객 정보(이름, 연락처, 방문 목적, 방문 시간)를 입력합니다.\n' +
      '3. 차량 번호를 입력하고 등록을 완료합니다.\n' +
      '4. 등록 완료 후 문자로 주차 QR코드가 발송됩니다.\n\n' +
      '※ 방문객은 등록된 시간 내 출차 시 정산 없이 이용 가능합니다.',
  },
  {
    keys: ['운영시간', '몇 시', '몇시'],
    tag: '식당 정보',
    text:
      '구내식당 운영시간 안내입니다.\n' +
      '• 조식 08:00 ~ 09:00\n' +
      '• 중식 11:30 ~ 13:30\n' +
      '• 석식 17:30 ~ 19:00\n\n' +
      '주말 및 공휴일은 운영하지 않습니다.',
  },
  {
    keys: ['혼잡', '식당', '메뉴', '식단'],
    tag: '실시간 정보',
    text:
      "구내식당 현재 혼잡도는 '여유' 입니다.\n" +
      '• 혼잡도: 여유 (대기 없음)\n' +
      '• 좌석 이용률: 31%\n\n' +
      '오늘 메뉴: 돈까스, 된장찌개, 잡곡밥, 샐러드 외 3종',
  },
  {
    keys: ['비품', '사무용품'],
    tag: 'RAG 문서검색',
    text:
      '비품 신청 방법을 안내해 드릴게요.\n' +
      '1. [비품 신청] 메뉴에서 필요한 비품을 검색합니다.\n' +
      '2. 수량과 사용 목적을 입력하고 신청서를 작성합니다.\n' +
      '3. 팀장 결재 후 경영지원팀에서 검토하여 발송합니다.\n' +
      '4. 일반 비품은 1~2일 이내, 재고가 없는 경우 3~5일 소요됩니다.\n\n' +
      '관련 규정: 비품 관리 규정 제3조(신청 절차) 참고',
  },
  {
    keys: ['규정', '연차', '휴가'],
    tag: 'RAG 문서검색',
    text:
      '사내 규정 검색 결과를 안내해 드릴게요.\n' +
      '관련 규정 문서를 찾았습니다. 구체적인 항목(연차, 경비, 복리후생 등)을 말씀해 주시면 해당 조항을 요약해 드립니다.',
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

const rooms = computed(() => chatStore.rooms)

const activeRoomId = computed(() => chatStore.activeConversationId)

const activeRoom = computed(() => chatStore.activeRoom)

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

const getRoomPreview = (room) => {
  const lastMessage = room.messages[room.messages.length - 1]
  return lastMessage ? lastMessage.text.split('\n')[0] : ''
}

const selectRoom = (roomId) => {
  chatStore.setActiveConversation(roomId)
  typing.value = false
  scrollThread()
}

const ensureActiveConversation = async () => {
  if (activeRoomId.value) {
    return activeRoomId.value
  }

  const conversation = await chatStore.createConversation({
    title: '새 채팅',
    chatType: 'GENERAL',
  })

  return conversation.conversationId
}

const sendMessage = async (text = draft.value) => {
  const messageText = text.trim()

  if (!messageText || typing.value) return

  let conversationId

  try {
    conversationId = await ensureActiveConversation()
  } catch (error) {
    console.error('Failed to create conversation before sending:', error)
    return
  }

  const currentRoomTitle = activeRoom.value?.title

  const userMessage = {
    id: Date.now(),
    role: 'user',
    text: messageText,
    time: nowTime(),
  }

  draft.value = ''
  chatStore.appendLocalMessage(conversationId, userMessage)

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

  typing.value = true
  scrollThread()

  const matchedReply = replies.find((reply) =>
    reply.keys.some((key) => messageText.includes(key)),
  )

  const botReply = matchedReply || {
    tag: null,
    text:
      '문의 주신 내용을 확인하고 있어요.\n' +
      '회의실 예약, 주차 등록, 식당 정보, 비품 신청, 사내 규정에 대해 도와드릴 수 있습니다. 조금 더 구체적으로 말씀해 주시겠어요?',
  }

  setTimeout(() => {
    chatStore.appendLocalMessage(conversationId, {
      id: Date.now() + 1,
      role: 'assistant',
      tag: botReply.tag,
      text: botReply.text,
      time: nowTime(),
    })

    typing.value = false
    scrollThread()
  }, 900)
}

const createNewChat = async () => {
  if (chatStore.creating) return

  try {
    await chatStore.createConversation({
      title: '새 채팅',
      chatType: 'GENERAL',
    })

    panelKey.value = null
    typing.value = false
    draft.value = ''
    await scrollThread()
  } catch (error) {
    console.error('Failed to create chat conversation:', error)
  }
}

const deleteChatRoom = async (roomId) => {
  if (!roomId || chatStore.deleting) return

  const ok = window.confirm('이 채팅방을 삭제할까요?')

  if (!ok) return

  try {
    await chatStore.deleteConversation(roomId)
    typing.value = false
    draft.value = ''
    await scrollThread()
  } catch (error) {
    console.error('Failed to delete chat conversation:', error)
  }
}

const startEditRoomTitle = async (room) => {
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

const runPanelAction = () => {
  if (!currentPanel.value) return

  const query = currentPanel.value.actionQuery
  closePanel()
  sendMessage(query)
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

onMounted(async () => {
  if (
    authStore.isAuthenticated &&
    typeof authStore.fetchUserContext === 'function' &&
    (!authStore.user || !authStore.employeeProfile)
  ) {
    authStore.fetchUserContext().catch((error) => {
      console.warn('Failed to fetch user context:', error)
    })
  }

  try {
    await chatStore.fetchConversations()
    await scrollThread()
  } catch (error) {
    console.error('Failed to fetch chat conversations:', error)
  }

  timeTimer = window.setInterval(() => {
    timeTick.value = Date.now()
  }, 60 * 1000)
})

onBeforeUnmount(() => {
  if (timeTimer) {
    window.clearInterval(timeTimer)
  }
})
</script>

<template>
  <div class="chat-shell page">
    <header class="app-header">
      <div class="header-title-area">
        <div>
          <h1>사내 업무지원 AI 어시스턴트</h1>
          <p>주차 · 회의실 · 식당 · 사무용품 업무를 대화로 처리</p>
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
              <h2>채팅방 목록</h2>
              <span>{{ roomCount }}개</span>
            </div>

            <div v-if="chatStore.loading" class="room-loading">
              채팅방을 불러오는 중입니다.
            </div>

            <div v-else-if="rooms.length === 0" class="room-empty">
              <p>아직 채팅방이 없습니다.</p>
              <button type="button" @click="createNewChat">
                첫 채팅방 만들기
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
                      <button
                        class="room-title-button"
                        type="button"
                        title="채팅방 이름 수정"
                        @click.stop="startEditRoomTitle(room)"
                      >
                        {{ room.title }}
                      </button>
                    </template>

                    <span>{{ formatRelativeTime(room.createdAt) }}</span>
                  </div>

                  <p>{{ getRoomPreview(room) }}</p>
                </div>

                <button
                  class="room-delete-button"
                  type="button"
                  aria-label="채팅방 삭제"
                  @click.stop="deleteChatRoom(room.id)"
                >
                  ×
                </button>
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

      <main class="chat-main">
        <section class="welcome-area">
          <div class="welcome-top">
            <img
              class="bot-logo large"
              :src="chatbotLogo"
              alt="AI 어시스턴트 로고"
            />

            <div>
              <h2>안녕하세요, {{ profileName }} 님!</h2>
              <p>
                회의실 예약, 주차 등록, 식당 정보, 비품 신청, 사내 규정 등<br />
                업무 관련 문의를 자연스럽게 질문해 주세요.
              </p>
            </div>
          </div>
        </section>

        <section ref="threadRef" class="thread-area">
          <div
            v-for="message in activeRoom.messages"
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
                <div class="assistant-bubble">
                  {{ message.text }}
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

          <div v-if="typing" class="typing-row">
            <img
              class="bot-logo small"
              :src="chatbotLogo"
              alt="AI 어시스턴트 로고"
            />

            <div class="typing-bubble">
              <span></span>
              <span></span>
              <span></span>
            </div>
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

            <input
              v-model="draft"
              type="text"
              placeholder="무엇을 도와드릴까요?"
              @keydown.enter.prevent="sendMessage()"
            />

            <button type="button" @click="sendMessage()">
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

          <p>현재 채팅 메시지는 화면 세션에서만 표시되며, 메시지 저장은 Kafka/Redis 연동 후 적용됩니다.</p>
        </section>
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
          <button type="button" @click="runPanelAction">
            {{ currentPanel.actionLabel }}
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
  margin: 0;
  font-size: 17px;
  font-weight: 800;
  color: var(--color-primary);
  letter-spacing: -0.3px;
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
  min-height: 74px;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 11px;
  flex-shrink: 0;
  display: flex;
  align-items: stretch;
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
  padding: 11px 34px 11px 12px;
  border-radius: 11px;
}

.room-delete-button {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--color-placeholder);
  font-size: 16px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.room-delete-button:hover {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.room-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.room-title-button {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  padding: 0;
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  color: #4a5570;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.room-title-button:hover {
  color: var(--color-primary-light);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.room-item.active .room-title-button {
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

.room-top span {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--color-placeholder);
}

.room-item p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--color-subtle);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

.faq-title {
  margin: 0 0 16px 4px;
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

.welcome-area {
  padding: 26px 28px 20px;
  border-bottom: 1px solid var(--color-border-light);
}

.welcome-top {
  display: flex;
  gap: 18px;
  align-items: flex-start;
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
  white-space: pre-line;
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

.message-row time,
.typing-row time {
  font-size: 11px;
  color: var(--color-placeholder);
}

.typing-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.typing-bubble {
  background: var(--color-white);
  border: 1px solid var(--color-border);
  border-radius: 4px 16px 16px 16px;
  padding: 13px 16px;
  display: flex;
  gap: 5px;
}

.typing-bubble span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-placeholder);
  animation: tanetPulse 1.1s ease-in-out infinite;
}

.typing-bubble span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-bubble span:nth-child(3) {
  animation-delay: 0.4s;
}

.composer-area {
  padding: 16px 24px 12px;
  border-top: 1px solid var(--color-border-light);
  background: var(--color-white);
}

.composer-box {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1.5px solid var(--color-border);
  border-radius: 14px;
  padding: 8px 8px 8px 16px;
}

.composer-box:focus-within {
  border-color: var(--color-primary-light);
}

.composer-box input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  color: var(--color-text);
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
}

.composer-box button:hover {
  background: var(--color-primary);
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