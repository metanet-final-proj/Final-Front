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
const routerSource = readFileSync(
  new URL('../src/router/index.js', import.meta.url),
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

test('recording locks the composer while answering only disables send', () => {
  assert.equal(
    chatViewSource.match(/:disabled="isRecording \|\| isTranscribing"/g)?.length,
    2,
  )
  assert.equal(
    chatViewSource.match(/:disabled="isAnswering \|\| isRecording \|\| isTranscribing"/g)?.length,
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

test('chat URLs retain the conversation id for refresh restoration', () => {
  assert.match(routerSource, /path:\s*['"]\/chat\/:conversationId\?['"]/)
  assert.match(chatViewSource, /route\.params\.conversationId/)
  assert.match(chatViewSource, /await activateConversation\(routeConversationId\)/)
})

test('stream auto-follow pauses when the user scrolls away from the bottom', () => {
  assert.match(
    chatViewSource,
    /const handleThreadScroll = \(\) => \{[\s\S]*?threadUserScrollIntentUntil[\s\S]*?autoFollowThread\.value = isThreadNearBottom\(\)/,
  )
  assert.match(
    chatViewSource,
    /if \(scrollAnimationFrameId \|\| !autoFollowThread\.value\) return/,
  )
  assert.match(
    chatViewSource,
    /@scroll\.passive="handleThreadScroll"/,
  )
  assert.match(chatViewSource, /@wheel\.passive="markThreadScrollIntent"/)
})

test('structured chat content keeps auto-following through final layout changes', () => {
  assert.match(chatViewSource, /threadResizeObserver = new ResizeObserver/)
  assert.match(chatViewSource, /threadResizeObserver\.observe\(element\)/)
  assert.match(
    chatViewSource,
    /threadMutationObserver = new MutationObserver\(\(\) => \{[\s\S]*?observeMessageRows\(\)[\s\S]*?requestScrollThread\(\)/,
  )
})
