import apiClient from './client'

export const myUsageApi = {
  getMonthlySummary() {
    return apiClient.get('/api/v1/me/observability/monthly-summary')
  },

  getUsageTrends(range = '7d') {
    return apiClient.get('/api/v1/me/observability/usage-trends', {
      params: {
        range,
      },
    })
  },
}
