export const restoreAccessToken = async ({
  getAccessToken,
  refreshAccessToken,
}) => {
  if (getAccessToken()) {
    return true
  }

  try {
    await refreshAccessToken()
    return Boolean(getAccessToken())
  } catch {
    return false
  }
}

export const createAuthFailureHandler = ({
  clearAuth,
  getCurrentRoute,
  replaceRoute,
}) => {
  return () => {
    const currentRoute = getCurrentRoute()
    clearAuth()

    if (currentRoute?.meta?.requiresAuth !== true) {
      return undefined
    }

    return replaceRoute({
      path: '/login',
      query: { redirect: currentRoute.fullPath },
    })
  }
}
