import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

export const MOBILE_SIDEBAR_QUERY = '(max-width: 820px)'

export const resolveSidebarPresentation = ({
  isMobile,
  mobileOpen,
  desktopCollapsed,
}) => ({
  isDrawerOpen: Boolean(isMobile && mobileOpen),
  showCollapsedRail: Boolean(!isMobile && desktopCollapsed),
})

export const useResponsiveSidebar = () => {
  const isMobile = ref(
    typeof window !== 'undefined' && window.matchMedia(MOBILE_SIDEBAR_QUERY).matches,
  )
  const mobileOpen = ref(false)
  const desktopCollapsed = ref(false)

  let mobileMediaQuery = null

  const presentation = computed(() => {
    return resolveSidebarPresentation({
      isMobile: isMobile.value,
      mobileOpen: mobileOpen.value,
      desktopCollapsed: desktopCollapsed.value,
    })
  })

  const syncViewport = (event) => {
    isMobile.value = event.matches

    if (!event.matches) {
      mobileOpen.value = false
    }
  }

  const open = () => {
    if (isMobile.value) {
      mobileOpen.value = true
    }
  }

  const close = () => {
    mobileOpen.value = false
  }

  const toggle = () => {
    if (isMobile.value) {
      mobileOpen.value = !mobileOpen.value
      return
    }

    desktopCollapsed.value = !desktopCollapsed.value
  }

  onMounted(() => {
    mobileMediaQuery = window.matchMedia(MOBILE_SIDEBAR_QUERY)
    syncViewport(mobileMediaQuery)
    mobileMediaQuery.addEventListener?.('change', syncViewport)
  })

  onBeforeUnmount(() => {
    mobileMediaQuery?.removeEventListener?.('change', syncViewport)
  })

  return {
    isMobile,
    mobileOpen,
    desktopCollapsed,
    presentation,
    open,
    close,
    toggle,
  }
}
