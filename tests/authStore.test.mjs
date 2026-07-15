import assert from 'node:assert/strict'
import test, { after, beforeEach } from 'node:test'

import { createPinia, setActivePinia } from 'pinia'
import apiClient from '../src/api/client.js'
import { useAuthStore } from '../src/stores/authStore.js'
import { tokenStore } from '../src/stores/tokenStore.js'

class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries))
  }

  getItem(key) {
    return this.values.get(key) ?? null
  }

  setItem(key, value) {
    this.values.set(key, String(value))
  }

  removeItem(key) {
    this.values.delete(key)
  }
}

const originalAdapter = apiClient.defaults.adapter
const originalLocalStorage = globalThis.localStorage

let refreshCalls
let csrfCalls
let logoutCalls

beforeEach(() => {
  refreshCalls = 0
  csrfCalls = 0
  logoutCalls = 0
  globalThis.localStorage = new MemoryStorage()
  tokenStore.clear()
  setActivePinia(createPinia())

  apiClient.defaults.adapter = async (config) => {
    if (config.url === '/api/v1/auth/csrf') {
      csrfCalls += 1
      return {
        data: { token: 'csrf-token' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }
    }

    if (config.url === '/api/v1/auth/refresh') {
      refreshCalls += 1
      await Promise.resolve()
      return {
        data: {
          tokenType: 'Bearer',
          accessToken: 'new-access-token',
          expiresIn: 900,
          refreshExpiresIn: 1209600,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }
    }

    if (config.url === '/api/v1/auth/logout') {
      logoutCalls += 1
      return {
        data: undefined,
        status: 204,
        statusText: 'No Content',
        headers: {},
        config,
      }
    }

    throw new Error(`Unexpected request: ${config.url}`)
  }
})

after(() => {
  apiClient.defaults.adapter = originalAdapter
  globalThis.localStorage = originalLocalStorage
})

test('initialization removes all legacy authentication tokens from browser storage', () => {
  globalThis.localStorage = new MemoryStorage({
    accessToken: 'access-token',
    refreshToken: 'legacy-refresh-token',
    tokenType: 'Bearer',
  })

  const authStore = useAuthStore()

  assert.equal('accessToken' in authStore.$state, false)
  assert.equal('refreshToken' in authStore.$state, false)
  assert.equal('tokenType' in authStore.$state, false)
  assert.equal(globalThis.localStorage.getItem('accessToken'), null)
  assert.equal(globalThis.localStorage.getItem('refreshToken'), null)
  assert.equal(globalThis.localStorage.getItem('tokenType'), null)
  assert.equal(tokenStore.getAccessToken(), '')
})

test('token responses without an access token are rejected at the store boundary', () => {
  const authStore = useAuthStore()

  assert.throws(
    () => authStore.setTokens({ tokenType: 'Bearer' }),
    /access token/i,
  )
  assert.equal(authStore.accessToken, '')
  assert.equal(globalThis.localStorage.getItem('accessToken'), null)
})

test('concurrent refresh calls share one cookie refresh request', async () => {
  const authStore = useAuthStore()

  const [firstResponse, secondResponse] = await Promise.all([
    authStore.refreshAccessToken(),
    authStore.refreshAccessToken(),
  ])

  assert.equal(refreshCalls, 1)
  assert.equal(csrfCalls, 1)
  assert.equal(firstResponse.accessToken, 'new-access-token')
  assert.equal(secondResponse.accessToken, 'new-access-token')
  assert.equal(authStore.accessToken, 'new-access-token')
  assert.equal(globalThis.localStorage.getItem('accessToken'), null)
  assert.equal(globalThis.localStorage.getItem('refreshToken'), null)
})

test('logout calls the cookie endpoint even without a JavaScript refresh token', async () => {
  const authStore = useAuthStore()
  authStore.setTokens({ accessToken: 'access-token', tokenType: 'Bearer' })

  await authStore.logout()

  assert.equal(logoutCalls, 1)
  assert.equal(authStore.accessToken, '')
  assert.equal(globalThis.localStorage.getItem('accessToken'), null)
})
