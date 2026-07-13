import apiClient from './client'

export const adminObservabilityApi = {
  getDashboard(range = '7d') {
    return apiClient.get('/api/v1/admin/observability/dashboard', {
      params: {
        range,
      },
    })
  },
}
