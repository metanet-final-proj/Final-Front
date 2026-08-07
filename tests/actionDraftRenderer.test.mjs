import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

test('chat view delegates every action draft to one renderer', () => {
  const chatView = read('../src/views/ChatView.vue')

  assert.match(chatView, /<ActionDraftRenderer/)
  assert.doesNotMatch(chatView, /<VisitorParkingActionDraftCard/)
  assert.doesNotMatch(chatView, /<SupplyActionDraftCard/)
})

test('domain forms share the common modal container', () => {
  for (const component of [
    'ActionDraftCard.vue',
    'VisitorParkingActionDraftCard.vue',
    'SupplyActionDraftCard.vue',
  ]) {
    const source = read(`../src/components/chat/${component}`)
    assert.match(source, /<ActionDraftContainer/)
  }
})

test('renderer selects a domain form from actionType', () => {
  const renderer = read('../src/components/chat/ActionDraftRenderer.vue')

  assert.match(renderer, /actionType\.startsWith\('visitor_parking\.'\)/)
  assert.match(renderer, /actionType\.startsWith\('supply\.'\)/)
  assert.match(renderer, /return ActionDraftCard/)
})
