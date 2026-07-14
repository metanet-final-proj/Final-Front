import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const chatSidebarSource = readFileSync(
  new URL('../src/components/chat/ChatSidebar.vue', import.meta.url),
  'utf8',
)
const myPageSource = readFileSync(
  new URL('../src/components/mypage/MyPagePanel.vue', import.meta.url),
  'utf8',
)

test('mobile sidebar content keeps safe-area-aware space above its controls', () => {
  assert.match(
    chatSidebarSource,
    /@media \(max-width: 820px\)[\s\S]*?\.sidebar-content\s*\{[\s\S]*?padding-top:\s*calc\(env\(safe-area-inset-top, 0px\) \+ 16px\)/,
  )
})

test('responsive mypage gives the range filter its own grid row', () => {
  assert.match(
    myPageSource,
    /@media \(max-width: 1040px\)[\s\S]*?grid-template-areas:[\s\S]*?"kpi"[\s\S]*?"range"[\s\S]*?"chart"/,
  )
  assert.match(
    myPageSource,
    /@media \(max-width: 1040px\)[\s\S]*?\.range-toggle\s*\{\s*grid-area:\s*range;/,
  )
})
