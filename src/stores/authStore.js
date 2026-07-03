import { defineStore } from 'pinia'
import { authApi } from '../api/authApi'
import { employeeApi } from '../api/employeeApi'

const ACCESS_TOKEN_KEY = 'accessToken'
const REFRESH_TOKEN_KEY = 'refreshToken'
const TOKEN_TYPE_KEY = 'tokenType'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    accessToken: localStorage.getItem(ACCESS_TOKEN_KEY) || '',
    refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY) || '',
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
      this.accessToken = tokenResponse.accessToken || ''
      this.refreshToken = tokenResponse.refreshToken || ''

      localStorage.setItem(TOKEN_TYPE_KEY, this.tokenType)
      localStorage.setItem(ACCESS_TOKEN_KEY, this.accessToken)
      localStorage.setItem(REFRESH_TOKEN_KEY, this.refreshToken)
    },

    clearAuth() {
      this.accessToken = ''
      this.refreshToken = ''
      this.tokenType = 'Bearer'
      this.user = null
      this.employeeProfile = null

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
      const [meResult, profileResult] = await Promise.allSettled([
        this.fetchMe(),
        this.fetchEmployeeProfile(),
      ])

      if (meResult.status === 'rejected') {
        throw meResult.reason
      }

      if (profileResult.status === 'rejected') {
        console.warn('Employee profile fetch failed:', profileResult.reason)
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