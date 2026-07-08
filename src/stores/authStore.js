import { defineStore } from 'pinia'
import { authApi } from '../api/authApi'
import { employeeApi } from '../api/employeeApi'

const ACCESS_TOKEN_KEY = 'accessToken'
const REFRESH_TOKEN_KEY = 'refreshToken'
const TOKEN_TYPE_KEY = 'tokenType'

const normalizeToken = (token) => {
  if (!token) return ''
  return String(token).replace(/^"|"$/g, '').trim()
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    accessToken: normalizeToken(localStorage.getItem(ACCESS_TOKEN_KEY)),
    refreshToken: normalizeToken(localStorage.getItem(REFRESH_TOKEN_KEY)),
    tokenType: localStorage.getItem(TOKEN_TYPE_KEY) || 'Bearer',
    user: null,
    employeeProfile: null,
    loading: false,
  }),

  getters: {
    isAuthenticated: (state) => Boolean(state.accessToken),

    displayName: (state) => {
      return state.user?.displayName || '사용자'
    },

    email: (state) => {
      return state.user?.email || '이메일 정보 없음'
    },

    jobTitle: (state) => {
      return state.employeeProfile?.jobTitle || '직원'
    },

    department: (state) => {
      return state.employeeProfile?.department || '소속 팀 정보 없음'
    },

    profileLabel() {
      return `${this.displayName} ${this.jobTitle}`.trim()
    },
  },

  actions: {
    setTokens(tokenResponse) {
      this.tokenType = tokenResponse.tokenType || 'Bearer'
      this.accessToken = normalizeToken(tokenResponse.accessToken)
      this.refreshToken = normalizeToken(tokenResponse.refreshToken)

      localStorage.setItem(TOKEN_TYPE_KEY, this.tokenType)
      localStorage.setItem(ACCESS_TOKEN_KEY, this.accessToken)

      if (this.refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, this.refreshToken)
      } else {
        localStorage.removeItem(REFRESH_TOKEN_KEY)
      }
    },

    clearAuth() {
      this.accessToken = ''
      this.refreshToken = ''
      this.tokenType = 'Bearer'
      this.user = null
      this.employeeProfile = null
      this.loading = false

      localStorage.removeItem(ACCESS_TOKEN_KEY)
      localStorage.removeItem(REFRESH_TOKEN_KEY)
      localStorage.removeItem(TOKEN_TYPE_KEY)
    },

    async exchangeCode(code) {
      this.loading = true

      try {
        const response = await authApi.exchangeCode(code)
        this.setTokens(response.data)

        return response.data
      } finally {
        this.loading = false
      }
    },

    async fetchMe() {
      const response = await authApi.me()
      this.user = response.data

      return response.data
    },

    async fetchEmployeeProfile() {
      const response = await employeeApi.getMyProfile()
      this.employeeProfile = response.data

      return response.data
    },

    async fetchUserContext() {
      if (!this.accessToken) {
        this.clearAuth()
        throw new Error('Access token is missing')
      }

      const [meResult, profileResult] = await Promise.allSettled([
        this.fetchMe(),
        this.fetchEmployeeProfile(),
      ])

      if (meResult.status === 'rejected') {
        this.clearAuth()
        throw meResult.reason
      }

      if (profileResult.status === 'rejected') {
        const status = profileResult.reason?.response?.status

        if (status === 401 || status === 403) {
          this.clearAuth()
          throw profileResult.reason
        }

        console.warn('Employee profile fetch failed:', profileResult.reason)
        this.employeeProfile = null
      }

      return {
        user: this.user,
        employeeProfile: this.employeeProfile,
      }
    },

    async logout() {
      const refreshToken = this.refreshToken

      try {
        if (refreshToken) {
          await authApi.logout(refreshToken)
        }
      } catch (error) {
        console.error('Logout API failed:', error)
      } finally {
        this.clearAuth()
      }
    },
  },
})