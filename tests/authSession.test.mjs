import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createAuthFailureHandler,
  restoreAccessToken,
} from '../src/router/authSession.js'

test('existing access token skips cookie refresh', async () => {
  let refreshCalls = 0

  const restored = await restoreAccessToken({
    getAccessToken: () => 'access-token',
    refreshAccessToken: async () => {
      refreshCalls += 1
    },
  })

  assert.equal(restored, true)
  assert.equal(refreshCalls, 0)
})

test('missing access token is restored from the refresh cookie', async () => {
  let accessToken = ''

  const restored = await restoreAccessToken({
    getAccessToken: () => accessToken,
    refreshAccessToken: async () => {
      accessToken = 'restored-access-token'
    },
  })

  assert.equal(restored, true)
  assert.equal(accessToken, 'restored-access-token')
})

test('failed cookie refresh leaves the session unauthenticated', async () => {
  const restored = await restoreAccessToken({
    getAccessToken: () => '',
    refreshAccessToken: async () => {
      throw new Error('refresh rejected')
    },
  })

  assert.equal(restored, false)
})

test('final refresh failure clears auth and redirects protected routes', async () => {
  let clearCalls = 0
  let redirectedTo = null
  const handleAuthFailure = createAuthFailureHandler({
    clearAuth: () => {
      clearCalls += 1
    },
    getCurrentRoute: () => ({
      fullPath: '/chat?conversation=10',
      meta: { requiresAuth: true },
    }),
    replaceRoute: async (route) => {
      redirectedTo = route
    },
  })

  await handleAuthFailure()

  assert.equal(clearCalls, 1)
  assert.deepEqual(redirectedTo, {
    path: '/login',
    query: { redirect: '/chat?conversation=10' },
  })
})
