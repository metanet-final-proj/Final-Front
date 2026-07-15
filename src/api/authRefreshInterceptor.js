const setHeader = (headers, name, value) => {
  if (typeof headers.set === 'function') {
    headers.set(name, value)
    return
  }

  headers[name] = value
}

const deleteHeader = (headers, name) => {
  if (typeof headers.delete === 'function') {
    headers.delete(name)
    return
  }

  delete headers[name]
  delete headers[name.toLowerCase()]
}

export const attachAuthorizationHeader = (
  config,
  { getAccessToken, getTokenType },
) => {
  const headers = config.headers || {}
  config.headers = headers

  if (config.skipAuthHeader) {
    deleteHeader(headers, 'Authorization')
    return config
  }

  const accessToken = getAccessToken()

  if (!accessToken) {
    deleteHeader(headers, 'Authorization')
    return config
  }

  const tokenType = getTokenType() || 'Bearer'
  setHeader(headers, 'Authorization', `${tokenType} ${accessToken}`)

  return config
}

export const createAuthRefreshInterceptor = ({
  refreshAccessToken,
  retryRequest,
  clearAuth,
}) => {
  return async (error) => {
    const originalRequest = error?.config
    const shouldRefresh =
      error?.response?.status === 401 &&
      originalRequest &&
      !originalRequest.skipAuthRefresh &&
      !originalRequest._retry

    if (!shouldRefresh) {
      return Promise.reject(error)
    }

    originalRequest._retry = true

    try {
      const tokenResponse = await refreshAccessToken()
      const accessToken = tokenResponse?.accessToken

      if (!accessToken) {
        throw new Error('Refresh response did not include an access token')
      }

      attachAuthorizationHeader(originalRequest, {
        getAccessToken: () => accessToken,
        getTokenType: () => tokenResponse.tokenType || 'Bearer',
      })

      return retryRequest(originalRequest)
    } catch (refreshError) {
      await clearAuth()
      return Promise.reject(refreshError)
    }
  }
}
