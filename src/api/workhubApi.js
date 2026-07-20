import apiClient from './client'

export const workhubApi = {
  getSidebarSummary() {
    return apiClient.get('/api/v1/workhub/sidebar-summary')
  },
  getMeetingRooms(date) {
    return apiClient.get('/api/v1/workhub/meeting-rooms', {
      params: date ? { date } : undefined,
    })
  },
  getParkingLots() {
    return apiClient.get('/api/v1/workhub/parking-lots')
  },
  getSupplyItems() {
    return apiClient.get('/api/v1/workhub/supply-items')
  },
}
