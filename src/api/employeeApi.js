import apiClient from './client.js'

export const employeeApi = {
  getMyProfile() {
    return apiClient.get('/api/v1/employees/me/profile')
  },
}
