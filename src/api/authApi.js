import apiClient from './client.js'

const getRefreshCsrfToken = async () => {
  const response = await apiClient.get(
    '/api/v1/auth/csrf',
    {
      withCredentials: true,
      skipAuthHeader: true,
      skipAuthRefresh: true,
    },
  )
  const token = String(response.data?.token || '').trim()

  if (!token) {
    throw new Error('CSRF response did not include a token')
  }

  return token
}

export const authApi = {
  exchangeCode(code) {
    return apiClient.post(
      '/api/v1/auth/token/exchange',
      { code },
      {
        withCredentials: true,
        skipAuthHeader: true,
        skipAuthRefresh: true,
      },
    )
  },

  async refresh() {
    const csrfToken = await getRefreshCsrfToken()

    return apiClient.post(
      '/api/v1/auth/refresh',
      undefined,
      {
        withCredentials: true,
        skipAuthHeader: true,
        skipAuthRefresh: true,
        headers: {
          'X-XSRF-TOKEN': csrfToken,
        },
      },
    )
  },

  logout() {
    return apiClient.post(
      '/api/v1/auth/logout',
      undefined,
      { withCredentials: true },
    )
  },

  me() {
    return apiClient.get('/api/v1/auth/me')
  },
}
