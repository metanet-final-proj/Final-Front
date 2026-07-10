import apiClient from './client'

export const workhubApi = {
  getSidebarSummary() {
    return apiClient.get('/api/v1/workhub/sidebar-summary')
  },
}
