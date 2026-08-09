import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const chatSidebarSource = readFileSync(
  new URL('../src/components/chat/ChatSidebar.vue', import.meta.url),
  'utf8',
)
const myPageSource = readFileSync(
  new URL('../src/components/mypage/MyPagePanel.vue', import.meta.url),
  'utf8',
)
const chatViewSource = readFileSync(
  new URL('../src/views/ChatView.vue', import.meta.url),
  'utf8',
)
const loginViewSource = readFileSync(
  new URL('../src/views/LoginView.vue', import.meta.url),
  'utf8',
)
const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const workhubPanelUrl = new URL(
  '../src/components/chat/WorkhubDetailPanel.vue',
  import.meta.url,
)
const workhubPanelSource = existsSync(workhubPanelUrl)
  ? readFileSync(workhubPanelUrl, 'utf8')
  : ''

test('mobile sidebar content keeps safe-area-aware space above its controls', () => {
  assert.match(
    chatSidebarSource,
    /@media \(max-width: 820px\)[\s\S]*?\.sidebar-content\s*\{[\s\S]*?padding-top:\s*calc\(env\(safe-area-inset-top, 0px\) \+ 16px\)/,
  )
})

test('login remains scrollable when its card is taller than the mobile viewport', () => {
  assert.match(loginViewSource, /\.login-page\s*\{[\s\S]*?min-height:\s*100dvh;/)
  assert.match(loginViewSource, /\.login-page\s*\{[\s\S]*?overflow-y:\s*auto;/)
  assert.match(
    loginViewSource,
    /@media \(max-width: 860px\)[\s\S]*?\.login-page\s*\{[\s\S]*?align-items:\s*flex-start;/,
  )
})

test('chat uses the dynamic viewport and keeps its composer above the safe area', () => {
  assert.doesNotMatch(chatViewSource, /:global\(html\)[\s\S]*?overflow:\s*hidden;/)
  assert.match(chatViewSource, /\.chat-shell\s*\{[\s\S]*?height:\s*100dvh;/)
  assert.match(
    chatViewSource,
    /\.composer-area\s*\{[\s\S]*?padding:[\s\S]*?env\(safe-area-inset-bottom, 0px\)/,
  )
  assert.match(indexSource, /viewport-fit=cover/)
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

test('mypage chart containers can shrink with the responsive grid', () => {
  assert.match(
    myPageSource,
    /\.chart-card\s*\{[\s\S]*?min-width:\s*0;/,
  )
  assert.match(
    myPageSource,
    /\.chart-stage\s*\{[\s\S]*?min-width:\s*0;/,
  )
})

test('chat view delegates workhub details to a focused component', () => {
  assert.match(chatViewSource, /import WorkhubDetailPanel from/)
  assert.match(chatViewSource, /<WorkhubDetailPanel/)
})

test('mobile workhub details render as an accessible safe-area bottom sheet', () => {
  assert.match(workhubPanelSource, /:role="isMobile \? 'dialog' : 'complementary'"/)
  assert.match(workhubPanelSource, /:aria-modal="isMobile \? 'true' : undefined"/)
  assert.match(workhubPanelSource, /class="detail-backdrop"/)
  assert.match(
    workhubPanelSource,
    /@media \(max-width: 820px\)[\s\S]*?\.workhub-detail-layer\s*\{[\s\S]*?position:\s*fixed;/,
  )
  assert.match(workhubPanelSource, /max-height:\s*min\(88dvh, 720px\)/)
  assert.match(workhubPanelSource, /env\(safe-area-inset-bottom, 0px\)/)
})
