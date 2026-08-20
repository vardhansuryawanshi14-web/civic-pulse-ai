import { useEffect, useState } from 'react'
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import { motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, MessageSquare, RefreshCw, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'

import api from '@/api/axios'
import { BentoCard, BentoSection } from '@/components/MagicBento'
import { CountUp } from '@/components/motion'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { buttonVariants } from '@/components/ui/button'
import { errorMessage } from '@/utils/helpers'

ChartJS.register(
  ArcElement, BarElement, CategoryScale, Filler, Legend, LineElement, LinearScale, PointElement, Tooltip,
)

const SERIES = ['#adc6ff', '#4edea3', '#c0c1ff', '#ffb4ab', '#F59E0B', '#8c909f']
const ACCENT = '#adc6ff'
const GRID = 'rgba(140,144,159,0.15)'
const TICK = 'rgba(194,198,214,0.8)'

const RANGES = [
  { value: '7', label: 'Last 7 Days' },
  { value: '30', label: 'Last 30 Days' },
  { value: 'all', label: 'All Time' },
]

function Panel({ title, action, children, className = '', empty }) {
  return (
    <BentoCard className={className} magnetism={false}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-on-surface">{title}</h2>
        {action}
      </div>
      {empty ? (
        <p className="mt-4 text-sm text-on-surface-variant">No data for this range</p>
      ) : (
        <div className="mt-5 h-64">{children}</div>
      )}
    </BentoCard>
  )
}

function StatCard({ label, value, Icon, tone = 'text-on-surface', index, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: index * 0.05 }}
    >
      <BentoCard className="h-full">
      <div className="flex items-start justify-between gap-3">
        <p className="font-label text-[11px] font-medium tracking-[0.05em] text-on-surface-variant uppercase">
          {label}
        </p>
        <Icon className={`size-5 ${tone} opacity-80`} />
      </div>
      <CountUp value={value} className={`mt-2 block text-4xl font-bold ${tone}`} />
      <div className="mt-3 h-5 text-xs">{children}</div>
      </BentoCard>
    </motion.div>
  )
}

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState(null)
  const [complaints, setComplaints] = useState([])
  const [range, setRange] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get('/api/admin/analytics', { params: { range } }),
      api.get('/api/admin/complaints'),
    ])
      .then(([a, c]) => {
        setAnalytics(a.data.data.analytics)
        setComplaints(c.data.data.complaints)
      })
      .catch((err) => setError(errorMessage(err, 'Could not load analytics')))
      .finally(() => setLoading(false))
  }, [range])

  if (loading && !analytics) return <p className="text-sm text-on-surface-variant">Loading…</p>
  if (!analytics)
    return (
      <p role="alert" className="text-sm text-error">
        {error || 'No analytics available'}
      </p>
    )

  const total = analytics.total || 0
  const status = analytics.by_status || {}
  const share = (n) => (total ? Math.round((n / total) * 100) : 0)
  const series = analytics.time_series || []
  const categoryEntries = Object.entries(analytics.by_issue_type || {}).sort((a, b) => b[1] - a[1])
  const wardEntries = Object.entries(analytics.by_ward || {}).sort((a, b) => b[1] - a[1]).slice(0, 8)

  // "avg days active" over complaints that are still open or in progress
  const activeAges = complaints
    .filter((c) => c.status !== 'Resolved')
    .map((c) => (Date.now() - new Date(c.created_at).getTime()) / 86400000)
  const avgActive = activeAges.length
    ? Math.round(activeAges.reduce((a, b) => a + b, 0) / activeAges.length)
    : 0

  const lineData = {
    labels: series.map((p) => p.date.slice(5)),
    datasets: [
      {
        data: series.map((p) => p.count),
        borderColor: ACCENT,
        backgroundColor: 'rgba(173,198,255,0.15)',
        pointRadius: series.length > 40 ? 0 : 3,
        pointBackgroundColor: ACCENT,
        borderWidth: 2,
        tension: 0.4,
        fill: true,
      },
    ],
  }

  const donutData = {
    labels: categoryEntries.map(([k]) => k),
    datasets: [
      {
        data: categoryEntries.map(([, v]) => v),
        backgroundColor: categoryEntries.map((_, i) => SERIES[i % SERIES.length]),
        borderWidth: 0,
        cutout: '72%',
      },
    ],
  }

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-5xl font-bold tracking-[-0.02em] text-on-surface">Admin Analytics</h1>
          <p className="mt-2 text-lg text-on-surface-variant">
            Comprehensive overview of municipal data and system performance.
          </p>
        </div>
        <Link to="/admin/reports" className={buttonVariants({ variant: 'outline' })}>
          Download report
        </Link>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-error">
          {error}
        </p>
      )}

      <BentoSection className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Complaints" value={total} Icon={MessageSquare} index={0}>
          <span className="flex items-center gap-1.5 text-tertiary">
            <TrendingUp className="size-3.5" />
            {analytics.citizens} citizens reporting
          </span>
        </StatCard>
        <StatCard
          label="Resolved"
          value={status.Resolved || 0}
          Icon={CheckCircle2}
          tone="text-tertiary"
          index={1}
        >
          <span className="text-on-surface-variant">{share(status.Resolved || 0)}% resolution rate</span>
        </StatCard>
        <StatCard label="In Progress" value={status['In Progress'] || 0} Icon={RefreshCw} index={2}>
          <span className="text-on-surface-variant">Avg. {avgActive} days active</span>
        </StatCard>
        <StatCard label="Open" value={status.Open || 0} Icon={AlertCircle} tone="text-error" index={3}>
          <span className="text-on-surface-variant">{share(status.Open || 0)}% of all complaints</span>
        </StatCard>
      </BentoSection>

      <BentoSection className="mt-6 grid gap-4 lg:grid-cols-5">
        <Panel
          title="Complaint Volume Over Time"
          className="lg:col-span-3"
          empty={series.length === 0}
          action={
            <Select items={RANGES} value={range} onValueChange={setRange}>
              <SelectTrigger aria-label="Date range" className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Range</SelectLabel>
                  {RANGES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          }
        >
          <Line
            data={lineData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                x: { ticks: { color: TICK, maxTicksLimit: 8 }, grid: { display: false } },
                y: { beginAtZero: true, ticks: { color: TICK, precision: 0 }, grid: { color: GRID } },
              },
            }}
          />
        </Panel>

        <Panel title="Issue Categories" className="lg:col-span-2" empty={categoryEntries.length === 0}>
          <div className="flex h-full items-center gap-5">
            <div className="relative size-40 shrink-0">
              <Doughnut
                data={donutData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                }}
              />
              <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-on-surface">{categoryEntries.length}</span>
                <span className="font-label text-[9px] tracking-[0.1em] text-on-surface-variant uppercase">
                  Categories
                </span>
              </span>
            </div>
            <ul className="flex min-w-0 flex-1 flex-col gap-2.5">
              {categoryEntries.map(([name, count], i) => (
                <li key={name} className="flex items-center gap-2 text-sm">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: SERIES[i % SERIES.length] }}
                  />
                  <span className="truncate text-on-surface">{name}</span>
                  <span className="ml-auto font-label text-on-surface-variant">{share(count)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </BentoSection>

      <BentoSection className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Top Districts by Complaint Volume" empty={wardEntries.length === 0}>
          <Bar
            data={{
              labels: wardEntries.map(([k]) => k),
              datasets: [
                {
                  data: wardEntries.map(([, v]) => v),
                  backgroundColor: wardEntries.map((_, i) => SERIES[i % SERIES.length]),
                  borderWidth: 0,
                },
              ],
            }}
            options={{
              indexAxis: 'y',
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                x: { beginAtZero: true, ticks: { color: TICK, precision: 0 }, grid: { color: GRID } },
                y: { ticks: { color: TICK }, grid: { display: false } },
              },
            }}
          />
        </Panel>

        <BentoCard magnetism={false}>
          <h2 className="text-xl font-semibold text-on-surface">Officer Performance</h2>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            Average time is to the last status change, across all time
          </p>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[22rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-on-surface-variant">
                  <th className="pb-2 font-medium">Officer</th>
                  <th className="pb-2 font-medium">District</th>
                  <th className="pb-2 font-medium">Resolved</th>
                  <th className="pb-2 font-medium">Avg time</th>
                </tr>
              </thead>
              <tbody>
                {(analytics.officer_performance || []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-3 text-on-surface-variant">
                      No officers yet.{' '}
                      <Link to="/admin/officers" className="text-primary hover:underline">
                        Add one
                      </Link>
                    </td>
                  </tr>
                )}
                {(analytics.officer_performance || []).map((o) => (
                  <tr key={o.id} className="border-b border-border last:border-0">
                    <td className="py-2 text-on-surface">
                      {o.name}
                      {!o.is_active && (
                        <span className="ml-2 text-xs text-on-surface-variant">(inactive)</span>
                      )}
                    </td>
                    <td className="py-2 text-on-surface-variant">{o.ward || '—'}</td>
                    <td className="py-2 font-label text-on-surface">
                      {o.resolved}
                      <span className="text-on-surface-variant"> / {o.handled}</span>
                    </td>
                    <td className="py-2 font-label text-on-surface-variant">
                      {o.avg_hours == null ? '—' : `${o.avg_hours}h`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </BentoCard>
      </BentoSection>
    </div>
  )
}
