import apiClient from './client'

export const adminOrganizationApi = {
  getOrganizations(page = 1, pageSize = 10) {
    return apiClient.get('/api/v1/admin/organizations', {
      params: {
        page,
        pageSize,
      },
    })
  },

  createOrganization({ name, azureTenantId }) {
    return apiClient.post('/api/v1/admin/organizations', {
      name,
      azureTenantId,
    })
  },

  updateOrganizationStatus(organizationId, status) {
    return apiClient.patch(`/api/v1/admin/organizations/${organizationId}`, {
      status,
    })
  },
}
