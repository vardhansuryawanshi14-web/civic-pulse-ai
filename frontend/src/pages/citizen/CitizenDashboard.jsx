import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, CalendarDays, CheckCircle2, ClipboardList, FileText, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'

import api, { photoUrl } from '@/api/axios'
import { BentoCard, BentoSection } from '@/components/MagicBento'
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button'
import { CountUp } from '@/components/motion'
import { useAuth } from '@/context/AuthContext'
import { errorMessage, formatDate } from '@/utils/helpers'

const STATUS_CHIP = {
  Open: 'bg-surface-high text-on-surface-variant',
  'In Progress': 'bg-secondary-container/40 text-on-secondary-container',
  Resolved: 'bg-tertiary-container/25 text-tertiary',
}

function StatCard({ label, value, Icon, children, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: index * 0.05 }}
    >
      <BentoCard className="h-full">
      <div className="flex items-start justify-between gap-3">
        <p className="font-label text-xs font-medium tracking-[0.05em] text-on-surface-variant uppercase">
          {label}
        </p>
        <span className="flex size-9 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
          <Icon className="size-4" />
        </span>
      </div>
      <CountUp value={value} className="mt-2 block text-2xl font-semibold text-on-surface" />
      <div className="mt-4 h-6">{children}</div>
      </BentoCard>
    </motion.div>
  )
}

export default function CitizenDashboard() {
  const { user } = useAuth()
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get('/api/citizen/complaints')
      .then((res) => setComplaints(res.data.data.complaints))
      .catch((err) => setError(errorMessage(err, 'Could not load your complaints')))
      .finally(() => setLoading(false))
  }, [])

  const total = complaints.length
  const inProgress = complaints.filter((c) => c.status === 'In Progress').length
  const resolved = complaints.filter((c) => c.status === 'Resolved').length
  const progressPct = total ? Math.round((inProgress / total) * 100) : 0

  return (
    <div className="mx-auto max-w-[1280px]">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/14 bg-gradient-to-r from-[rgba(38,38,42,0.8)] to-[rgba(26,26,29,0.75)] p-6 shadow-[0_4px_18px_rgba(0,0,0,0.45)]"
      >
        <div>
          <p className="font-label text-xs font-medium tracking-[0.1em] text-primary uppercase">
            Civic Dashboard
          </p>
          <h1 className="mt-1.5 text-xl font-bold text-on-surface">
            Welcome back, {user?.name?.split(' ')[0] || 'there'}
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            {total === 0
              ? 'You have not reported any issues yet.'
              : `You have reported ${total} issue${total === 1 ? '' : 's'}${user?.ward ? ` in ${user.ward}` : ''}.`}
          </p>
        </div>
        <InteractiveHoverButton
          as={Link}
          to="/citizen/submit"
          text="Submit New Complaint"
          className="w-full sm:w-56 py-2.5"
        />
      </motion.section>

      <BentoSection className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total Reports" value={total} Icon={FileText} index={0}>
          <p className="text-xs text-on-surface-variant">Across all districts you reported in</p>
        </StatCard>

        <StatCard label="In Progress" value={inProgress} Icon={ClipboardList} index={1}>
          <div className="flex items-center gap-3">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-highest">
              <span
                className="block h-full rounded-full bg-tertiary transition-[width] duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </span>
            <span className="font-label text-xs text-on-surface-variant">{progressPct}%</span>
          </div>
        </StatCard>

        <StatCard label="Resolved" value={resolved} Icon={CheckCircle2} index={2}>
          <p className="text-xs text-on-surface-variant">
            {total ? `${Math.round((resolved / total) * 100)}% of your reports closed` : 'Nothing closed yet'}
          </p>
        </StatCard>
      </BentoSection>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-on-surface">Your Recent Reports</h2>
        <Link
          to="/citizen/complaints"
          className="flex items-center gap-1.5 text-sm text-primary transition-colors hover:text-primary-container"
        >
          View All
          <ArrowRight className="size-4" />
        </Link>
      </div>

      {loading && <p className="mt-4 text-sm text-on-surface-variant">Loading…</p>}
      {error && (
        <p role="alert" className="mt-4 text-sm text-error">
          {error}
        </p>
      )}
      {!loading && !error && total === 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-on-surface">You haven&apos;t reported any issues yet</p>
          <InteractiveHoverButton
            as={Link}
            to="/citizen/submit"
            text="Submit your first complaint"
            className="mt-4 inline-block w-full sm:w-64 py-2.5"
          />
        </div>
      )}

      <BentoSection className="mt-4 grid gap-4 md:grid-cols-2">
        {complaints.slice(0, 4).map((c, i) => (
          <motion.article
            key={c.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: Math.min(i * 0.05, 0.3) }}
          >
            <BentoCard className="magic-bento-card--flush h-full" particleCount={6}>
            {c.has_photo ? (
              <img
                src={photoUrl(c.id)}
                alt=""
                loading="lazy"
                className="w-[135px] shrink-0 object-cover"
              />
            ) : (
              <span className="flex w-[135px] shrink-0 items-center justify-center bg-surface-container text-on-surface-variant">
                <FileText className="size-7" />
              </span>
            )}

            <div className="min-w-0 flex-1 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-surface-container px-2 py-1 text-xs text-on-surface-variant">
                  {c.issue_type}
                </span>
                <span className={`rounded-md px-2 py-1 text-xs ${STATUS_CHIP[c.status]}`}>
                  {c.status}
                </span>
              </div>
              {/* the schema has no title field, so the first sentence acts as one
                  and only the remainder becomes the body */}
              {(() => {
                const [, head, rest] = c.description.match(/^(.*?[.!?])\s*(.*)$/s) || [
                  null,
                  c.description,
                  '',
                ]
                return (
                  <>
                    <h3 className="mt-2 line-clamp-1 font-semibold text-on-surface">{head}</h3>
                    {rest && (
                      <p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">{rest}</p>
                    )}
                  </>
                )
              })()}
              <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-on-surface-variant">
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {c.ward}
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <CalendarDays className="size-3.5" />
                  {formatDate(c.created_at)}
                </span>
              </p>
            </div>
            </BentoCard>
          </motion.article>
        ))}
      </BentoSection>
    </div>
  )
}
