import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'

import { authApi } from '../src/api/authApi.js'
import apiClient from '../src/api/client.js'
import { tokenStore } from '../src/stores/tokenStore.js'

const originalAdapter = apiClient.defaults.adapter
const originalLocalStorage = globalThis.localStorage
const requests = []

before(() => {
  globalThis.localStorage = {
    getItem(key) {
      if (['accessToken', 'refreshToken', 'tokenType'].includes(key)) {
        throw new Error(`Authentication storage read is forbidden: ${key}`)
      }
      return null
    },
  }
  tokenStore.setTokens({ accessToken: 'access-token', tokenType: 'Bearer' })

  apiClient.defaults.adapter = async (config) => {
    requests.push(config)
    return {
      data: config.url === '/api/v1/auth/csrf'
        ? { token: 'csrf-token' }
        : {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }
  }
})

after(() => {
  apiClient.defaults.adapter = originalAdapter
  globalThis.localStorage = originalLocalStorage
  tokenStore.clear()
})

test('auth API uses credentialed cookie requests without exposing refresh token data', async () => {
  requests.length = 0

  await authApi.exchangeCode('login-code')
  await authApi.refresh()
  await authApi.logout()

  const [exchangeRequest, csrfRequest, refreshRequest, logoutRequest] = requests

  assert.equal(exchangeRequest.withCredentials, true)
  assert.deepEqual(JSON.parse(exchangeRequest.data), { code: 'login-code' })

  assert.equal(csrfRequest.url, '/api/v1/auth/csrf')
  assert.equal(csrfRequest.method, 'get')
  assert.equal(csrfRequest.withCredentials, true)
  assert.equal(csrfRequest.skipAuthHeader, true)
  assert.equal(csrfRequest.skipAuthRefresh, true)

  assert.equal(refreshRequest.withCredentials, true)
  assert.equal(refreshRequest.data, undefined)
  assert.equal(refreshRequest.skipAuthHeader, true)
  assert.equal(refreshRequest.skipAuthRefresh, true)
  assert.equal(refreshRequest.headers['X-XSRF-TOKEN'], 'csrf-token')

  assert.equal(logoutRequest.withCredentials, true)
  assert.equal(logoutRequest.data, undefined)
  assert.notEqual(logoutRequest.skipAuthRefresh, true)
  assert.equal(logoutRequest.headers.Authorization, 'Bearer access-token')
})
