import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'

export const MAIN_PANEL = {
  CHAT: 'chat',
  ADMIN: 'admin',
  MYPAGE: 'mypage',
}

export const ADMIN_DASHBOARD_PERMISSION = 'observability.dashboard.read'

const THEME_STORAGE_KEY = 'officeLinkTheme'
const PANEL_QUERY_VALUES = new Set(Object.values(MAIN_PANEL))
const PANEL_ROUTE_NAMES = {
  [MAIN_PANEL.MYPAGE]: 'mypage',
  [MAIN_PANEL.ADMIN]: 'admin-dashboard',
}
const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
})

export const getInitialDarkMode = () => {
  if (typeof window === 'undefined') return false

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (storedTheme === 'dark') return true
  if (storedTheme === 'light') return false

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches || false
}

export const applyTheme = (darkMode) => {
  if (typeof document === 'undefined') return

  const theme = darkMode ? 'dark' : 'light'
  document.documentElement.dataset.theme = theme
  window.localStorage.setItem(THEME_STORAGE_KEY, theme)
}

export const renderMarkdown = (text) => {
  if (!text) return ''

  return DOMPurify.sanitize(markdown.render(String(text)), {
    USE_PROFILES: { html: true },
  })
}

export const getPanelFromQuery = (panelQuery) => {
  const rawPanel = Array.isArray(panelQuery) ? panelQuery[0] : panelQuery
  const normalizedPanel = String(rawPanel || '').toLowerCase()
  return PANEL_QUERY_VALUES.has(normalizedPanel) ? normalizedPanel : MAIN_PANEL.CHAT
}

export const getPanelFromRoute = (currentRoute) => {
  if (currentRoute.name === PANEL_ROUTE_NAMES[MAIN_PANEL.MYPAGE]) {
    return MAIN_PANEL.MYPAGE
  }
  if (currentRoute.name === PANEL_ROUTE_NAMES[MAIN_PANEL.ADMIN]) {
    return MAIN_PANEL.ADMIN
  }
  return getPanelFromQuery(currentRoute.query.panel)
}

export const panelRouteLocation = (panel, conversationId = null) => {
  if (panel !== MAIN_PANEL.CHAT) {
    return { name: PANEL_ROUTE_NAMES[panel] }
  }

  return {
    name: 'chat',
    params: conversationId ? { conversationId } : {},
    query: {},
  }
}
