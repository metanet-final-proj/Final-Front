import { defineStore } from 'pinia'
import { chatApi } from '../api/chatApi'

const nowTime = () => {
  const date = new Date()
  const hour = date.getHours()
  const minute = String(date.getMinutes()).padStart(2, '0')
  const period = hour < 12 ? '오전' : '오후'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12

  return `${period} ${String(displayHour).padStart(2, '0')}:${minute}`
}

const getInitialMessages = () => [
  {
    id: `assistant-${Date.now()}`,
    role: 'assistant',
    text: '무엇을 도와드릴까요?',
    time: nowTime(),
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

export const useChatStore = defineStore('chat', {
  state: () => ({
    conversations: [],
    activeConversationId: null,
    messagesByConversationId: {},
    loading: false,
    creating: false,
    updating: false,
    deleting: false,
  }),

  getters: {
    rooms: (state) => {
      return state.conversations.map((conversation) => {
        const conversationId = conversation.conversationId
        const key = String(conversationId)
        const messages = state.messagesByConversationId[key] || getInitialMessages()

        return {
          id: conversationId,
          conversationId,
          title: conversation.title,
          chatType: conversation.chatType,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
          lastMessageAt: conversation.lastMessageAt,
          messages,
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
  },

  actions: {
    setActiveConversation(conversationId) {
      this.activeConversationId = conversationId
    },

    ensureInitialMessages(conversations) {
      const nextMessages = { ...this.messagesByConversationId }

      conversations.forEach((conversation) => {
        const key = String(conversation.conversationId)

        if (!nextMessages[key]) {
          nextMessages[key] = getInitialMessages()
        }
      })

      this.messagesByConversationId = nextMessages
    },

    async fetchConversations() {
      this.loading = true

      try {
        const response = await chatApi.listConversations()
        const data = Array.isArray(response.data) ? response.data : []

        this.conversations = data.map(normalizeConversation)
        this.ensureInitialMessages(this.conversations)

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
          [String(conversation.conversationId)]: getInitialMessages(),
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

    appendLocalMessage(conversationId, message) {
      if (!conversationId) return

      const key = String(conversationId)
      const currentMessages =
        this.messagesByConversationId[key] || getInitialMessages()

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
  },
})