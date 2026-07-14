import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { mergeFetchedMessagesWithInFlight } from '../src/stores/chatMessageMerge.js'

const chatStoreSource = readFileSync(
  new URL('../src/stores/chatStore.js', import.meta.url),
  'utf8',
)
const chatRoomListSource = readFileSync(
  new URL('../src/components/chat/ChatRoomList.vue', import.meta.url),
  'utf8',
)

test('an in-flight conversation keeps its SSE assistant when the server only returns the user message', () => {
  const serverUserMessage = {
    id: 'server-user-1',
    messageId: 'server-user-1',
    role: 'user',
    text: 'Show my tasks',
    isLocal: false,
  }
  const streamedAssistantMessage = {
    id: 'server-assistant-1',
    messageId: 'server-assistant-1',
    role: 'assistant',
    text: 'Here are your tasks',
    isLocal: false,
    agentActivity: {
      currentText: 'Writing the answer',
      steps: [{ id: 'step-1', title: 'Load tasks' }],
    },
  }
  const inFlight = {
    conversationId: 'conversation-1',
    assistantMessageId: 'server-assistant-1',
    status: 'streaming',
  }

  const merged = mergeFetchedMessagesWithInFlight(
    [serverUserMessage],
    [serverUserMessage, streamedAssistantMessage],
    inFlight,
  )

  assert.deepEqual(merged, [serverUserMessage, streamedAssistantMessage])
})

test('a conversation without in-flight work uses only the server response', () => {
  const serverMessages = [
    { id: 'server-user-1', role: 'user', text: 'Server message' },
  ]
  const cachedAssistant = {
    id: 'local-assistant-1',
    role: 'assistant',
    text: 'Unrelated cached answer',
  }

  const merged = mergeFetchedMessagesWithInFlight(
    serverMessages,
    [cachedAssistant],
    null,
  )

  assert.deepEqual(merged, serverMessages)
})

test('the persisted assistant replaces the tracked cache without duplication', () => {
  const serverAssistant = {
    id: 'server-assistant-1',
    messageId: 'server-assistant-1',
    role: 'assistant',
    text: 'Persisted answer',
  }
  const cachedAssistant = {
    ...serverAssistant,
    agentActivity: {
      currentText: 'Finished',
      steps: [{ id: 'step-1', title: 'Load tasks' }],
    },
  }
  const inFlight = {
    conversationId: 'conversation-1',
    assistantMessageId: 'server-assistant-1',
    status: 'completed',
  }

  const merged = mergeFetchedMessagesWithInFlight(
    [serverAssistant],
    [cachedAssistant],
    inFlight,
  )

  assert.deepEqual(merged, [serverAssistant])
})

test('chat store tracks in-flight work by conversation id', () => {
  assert.match(chatStoreSource, /inFlightByConversationId/)
  assert.match(chatStoreSource, /assistantMessageId/)
})

test('completed stream state remains available for reconciliation without showing as answering', () => {
  assert.match(chatStoreSource, /completeConversationInFlight/)
  assert.match(chatStoreSource, /inFlight\?\.status === 'streaming'/)
})

test('chat room list identifies the room whose assistant is answering', () => {
  assert.match(chatRoomListSource, /v-if="room\.isAnswering"/)
  assert.match(chatRoomListSource, /class="room-answering"/)
  assert.match(chatRoomListSource, /role="status"/)
})

test('background conversation refresh keeps the existing room list mounted', () => {
  assert.match(
    chatRoomListSource,
    /v-if="!collapsed && chatStore\.loading && rooms\.length === 0"/,
  )
})
