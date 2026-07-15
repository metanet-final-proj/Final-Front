import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveSidebarPresentation } from '../src/composables/useResponsiveSidebar.js'

test('mobile sidebar starts outside the layout without a collapsed rail', () => {
  assert.deepEqual(
    resolveSidebarPresentation({
      isMobile: true,
      mobileOpen: false,
      desktopCollapsed: false,
    }),
    {
      isDrawerOpen: false,
      showCollapsedRail: false,
    },
  )
})

test('desktop sidebar preserves its collapsed rail state', () => {
  assert.deepEqual(
    resolveSidebarPresentation({
      isMobile: false,
      mobileOpen: false,
      desktopCollapsed: true,
    }),
    {
      isDrawerOpen: false,
      showCollapsedRail: true,
    },
  )
})
