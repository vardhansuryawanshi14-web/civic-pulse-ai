import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  MapPin,
  Receipt,
  TrendingUp,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

import api, { photoUrl } from '@/api/axios'
import { BentoCard, BentoSection } from '@/components/MagicBento'
import { CountUp } from '@/components/motion'
import { priorityBand } from '@/components/PriorityBadge'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { complaintCode, errorMessage, relativeTime } from '@/utils/helpers'

const STATUSES = ['Open', 'In Progress', 'Resolved']
const URGENCIES = ['High', 'Medium', 'Low']

/* The reference invents a 0-10 score and categories like PARKS & REC. Real
   scores run 3-30 and the five issue types are fixed by the backend, so the
   bands below are the product's own Critical / Moderate / Low. */
const BAND_STYLE = {
  Critical: { text: 'text-error', bar: 'bg-error', label: 'HIGH PRIORITY' },
  Moderate: { text: 'text-[#F59E0B]', bar: 'bg-[#F59E0B]', label: 'MEDIUM PRIORITY' },
  Low: { text: 'text-tertiary', bar: 'bg-tertiary', label: 'LOW PRIORITY' },
}

const STATUS_PILL = {
  Open: 'bg-surface-high text-on-surface-variant',
  'In Progress': 'bg-secondary-container text-on-secondary-container',
  Resolved: 'bg-tertiary-container/30 text-tertiary',
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

/** Filter dropdown. ANY is a sentinel because the filter state uses '' for
 *  "no filter", which Base UI reads as "nothing selected". */
const ANY = '__any__'

function FilterSelect({ label, placeholder, value, onChange, options }) {
  const items = [{ label: placeholder, value: ANY }, ...options.map((o) => ({ label: o, value: o }))]
  return (
    <Select
      items={items}
      value={value || ANY}
      onValueChange={(next) => onChange(next === ANY ? '' : next)}
    >
      <SelectTrigger aria-label={label} className="w-full sm:w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>{label}</SelectLabel>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export default function OfficerDashboard() {
  // one component, two routes: /officer/dashboard and /officer/complaints
  const queueMode = useLocation().pathname.startsWith('/officer/complaints')
  const [complaints, setComplaints] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ issue_type: '', urgency_level: '', status: '' })

  useEffect(() => {
    Promise.all([api.get('/api/officer/complaints'), api.get('/api/officer/profile')])
      .then(([list, prof]) => {
        setComplaints(list.data.data.complaints)
        setProfile(prof.data.data.profile)
      })
      .catch((err) => setError(errorMessage(err, 'Could not load your district queue')))
      .finally(() => setLoading(false))
  }, [])

  const shown = useMemo(
    () =>
      complaints.filter(
        (c) =>
          (!filters.issue_type || c.issue_type === filters.issue_type) &&
          (!filters.urgency_level || c.urgency_level === filters.urgency_level) &&
          (!filters.status || c.status === filters.status),
      ),
    [complaints, filters],
  )

  // the dashboard previews the top of the queue; the queue page lists everything
  const visible = queueMode ? shown : shown.slice(0, 5)

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const resolved = complaints.filter((c) => c.status === 'Resolved')
  const stats = {
    total: complaints.length,
    high: complaints.filter((c) => c.priority_score >= 20).length,
    pending: complaints.filter((c) => c.status !== 'Resolved').length,
    resolved: resolved.length,
    // "this week" is measured off the last status change, the closest thing to a
    // resolution timestamp the schema has
    resolvedWeek: resolved.filter((c) => new Date(c.updated_at || c.created_at) >= weekAgo).length,
  }
  const resolutionRate = stats.total ? Math.round((stats.resolved / stats.total) * 100) : 0

  const issueTypes = [...new Set(complaints.map((c) => c.issue_type).filter(Boolean))].sort()

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-[-0.02em] text-on-surface sm:text-5xl">
            {queueMode ? 'My District Complaints' : 'Officer Dashboard'}
          </h1>
          <p className="mt-2 text-lg text-on-surface-variant">
            {queueMode
              ? `Every complaint in ${profile?.ward || 'your district'}, worst first.`
              : profile
                ? `${profile.ward} · review and manage civic issues.`
                : 'Review and manage civic issues.'}
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-3 sm:w-auto">
          <FilterSelect
            label="Category"
            placeholder="All Categories"
            value={filters.issue_type}
            onChange={(v) => setFilters({ ...filters, issue_type: v })}
            options={issueTypes}
          />
          <FilterSelect
            label="Urgency"
            placeholder="Any Urgency"
            value={filters.urgency_level}
            onChange={(v) => setFilters({ ...filters, urgency_level: v })}
            options={URGENCIES}
          />
          <FilterSelect
            label="Status"
            placeholder="Any Status"
            value={filters.status}
            onChange={(v) => setFilters({ ...filters, status: v })}
            options={STATUSES}
          />
        </div>
      </div>

      {/* stats belong to the dashboard; the queue page is just the list */}
      {!queueMode && (
      <BentoSection className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Complaints" value={stats.total} Icon={Receipt} index={0}>
          <span className="flex items-center gap-1.5 text-tertiary">
            <TrendingUp className="size-3.5" />
            {profile ? `In ${profile.ward}` : 'Across your ward'}
          </span>
        </StatCard>

        <StatCard label="High Priority" value={stats.high} Icon={AlertTriangle} tone="text-error" index={1}>
          <span className="flex items-center gap-1.5 text-error">
            {stats.high > 0 && <span className="font-bold">!</span>}
            {stats.high ? 'Requires immediate action' : 'Nothing critical right now'}
          </span>
        </StatCard>

        <StatCard label="Pending Response" value={stats.pending} Icon={ClipboardList} index={2}>
          <span className="block h-1.5 overflow-hidden rounded-full bg-surface-highest">
            <span
              className="block h-full rounded-full bg-primary transition-[width] duration-700"
              style={{ width: `${stats.total ? (stats.pending / stats.total) * 100 : 0}%` }}
            />
          </span>
        </StatCard>

        <StatCard label="Resolved This Week" value={stats.resolvedWeek} Icon={CheckCircle2} tone="text-tertiary" index={3}>
          <span className="flex items-center gap-1.5 text-tertiary">
            <CheckCircle2 className="size-3.5" />
            {resolutionRate}% resolution rate
          </span>
        </StatCard>
      </BentoSection>
      )}

      <div className="mt-10 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-semibold tracking-[-0.01em] text-on-surface sm:text-3xl">
          {queueMode ? `${shown.length} in the queue` : 'Recent Complaints'}
        </h2>
        {queueMode ? (
          <p className="text-sm text-on-surface-variant">Sorted by priority score</p>
        ) : (
          <Link
            to="/officer/complaints"
            className="flex items-center gap-1.5 font-label text-sm text-accent-sky transition-colors hover:text-on-surface"
          >
            View all complaints
            <ChevronRight className="size-4" />
          </Link>
        )}
      </div>

      {loading && <p className="mt-6 text-sm text-on-surface-variant">Loading…</p>}
      {error && (
        <p role="alert" className="mt-6 text-sm text-error">
          {error}
        </p>
      )}
      {!loading && !error && shown.length === 0 && (
        <p className="mt-6 text-sm text-on-surface-variant">
          {complaints.length === 0
            ? 'No complaints in your ward yet.'
            : 'No complaints match these filters.'}
        </p>
      )}

      <BentoSection className="mt-5 flex flex-col gap-4">
        {visible.map((c, i) => {
          const band = BAND_STYLE[priorityBand(c.priority_score).label]
          return (
            <motion.article
              key={c.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: Math.min(i * 0.04, 0.3) }}
            >
              <BentoCard className="relative flex flex-wrap items-center gap-5 pl-6">
              <span className={`absolute inset-y-0 left-0 w-1.5 ${band.bar}`} />

              {c.has_photo ? (
                <img
                  src={photoUrl(c.id)}
                  alt=""
                  loading="lazy"
                  className="size-[90px] shrink-0 rounded-lg border border-border object-cover"
                />
              ) : (
                <span className="flex size-[90px] shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-on-surface-variant">
                  <ClipboardList className="size-8" />
                </span>
              )}

              <div className="min-w-[16rem] flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span className={`font-label font-medium tracking-[0.05em] uppercase ${band.text}`}>
                    {c.issue_type}
                  </span>
                  <span className="font-label text-on-surface">#{complaintCode(c.id)}</span>
                  <span className="flex items-center gap-1 text-on-surface-variant">
                    <Clock className="size-3.5" />
                    {relativeTime(c.created_at)}
                  </span>
                </p>
                <Link
                  to={`/officer/complaints/${c.id}`}
                  className="mt-1 block text-xl font-bold text-on-surface hover:underline"
                >
                  {c.description}
                </Link>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-on-surface-variant">
                  <MapPin className="size-4" />
                  {c.ward}
                  {c.latitude != null && (
                    <span className="font-label text-xs">
                      · {Number(c.latitude).toFixed(4)}, {Number(c.longitude).toFixed(4)}
                    </span>
                  )}
                </p>
              </div>

              <div className="flex flex-col items-end gap-3">
                <div className="text-right">
                  <p className="font-label text-xs font-medium tracking-[0.05em] text-on-surface-variant uppercase">
                    Priority score
                  </p>
                  <p className={`text-4xl font-bold ${band.text}`}>{c.priority_score}</p>
                  <p className={`font-label text-xs tracking-[0.05em] ${band.text}`}>{band.label}</p>
                </div>
                {/* read-only here — status is changed on the case page, one place only */}
                <span
                  className={`rounded-full px-4 py-2 font-label text-sm font-medium ${STATUS_PILL[c.status]}`}
                >
                  {c.status}
                </span>
                <Link
                  to={`/officer/complaints/${c.id}`}
                  className="flex items-center gap-1.5 font-label text-sm text-accent-sky transition-colors hover:text-on-surface"
                >
                  Open case
                  <ChevronRight className="size-4" />
                </Link>
              </div>
              </BentoCard>
            </motion.article>
          )
        })}
      </BentoSection>
    </div>
  )
}
