<script setup>
import Chart from 'chart.js/auto'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { myUsageApi } from '../../api/myUsageApi'

const props = defineProps({
  user: {
    type: Object,
    default: null,
  },
  profile: {
    type: Object,
    default: null,
  },
})

const displayName = computed(() => props.user?.displayName || '사용자')
const email = computed(() => props.user?.email || '이메일 정보 없음')
const jobTitle = computed(() => props.profile?.jobTitle || '직급 정보 없음')
const department = computed(() => props.profile?.department || '부서 정보 없음')
const employeeId = computed(() => props.profile?.employeeId || '사번 정보 없음')
const employeeType = computed(() => props.profile?.employeeType || '고용 형태 정보 없음')
const officeLocation = computed(() => props.profile?.officeLocation || '오피스 위치 정보 없음')

const hireDate = computed(() => {
  if (!props.profile?.employeeHireDate) return '입사일 정보 없음'
  return String(props.profile.employeeHireDate)
})

const initial = computed(() => displayName.value.slice(0, 1))
const chartRanges = [
  { label: '24H', value: '24h' },
  { label: '7', value: '7d' },
  { label: '14', value: '14d' },
  { label: '30', value: '30d' },
]
const selectedRange = ref(chartRanges[1].value)
const monthlySummary = ref({
  totalTokens: 0,
  chatRequestCount: 0,
})
const usageTrend = ref({
  points: [],
})
const summaryLoading = ref(false)
const trendLoading = ref(false)
const usageError = ref(null)
const tokenCanvas = ref(null)
const requestCanvas = ref(null)
let tokenChart = null
let requestChart = null

const formatNumber = (value) => {
  return new Intl.NumberFormat('ko-KR').format(Number(value || 0))
}

const chartLabels = computed(() => usageTrend.value?.points?.map((point) => point.label) || [])
const tokenValues = computed(() => usageTrend.value?.points?.map((point) => point.totalTokens || 0) || [])
const requestValues = computed(() => usageTrend.value?.points?.map((point) => point.chatRequestCount || 0) || [])

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      displayColors: false,
    },
  },
  scales: {
    x: {
      grid: {
        display: false,
      },
      ticks: {
        color: '#7b8498',
        maxRotation: 0,
      },
    },
    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(138, 148, 172, 0.18)',
      },
      ticks: {
        color: '#7b8498',
        precision: 0,
      },
    },
  },
}

const destroyCharts = () => {
  tokenChart?.destroy()
  requestChart?.destroy()
  tokenChart = null
  requestChart = null
}

const renderCharts = async () => {
  await nextTick()

  if (!tokenCanvas.value || !requestCanvas.value) return

  destroyCharts()

  tokenChart = new Chart(tokenCanvas.value, {
    type: 'line',
    data: {
      labels: chartLabels.value,
      datasets: [
        {
          data: tokenValues.value,
          borderColor: '#4f6df5',
          backgroundColor: 'rgba(79, 109, 245, 0.14)',
          borderWidth: 2,
          fill: true,
          tension: 0.35,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
      ],
    },
    options: chartOptions,
  })

  requestChart = new Chart(requestCanvas.value, {
    type: 'bar',
    data: {
      labels: chartLabels.value,
      datasets: [
        {
          data: requestValues.value,
          backgroundColor: 'rgba(47, 183, 132, 0.72)',
          borderColor: '#2fb784',
          borderWidth: 1,
          borderRadius: 8,
          maxBarThickness: 28,
        },
      ],
    },
    options: chartOptions,
  })
}

const fetchMonthlySummary = async () => {
  summaryLoading.value = true

  try {
    const response = await myUsageApi.getMonthlySummary()
    monthlySummary.value = response.data || {
      totalTokens: 0,
      chatRequestCount: 0,
    }
  } catch (error) {
    usageError.value = error
    console.error('Failed to fetch my monthly usage summary:', error)
  } finally {
    summaryLoading.value = false
  }
}

const fetchUsageTrend = async () => {
  trendLoading.value = true
  usageError.value = null

  try {
    const response = await myUsageApi.getUsageTrends(selectedRange.value)
    usageTrend.value = response.data || {
      points: [],
    }
    await renderCharts()
  } catch (error) {
    usageError.value = error
    console.error('Failed to fetch my usage trends:', error)
  } finally {
    trendLoading.value = false
  }
}

watch(selectedRange, () => {
  fetchUsageTrend()
})

onMounted(async () => {
  await Promise.all([
    fetchMonthlySummary(),
    fetchUsageTrend(),
  ])
})

onBeforeUnmount(() => {
  destroyCharts()
})
</script>

<template>
  <section class="mypage-panel" aria-labelledby="mypage-title">
    <div class="mypage-grid">
      <div class="mypage-kpi-area">
        <p class="mypage-eyebrow">KPI</p>

        <div class="kpi-card">
          <article>
            <span>이번달 토큰 사용량</span>
            <strong>{{ summaryLoading ? '...' : formatNumber(monthlySummary.totalTokens) }}</strong>
          </article>

          <article>
            <span>이번달 요청량</span>
            <strong>{{ summaryLoading ? '...' : `${formatNumber(monthlySummary.chatRequestCount)}건` }}</strong>
          </article>
        </div>
      </div>

      <div class="range-toggle" aria-label="그래프 기간">
        <span>기간</span>

        <div class="range-toggle-buttons">
          <button
            v-for="range in chartRanges"
            :key="range.value"
            type="button"
            :class="{ active: selectedRange === range.value }"
            :aria-pressed="selectedRange === range.value"
            @click="selectedRange = range.value"
          >
            {{ range.label }}
          </button>
        </div>
      </div>

      <aside class="profile-stack">
        <div class="profile-avatar-large">
          {{ initial }}
        </div>

        <div class="profile-info-card">
          <p class="profile-card-label">프로필</p>
          <h1 id="mypage-title">{{ displayName }}</h1>

          <dl>
            <div>
              <dt>직급</dt>
              <dd>{{ jobTitle }}</dd>
            </div>

            <div>
              <dt>부서</dt>
              <dd>{{ department }}</dd>
            </div>

            <div>
              <dt>사번</dt>
              <dd>{{ employeeId }}</dd>
            </div>

            <div>
              <dt>고용 형태</dt>
              <dd>{{ employeeType }}</dd>
            </div>

            <div>
              <dt>입사일</dt>
              <dd>{{ hireDate }}</dd>
            </div>

            <div>
              <dt>오피스 위치</dt>
              <dd>{{ officeLocation }}</dd>
            </div>

            <div>
              <dt>이메일</dt>
              <dd>{{ email }}</dd>
            </div>
          </dl>
        </div>
      </aside>

      <article class="chart-card token-chart">
        <div class="chart-card-header">
          <div>
            <span>Token Usage</span>
            <h2>토큰 사용량 그래프</h2>
          </div>
        </div>

        <div class="chart-stage">
          <canvas ref="tokenCanvas" aria-label="토큰 사용량 차트 영역"></canvas>
          <div
            v-if="trendLoading || !tokenValues.length"
            class="chart-placeholder"
          >
            {{ trendLoading ? '불러오는 중...' : '표시할 데이터가 없습니다' }}
          </div>
        </div>
      </article>

      <article class="chart-card request-chart">
        <div class="chart-card-header">
          <div>
            <span>Total Request</span>
            <h2>요청량 그래프</h2>
          </div>
        </div>

        <div class="chart-stage">
          <canvas ref="requestCanvas" aria-label="요청량 차트 영역"></canvas>
          <div
            v-if="trendLoading || !requestValues.length"
            class="chart-placeholder"
          >
            {{ trendLoading ? '불러오는 중...' : '표시할 데이터가 없습니다' }}
          </div>
        </div>
      </article>

      <p
        v-if="usageError"
        class="usage-error"
      >
        사용량 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </p>
    </div>
  </section>
</template>

<style scoped>
.mypage-panel {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background:
    radial-gradient(circle at 16% 0%, rgba(var(--color-primary-light-rgb), 0.16), transparent 34%),
    radial-gradient(circle at 88% 8%, rgba(var(--color-sky-rgb), 0.16), transparent 30%),
    linear-gradient(180deg, var(--color-page-gradient-start) 0%, var(--color-surface-raised) 62%);
  padding: 36px 44px 42px;
}

.mypage-grid {
  width: min(1160px, 100%);
  min-height: 100%;
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 230px;
  grid-template-areas:
    "kpi profile"
    "chart profile"
    "request request"
    "error error";
  gap: 24px 28px;
  align-items: start;
}

.mypage-kpi-area {
  grid-area: kpi;
  width: min(520px, 100%);
  align-self: start;
}

.mypage-eyebrow {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 800;
  color: var(--color-primary);
  text-transform: uppercase;
}

.kpi-card {
  border: 1px solid rgba(var(--color-border-muted-rgb), 0.85);
  background: rgba(var(--color-white-rgb), 0.88);
  box-shadow: 0 20px 48px rgba(var(--color-primary-rgb), 0.08);
  backdrop-filter: blur(12px);
  border-radius: 14px;
  padding: 16px 18px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.kpi-card article {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kpi-card span,
.chart-card-header span,
.profile-card-label,
.range-toggle span {
  font-size: 12px;
  color: var(--color-muted);
  font-weight: 700;
}

.kpi-card strong {
  font-size: 20px;
  line-height: 1;
  color: var(--color-primary);
}

.range-toggle {
  grid-area: kpi;
  justify-self: end;
  align-self: end;
  min-width: 238px;
  border: 1px solid rgba(var(--color-border-muted-rgb), 0.85);
  background: rgba(var(--color-white-rgb), 0.84);
  border-radius: 999px;
  padding: 5px 6px 5px 14px;
  box-shadow: 0 16px 34px rgba(var(--color-primary-rgb), 0.07);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.range-toggle-buttons {
  display: flex;
  align-items: center;
  gap: 3px;
  border-radius: 999px;
  background: var(--color-surface-muted);
  padding: 3px;
}

.range-toggle-buttons button {
  min-width: 38px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 999px;
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 800;
}

.range-toggle-buttons button:hover {
  color: var(--color-primary-light);
  background: rgba(var(--color-white-rgb), 0.66);
}

.range-toggle-buttons button.active {
  background: var(--color-surface-raised);
  color: var(--color-primary);
  box-shadow: 0 6px 14px rgba(var(--color-primary-rgb), 0.12);
}

.profile-stack {
  grid-area: profile;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

.profile-avatar-large {
  width: 104px;
  height: 104px;
  border-radius: 50%;
  background:
    linear-gradient(145deg, rgba(var(--color-white-rgb), 0.95), rgba(234, 241, 254, 0.95));
  border: 1px solid rgba(var(--color-white-rgb), 0.95);
  box-shadow: 0 24px 48px rgba(var(--color-primary-rgb), 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
  font-size: 34px;
  font-weight: 850;
}

.profile-info-card {
  width: 100%;
  border: 1px solid rgba(var(--color-border-muted-rgb), 0.86);
  background: rgba(var(--color-white-rgb), 0.9);
  border-radius: 14px;
  padding: 18px;
  box-shadow: 0 20px 48px rgba(var(--color-primary-rgb), 0.08);
}

.profile-info-card h1 {
  margin: 4px 0 16px;
  font-size: 20px;
  line-height: 1.2;
  color: var(--color-primary);
}

.profile-info-card dl {
  margin: 0;
  display: grid;
  gap: 11px;
}

.profile-info-card div {
  min-width: 0;
}

.profile-info-card dt {
  font-size: 11px;
  font-weight: 800;
  color: var(--color-subtle);
}

.profile-info-card dd {
  margin: 3px 0 0;
  font-size: 13px;
  color: var(--color-text);
  line-height: 1.35;
  word-break: break-all;
}

.chart-card {
  border: 1px solid rgba(var(--color-border-muted-rgb), 0.88);
  background: rgba(var(--color-white-rgb), 0.88);
  border-radius: 16px;
  box-shadow: 0 24px 60px rgba(var(--color-primary-rgb), 0.09);
  backdrop-filter: blur(12px);
  padding: 20px;
}

.token-chart {
  grid-area: chart;
  min-height: 260px;
}

.request-chart {
  grid-area: request;
  min-height: 260px;
}

.chart-card-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.chart-card-header h2 {
  margin: 4px 0 0;
  color: var(--color-text);
  font-size: 16px;
  font-weight: 800;
}

.chart-stage {
  height: 190px;
  position: relative;
  border: 1px solid rgba(var(--color-border-muted-rgb), 0.42);
  background:
    linear-gradient(rgba(234, 241, 254, 0.58) 1px, transparent 1px),
    linear-gradient(90deg, rgba(234, 241, 254, 0.58) 1px, transparent 1px);
  background-size: 40px 40px;
  border-radius: 12px;
  overflow: hidden;
}

.chart-stage canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.chart-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-subtle);
  font-size: 13px;
  font-weight: 700;
  background: rgba(var(--color-white-rgb), 0.62);
}

.usage-error {
  grid-area: error;
  margin: 0;
  border: 1px solid var(--color-warning-border);
  background: var(--color-warning-bg);
  color: var(--color-warning-text);
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 13px;
  font-weight: 700;
}

@media (max-width: 1040px) {
  .mypage-panel {
    padding: 28px;
  }

  .mypage-grid {
    grid-template-columns: 1fr;
    grid-template-areas:
      "profile"
      "kpi"
      "range"
      "chart"
      "request"
      "error";
  }

  .range-toggle {
    grid-area: range;
    justify-self: stretch;
    align-self: auto;
  }

  .profile-stack {
    align-items: stretch;
  }
}

@media (max-width: 720px) {
  .mypage-panel {
    padding: 18px;
  }

  .kpi-card {
    grid-template-columns: 1fr;
  }

  .range-toggle {
    border-radius: 14px;
  }

  .range-toggle-buttons {
    flex: 1;
    justify-content: space-between;
  }

  .chart-card {
    padding: 16px;
  }
}
</style>
