import { defineStore } from 'pinia'
import { authApi } from '../api/authApi.js'
import { employeeApi } from '../api/employeeApi.js'
import { tokenStore } from './tokenStore.js'

const LEGACY_TOKEN_KEYS = ['accessToken', 'refreshToken', 'tokenType']
const TOKEN_REFRESH_THRESHOLD_MS = 60 * 1000

let refreshPromise = null

const clearLegacyStoredTokens = () => {
  LEGACY_TOKEN_KEYS.forEach((key) => localStorage.removeItem(key))
}

const normalizePermission = (permission) => {
  return String(permission || '').trim().toLowerCase()
}

const normalizePermissions = (permissions) => {
  const permissionList = Array.isArray(permissions) ? permissions : [permissions]

  return permissionList
    .map(normalizePermission)
    .filter(Boolean)
}

const decodeJwtPayload = (token) => {
  const [, payload] = token.split('.')

  if (!payload) return null

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '=',
    )

    return JSON.parse(window.atob(padded))
  } catch {
    return null
  }
}

const getTokenExpiresAtMs = (token) => {
  const payload = decodeJwtPayload(token)

  if (!payload?.exp) return null

  return Number(payload.exp) * 1000
}

export const useAuthStore = defineStore('auth', {
  state: () => {
    clearLegacyStoredTokens()

    return {
      user: null,
      employeeProfile: null,
      loading: false,
    }
  },

  getters: {
    accessToken: () => tokenStore.getAccessToken(),

    tokenType: () => tokenStore.getTokenType(),

    isAuthenticated: () => Boolean(tokenStore.getAccessToken()),

    userPermissions: (state) => normalizePermissions(state.user?.permissions),

    hasPermission() {
      return (permission) => this.userPermissions.includes(normalizePermission(permission))
    },

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
      tokenStore.setTokens(tokenResponse)
      clearLegacyStoredTokens()
    },

    clearAuth() {
      tokenStore.clear()
      this.user = null
      this.employeeProfile = null
      this.loading = false

      clearLegacyStoredTokens()
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

    isAccessTokenExpiringSoon(thresholdMs = TOKEN_REFRESH_THRESHOLD_MS) {
      const expiresAtMs = getTokenExpiresAtMs(this.accessToken)

      if (!expiresAtMs) {
        return false
      }

      return expiresAtMs - Date.now() <= thresholdMs
    },

    async refreshAccessToken() {
      if (refreshPromise) {
        return refreshPromise
      }

      refreshPromise = authApi.refresh()
        .then((response) => {
          this.setTokens(response.data)
          return response.data
        })
        .catch((error) => {
          this.clearAuth()
          throw error
        })
        .finally(() => {
          refreshPromise = null
        })

      return refreshPromise
    },

    async ensureFreshAccessToken(thresholdMs = TOKEN_REFRESH_THRESHOLD_MS) {
      if (!this.accessToken) {
        this.clearAuth()
        throw new Error('Access token is missing')
      }

      if (!this.isAccessTokenExpiringSoon(thresholdMs)) {
        return this.accessToken
      }

      await this.refreshAccessToken()
      return this.accessToken
    },

    async logout() {
      try {
        await authApi.logout()
      } catch (error) {
        console.error('Logout API failed:', error)
      } finally {
        this.clearAuth()
      }
    },
  },
})
