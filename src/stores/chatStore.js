import { defineStore } from 'pinia'
import { chatApi } from '../api/chatApi'
import {
  hasTrackedAssistantMessage,
  mergeFetchedMessagesWithInFlight,
} from './chatMessageMerge.js'

const DEBUG_CHAT_SSE =
  import.meta.env.DEV || localStorage.getItem('debugChatSse') === '1'

const nowTime = () => {
  const date = new Date()
  const hour = date.getHours()
  const minute = String(date.getMinutes()).padStart(2, '0')
  const period = hour < 12 ? '오전' : '오후'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12

  return `${period} ${String(displayHour).padStart(2, '0')}:${minute}`
}

const ASSISTANT_LOADING_TEXT = '답변을 생성하고 있어요'
const ASSISTANT_FAILURE_TEXT = '답변 생성에 실패했습니다. 잠시 후 다시 질문해 주세요.'

const STAGE_LABELS = {
  planning: '요청을 분석하고 있어요...',
  summarizing: '지금까지의 대화를 요약하고 있어요...',
  tool_selecting: '필요한 정보와 작업을 결정하고 있어요...',
  generating: '답변을 작성하고 있어요...',
}

const getStatusText = (parsed) => {
  if (parsed.event === 'status') {
    return parsed.data?.message || STAGE_LABELS[parsed.data?.stage] || null
  }

  if (parsed.event === 'summary') {
    return parsed.data?.message || '이전 대화 요약을 완료했어요.'
  }

  if (parsed.event === 'progress') {
    return parsed.data?.message || STAGE_LABELS[parsed.data?.stage] || null
  }

  if (parsed.event === 'tool_start') {
    const name = parsed.data?.name || '도구'
    return `${name} 실행 중...`
  }

  return null
}

const AGENT_STAGE_TITLES = {
  planning: '요청을 분석하고 계획을 세우는 중',
  summarizing: '답변을 요약하는 중',
  tool_selecting: '필요한 정보와 작업을 결정하는 중',
  generating: '결과를 바탕으로 답변을 작성하는 중',
}

const RUNNING_STATUS_STAGES = new Set(['summarizing', 'tool_selecting', 'generating'])

const createAgentActivity = (currentText = ASSISTANT_LOADING_TEXT) => ({
  currentText,
  collapsed: false,
  steps: [],
})

const completeAgentActivity = (activity) => {
  if (!activity) return null

  return {
    ...activity,
    collapsed: true,
    steps: activity.steps.map((step) => ({
      ...step,
      status: 'done',
    })),
  }
}

const updateAgentStep = (activity, nextStep) => {
  const steps = activity.steps || []
  const exists = steps.some((step) => step.id === nextStep.id)

  if (exists) {
    return {
      ...activity,
      steps: steps.map((step) =>
        step.id === nextStep.id
          ? step.status === 'done' && nextStep.status !== 'done'
            ? step
            : {
                ...step,
                ...nextStep,
              }
          : step,
      ),
    }
  }

  return {
    ...activity,
    steps: [...steps, nextStep],
  }
}

const updateRepeatedToolStep = (activity, nextStep) => {
  const steps = activity.steps || []
  const existingIndex = steps.findIndex(
    (step) =>
      step.id === nextStep.id ||
      (Array.isArray(step.eventStepIds) && step.eventStepIds.includes(nextStep.id)),
  )

  if (existingIndex >= 0) {
    return {
      ...activity,
      steps: steps.map((step, index) =>
        index === existingIndex
          ? {
              ...step,
              ...nextStep,
              id: step.id,
              repeatCount: step.repeatCount || 1,
              eventStepIds: step.eventStepIds || [step.id],
            }
          : step,
      ),
    }
  }

  const lastIndex = steps.length - 1
  const lastStep = steps[lastIndex]
  const isSameAsPrevious =
    lastStep?.type === 'tool' &&
    lastStep.tool === nextStep.tool &&
    lastStep.title === nextStep.title

  if (isSameAsPrevious) {
    return {
      ...activity,
      steps: steps.map((step, index) =>
        index === lastIndex
          ? {
              ...step,
              status: nextStep.status,
              repeatCount: (step.repeatCount || 1) + 1,
              eventStepIds: [...(step.eventStepIds || [step.id]), nextStep.id],
            }
          : step,
      ),
    }
  }

  return {
    ...activity,
    steps: [
      ...steps,
      {
        ...nextStep,
        repeatCount: 1,
        eventStepIds: [nextStep.id],
      },
    ],
  }
}

const updateAgentActivityFromEvent = (activity, parsed) => {
  const statusText = getStatusText(parsed)

  if (!statusText) return activity

  const baseActivity = activity || createAgentActivity(statusText)
  const data = parsed.data || {}

  if (parsed.event === 'status') {
    const stage = data.stage || 'status'
    const sequenceNo = data.sequenceNo ?? data.sequence_no ?? null
    const stepSuffix = sequenceNo == null ? '' : `-${sequenceNo}`
    const nextStep = {
      id: `status-${stage}${stepSuffix}`,
      type: 'status',
      title: data.message || AGENT_STAGE_TITLES[stage] || statusText,
      status: RUNNING_STATUS_STAGES.has(stage) ? 'running' : 'done',
    }
    const completedSteps = (baseActivity.steps || []).map((step) =>
      step.status === 'running'
        ? {
            ...step,
            status: 'done',
          }
        : step,
    )

    return updateAgentStep(
      {
        ...baseActivity,
        currentText: statusText,
        collapsed: false,
        steps: completedSteps,
      },
      nextStep,
    )
  }

  if (parsed.event === 'summary') {
    const completedSteps = (baseActivity.steps || []).map((step) =>
      step.status === 'running'
        ? {
            ...step,
            status: 'done',
          }
        : step,
    )

    return updateAgentStep(
      {
        ...baseActivity,
        currentText: statusText,
        collapsed: false,
        steps: completedSteps,
      },
      {
        id: 'status-summarizing',
        type: 'summary',
        title: statusText,
        status: 'done',
      },
    )
  }

  if (parsed.event === 'progress') {
    const stage = data.stage || 'progress'
    const tool = data.tool || data.name || null
    const isToolTerminal = stage === 'tool_end' || stage === 'tool_error'
    const sequenceNo = data.sequenceNo ?? data.sequence_no ?? null
    const stepSuffix = sequenceNo == null ? '' : `-${sequenceNo}`
    const stepId = tool ? `tool-${tool}${stepSuffix}` : `progress-${stage}${stepSuffix}`
    const completedSteps = (baseActivity.steps || []).map((step) =>
      step.status === 'running' && step.id !== stepId
        ? {
            ...step,
            status: 'done',
          }
        : step,
    )

    const nextActivity = {
      ...baseActivity,
      currentText: statusText,
      collapsed: false,
      steps: completedSteps,
    }
    const nextStep = {
      id: stepId,
      type: tool ? 'tool' : 'progress',
      tool,
      title: statusText,
      status: isToolTerminal ? 'done' : 'running',
    }

    return tool
      ? updateRepeatedToolStep(nextActivity, nextStep)
      : updateAgentStep(nextActivity, nextStep)
  }

  return {
    ...baseActivity,
    currentText: statusText,
  }
}

const formatKoreanTime = (value) => {
  if (!value) return nowTime()

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return nowTime()
  }

  const hour = date.getHours()
  const minute = String(date.getMinutes()).padStart(2, '0')
  const period = hour < 12 ? '오전' : '오후'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12

  return `${period} ${String(displayHour).padStart(2, '0')}:${minute}`
}

const getInitialMessages = () => [
  {
    id: `local-assistant-${Date.now()}`,
    messageId: null,
    role: 'assistant',
    text: '무엇을 도와드릴까요?',
    content: '무엇을 도와드릴까요?',
    time: nowTime(),
    createdAt: null,
    isLocal: true,
  },
]

const normalizeConversation = (conversation) => ({
  conversationId: conversation.conversationId,
  title: conversation.title || '새 채팅',
  chatType: conversation.chatType || 'GENERAL',
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt,
  lastMessageAt: conversation.lastMessageAt,
})

const normalizeRole = (role) => {
  const upperRole = String(role || '').toUpperCase()

  if (upperRole === 'USER') return 'user'
  if (upperRole === 'ASSISTANT') return 'assistant'
  if (upperRole === 'SYSTEM') return 'assistant'
  if (upperRole === 'TOOL') return 'assistant'

  return 'assistant'
}

const normalizeSupplyItem = (item = {}) => ({
  ...item,
  itemId: item.itemId ?? item.item_id ?? item.id ?? null,
  itemName: item.itemName ?? item.item_name ?? item.name ?? item.supplyItemName ?? null,
  category: item.category ?? null,
  stockQuantity: Number(item.stockQuantity ?? item.stock_quantity ?? 0),
  status: item.status ?? 'ACTIVE',
})

const normalizeSupplyItems = (items) => (
  Array.isArray(items) ? items.map(normalizeSupplyItem) : null
)

const normalizeMessage = (message) => {
  const messageId = message.messageId || message.message_id || message.id || null
  const conversationId =
    message.conversationId || message.conversation_id || message.chatConversationId || null
  const createdAt = message.createdAt || message.created_at || null
  const role = normalizeRole(message.role)
  const actionDraft = message.actionDraft || message.action_draft || null
  const originalContent = message.content ?? message.message ?? message.text ?? ''
  const presentationMessage = String(
    actionDraft?.presentationMessage || actionDraft?.presentation_message || '',
  ).trim()
  const content = role === 'assistant' && presentationMessage
    ? presentationMessage
    : originalContent

  return {
    id: messageId || `${role}-${createdAt || Date.now()}-${Math.random()}`,
    messageId,
    conversationId,
    role,
    text: content,
    content,
    tag: message.tag || null,
    agentActivity: message.agentActivity || null,
    actionDraft,
    meetingReservations: message.meetingReservations || message.meeting_reservations || null,
    meetingReservationActionResult:
      message.meetingReservationActionResult || message.meeting_reservation_action_result || null,
    meetingRoomAvailableList:
      message.meetingRoomAvailableList || message.meeting_room_available_list || null,
    meetingRoomDetail: message.meetingRoomDetail || message.meeting_room_detail || null,
    visitorParkingRegistrations:
      message.visitorParkingRegistrations || message.visitor_parking_registrations || null,
    visitorParkingActionResult:
      message.visitorParkingActionResult || message.visitor_parking_action_result || null,
    supplyItems: normalizeSupplyItems(message.supplyItems || message.supply_items),
    supplyRequests: message.supplyRequests || message.supply_requests || null,
    supplyRequestActionResult:
      message.supplyRequestActionResult || message.supply_request_action_result || null,
    supplyItemActionResult:
      message.supplyItemActionResult || message.supply_item_action_result || null,
    ownerDisplayName: message.ownerDisplayName || message.owner_display_name || null,
    createdAt,
    time: formatKoreanTime(createdAt),
    isLocal: false,
  }
}

const extractMessages = (data) => {
  if (!data) return []

  if (Array.isArray(data)) {
    return data.map(normalizeMessage)
  }

  if (Array.isArray(data.data)) {
    return data.data.map(normalizeMessage)
  }

  if (Array.isArray(data.messages)) {
    return data.messages.map(normalizeMessage)
  }

  const result = []

  if (data.userMessage) {
    result.push(normalizeMessage(data.userMessage))
  }

  if (data.assistantMessage) {
    result.push(normalizeMessage(data.assistantMessage))
  }

  if (data.message) {
    result.push(normalizeMessage(data.message))
  }

  if (
    data.messageId ||
    data.message_id ||
    data.content ||
    data.text ||
    data.role
  ) {
    result.push(normalizeMessage(data))
  }

  return result
}

const extractChunkContent = (data) => {
  if (!data) return ''

  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data)
      return parsed.content || parsed.message || parsed.text || data
    } catch {
      return data
    }
  }

  if (typeof data === 'object') {
    return data.content || data.message || data.text || ''
  }

  return String(data)
}

const extractRefreshTargets = (data) => {
  const targets = data?.refreshTargets || data?.refresh_targets

  if (!Array.isArray(targets)) {
    return []
  }

  return targets
    .map((target) => String(target || '').trim())
    .filter(Boolean)
}

export const useChatStore = defineStore('chat', {
  state: () => ({
    conversations: [],
    activeConversationId: null,
    messagesByConversationId: {},
    inFlightByConversationId: {},
    loading: false,
    messagesLoading: false,
    creating: false,
    updating: false,
    deleting: false,
  }),

  getters: {
    rooms: (state) => {
      return state.conversations.map((conversation) => {
        const conversationId = conversation.conversationId
        const key = String(conversationId)
        const messages = state.messagesByConversationId[key]
        const inFlight = state.inFlightByConversationId[key]

        return {
          id: conversationId,
          conversationId,
          title: conversation.title,
          chatType: conversation.chatType,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
          lastMessageAt: conversation.lastMessageAt,
          isAnswering: inFlight?.status === 'streaming',
          messages:
            messages && messages.length > 0
              ? messages
              : getInitialMessages(),
        }
      })
    },

    activeRoom() {
      return (
        this.rooms.find((room) => room.id === this.activeConversationId) ||
        this.rooms[0] || {
          id: null,
          conversationId: null,
          title: '새 채팅',
          chatType: 'GENERAL',
          createdAt: null,
          updatedAt: null,
          lastMessageAt: null,
          messages: getInitialMessages(),
        }
      )
    },

    isConversationAnswering: (state) => (conversationId) => {
      if (!conversationId) return false

      return state.inFlightByConversationId[String(conversationId)]?.status === 'streaming'
    },
  },

  actions: {
    setActiveConversation(conversationId) {
      this.activeConversationId = conversationId
    },

    startConversationInFlight(conversationId, assistantMessageId) {
      if (!conversationId || !assistantMessageId) return

      const key = String(conversationId)

      this.inFlightByConversationId = {
        ...this.inFlightByConversationId,
        [key]: {
          conversationId,
          assistantMessageId,
          status: 'streaming',
          startedAt: new Date().toISOString(),
        },
      }
    },

    updateInFlightAssistantMessageId(conversationId, assistantMessageId) {
      if (!conversationId || !assistantMessageId) return

      const key = String(conversationId)
      const current = this.inFlightByConversationId[key]

      if (!current) return

      this.inFlightByConversationId = {
        ...this.inFlightByConversationId,
        [key]: {
          ...current,
          assistantMessageId,
        },
      }
    },

    completeConversationInFlight(conversationId) {
      if (!conversationId) return

      const key = String(conversationId)
      const current = this.inFlightByConversationId[key]

      if (!current) return

      this.inFlightByConversationId = {
        ...this.inFlightByConversationId,
        [key]: {
          ...current,
          status: 'completed',
          completedAt: new Date().toISOString(),
        },
      }
    },

    finishConversationInFlight(conversationId) {
      if (!conversationId) return

      const key = String(conversationId)

      if (!this.inFlightByConversationId[key]) return

      const nextInFlight = { ...this.inFlightByConversationId }
      delete nextInFlight[key]
      this.inFlightByConversationId = nextInFlight
    },

    async fetchConversations() {
      this.loading = true

      try {
        const response = await chatApi.listConversations()
        const data = Array.isArray(response.data) ? response.data : []

        this.conversations = data.map(normalizeConversation)

        const activeExists = this.conversations.some(
          (conversation) =>
            conversation.conversationId === this.activeConversationId,
        )

        if (!activeExists) {
          this.activeConversationId =
            this.conversations[0]?.conversationId || null
        }

        return this.conversations
      } finally {
        this.loading = false
      }
    },

    async createConversation(payload = {}) {
      this.creating = true

      try {
        const response = await chatApi.createConversation({
          title: payload.title || '새 채팅',
          chatType: payload.chatType || 'GENERAL',
        })

        const conversation = normalizeConversation(response.data)

        this.conversations = [
          conversation,
          ...this.conversations.filter(
            (item) => item.conversationId !== conversation.conversationId,
          ),
        ]

        this.activeConversationId = conversation.conversationId

        this.messagesByConversationId = {
          ...this.messagesByConversationId,
          [String(conversation.conversationId)]: [],
        }

        return conversation
      } finally {
        this.creating = false
      }
    },

    async updateConversationTitle(conversationId, title) {
      if (!conversationId || !title.trim()) return null

      const safeTitle = title.trim().slice(0, 255)
      const previousConversations = [...this.conversations]

      this.updating = true

      this.conversations = this.conversations.map((conversation) => {
        if (conversation.conversationId !== conversationId) {
          return conversation
        }

        return {
          ...conversation,
          title: safeTitle,
          updatedAt: new Date().toISOString(),
        }
      })

      try {
        const response = await chatApi.updateConversationTitle(
          conversationId,
          safeTitle,
        )

        const updated = normalizeConversation(response.data)

        this.conversations = this.conversations.map((conversation) => {
          if (conversation.conversationId !== conversationId) {
            return conversation
          }

          return updated
        })

        return updated
      } catch (error) {
        this.conversations = previousConversations
        throw error
      } finally {
        this.updating = false
      }
    },

    async deleteConversation(conversationId) {
      if (!conversationId) return

      this.deleting = true

      try {
        await chatApi.deleteConversation(conversationId)

        this.conversations = this.conversations.filter(
          (conversation) => conversation.conversationId !== conversationId,
        )

        const copiedMessages = { ...this.messagesByConversationId }
        delete copiedMessages[String(conversationId)]
        this.messagesByConversationId = copiedMessages

        if (this.activeConversationId === conversationId) {
          this.activeConversationId =
            this.conversations[0]?.conversationId || null
        }
      } finally {
        this.deleting = false
      }
    },

    async fetchMessages(conversationId) {
      if (!conversationId) return []

      const key = String(conversationId)
      this.messagesLoading = true

      try {
        const response = await chatApi.listMessages(conversationId)
        const serverMessages = extractMessages(response.data)
        const inFlight = this.inFlightByConversationId[key]
        const messages = mergeFetchedMessagesWithInFlight(
          serverMessages,
          this.messagesByConversationId[key],
          inFlight,
        )

        this.messagesByConversationId = {
          ...this.messagesByConversationId,
          [key]: messages,
        }

        if (
          inFlight?.status === 'completed' &&
          hasTrackedAssistantMessage(serverMessages, inFlight)
        ) {
          this.finishConversationInFlight(conversationId)
        }

        return messages
      } catch (error) {
        if (error.response?.status === 404) {
          const messages = mergeFetchedMessagesWithInFlight(
            [],
            this.messagesByConversationId[key],
            this.inFlightByConversationId[key],
          )

          this.messagesByConversationId = {
            ...this.messagesByConversationId,
            [key]: messages,
          }

          return messages
        }

        throw error
      } finally {
        this.messagesLoading = false
      }
    },

    appendLocalMessage(conversationId, message) {
      if (!conversationId) return

      const key = String(conversationId)
      const currentMessages = this.messagesByConversationId[key] || []

      this.messagesByConversationId = {
        ...this.messagesByConversationId,
        [key]: [...currentMessages, message],
      }

      this.conversations = this.conversations.map((conversation) => {
        if (conversation.conversationId !== conversationId) {
          return conversation
        }

        return {
          ...conversation,
          lastMessageAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      })
    },

    replaceLocalMessage(conversationId, localMessageId, serverMessage) {
      const key = String(conversationId)
      const currentMessages = this.messagesByConversationId[key] || []
      const normalized = normalizeMessage(serverMessage)

      let replacement = null

      this.messagesByConversationId = {
        ...this.messagesByConversationId,
        [key]: currentMessages.map((message) => {
          if (message.id !== localMessageId) {
            return message
          }

          replacement = {
            ...normalized,
            agentActivity: normalized.agentActivity || message.agentActivity || null,
            meetingReservations: normalized.meetingReservations || message.meetingReservations || null,
            meetingRoomAvailableList:
              normalized.meetingRoomAvailableList || message.meetingRoomAvailableList || null,
            meetingRoomDetail: normalized.meetingRoomDetail || message.meetingRoomDetail || null,
            visitorParkingRegistrations:
              normalized.visitorParkingRegistrations || message.visitorParkingRegistrations || null,
            visitorParkingActionResult:
              normalized.visitorParkingActionResult || message.visitorParkingActionResult || null,
            supplyItems: normalized.supplyItems || message.supplyItems || null,
            supplyRequests: normalized.supplyRequests || message.supplyRequests || null,
            supplyRequestActionResult:
              normalized.supplyRequestActionResult || message.supplyRequestActionResult || null,
            supplyItemActionResult:
              normalized.supplyItemActionResult || message.supplyItemActionResult || null,
            ownerDisplayName: normalized.ownerDisplayName || message.ownerDisplayName || null,
          }

          return replacement
        }),
      }

      return replacement
    },

    updateLocalMessageText(conversationId, localMessageId, updater) {
      const key = String(conversationId)
      const currentMessages = this.messagesByConversationId[key] || []

      this.messagesByConversationId = {
        ...this.messagesByConversationId,
        [key]: currentMessages.map((message) => {
          if (message.id !== localMessageId) {
            return message
          }

          const nextText =
            typeof updater === 'function' ? updater(message.text || '') : updater

          return {
            ...message,
            text: nextText,
            content: nextText,
          }
        }),
      }
    },

    patchLocalMessage(conversationId, localMessageId, patch) {
      const key = String(conversationId)
      const currentMessages = this.messagesByConversationId[key] || []
    
      this.messagesByConversationId = {
        ...this.messagesByConversationId,
        [key]: currentMessages.map((message) => {
          if (message.id !== localMessageId) {
            return message
          }
    
          return {
            ...message,
            ...patch,
          }
        }),
      }
    },

    updateActionDraft(actionDraft) {
      const draftId = actionDraft?.draftId || actionDraft?.draft_id
      if (!draftId) return

      const preserveSupplyItemSnapshots = (currentDraft, nextDraft) => {
        const currentItems = currentDraft?.values?.items
        const nextItems = nextDraft?.values?.items
        if (!Array.isArray(currentItems) || !Array.isArray(nextItems)) return nextDraft

        const currentById = new Map(currentItems.map((item) => [
          String(item?.itemId ?? item?.item_id ?? ''),
          item,
        ]))
        return {
          ...nextDraft,
          values: {
            ...(nextDraft.values || {}),
            items: nextItems.map((item) => {
              const previous = currentById.get(String(item?.itemId ?? item?.item_id ?? ''))
              return item?.stockQuantity == null && item?.stock_quantity == null && previous
                ? { ...item, stockQuantity: previous.stockQuantity ?? previous.stock_quantity ?? 0 }
                : item
            }),
          },
        }
      }

      const updated = {}
      Object.entries(this.messagesByConversationId).forEach(([key, messages]) => {
        updated[key] = (messages || []).map((message) => {
          const currentDraftId = message.actionDraft?.draftId || message.actionDraft?.draft_id
          return String(currentDraftId || '') === String(draftId)
            ? {
                ...message,
                actionDraft: preserveSupplyItemSnapshots(message.actionDraft, actionDraft),
              }
            : message
        })
      })
      this.messagesByConversationId = updated
    },

    setMessageActionDraft(conversationId, messageId, actionDraft) {
      const key = String(conversationId)
      this.messagesByConversationId = {
        ...this.messagesByConversationId,
        [key]: (this.messagesByConversationId[key] || []).map((message) => (
          String(message.id) === String(messageId)
            ? { ...message, actionDraft }
            : message
        )),
      }
    },

    setMessageMeetingReservations(conversationId, messageId, reservations, ownerDisplayName = null) {
      const key = String(conversationId)
      this.messagesByConversationId = {
        ...this.messagesByConversationId,
        [key]: (this.messagesByConversationId[key] || []).map((message) => (
          String(message.id) === String(messageId)
            ? {
                ...message,
                meetingReservations: reservations,
                ownerDisplayName: ownerDisplayName || message.ownerDisplayName || null,
              }
            : message
        )),
      }
    },

    setMessageMeetingReservationActionResult(conversationId, messageId, actionResult) {
      const key = String(conversationId)
      this.messagesByConversationId = {
        ...this.messagesByConversationId,
        [key]: (this.messagesByConversationId[key] || []).map((message) => (
          String(message.id) === String(messageId)
            ? { ...message, meetingReservationActionResult: actionResult }
            : message
        )),
      }
    },

    setMessageMeetingRoomAvailableList(conversationId, messageId, data) {
      const key = String(conversationId)
      this.messagesByConversationId = {
        ...this.messagesByConversationId,
        [key]: (this.messagesByConversationId[key] || []).map((message) => (
          String(message.id) === String(messageId)
            ? { ...message, meetingRoomAvailableList: data }
            : message
        )),
      }
    },

    setMessageMeetingRoomDetail(conversationId, messageId, data) {
      const key = String(conversationId)
      this.messagesByConversationId = {
        ...this.messagesByConversationId,
        [key]: (this.messagesByConversationId[key] || []).map((message) => (
          String(message.id) === String(messageId)
            ? { ...message, meetingRoomDetail: data }
            : message
        )),
      }
    },

    setMessageVisitorParkingRegistrations(
      conversationId,
      messageId,
      registrations,
      ownerDisplayName = null,
    ) {
      const key = String(conversationId)
      this.messagesByConversationId = {
        ...this.messagesByConversationId,
        [key]: (this.messagesByConversationId[key] || []).map((message) => (
          String(message.id) === String(messageId)
            ? {
                ...message,
                visitorParkingRegistrations: registrations,
                ownerDisplayName: ownerDisplayName || message.ownerDisplayName || null,
              }
            : message
        )),
      }
    },

    setMessageVisitorParkingActionResult(conversationId, messageId, actionResult) {
      const key = String(conversationId)
      this.messagesByConversationId = {
        ...this.messagesByConversationId,
        [key]: (this.messagesByConversationId[key] || []).map((message) => (
          String(message.id) === String(messageId)
            ? { ...message, visitorParkingActionResult: actionResult }
            : message
        )),
      }
    },

    setMessageSupplyItems(conversationId, messageId, items) {
      const key = String(conversationId)
      this.messagesByConversationId = {
        ...this.messagesByConversationId,
        [key]: (this.messagesByConversationId[key] || []).map((message) => (
          String(message.id) === String(messageId)
            ? { ...message, supplyItems: normalizeSupplyItems(items) || [] }
            : message
        )),
      }
    },

    setMessageSupplyRequests(conversationId, messageId, requests, ownerDisplayName = null) {
      const key = String(conversationId)
      this.messagesByConversationId = {
        ...this.messagesByConversationId,
        [key]: (this.messagesByConversationId[key] || []).map((message) => (
          String(message.id) === String(messageId)
            ? {
                ...message,
                supplyRequests: requests,
                ownerDisplayName: ownerDisplayName || message.ownerDisplayName || null,
              }
            : message
        )),
      }
    },

    setMessageSupplyRequestActionResult(conversationId, messageId, actionResult) {
      const key = String(conversationId)
      this.messagesByConversationId = {
        ...this.messagesByConversationId,
        [key]: (this.messagesByConversationId[key] || []).map((message) => (
          String(message.id) === String(messageId)
            ? { ...message, supplyRequestActionResult: actionResult }
            : message
        )),
      }
    },

    setMessageSupplyItemActionResult(conversationId, messageId, actionResult) {
      const key = String(conversationId)
      this.messagesByConversationId = {
        ...this.messagesByConversationId,
        [key]: (this.messagesByConversationId[key] || []).map((message) => (
          String(message.id) === String(messageId)
            ? { ...message, supplyItemActionResult: actionResult }
            : message
        )),
      }
    },

    async createMeetingRoomActionDraft(payload) {
      const response = await chatApi.createMeetingRoomActionDraft(payload)
      return response.data
    },

    async createVisitorParkingActionDraft(payload) {
      const response = await chatApi.createVisitorParkingActionDraft(payload)
      return response.data
    },

    async createSupplyActionDraft(payload) {
      const response = await chatApi.createSupplyActionDraft(payload)
      return response.data
    },

    async confirmActionDraft({ draftId, version, values }) {
      const response = await chatApi.confirmActionDraft(
        draftId,
        version,
        values,
      )
      this.updateActionDraft(response.data)
      return response.data
    },

    removeLocalMessage(conversationId, localMessageId) {
      const key = String(conversationId)
      const currentMessages = this.messagesByConversationId[key] || []

      this.messagesByConversationId = {
        ...this.messagesByConversationId,
        [key]: currentMessages.filter((message) => message.id !== localMessageId),
      }
    },

    async sendMessage(conversationId, message) {
      if (
        !conversationId ||
        !message.trim() ||
        this.isConversationAnswering(conversationId)
      ) {
        return []
      }

      const trimmedMessage = message.trim()
      const localUserMessageId = `local-user-${Date.now()}`
      const localAssistantMessageId = `local-assistant-${Date.now()}`

      const localUserMessage = {
        id: localUserMessageId,
        messageId: null,
        conversationId,
        role: 'user',
        text: trimmedMessage,
        content: trimmedMessage,
        time: nowTime(),
        createdAt: new Date().toISOString(),
        isLocal: true,
      }

      const localAssistantMessage = {
        id: localAssistantMessageId,
        messageId: null,
        conversationId,
        role: 'assistant',
        text: ASSISTANT_LOADING_TEXT,
        content: ASSISTANT_LOADING_TEXT,
        time: nowTime(),
        createdAt: new Date().toISOString(),
        isLocal: true,
        isLoading: true,
        agentActivity: createAgentActivity(),
      }

      let hasReceivedFirstChunk = false
      let hasReceivedAssistantMessage = false
      let agentActivity = localAssistantMessage.agentActivity
      const refreshTargets = new Set()

      this.appendLocalMessage(conversationId, localUserMessage)
      this.appendLocalMessage(conversationId, localAssistantMessage)
      const idempotencyKey = `idem_${crypto.randomUUID()}`
      this.startConversationInFlight(conversationId, localAssistantMessageId)

      try {
        await chatApi.sendMessageStream(conversationId, trimmedMessage, {
          onUserMessage: (data) => {
            this.replaceLocalMessage(conversationId, localUserMessageId, data)
          },

          onChunk: (data) => {
            const chunk = extractChunkContent(data)
          
            if (!chunk) return
          
            if (!hasReceivedFirstChunk) {
              if (DEBUG_CHAT_SSE) {
                console.log('[chat:store:first-chunk]', {
                  conversationId,
                  localAssistantMessageId,
                  data,
                  chunk,
                  agentActivity,
                })
              }

              hasReceivedFirstChunk = true
              agentActivity = completeAgentActivity(agentActivity)
          
              this.patchLocalMessage(conversationId, localAssistantMessageId, {
                text: chunk,
                content: chunk,
                isLoading: false,
                agentActivity,
              })
          
              return
            }
          
            this.updateLocalMessageText(
              conversationId,
              localAssistantMessageId,
              (currentText) => currentText + chunk,
            )
          },

          onAssistantMessage: (data) => {
            if (DEBUG_CHAT_SSE) {
              console.log('[chat:store:assistant-message]', {
                conversationId,
                localAssistantMessageId,
                data,
                agentActivity,
              })
            }

            hasReceivedAssistantMessage = true
            agentActivity = completeAgentActivity(agentActivity)
            const assistantMessage = this.replaceLocalMessage(
              conversationId,
              localAssistantMessageId,
              {
                ...data,
                agentActivity,
              },
            )

            if (assistantMessage?.id) {
              this.updateInFlightAssistantMessageId(
                conversationId,
                assistantMessage.id,
              )
            }
          },

          onError: (data) => {
            console.error('SSE error event:', data)
          },

          onEvent: (parsed) => {
            if (DEBUG_CHAT_SSE) {
              console.log('[chat:store:event:received]', {
                event: parsed.event,
                data: parsed.data,
                rawData: parsed.rawData,
                hasReceivedFirstChunk,
                currentSteps: agentActivity?.steps || [],
              })
            }

            extractRefreshTargets(parsed.data).forEach((target) => {
              refreshTargets.add(target)
            })

            if (parsed.event === 'final_revision') {
              const content = parsed.data?.content
              if (content) {
                hasReceivedFirstChunk = true
                agentActivity = completeAgentActivity(agentActivity)
                this.patchLocalMessage(conversationId, localAssistantMessageId, {
                  text: content,
                  content,
                  isLoading: false,
                  agentActivity,
                })
              }
              return
            }
            if (parsed.event === 'meeting_reservation_list') {
              this.setMessageMeetingReservations(
                conversationId,
                localAssistantMessageId,
                parsed.data?.reservations || [],
                parsed.data?.ownerDisplayName || parsed.data?.owner_display_name || null,
              )
              return
            }
            if (parsed.event === 'meeting_room_available_list') {
              this.setMessageMeetingRoomAvailableList(
                conversationId,
                localAssistantMessageId,
                parsed.data || {},
              )
              return
            }
            if (parsed.event === 'meeting_room_detail') {
              this.setMessageMeetingRoomDetail(
                conversationId,
                localAssistantMessageId,
                parsed.data || {},
              )
              return
            }
            if (parsed.event === 'visitor_parking_registration_list') {
              this.setMessageVisitorParkingRegistrations(
                conversationId,
                localAssistantMessageId,
                parsed.data?.registrations || [],
                parsed.data?.ownerDisplayName || parsed.data?.owner_display_name || null,
              )
              return
            }
            if (parsed.event === 'supply_item_list') {
              this.setMessageSupplyItems(
                conversationId,
                localAssistantMessageId,
                parsed.data?.items || [],
              )
              return
            }
            if (parsed.event === 'supply_request_list') {
              this.setMessageSupplyRequests(
                conversationId,
                localAssistantMessageId,
                parsed.data?.requests || [],
                parsed.data?.ownerDisplayName || parsed.data?.owner_display_name || null,
              )
              return
            }
            const statusText = getStatusText(parsed)
            if (!statusText) {
              if (DEBUG_CHAT_SSE) {
                console.log('[chat:store:event:no-status-text]', {
                  event: parsed.event,
                  data: parsed.data,
                })
              }
              return
            }

            agentActivity = updateAgentActivityFromEvent(agentActivity, parsed)

            if (DEBUG_CHAT_SSE) {
              console.log('[chat:store:event:activity-updated]', {
                event: parsed.event,
                statusText,
                hasReceivedFirstChunk,
                steps: agentActivity?.steps || [],
                agentActivity,
              })
            }

            const activityPatch = hasReceivedFirstChunk
              ? { agentActivity }
              : {
                  text: statusText,
                  content: statusText,
                  agentActivity,
                }

            this.patchLocalMessage(
              conversationId,
              localAssistantMessageId,
              activityPatch,
            )
          },      
        }, { idempotencyKey })

        if (!hasReceivedFirstChunk && !hasReceivedAssistantMessage) {
          this.patchLocalMessage(conversationId, localAssistantMessageId, {
            text: ASSISTANT_FAILURE_TEXT,
            content: ASSISTANT_FAILURE_TEXT,
            isLoading: false,
            agentActivity: completeAgentActivity(agentActivity),
          })
        }

        await this.fetchConversations()

        return {
          messages: this.messagesByConversationId[String(conversationId)] || [],
          refreshTargets: [...refreshTargets],
        }
      } catch (error) {
        console.error('Send message failed:', error)
        console.error('Send message failed status:', error.status)
        console.error('Send message failed response:', error.responseText)

        this.patchLocalMessage(conversationId, localAssistantMessageId, {
          text: ASSISTANT_FAILURE_TEXT,
          content: ASSISTANT_FAILURE_TEXT,
          isLoading: false,
          agentActivity: completeAgentActivity(agentActivity),
        })

        this.finishConversationInFlight(conversationId)

        throw error
      } finally {
        if (hasReceivedAssistantMessage) {
          this.completeConversationInFlight(conversationId)
        } else {
          this.finishConversationInFlight(conversationId)
        }
      }
    },
  },
})
