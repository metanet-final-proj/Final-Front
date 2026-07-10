import { defineStore } from 'pinia'
import { workhubApi } from '../api/workhubApi'

const SECTION_ORDER = [
  'meetingReservations',
  'parkingRequests',
  'cafeteriaMenus',
  'supplyRequests',
]

const TONE_BY_KEY = {
  meetingReservations: 'blue',
  parkingRequests: 'blue',
  cafeteriaMenus: 'orange',
  supplyRequests: 'blue',
}

const normalizeSection = (key, section) => ({
  key: section?.key || key,
  title: section?.title || '',
  badge: section?.badge || '',
  actionLabel: section?.actionLabel || '',
  actionQuery: section?.actionQuery || '',
  emptyText: section?.emptyText || '표시할 내역이 없습니다.',
  items: Array.isArray(section?.items) ? section.items : [],
})

export const useWorkhubStore = defineStore('workhub', {
  state: () => ({
    summary: null,
    loading: false,
    error: null,
  }),

  getters: {
    sections(state) {
      return SECTION_ORDER
        .map((key) => normalizeSection(key, state.summary?.[key]))
        .filter((section) => section.title)
    },

    shortcuts() {
      if (this.loading) {
        return SECTION_ORDER.map((key) => ({
          key,
          label: '불러오는 중',
          value: '...',
          tone: TONE_BY_KEY[key] || 'blue',
        }))
      }

      if (this.error) {
        return [
          {
            key: 'workhub-error',
            label: '업무 현황을 불러오지 못했습니다',
            value: '재시도',
            tone: 'orange',
            disabled: true,
          },
        ]
      }

      return this.sections.map((section) => ({
        key: section.key,
        label: section.title,
        value: section.badge,
        tone: TONE_BY_KEY[section.key] || 'blue',
      }))
    },

    panelsByKey() {
      return this.sections.reduce((acc, section) => {
        acc[section.key] = section
        return acc
      }, {})
    },
  },

  actions: {
    async fetchSidebarSummary() {
      this.loading = true
      this.error = null

      try {
        const response = await workhubApi.getSidebarSummary()
        this.summary = response.data || null
        return this.summary
      } catch (error) {
        this.error = error
        throw error
      } finally {
        this.loading = false
      }
    },
  },
})
