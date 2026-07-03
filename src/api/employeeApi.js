import apiClient from './client'

export const employeeApi = {
  getMyProfile() {
    return apiClient.get('/api/v1/employees/me/profile')
  },
}