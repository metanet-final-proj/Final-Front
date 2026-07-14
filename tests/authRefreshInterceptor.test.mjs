import assert from 'node:assert/strict'
import test from 'node:test'

import {
  attachAuthorizationHeader,
  createAuthRefreshInterceptor,
} from '../src/api/authRefreshInterceptor.js'

const unauthorizedError = (config = {}) => ({
  response: { status: 401 },
  config: {
    headers: {},
    ...config,
  },
})

test('public token requests do not receive an authorization header', () => {
  const config = attachAuthorizationHeader(
    {
      skipAuthHeader: true,
      headers: {
        Authorization: 'Bearer expired-token',
      },
    },
    {
      getAccessToken: () => 'expired-token',
      getTokenType: () => 'Bearer',
    },
  )

  assert.equal(config.headers.Authorization, undefined)
})

test('protected requests receive the latest access token', () => {
  const config = attachAuthorizationHeader(
    { headers: {} },
    {
      getAccessToken: () => 'current-access-token',
      getTokenType: () => 'Bearer',
    },
  )

  assert.equal(config.headers.Authorization, 'Bearer current-access-token')
})

test('a 401 refreshes tokens and retries the original request once', async () => {
  let retriedConfig = null
  const handler = createAuthRefreshInterceptor({
    refreshAccessToken: async () => ({
      accessToken: 'new-access-token',
      tokenType: 'Bearer',
    }),
    retryRequest: async (config) => {
      retriedConfig = config
      return { status: 200 }
    },
    clearAuth: () => {},
  })

  const response = await handler(unauthorizedError())

  assert.equal(response.status, 200)
  assert.equal(retriedConfig._retry, true)
  assert.equal(retriedConfig.headers.Authorization, 'Bearer new-access-token')
})

test('refresh and public auth requests are never intercepted', async () => {
  let refreshCalls = 0
  const handler = createAuthRefreshInterceptor({
    refreshAccessToken: async () => {
      refreshCalls += 1
    },
    retryRequest: async () => ({ status: 200 }),
    clearAuth: () => {},
  })
  const error = unauthorizedError({ skipAuthRefresh: true })

  await assert.rejects(() => handler(error), (rejected) => rejected === error)
  assert.equal(refreshCalls, 0)
})

test('a retried request is not refreshed again when it returns 401', async () => {
  let refreshCalls = 0
  const handler = createAuthRefreshInterceptor({
    refreshAccessToken: async () => {
      refreshCalls += 1
    },
    retryRequest: async () => ({ status: 200 }),
    clearAuth: () => {},
  })
  const error = unauthorizedError({ _retry: true })

  await assert.rejects(() => handler(error), (rejected) => rejected === error)
  assert.equal(refreshCalls, 0)
})

test('failed refresh clears local authentication without retrying the request', async () => {
  const refreshError = new Error('refresh expired')
  let clearCalls = 0
  let retryCalls = 0
  const handler = createAuthRefreshInterceptor({
    refreshAccessToken: async () => {
      throw refreshError
    },
    retryRequest: async () => {
      retryCalls += 1
    },
    clearAuth: () => {
      clearCalls += 1
    },
  })

  await assert.rejects(
    () => handler(unauthorizedError()),
    (rejected) => rejected === refreshError,
  )
  assert.equal(clearCalls, 1)
  assert.equal(retryCalls, 0)
})
