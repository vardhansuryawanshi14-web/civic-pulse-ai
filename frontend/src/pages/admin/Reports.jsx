import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, FileText, MapPin } from 'lucide-react'

import api from '@/api/axios'
import { BentoCard, BentoSection } from '@/components/MagicBento'
import { CountUp } from '@/components/motion'
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button'
import { errorMessage } from '@/utils/helpers'

/** Bar colour per row, so status and urgency read at a glance. */
const TONE = {
  Open: 'bg-error',
  'In Progress': 'bg-accent-sky',
  Resolved: 'bg-tertiary',
  High: 'bg-error',
  Medium: 'bg-warning',
  Low: 'bg-tertiary',
}

function Breakdown({ title, mapping, index }) {
  // biggest first — a report is for spotting where the load is
  const entries = Object.entries(mapping || {}).sort((a, b) => b[1] - a[1])
  const total = entries.reduce((sum, [, count]) => sum + count, 0)
  const max = entries.length ? entries[0][1] : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: index * 0.05 }}
    >
      <BentoCard className="h-full" magnetism={false}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-label text-xs font-medium tracking-[0.14em] text-on-surface-variant uppercase">
            {title}
          </h2>
          <span className="font-mono-data text-xs text-on-surface-variant">{total} total</span>
        </div>

        {entries.length === 0 ? (
          <p className="mt-4 text-sm text-on-surface-variant">No data yet</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {entries.map(([key, count]) => (
              <li key={key}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-on-surface">{key}</span>
                  <span className="font-mono-data text-on-surface-variant">
                    {count}
                    <span className="ml-2 text-xs opacity-70">
                      {total ? Math.round((count / total) * 100) : 0}%
                    </span>
                  </span>
                </div>
                {/* bars scale against the largest row, so small differences stay readable */}
                <span className="track mt-1.5 block h-1.5">
                  <span
                    className={`track-fill ${TONE[key] || 'bg-accent-sky'}`}
                    style={{ width: `${max ? (count / max) * 100 : 0}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </BentoCard>
    </motion.div>
  )
}

function Stat({ label, value, suffix, Icon, tone = 'text-on-surface', index }) {
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
        <p className="mt-2 flex items-baseline gap-1">
          <CountUp value={value} className={`text-4xl font-bold ${tone}`} />
          {suffix && <span className={`text-xl font-bold ${tone}`}>{suffix}</span>}
        </p>
      </BentoCard>
    </motion.div>
  )
}

export default function Reports() {
  const [analytics, setAnalytics] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api
      .get('/api/admin/analytics')
      .then((res) => setAnalytics(res.data.data.analytics))
      .catch((err) => setError(errorMessage(err, 'Could not load report data')))
  }, [])

  // fetched with axios rather than a plain link so the session cookie is sent
  // the same way in dev and in production
  const download = async () => {
    setError('')
    setBusy(true)
    try {
      const res = await api.get('/api/admin/report', { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const link = document.createElement('a')
      link.href = url
      link.download = 'civic-report.pdf'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(errorMessage(err, 'Could not generate the report'))
    } finally {
      setBusy(false)
    }
  }

  const status = analytics?.by_status || {}
  const urgency = analytics?.by_urgency || {}
  const total = Object.values(status).reduce((sum, n) => sum + n, 0)
  const resolvedRate = total ? Math.round(((status.Resolved || 0) / total) * 100) : 0
  const districts = Object.keys(analytics?.by_ward || {}).length

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-on-surface">Reports</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            A snapshot of the whole system. The PDF adds the 50 highest priority complaints.
          </p>
        </div>
        <InteractiveHoverButton
          type="button"
          disabled={busy}
          onClick={download}
          text={busy ? 'Generating…' : 'Download PDF report'}
          className="w-full py-2.5 disabled:opacity-70 sm:w-56"
        />
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-error">
          {error}
        </p>
      )}

      {analytics && (
        <>
          <BentoSection className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Total complaints" value={total} Icon={FileText} index={0} />
            <Stat
              label="Resolved"
              value={resolvedRate}
              suffix="%"
              Icon={CheckCircle2}
              tone="text-tertiary"
              index={1}
            />
            <Stat
              label="High urgency"
              value={urgency.High || 0}
              Icon={AlertTriangle}
              tone="text-error"
              index={2}
            />
            <Stat label="Districts covered" value={districts} Icon={MapPin} index={3} />
          </BentoSection>

          <BentoSection className="mt-4 grid gap-4 lg:grid-cols-2">
            <Breakdown title="By issue type" mapping={analytics.by_issue_type} index={0} />
            <Breakdown title="By status" mapping={analytics.by_status} index={1} />
            <Breakdown title="By district" mapping={analytics.by_ward} index={2} />
            <Breakdown title="By urgency" mapping={analytics.by_urgency} index={3} />
          </BentoSection>
        </>
      )}
    </div>
  )
}
