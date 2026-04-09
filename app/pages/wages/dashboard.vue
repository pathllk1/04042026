<template>
  <div class="min-h-screen p-4 sm:p-6 md:p-8">

    <!-- Page Header -->
    <div class="mb-8 animate-fade-in">
      <h1 class="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white mb-2">
        Employee & Wages Management
      </h1>
      <p class="text-gray-600 dark:text-gray-400">Monitor employee statistics, wages, and advances in one place</p>
    </div>

    <!-- ── Stats Cards ──────────────────────────────────────────────── -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">

      <div class="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 rounded-xl shadow-md p-6 border border-blue-200 dark:border-blue-700 hover:shadow-lg hover:scale-105 transition-all duration-300">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-blue-600 dark:text-blue-300 text-sm font-medium mb-1">Total Employees</p>
            <h3 class="text-2xl font-bold text-gray-800 dark:text-white">{{ stats.totalEmployees }}</h3>
            <p class="text-blue-600 dark:text-blue-300 text-xs mt-2">{{ stats.activeEmployees }} active</p>
          </div>
          <div class="bg-blue-100 dark:bg-blue-700 p-3 rounded-full">
            <UIcon name="i-lucide-users" class="h-8 w-8 text-blue-600 dark:text-blue-300" />
          </div>
        </div>
      </div>

      <div class="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 rounded-xl shadow-md p-6 border border-green-200 dark:border-green-700 hover:shadow-lg hover:scale-105 transition-all duration-300">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-green-600 dark:text-green-300 text-sm font-medium mb-1">Monthly Wages</p>
            <h3 class="text-2xl font-bold text-gray-800 dark:text-white">₹{{ formatCurrency(stats.monthlyWages) }}</h3>
            <p class="text-green-600 dark:text-green-300 text-xs mt-2">{{ currentMonth }}</p>
          </div>
          <div class="bg-green-100 dark:bg-green-700 p-3 rounded-full">
            <UIcon name="i-lucide-wallet" class="h-8 w-8 text-green-600 dark:text-green-300" />
          </div>
        </div>
      </div>

      <div class="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900 dark:to-yellow-800 rounded-xl shadow-md p-6 border border-yellow-200 dark:border-yellow-700 hover:shadow-lg hover:scale-105 transition-all duration-300">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-yellow-600 dark:text-yellow-300 text-sm font-medium mb-1">Outstanding Advances</p>
            <h3 class="text-2xl font-bold text-gray-800 dark:text-white">₹{{ formatCurrency(stats.outstandingAdvances) }}</h3>
            <p class="text-yellow-600 dark:text-yellow-300 text-xs mt-2">{{ stats.advanceCount }} active advances</p>
          </div>
          <div class="bg-yellow-100 dark:bg-yellow-700 p-3 rounded-full">
            <UIcon name="i-lucide-circle-dollar-sign" class="h-8 w-8 text-yellow-600 dark:text-yellow-300" />
          </div>
        </div>
      </div>

      <div class="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900 dark:to-purple-800 rounded-xl shadow-md p-6 border border-purple-200 dark:border-purple-700 hover:shadow-lg hover:scale-105 transition-all duration-300">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-purple-600 dark:text-purple-300 text-sm font-medium mb-1">Recovered Advances</p>
            <h3 class="text-2xl font-bold text-gray-800 dark:text-white">₹{{ formatCurrency(stats.recoveredAdvances) }}</h3>
            <p class="text-purple-600 dark:text-purple-300 text-xs mt-2">{{ currentMonth }}</p>
          </div>
          <div class="bg-purple-100 dark:bg-purple-700 p-3 rounded-full">
            <UIcon name="i-lucide-circle-check" class="h-8 w-8 text-purple-600 dark:text-purple-300" />
          </div>
        </div>
      </div>
    </div>

    <!-- ── Charts Section ────────────────────────────────────────────── -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

      <!-- Charts header -->
      <div class="lg:col-span-2 flex justify-between items-center">
        <h2 class="text-xl font-semibold text-gray-800 dark:text-white">Charts & Analytics</h2>
        <div class="flex gap-2">
          <UButton
            size="sm"
            color="success"
            variant="soft"
            icon="i-lucide-cloud-download"
            @click="async () => { await fetchDashboardData(); await refreshCharts(); }"
          >
            Refresh Data
          </UButton>
          <UButton
            size="sm"
            color="primary"
            variant="soft"
            icon="i-lucide-refresh-cw"
            @click="refreshCharts"
          >
            Refresh Charts
          </UButton>
        </div>
      </div>

      <!-- Monthly Wages Chart -->
      <UCard>
        <template #header>
          <div class="flex justify-between items-center">
            <h2 class="text-lg font-semibold text-gray-800 dark:text-white">Monthly Wages Trend</h2>
            <span v-if="wagesData.length > 0" class="text-xs text-gray-500">
              {{ wagesData.length }} month{{ wagesData.length > 1 ? 's' : '' }}
            </span>
          </div>
        </template>
        <div class="relative h-64 w-full">
          <div id="wagesChartContainer" class="absolute inset-0 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden z-30" v-show="showWagesChart">
            <div v-if="showWagesChart && !wagesChartInstance" class="absolute inset-0 flex items-center justify-center text-xs text-gray-400 z-20">
              <div class="bg-white dark:bg-gray-800 px-3 py-2 rounded shadow-sm">Chart loading…</div>
            </div>
          </div>
          <div v-if="loading" class="absolute inset-0 flex justify-center items-center z-20">
            <UIcon name="i-lucide-loader-circle" class="h-12 w-12 animate-spin text-green-500" />
          </div>
          <div v-if="!loading && !showWagesChart" class="absolute inset-0 flex flex-col justify-center items-center z-10 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 text-center p-4">
            <UIcon name="i-lucide-file-text" class="h-12 w-12 mb-2 text-gray-300" />
            <p class="text-gray-500 text-sm">No wage data available for chart</p>
            <p class="text-xs text-gray-400 mt-1">Process wages for multiple months to see the trend</p>
            <p v-if="stats.monthlyWages > 0" class="text-xs text-blue-500 mt-2">
              (Current month wages: ₹{{ formatCurrency(stats.monthlyWages) }})
            </p>
          </div>
        </div>
      </UCard>

      <!-- Advances Distribution Chart -->
      <UCard>
        <template #header>
          <div class="flex justify-between items-center">
            <h2 class="text-lg font-semibold text-gray-800 dark:text-white">Advances Status</h2>
            <span v-if="advancesData.labels && advancesData.labels.length > 0" class="text-xs text-gray-500">
              {{ advancesData.labels.length }} status{{ advancesData.labels.length > 1 ? 'es' : '' }}
            </span>
          </div>
        </template>
        <div class="relative h-64 w-full">
          <div id="advancesChartContainer" class="absolute inset-0 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden z-30" v-show="showAdvancesChart">
            <div class="absolute top-0 left-0 right-0 bg-white/80 dark:bg-gray-900/80 p-1 text-center text-xs text-gray-600 z-40"
                 v-if="advancesData.data && advancesData.data.some((v: number) => v > 0)">
              Outstanding (₹{{ formatCurrency(stats.outstandingAdvances) }}) vs Recovered (₹{{ formatCurrency(stats.recoveredAdvances) }})
            </div>
            <div v-if="showAdvancesChart && !advancesChartInstance" class="absolute inset-0 flex items-center justify-center text-xs text-gray-400 z-20">
              <div class="bg-white dark:bg-gray-800 px-3 py-2 rounded shadow-sm">Chart loading…</div>
            </div>
          </div>
          <div v-if="loading" class="absolute inset-0 flex justify-center items-center z-20">
            <UIcon name="i-lucide-loader-circle" class="h-12 w-12 animate-spin text-yellow-500" />
          </div>
          <div v-if="!loading && !showAdvancesChart" class="absolute inset-0 flex flex-col justify-center items-center z-10 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 text-center p-4">
            <UIcon name="i-lucide-circle-dollar-sign" class="h-12 w-12 mb-2 text-gray-300" />
            <p class="text-gray-500 text-sm">No advances data available for chart</p>
            <p class="text-xs text-gray-400 mt-1">Create advances with different statuses to see distribution</p>
            <p v-if="stats.outstandingAdvances > 0" class="text-xs text-yellow-500 mt-2">
              (Outstanding: ₹{{ formatCurrency(stats.outstandingAdvances) }})
            </p>
            <p v-if="stats.recoveredAdvances > 0" class="text-xs text-purple-500 mt-1">
              (Recovered: ₹{{ formatCurrency(stats.recoveredAdvances) }})
            </p>
          </div>
        </div>
      </UCard>
    </div>

    <!-- ── Quick Actions + Recent Activity ──────────────────────────── -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

      <!-- Quick Actions -->
      <UCard class="lg:col-span-1">
        <template #header>
          <h2 class="text-lg font-semibold text-gray-800 dark:text-white">Quick Actions</h2>
        </template>
        <div class="space-y-3">
          <button
            v-for="action in quickActions"
            :key="action.path"
            class="w-full flex items-center justify-between p-3 rounded-lg transition-colors"
            :class="action.bg"
            @click="navigateTo(action.path)"
          >
            <span class="font-medium" :class="action.text">{{ action.label }}</span>
            <UIcon name="i-lucide-chevron-right" class="h-5 w-5" :class="action.icon" />
          </button>
        </div>
      </UCard>

      <!-- Recent Activity -->
      <UCard class="lg:col-span-2">
        <template #header>
          <h2 class="text-lg font-semibold text-gray-800 dark:text-white">Recent Activity</h2>
        </template>

        <div v-if="loading" class="flex justify-center items-center h-48">
          <UIcon name="i-lucide-loader-circle" class="h-12 w-12 animate-spin text-indigo-500" />
        </div>

        <div v-else-if="recentActivity.length === 0" class="flex justify-center items-center h-48 text-gray-500">
          No recent activity found
        </div>

        <ul v-else class="divide-y divide-gray-200 dark:divide-gray-700">
          <li v-for="(activity, index) in recentActivity" :key="index" class="py-3 flex items-start">
            <div :class="`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${getActivityIconBg(activity.type)}`">
              <UIcon :name="getActivityIcon(activity.type)" class="h-5 w-5 text-white" />
            </div>
            <div class="ml-3 flex-1">
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ activity.description }}</p>
              <p class="text-xs text-gray-500">{{ formatDate(activity.date) }}</p>
            </div>
          </li>
        </ul>
      </UCard>
    </div>

  </div>
</template>

<script setup lang="ts">
import { usePageTitle } from '~/composables/ui/usePageTitle'
import useApiWithAuth from '~/composables/auth/useApiWithAuth'
import Chart from 'chart.js/auto'

// ─── Page setup ───────────────────────────────────────────────────────────────
definePageMeta({ requiresAuth: true })
usePageTitle('Employee & Wages Dashboard', 'Monitor employee statistics, wages, and advances')

const router = useRouter()
const api    = useApiWithAuth()

const isBrowser = typeof window !== 'undefined'

// ─── Chart instances (non-reactive — plain vars) ──────────────────────────────
let wagesChartInstance: Chart | null    = null
let advancesChartInstance: Chart | null = null

// ─── State ────────────────────────────────────────────────────────────────────
const loading        = ref(true)
const stats          = ref({ totalEmployees: 0, activeEmployees: 0, monthlyWages: 0, outstandingAdvances: 0, advanceCount: 0, recoveredAdvances: 0 })
const wagesData      = ref<any[]>([])
const advancesData   = ref<any>({})
const recentActivity = ref<any[]>([])

// ─── Static config ────────────────────────────────────────────────────────────
const quickActions = [
  { path: '/wages/master_roll', label: 'Manage Employees', bg: 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50',   text: 'text-blue-700',   icon: 'text-blue-500' },
  { path: '/wages',             label: 'Create Wages',     bg: 'bg-green-50 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-900/50', text: 'text-green-700',  icon: 'text-green-500' },
  { path: '/wages/edit',        label: 'Edit Wages',       bg: 'bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900/30',                         text: 'text-yellow-700', icon: 'text-yellow-500' },
  { path: '/wages/employee-advances', label: 'Manage Advances', bg: 'bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/30',                   text: 'text-purple-700', icon: 'text-purple-500' },
  { path: '/wages/report',      label: 'View Reports',     bg: 'bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30',                         text: 'text-indigo-700', icon: 'text-indigo-500' },
]

// ─── Computed ─────────────────────────────────────────────────────────────────
const currentMonth = computed(() =>
  new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
)

const showWagesChart = computed(() =>
  (wagesData.value?.length > 0 && !loading.value) || wagesChartInstance !== null
)

const showAdvancesChart = computed(() =>
  (!loading.value && advancesData.value?.labels?.length > 0 && advancesData.value?.data?.length > 0) || advancesChartInstance !== null
)

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatCurrency = (value: number) => new Intl.NumberFormat('en-IN').format(value)

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const getActivityIconBg = (type: string) => {
  switch (type) {
    case 'wage':     return 'bg-green-500'
    case 'advance':  return 'bg-yellow-500'
    case 'recovery': return 'bg-purple-500'
    default:         return 'bg-blue-500'
  }
}

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'wage':     return 'i-lucide-wallet'
    case 'advance':  return 'i-lucide-circle-dollar-sign'
    case 'recovery': return 'i-lucide-circle-check'
    default:         return 'i-lucide-user'
  }
}

const navigateTo = (path: string) => router.push(path)

// ─── API ──────────────────────────────────────────────────────────────────────
const fetchDashboardData = async () => {
  loading.value = true
  try {
    const response = await api.get('/api/wages/dashboard')
    if (response.success) {
      stats.value          = response.stats
      wagesData.value      = response.wagesData
      advancesData.value   = response.advancesData
      recentActivity.value = response.recentActivity
    }
  } catch (e) {
    console.error('Error fetching dashboard data:', e)
  } finally {
    loading.value = false
  }
}

// ─── Chart rendering ──────────────────────────────────────────────────────────
const isCanvasReady = (canvas: HTMLCanvasElement | null) => {
  if (!canvas) return false
  try { return !!canvas.getContext('2d') } catch { return false }
}

const renderWagesChart = (): Promise<boolean> =>
  new Promise(resolve => {
    if (!isBrowser) return resolve(false)
    requestAnimationFrame(() => {
      try {
        const container = document.getElementById('wagesChartContainer')
        if (!container || !wagesData.value?.length) return resolve(false)
        container.innerHTML = ''
        const canvas = document.createElement('canvas')
        canvas.id = 'wagesChartCanvas'
        Object.assign(canvas.style, { width: '100%', height: '100%', display: 'block', position: 'absolute', top: '0', left: '0' })
        container.appendChild(canvas)
        if (!isCanvasReady(canvas)) return resolve(false)
        if (wagesChartInstance) { wagesChartInstance.destroy(); wagesChartInstance = null }
        wagesChartInstance = new Chart(canvas.getContext('2d')!, {
          type: 'line',
          data: {
            labels: wagesData.value.map(i => i.month),
            datasets: [{ label: 'Monthly Wages', data: wagesData.value.map(i => i.total), backgroundColor: 'rgba(34,197,94,0.2)', borderColor: 'rgba(34,197,94,1)', borderWidth: 2, tension: 0.4, fill: true }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => 'Total: ₹' + ctx.raw!.toLocaleString('en-IN') } } },
            scales: { y: { beginAtZero: true, ticks: { callback: (v: any) => '₹' + v.toLocaleString('en-IN') } } },
            animation: { duration: 2000, easing: 'easeOutQuart' }
          }
        })
        resolve(true)
      } catch (e) { console.error('Error creating wages chart:', e); resolve(false) }
    })
  })

const renderAdvancesChart = (): Promise<boolean> =>
  new Promise(resolve => {
    if (!isBrowser) return resolve(false)
    requestAnimationFrame(() => {
      try {
        const container = document.getElementById('advancesChartContainer')
        const ad = advancesData.value
        if (!container || !ad?.labels?.length || !ad?.data?.length) return resolve(false)
        container.innerHTML = ''
        const canvas = document.createElement('canvas')
        canvas.id = 'advancesChartCanvas'
        Object.assign(canvas.style, { width: '100%', height: '100%', display: 'block', position: 'absolute', top: '0', left: '0' })
        container.appendChild(canvas)
        if (!isCanvasReady(canvas)) return resolve(false)

        const colorMap: Record<string, string[]> = {
          pending: ['rgba(234,179,8,0.8)', 'rgba(234,179,8,1)'],
          approved: ['rgba(59,130,246,0.8)', 'rgba(59,130,246,1)'],
          paid: ['rgba(236,72,153,0.8)', 'rgba(236,72,153,1)'],
          partially_recovered: ['rgba(168,85,247,0.8)', 'rgba(168,85,247,1)'],
          fully_recovered: ['rgba(34,197,94,0.8)', 'rgba(34,197,94,1)'],
          pending_remaining: ['rgba(255,87,51,0.8)', 'rgba(255,87,51,1)'],
          approved_remaining: ['rgba(0,204,153,0.8)', 'rgba(0,204,153,1)'],
          paid_remaining: ['rgba(102,51,153,0.8)', 'rgba(102,51,153,1)'],
          partially_recovered_remaining: ['rgba(255,159,64,0.8)', 'rgba(255,159,64,1)'],
          fully_recovered_remaining: ['rgba(54,162,235,0.8)', 'rgba(54,162,235,1)'],
        }

        const combinedData: number[] = [], combinedColors: string[] = [], combinedBorders: string[] = [], combinedLabels: string[] = []
        ad.labels.forEach((label: string, i: number) => {
          const rec = ad.data[i] || 0, rem = ad.remainingData?.[i] || 0
          if (rec > 0) {
            combinedData.push(rec); combinedLabels.push(`${label} ✓ (Recovered)`)
            combinedColors.push(colorMap[label]?.[0] ?? 'rgba(107,114,128,0.8)'); combinedBorders.push(colorMap[label]?.[1] ?? 'rgba(107,114,128,1)')
          }
          if (rem > 0) {
            combinedData.push(rem); combinedLabels.push(`${label} ⚠ (Outstanding)`)
            const rk = `${label}_remaining`
            combinedColors.push(colorMap[rk]?.[0] ?? 'rgba(107,114,128,0.4)'); combinedBorders.push(colorMap[rk]?.[1] ?? 'rgba(107,114,128,1)')
          }
        })

        if (advancesChartInstance) { advancesChartInstance.destroy(); advancesChartInstance = null }
        advancesChartInstance = new Chart(canvas.getContext('2d')!, {
          type: 'doughnut',
          data: { labels: combinedLabels, datasets: [{ data: combinedData, backgroundColor: combinedColors, borderColor: combinedBorders, borderWidth: 1 }] },
          options: {
            responsive: true, maintainAspectRatio: false, cutout: '40%',
            plugins: {
              legend: { position: 'right', align: 'start', labels: { boxWidth: 12, padding: 15, font: { size: 9 } } },
              tooltip: { callbacks: { label: ctx => { const v = ctx.raw as number; const t = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0); return `${ctx.label}: ₹${v.toLocaleString('en-IN')} (${t > 0 ? Math.round(v / t * 100) : 0}%)` } } }
            },
            animation: { duration: 2000, easing: 'easeOutQuart' }
          }
        })
        resolve(true)
      } catch (e) { console.error('Error creating advances chart:', e); resolve(false) }
    })
  })

const renderCharts = async (): Promise<boolean> => {
  if (!isBrowser) return false
  await new Promise(r => setTimeout(r, 100))
  if (!document.getElementById('wagesChartContainer') || !document.getElementById('advancesChartContainer')) return false
  let wagesOk = false, advancesOk = false
  for (let i = 0; i < 3 && (!wagesOk || !advancesOk); i++) {
    if (!wagesOk && wagesData.value?.length)                   wagesOk    = await renderWagesChart()
    if (!advancesOk && advancesData.value?.labels?.length)     advancesOk = await renderAdvancesChart()
    if (wagesOk && advancesOk) break
    if (i < 2) await new Promise(r => setTimeout(r, 200))
  }
  return wagesOk || advancesOk
}

const refreshCharts = async () => {
  if (!isBrowser) return
  wagesChartInstance?.destroy();    wagesChartInstance    = null
  advancesChartInstance?.destroy(); advancesChartInstance = null
  await new Promise(r => setTimeout(r, 200))
  await renderCharts()
}

const handleResize = async () => {
  wagesChartInstance?.destroy();    wagesChartInstance    = null
  advancesChartInstance?.destroy(); advancesChartInstance = null
  await new Promise(r => setTimeout(r, 200))
  await renderCharts()
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  if (isBrowser) window.addEventListener('resize', handleResize)
  await fetchDashboardData()
  if (isBrowser) {
    setTimeout(async () => {
      wagesChartInstance?.destroy();    wagesChartInstance    = null
      advancesChartInstance?.destroy(); advancesChartInstance = null
      const ok = await renderCharts()
      if (!ok) setTimeout(() => renderCharts(), 2000)
    }, 1000)
  }
})

onUnmounted(() => {
  if (isBrowser) window.removeEventListener('resize', handleResize)
  wagesChartInstance?.destroy()
  advancesChartInstance?.destroy()
})
</script>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.5s ease-in-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
#wagesChartContainer, #advancesChartContainer { position: absolute; height: 100%; width: 100%; z-index: 30; }
</style>