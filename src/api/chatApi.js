import apiClient from './client'

const getApiBaseUrl = () => {
  if (import.meta.env.DEV) {
    return ''
  }

  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
}

const getAuthHeaders = () => {
  const accessToken = localStorage.getItem('accessToken')
  const tokenType = localStorage.getItem('tokenType') || 'Bearer'

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
  }
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

    blocks.forEach((block) => {
      const trimmedBlock = block.trim()

      if (!trimmedBlock) return

      const parsed = parseSseEventBlock(trimmedBlock)

      if (parsed.event === 'user_message') {
        handlers.onUserMessage?.(parsed.data)
        return
      }

      if (parsed.event === 'chunk') {
        handlers.onChunk?.(parsed.data)
        return
      }

      if (parsed.event === 'assistant_message') {
        handlers.onAssistantMessage?.(parsed.data)
        return
      }

      if (parsed.event === 'error') {
        handlers.onError?.(parsed.data)
        return
      }

      handlers.onEvent?.(parsed)
    })
  }

  const remaining = buffer.trim()

  if (remaining) {
    const parsed = parseSseEventBlock(remaining)

    if (parsed.event === 'user_message') {
      handlers.onUserMessage?.(parsed.data)
    } else if (parsed.event === 'chunk') {
      handlers.onChunk?.(parsed.data)
    } else if (parsed.event === 'assistant_message') {
      handlers.onAssistantMessage?.(parsed.data)
    } else if (parsed.event === 'error') {
      handlers.onError?.(parsed.data)
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

  async sendMessageStream(conversationId, message, handlers = {}) {
    const baseUrl = getApiBaseUrl()

    const response = await fetch(
      `${baseUrl}/api/v1/chat/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          message,
        }),
      },
    )

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