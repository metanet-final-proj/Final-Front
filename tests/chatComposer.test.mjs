import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const chatViewSource = readFileSync(
  new URL('../src/views/ChatView.vue', import.meta.url),
  'utf8',
)
const chatStoreSource = readFileSync(
  new URL('../src/stores/chatStore.js', import.meta.url),
  'utf8',
)

test('both send buttons use a centered upward arrow', () => {
  assert.equal(chatViewSource.match(/class="send-button"/g)?.length, 2)
  assert.equal(chatViewSource.match(/class="send-icon"/g)?.length, 2)
  assert.equal(chatViewSource.match(/<path d="M12 19V5" \/>/g)?.length, 2)
  assert.equal(chatViewSource.match(/<path d="m5 12 7-7 7 7" \/>/g)?.length, 2)
  assert.match(
    chatViewSource,
    /\.send-button\s*\{[^}]*place-items:\s*center;/,
  )
  assert.doesNotMatch(
    chatViewSource,
    /\.send-icon\s*\{[^}]*transform:\s*translate/,
  )
})

test('answering keeps the composer editable while send stays disabled', () => {
  assert.equal(
    chatViewSource.match(/:disabled="isTranscribing"/g)?.length,
    2,
  )
  assert.equal(
    chatViewSource.match(/:disabled="isAnswering \|\| isTranscribing"/g)?.length,
    2,
  )
})

test('composer focus returns after the answer finishes', () => {
  assert.match(
    chatViewSource,
    /watch\(\s*isAnswering,\s*async \(isNowAnswering, wasAnswering\) => \{[\s\S]*?mainPanel\.value !== MAIN_PANEL\.CHAT[\s\S]*?await nextTick\(\)[\s\S]*?composerInputRef\.value\?\.focus\(\{ preventScroll: true \}\)/,
  )
})

test('only the active conversation is disabled while its answer is streaming', () => {
  assert.match(
    chatViewSource,
    /chatStore\.isConversationAnswering\(activeRoomId\.value\)/,
  )
  assert.doesNotMatch(chatViewSource, /chatStore\.sending/)
  assert.match(
    chatStoreSource,
    /async sendMessage\(conversationId, message\) \{[\s\S]*?this\.isConversationAnswering\(conversationId\)[\s\S]*?return \[\]/,
  )
})
