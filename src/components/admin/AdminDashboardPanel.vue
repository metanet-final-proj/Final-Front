<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Chart from 'chart.js/auto'
import { adminObservabilityApi } from '../../api/adminObservabilityApi'

const ranges = [
  { label: '24H', value: '24h' },
  { label: '7', value: '7d' },
  { label: '14', value: '14d' },
  { label: '30', value: '30d' },
]
const selectedRange = ref(ranges[0].value)
const dashboard = ref(null)
const isLoading = ref(false)
const errorMessage = ref('')

const summary = computed(() => dashboard.value?.summary ?? {
  totalRequests: 0,
  totalRequestsDeltaPercent: 0,
  answerSuccessRate: 0,
  answerSuccessRateDeltaPercent: 0,
  totalTokens: 0,
  totalTokensDeltaPercent: 0,
  activeUsers: 0,
  activeUsersDeltaPercent: 0,
  signupUsers: 0,
  signupUsersDeltaPercent: 0,
  avgLatencyMs: 0,
  avgLatencyDeltaPercent: 0,
  topDomain: '',
  topDomainCount: 0,
  topDomainCountDeltaPercent: 0,
})

const kpis = computed(() => [
  {
    label: '답변 평균 지연 시간',
    value: `${formatNumber(summary.value.avgLatencyMs)} ms`,
    delta: deltaText(summary.value.avgLatencyDeltaPercent),
  },
  {
    label: '총 토큰 사용량',
    value: formatNumber(summary.value.totalTokens),
    delta: deltaText(summary.value.totalTokensDeltaPercent),
  },
  {
    label: '요청량',
    value: `${formatNumber(summary.value.totalRequests)} 회`,
    delta: deltaText(summary.value.totalRequestsDeltaPercent),
  },
  {
    label: '가장 많이 사용된 도메인',
    value: `${domainLabel(summary.value.topDomain)} ${formatNumber(summary.value.topDomainCount)} 회`,
    delta: deltaText(summary.value.topDomainCountDeltaPercent),
  },
  {
    label: '가입한 유저',
    value: `${formatNumber(summary.value.signupUsers)} 명`,
    delta: deltaText(summary.value.signupUsersDeltaPercent),
  },
  {
    label: '답변 성공률',
    value: `${formatPercent(summary.value.answerSuccessRate)}%`,
    delta: deltaText(summary.value.answerSuccessRateDeltaPercent),
  },
])

const logRows = computed(() => {
  return (dashboard.value?.recentAuthLogs ?? []).map((row) => ({
    createdAt: row.createdAt,
    time: formatTime(row.createdAt),
    user: row.userId ? `#${row.userId}` : '-',
    email: row.email ?? '-',
    provider: row.provider ?? '-',
    event: eventLabel(row.eventType),
  }))
})

const LOG_PREVIEW_SIZE = 6
const LOG_PAGE_SIZE = 10
const authLogDialogOpen = ref(false)
const authLogPage = ref(1)
const authLogEmailQuery = ref('')

const sortedLogRows = computed(() => {
  return [...logRows.value].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
})

const visibleLogRows = computed(() => sortedLogRows.value.slice(0, LOG_PREVIEW_SIZE))

const filteredLogRows = computed(() => {
  const query = authLogEmailQuery.value.trim().toLowerCase()

  if (!query) return sortedLogRows.value

  return sortedLogRows.value.filter((row) => row.email.toLowerCase().includes(query))
})

const totalLogPages = computed(() => {
  return Math.max(1, Math.ceil(filteredLogRows.value.length / LOG_PAGE_SIZE))
})

const pagedLogRows = computed(() => {
  const start = (authLogPage.value - 1) * LOG_PAGE_SIZE

  return filteredLogRows.value.slice(start, start + LOG_PAGE_SIZE)
})

const logPageNumbers = computed(() => {
  return Array.from({ length: totalLogPages.value }, (_, index) => index + 1)
})

const openAuthLogDialog = () => {
  authLogDialogOpen.value = true
  authLogPage.value = 1
}

const closeAuthLogDialog = () => {
  authLogDialogOpen.value = false
}

watch(authLogEmailQuery, () => {
  authLogPage.value = 1
})

watch(totalLogPages, (nextTotalPages) => {
  if (authLogPage.value > nextTotalPages) {
    authLogPage.value = nextTotalPages
  }
})

const tokenTrendCanvas = ref(null)
const tokenUsageCanvas = ref(null)
const requestCanvas = ref(null)
const signupCanvas = ref(null)
const mauCanvas = ref(null)

const charts = []

const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      backgroundColor: '#17306e',
      padding: 10,
      titleFont: {
        family: 'Pretendard Variable',
      },
      bodyFont: {
        family: 'Pretendard Variable',
      },
    },
  },
  scales: {
    x: {
      grid: {
        display: false,
      },
      ticks: {
        color: '#8a94ac',
      },
      border: {
        display: false,
      },
    },
    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(227, 232, 242, 0.8)',
      },
      ticks: {
        color: '#8a94ac',
      },
      border: {
        display: false,
      },
    },
  },
}

const paddedBarChartOptions = {
  ...baseChartOptions,
  layout: {
    padding: {
      left: 14,
      right: 14,
    },
  },
  scales: {
    ...baseChartOptions.scales,
    x: {
      ...baseChartOptions.scales.x,
      offset: true,
    },
  },
}

const createChart = (canvas, config) => {
  if (!canvas.value) return

  charts.push(new Chart(canvas.value, config))
}

const destroyCharts = () => {
  while (charts.length > 0) {
    charts.pop()?.destroy()
  }
}

const renderCharts = () => {
  destroyCharts()

  const tokenPoints = dashboard.value?.tokenUsageTrend ?? []
  const toolUsage = dashboard.value?.toolUsage ?? []
  const requestTrend = dashboard.value?.requestTrend ?? []
  const authTrend = dashboard.value?.authTrend ?? []
  const ragSummary = dashboard.value?.ragSummary ?? {
    totalSearches: 0,
    avgHitCount: 0,
    avgLatencyMs: 0,
  }

  createChart(tokenTrendCanvas, {
    type: 'line',
    data: {
      labels: tokenPoints.map((point) => point.label),
      datasets: [
        {
          data: tokenPoints.map((point) => point.totalTokens),
          borderColor: '#1b4396',
          backgroundColor: 'rgba(27, 67, 150, 0.12)',
          fill: true,
          tension: 0.38,
          pointRadius: 3,
          pointBackgroundColor: '#1b4396',
        },
      ],
    },
    options: baseChartOptions,
  })

  createChart(tokenUsageCanvas, {
    type: 'bar',
    data: {
      labels: toolUsage.map((item) => compactToolName(item.toolName)),
      datasets: [
        {
          data: toolUsage.map((item) => item.count),
          categoryPercentage: 0.7,
          barPercentage: 0.78,
          borderRadius: 6,
          backgroundColor: ['#17306e', '#1b4396', '#12a5de', '#2fa35c', '#f6c21a', '#f0812c'],
        },
      ],
    },
    options: paddedBarChartOptions,
  })

  createChart(requestCanvas, {
    type: 'bar',
    data: {
      labels: requestTrend.map((point) => point.label),
      datasets: [
        {
          data: requestTrend.map((point) => point.value),
          borderRadius: 6,
          backgroundColor: '#12a5de',
        },
      ],
    },
    options: baseChartOptions,
  })

  createChart(signupCanvas, {
    type: 'line',
    data: {
      labels: authTrend.map((point) => point.label),
      datasets: [
        {
          data: authTrend.map((point) => point.value),
          borderColor: '#2fa35c',
          backgroundColor: 'rgba(47, 163, 92, 0.12)',
          fill: true,
          tension: 0.35,
          pointRadius: 3,
        },
      ],
    },
    options: baseChartOptions,
  })

  createChart(mauCanvas, {
    type: 'bar',
    data: {
      labels: ['검색 수', '평균 반환 문서 수', '평균 지연'],
      datasets: [
        {
          data: [
            ragSummary.totalSearches,
            Math.round(ragSummary.avgHitCount * 10) / 10,
            ragSummary.avgLatencyMs,
          ],
          categoryPercentage: 0.62,
          barPercentage: 0.72,
          borderRadius: 6,
          backgroundColor: ['#1b4396', '#12a5de', '#f0812c'],
        },
      ],
    },
    options: paddedBarChartOptions,
  })
}

const fetchDashboard = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const response = await adminObservabilityApi.getDashboard(selectedRange.value)
    dashboard.value = response.data
    await nextTick()
    renderCharts()
  } catch (error) {
    console.error('Failed to load admin observability dashboard:', error)
    errorMessage.value = '관리자 대시보드를 불러오지 못했습니다.'
  } finally {
    isLoading.value = false
  }
}

const formatNumber = (value) => {
  return Number(value ?? 0).toLocaleString('ko-KR')
}

const formatPercent = (value) => {
  return Number(value ?? 0).toLocaleString('ko-KR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })
}

const deltaText = (value) => {
  const numericValue = Number(value ?? 0)
  if (numericValue === 0) return '지난달 대비 0%'
  const sign = numericValue > 0 ? '+' : ''
  return `지난달 대비 ${sign}${formatPercent(numericValue)}%`
}

const formatTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const compactToolName = (toolName) => {
  if (!toolName) return '-'
  const domainName = domainLabel(toolName)
  if (domainName !== toolName) return domainName

  return toolName
    .replace('meeting_room_', '회의실 ')
    .replace('parking_', '주차 ')
    .replace('cafeteria_', '식당 ')
    .replace('office_supplies_', '비품 ')
    .replaceAll('_', ' ')
}

const domainLabel = (domain) => {
  const labels = {
    meeting_room: '회의실',
    parking: '주차',
    cafeteria: '구내식당',
    office_supplies: '비품',
    policy_rag: '사내 규정',
    rag: 'RAG',
    unknown: '기타',
  }

  return labels[domain] ?? domain ?? '-'
}

const eventLabel = (eventType) => {
  if (eventType === 'login') return '로그인'
  if (eventType === 'signup') return '회원가입'
  if (eventType === 'logout') return '로그아웃'
  return eventType || '-'
}

watch(selectedRange, fetchDashboard)

onMounted(fetchDashboard)

onBeforeUnmount(() => {
  destroyCharts()
})
</script>

<template>
  <section class="admin-dashboard-panel" aria-labelledby="admin-dashboard-title">
    <div class="admin-dashboard-grid">
      <header class="admin-heading">
        <p>Admin</p>
        <h1 id="admin-dashboard-title">관리자 대시보드</h1>
      </header>

      <section class="admin-kpi-card" aria-label="관리자 KPI">
        <article v-for="kpi in kpis" :key="kpi.label">
          <span>{{ kpi.label }}</span>
          <strong>{{ kpi.value }}</strong>
          <small>{{ kpi.delta }}</small>
        </article>
      </section>

      <p v-if="errorMessage" class="dashboard-error">{{ errorMessage }}</p>
      <p v-else-if="isLoading" class="dashboard-loading">대시보드를 불러오는 중입니다.</p>

      <div class="range-toggle" aria-label="차트 기간 선택">
        <span>기간</span>

        <div class="range-toggle-buttons">
          <button
            v-for="range in ranges"
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

      <article class="dashboard-card token-trend-card">
        <div class="card-header">
          <div>
            <span>Token Usage</span>
            <h2>토큰 사용량 그래프</h2>
          </div>
        </div>
        <div class="chart-area">
          <canvas ref="tokenTrendCanvas" aria-label="토큰 사용량 그래프"></canvas>
        </div>
      </article>

      <article class="dashboard-card token-total-card">
        <div class="card-header">
          <div>
            <span>Tool Call by Domain</span>
            <h2>도메인별 툴 호출 횟수</h2>
          </div>
        </div>
        <div class="chart-area">
          <canvas ref="tokenUsageCanvas" aria-label="도메인별 툴 호출 횟수 차트"></canvas>
        </div>
      </article>

      <article class="dashboard-card request-card">
        <div class="card-header">
          <div>
            <span>Total Request</span>
            <h2>전체 요청량 그래프</h2>
          </div>
        </div>
        <div class="chart-area">
          <canvas ref="requestCanvas" aria-label="전체 요청량 그래프"></canvas>
        </div>
      </article>

      <article class="dashboard-card log-card">
        <div class="card-header">
          <div>
            <span>Auth Logs</span>
            <h2>로그인, 회원가입 로그</h2>
          </div>
          <button type="button" @click="openAuthLogDialog">펼치기</button>
        </div>

        <div class="log-table-wrap">
          <table>
            <thead>
              <tr>
                <th>일시</th>
                <th>유저</th>
                <th>이메일</th>
                <th>Provider</th>
                <th>이벤트</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in visibleLogRows" :key="`${row.createdAt}-${row.email}-${row.event}`">
                <td>{{ row.time }}</td>
                <td>{{ row.user }}</td>
                <td>{{ row.email }}</td>
                <td>{{ row.provider }}</td>
                <td>{{ row.event }}</td>
              </tr>
              <tr v-if="visibleLogRows.length === 0">
                <td colspan="5" class="auth-log-empty">표시할 로그가 없습니다.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="dashboard-card signup-card">
        <div class="card-header">
          <div>
            <span>MAU</span>
            <h2>MAU 변화량</h2>
          </div>
        </div>
        <div class="chart-area">
          <canvas ref="signupCanvas" aria-label="MAU 변화량 그래프"></canvas>
        </div>
      </article>

      <article class="dashboard-card mau-card">
        <div class="card-header">
          <div>
            <span>RAG</span>
            <h2>RAG 검색 결과 요약</h2>
          </div>
        </div>
        <div class="chart-area">
          <canvas ref="mauCanvas" aria-label="RAG 검색 결과 요약 그래프"></canvas>
        </div>
      </article>
    </div>

    <div
      v-if="authLogDialogOpen"
      class="auth-log-modal-backdrop"
      role="presentation"
      @click.self="closeAuthLogDialog"
    >
      <section
        class="auth-log-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-log-modal-title"
      >
        <header class="auth-log-modal-header">
          <div>
            <span>Auth Logs</span>
            <h2 id="auth-log-modal-title">로그인, 회원가입 로그</h2>
          </div>

          <button
            class="auth-log-modal-close"
            type="button"
            aria-label="로그 팝업 닫기"
            @click="closeAuthLogDialog"
          >
            ×
          </button>
        </header>

        <div class="auth-log-filter">
          <label for="auth-log-email-filter">이메일 검색</label>
          <input
            id="auth-log-email-filter"
            v-model="authLogEmailQuery"
            type="search"
            placeholder="이메일을 입력하세요"
          />
        </div>

        <div class="auth-log-modal-table-wrap">
          <table>
            <thead>
              <tr>
                <th>일시</th>
                <th>유저</th>
                <th>이메일</th>
                <th>Provider</th>
                <th>이벤트</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in pagedLogRows" :key="`modal-${row.createdAt}-${row.email}-${row.event}`">
                <td>{{ row.time }}</td>
                <td>{{ row.user }}</td>
                <td>{{ row.email }}</td>
                <td>{{ row.provider }}</td>
                <td>{{ row.event }}</td>
              </tr>
              <tr v-if="pagedLogRows.length === 0">
                <td colspan="5" class="auth-log-empty">검색 결과가 없습니다.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer class="auth-log-pagination" aria-label="로그 페이지">
          <button
            v-for="page in logPageNumbers"
            :key="page"
            type="button"
            :class="{ active: authLogPage === page }"
            :aria-current="authLogPage === page ? 'page' : undefined"
            @click="authLogPage = page"
          >
            {{ page }}
          </button>
        </footer>
      </section>
    </div>
  </section>
</template>

<style scoped>
.admin-dashboard-panel {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background:
    radial-gradient(circle at 16% 0%, rgba(var(--color-primary-light-rgb), 0.16), transparent 34%),
    radial-gradient(circle at 88% 8%, rgba(var(--color-sky-rgb), 0.16), transparent 30%),
    linear-gradient(180deg, var(--color-page-gradient-start) 0%, var(--color-surface-raised) 62%);
  padding: 32px 36px 36px;
}

.admin-dashboard-grid {
  width: min(1180px, 100%);
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 18px;
  align-items: stretch;
}

.admin-heading {
  grid-column: 1 / -1;
  align-self: end;
}

.admin-heading p {
  margin: 0 0 6px;
  color: var(--color-primary-light);
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}

.admin-heading h1 {
  margin: 0;
  color: var(--color-primary);
  font-size: 28px;
  font-weight: 850;
  line-height: 1.25;
}

.kpi-period-note {
  display: block;
  margin-top: 8px;
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.45;
}

.admin-kpi-card {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  border: 1px solid rgba(var(--color-border-muted-rgb), 0.85);
  border-radius: 8px;
  background: rgba(var(--color-white-rgb), 0.88);
  box-shadow: 0 20px 48px rgba(var(--color-primary-rgb), 0.08);
  backdrop-filter: blur(12px);
}

.admin-kpi-card article {
  min-width: 0;
  min-height: 98px;
  padding: 16px 16px;
  border-right: 1px solid var(--color-border-light);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 7px;
}

.admin-kpi-card article:last-child {
  border-right: none;
}

.admin-kpi-card span,
.card-header span,
.range-toggle span {
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.35;
}

.admin-kpi-card strong {
  color: var(--color-primary);
  font-size: 17px;
  font-weight: 850;
  line-height: 1.24;
  word-break: keep-all;
}

.admin-kpi-card small {
  color: var(--color-subtle);
  font-size: 11.5px;
  line-height: 1.3;
}

.dashboard-error,
.dashboard-loading {
  grid-column: 1 / 11;
  margin: 0;
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  background: rgba(var(--color-white-rgb), 0.82);
  color: var(--color-muted);
  padding: 10px 12px;
  font-size: 12.5px;
  font-weight: 700;
}

.dashboard-error {
  color: #b42318;
}

.range-toggle {
  grid-column: 11 / 13;
  justify-self: end;
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

.dashboard-card {
  min-width: 0;
  min-height: 216px;
  padding: 18px;
  border: 1px solid rgba(var(--color-border-muted-rgb), 0.88);
  border-radius: 8px;
  background: rgba(var(--color-white-rgb), 0.9);
  box-shadow: 0 24px 60px rgba(var(--color-primary-rgb), 0.09);
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
}

.token-trend-card {
  grid-column: 1 / 7;
}

.token-total-card {
  grid-column: 7 / 13;
}

.request-card {
  grid-column: 1 / 7;
}

.log-card {
  grid-column: 7 / 13;
}

.signup-card {
  grid-column: 1 / 7;
}

.mau-card {
  grid-column: 7 / 13;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 14px;
}

.card-header h2 {
  margin: 4px 0 0;
  color: var(--color-text);
  font-size: 15px;
  font-weight: 800;
}

.card-header button {
  flex-shrink: 0;
  min-height: 26px;
  border: 1px solid var(--color-primary-border-muted);
  border-radius: 999px;
  background: var(--color-surface-grid);
  color: var(--color-primary-light);
  padding: 5px 9px;
  font-size: 11.5px;
  font-weight: 800;
}

.card-header button:hover {
  background: var(--color-primary-soft);
}

.chart-area {
  position: relative;
  flex: 1;
  min-height: 150px;
}

.chart-area canvas {
  width: 100%;
  height: 100%;
}

.log-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
}

.log-table-wrap table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}

.log-table-wrap th,
.log-table-wrap td {
  padding: 11px 12px;
  text-align: left;
  border-bottom: 1px solid var(--color-border-light);
  white-space: nowrap;
}

.log-table-wrap th {
  background: var(--color-surface-soft);
  color: var(--color-muted);
  font-size: 11.5px;
  font-weight: 800;
}

.log-table-wrap td {
  color: var(--color-text);
}

.log-table-wrap tr:last-child td {
  border-bottom: none;
}

.auth-log-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  padding: 32px;
  background: rgba(23, 31, 49, 0.38);
  display: flex;
  align-items: center;
  justify-content: center;
}

.auth-log-modal {
  width: min(1080px, 100%);
  max-height: min(760px, calc(100vh - 64px));
  border: 1px solid rgba(var(--color-border-muted-rgb), 0.92);
  border-radius: 10px;
  background: var(--color-surface-raised);
  box-shadow: 0 30px 80px rgba(var(--color-primary-rgb), 0.24);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.auth-log-modal-header {
  padding: 20px 22px 16px;
  border-bottom: 1px solid var(--color-border-light);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.auth-log-modal-header span {
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 800;
}

.auth-log-modal-header h2 {
  margin: 4px 0 0;
  color: var(--color-primary);
  font-size: 20px;
  font-weight: 850;
}

.auth-log-modal-close {
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface-raised);
  color: var(--color-muted);
  font-size: 20px;
  line-height: 1;
}

.auth-log-modal-close:hover {
  background: var(--color-bg);
  color: var(--color-primary);
}

.auth-log-filter {
  padding: 16px 22px;
  border-bottom: 1px solid var(--color-border-light);
  display: flex;
  align-items: center;
  gap: 12px;
}

.auth-log-filter label {
  flex-shrink: 0;
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 800;
}

.auth-log-filter input {
  width: min(360px, 100%);
  height: 36px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface-subtle);
  color: var(--color-text);
  padding: 0 12px;
  font-size: 13px;
}

.auth-log-filter input:focus {
  outline: none;
  border-color: var(--color-primary-light);
  background: var(--color-surface-raised);
}

.auth-log-modal-table-wrap {
  min-height: 0;
  margin: 0 22px 4px;
  overflow: auto;
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
}

.auth-log-modal-table-wrap table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.auth-log-modal-table-wrap th,
.auth-log-modal-table-wrap td {
  padding: 12px 14px;
  text-align: left;
  border-bottom: 1px solid var(--color-border-light);
  white-space: nowrap;
}

.auth-log-modal-table-wrap th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--color-surface-soft);
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 800;
}

.auth-log-modal-table-wrap td {
  color: var(--color-text);
}

.auth-log-empty {
  height: 160px;
  text-align: center;
  color: var(--color-subtle);
}

.auth-log-pagination {
  padding: 14px 22px 18px;
  border-top: 1px solid var(--color-border-light);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.auth-log-pagination button {
  min-width: 32px;
  height: 32px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface-raised);
  color: var(--color-muted);
  font-size: 13px;
  font-weight: 800;
}

.auth-log-pagination button:hover {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.auth-log-pagination button.active {
  border-color: var(--color-primary-light);
  background: var(--color-primary-light);
  color: var(--color-white);
}

@media (max-width: 1180px) {
  .admin-heading,
  .admin-kpi-card,
  .range-toggle,
  .token-trend-card,
  .token-total-card,
  .request-card,
  .log-card,
  .signup-card,
  .mau-card {
    grid-column: 1 / -1;
  }

  .admin-kpi-card {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .admin-kpi-card article:nth-child(3n) {
    border-right: none;
  }

  .admin-kpi-card article:nth-child(n + 4) {
    border-top: 1px solid var(--color-border-light);
  }

  .range-toggle {
    justify-self: end;
  }
}

@media (max-width: 720px) {
  .admin-dashboard-panel {
    padding: 18px;
  }

  .admin-dashboard-grid {
    gap: 12px;
  }

  .admin-heading h1 {
    font-size: 23px;
  }

  .admin-kpi-card {
    grid-template-columns: 1fr;
  }

  .admin-kpi-card article,
  .admin-kpi-card article:nth-child(3n) {
    border-right: none;
  }

  .admin-kpi-card article:nth-child(n + 2) {
    border-top: 1px solid var(--color-border-light);
  }

  .range-toggle {
    width: 100%;
    justify-content: space-between;
    border-radius: 14px;
  }

  .range-toggle-buttons {
    flex: 1;
    justify-content: space-between;
  }

  .range-toggle-buttons button {
    flex: 1;
  }

  .dashboard-card {
    min-height: 230px;
    padding: 15px;
  }

  .auth-log-modal-backdrop {
    padding: 14px;
  }

  .auth-log-filter {
    align-items: stretch;
    flex-direction: column;
  }

  .auth-log-filter input {
    width: 100%;
  }
}
</style>
