import { ref } from 'vue'

const accessToken = ref('')
const tokenType = ref('Bearer')

const normalizeToken = (token) => {
  if (!token) return ''
  return String(token).replace(/^"|"$/g, '').trim()
}

export const tokenStore = {
  getAccessToken() {
    return accessToken.value
  },

  getTokenType() {
    return tokenType.value
  },

  setTokens(tokenResponse) {
    const nextAccessToken = normalizeToken(tokenResponse?.accessToken)

    if (!nextAccessToken) {
      throw new Error('Token response did not include an access token')
    }

    accessToken.value = nextAccessToken
    tokenType.value = tokenResponse.tokenType || 'Bearer'
  },

  clear() {
    accessToken.value = ''
    tokenType.value = 'Bearer'
  },
}
