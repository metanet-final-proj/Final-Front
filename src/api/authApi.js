import apiClient from './client'

export const authApi = {
  exchangeCode(code) {
    return apiClient.post('/api/v1/auth/token/exchange', {
      code,
    })
  },

  refresh(refreshToken) {
    return apiClient.post('/api/v1/auth/refresh', {
      refreshToken,
    })
  },

  logout(refreshToken) {
    return apiClient.post('/api/v1/auth/logout', {
      refreshToken,
    })
  },

  me() {
    return apiClient.get('/api/v1/auth/me')
  },
}