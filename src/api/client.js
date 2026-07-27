import axios from 'axios'
import {
  attachAuthorizationHeader,
  createAuthRefreshInterceptor,
} from './authRefreshInterceptor.js'
import { tokenStore } from '../stores/tokenStore.js'

const viteEnv = import.meta.env || {}

const apiClient = axios.create({
  baseURL: viteEnv.DEV
    ? ''
    : viteEnv.VITE_API_BASE_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use(
  (config) => {
    return attachAuthorizationHeader(config, {
      getAccessToken: () => tokenStore.getAccessToken(),
      getTokenType: () => tokenStore.getTokenType(),
    })
  },
  (error) => Promise.reject(error),
)

let authResponseInterceptorId = null

export const configureAuthRefreshInterceptor = ({
  refreshAccessToken,
  clearAuth,
}) => {
  if (authResponseInterceptorId !== null) {
    apiClient.interceptors.response.eject(authResponseInterceptorId)
  }

  authResponseInterceptorId = apiClient.interceptors.response.use(
    (response) => response,
    createAuthRefreshInterceptor({
      refreshAccessToken,
      retryRequest: (config) => apiClient(config),
      clearAuth,
    }),
  )
}

export default apiClient
