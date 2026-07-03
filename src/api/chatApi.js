import apiClient from './client'

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
}