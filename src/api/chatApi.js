import apiClient from './client'
import { useAuthStore } from '../stores/authStore'
import { tokenStore } from '../stores/tokenStore.js'

const DEBUG_CHAT_SSE =
  import.meta.env.DEV || localStorage.getItem('debugChatSse') === '1'

const getApiBaseUrl = () => {
  if (import.meta.env.DEV) {
    return ''
  }

  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
}

const getAuthHeaders = () => {
  const accessToken = tokenStore.getAccessToken()
  const tokenType = tokenStore.getTokenType()

  if (!accessToken) {
    return {}
  }

  return {
    Authorization: `${tokenType} ${accessToken}`,
  }
}

const parseSseEventBlock = (block) => {
  const lines = block.split('\n')
  let eventName = 'message'
  const dataLines = []

  lines.forEach((line) => {
    if (line.startsWith('event:')) {
      eventName = line.slice('event:'.length).trim()
      return
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trim())
    }
  })

  const rawData = dataLines.join('\n')

  let data = rawData

  try {
    data = JSON.parse(rawData)
  } catch {
    data = rawData
  }

  return {
    event: eventName,
    data,
    rawData,
    rawBlock: block,
  }
}

const createSseError = (data) => {
  const message = typeof data === 'string'
    ? data
    : data?.message || data?.error || 'Failed to stream chat response.'
  const error = new Error(message)

  error.isSseError = true
  error.responseText = typeof data === 'string' ? data : JSON.stringify(data)

  return error
}

const consumeSseStream = async (response, handlers = {}) => {
  const reader = response.body?.getReader()

  if (!reader) {
    return
  }

  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()

    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })

    const blocks = buffer.split(/\n\n|\r\n\r\n/)
    buffer = blocks.pop() || ''

    for (const block of blocks) {
      const trimmedBlock = block.trim()

      if (!trimmedBlock) continue

      const parsed = parseSseEventBlock(trimmedBlock)

      if (DEBUG_CHAT_SSE) {
        console.log('[chat:sse:parsed]', {
          event: parsed.event,
          data: parsed.data,
          rawData: parsed.rawData,
          rawBlock: parsed.rawBlock,
          dataType: typeof parsed.data,
        })
      }

      if (parsed.event === 'user_message') {
        handlers.onUserMessage?.(parsed.data)
        continue
      }

      if (parsed.event === 'chunk') {
        handlers.onChunk?.(parsed.data)
        continue
      }

      if (parsed.event === 'assistant_message') {
        handlers.onAssistantMessage?.(parsed.data)
        continue
      }

      if (parsed.event === 'error') {
        handlers.onError?.(parsed.data)
        throw createSseError(parsed.data)
      }

      handlers.onEvent?.(parsed)
    }
  }

  const remaining = buffer.trim()

  if (remaining) {
    const parsed = parseSseEventBlock(remaining)

    if (DEBUG_CHAT_SSE) {
      console.log('[chat:sse:parsed:remaining]', {
        event: parsed.event,
        data: parsed.data,
        rawData: parsed.rawData,
        rawBlock: parsed.rawBlock,
        dataType: typeof parsed.data,
      })
    }

    if (parsed.event === 'user_message') {
      handlers.onUserMessage?.(parsed.data)
    } else if (parsed.event === 'chunk') {
      handlers.onChunk?.(parsed.data)
    } else if (parsed.event === 'assistant_message') {
      handlers.onAssistantMessage?.(parsed.data)
    } else if (parsed.event === 'error') {
      handlers.onError?.(parsed.data)
      throw createSseError(parsed.data)
    } else {
      handlers.onEvent?.(parsed)
    }
  }
}

export const chatApi = {
  listConversations() {
    return apiClient.get('/api/v1/chat/conversations')
  },

  createConversation({ title = '새 채팅', chatType = 'GENERAL' } = {}) {
    return apiClient.post('/api/v1/chat/conversations', {
      title,
      chatType,
    })
  },

  updateConversationTitle(conversationId, title) {
    return apiClient.patch(`/api/v1/chat/conversations/${conversationId}`, {
      title,
    })
  },

  deleteConversation(conversationId) {
    return apiClient.delete(`/api/v1/chat/conversations/${conversationId}`)
  },

  listMessages(conversationId) {
    return apiClient.get(`/api/v1/chat/conversations/${conversationId}/messages`)
  },

  confirmActionDraft(draftId, version, values) {
    return apiClient.post(
      `/api/v1/chat/action-drafts/${draftId}/confirm`,
      { version, values },
    )
  },

  async sendMessageStream(conversationId, message, handlers = {}, requestOptions = {}) {
    const baseUrl = getApiBaseUrl()
    const authStore = useAuthStore()
    const idempotencyKey = requestOptions.idempotencyKey || `idem_${crypto.randomUUID()}`

    await authStore.ensureFreshAccessToken()

    const sendRequest = () => fetch(
      `${baseUrl}/api/v1/chat/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          'Idempotency-Key': idempotencyKey,
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          message,
        }),
      },
    )

    let response = await sendRequest()

    if (response.status === 401) {
      await authStore.refreshAccessToken()
      response = await sendRequest()
    }

    let processingRetries = 0
    while (response.status === 202 && processingRetries < 3) {
      const retryAfterSeconds = Number(response.headers.get('Retry-After')) || 2
      await new Promise((resolve) => setTimeout(resolve, retryAfterSeconds * 1000))
      processingRetries += 1
      response = await sendRequest()
    }

    if (!response.ok) {
      const errorText = await response.text()

      const error = new Error(
        `Failed to send message. status=${response.status}`,
      )

      error.status = response.status
      error.responseText = errorText

      throw error
    }

    await consumeSseStream(response, handlers)
  },
}
