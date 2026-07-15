import assert from 'node:assert/strict'
import test, { beforeEach } from 'node:test'

import { tokenStore } from '../src/stores/tokenStore.js'

beforeEach(() => {
  tokenStore.clear()
})

test('access token is kept in memory without browser storage', () => {
  tokenStore.setTokens({
    accessToken: 'access-token',
    tokenType: 'Bearer',
  })

  assert.equal(tokenStore.getAccessToken(), 'access-token')
  assert.equal(tokenStore.getTokenType(), 'Bearer')
})

test('token responses without an access token are rejected', () => {
  assert.throws(
    () => tokenStore.setTokens({ tokenType: 'Bearer' }),
    /access token/i,
  )
  assert.equal(tokenStore.getAccessToken(), '')
})

test('clearing the store removes the in-memory token', () => {
  tokenStore.setTokens({ accessToken: 'access-token' })

  tokenStore.clear()

  assert.equal(tokenStore.getAccessToken(), '')
  assert.equal(tokenStore.getTokenType(), 'Bearer')
})
