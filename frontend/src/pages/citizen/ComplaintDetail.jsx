import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Check, Flag, ImageOff, Link2, MapPin, Loader2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

import api, { photoUrl } from '@/api/axios'
import { BentoCard, BentoSection } from '@/components/MagicBento'
import { priorityBand } from '@/components/PriorityBadge'
import { complaintCode, errorMessage, formatDate, relativeTime } from '@/utils/helpers'

const STEPS = ['Open', 'In Progress', 'Resolved']
const STEP_ICON = { Open: Check, 'In Progress': Loader2, Resolved: Flag }

const BAND_TEXT = {
  Critical: 'text-error',
  Moderate: 'text-[#F59E0B]',
  Low: 'text-tertiary',
}
const BAND_RING = {
  Critical: 'stroke-error',
  Moderate: 'stroke-[#F59E0B]',
  Low: 'stroke-tertiary',
}

/** Score ring. Max score in this system is 30 (Pothole 10 × High 3). */
function PriorityRing({ score }) {
  const band = priorityBand(score).label
  const pct = Math.min(score / 30, 1)
  const r = 34
  const circumference = 2 * Math.PI * r

  return (
    <span className="relative flex size-20 shrink-0 items-center justify-center">
      <svg viewBox="0 0 80 80" className="absolute size-20 -rotate-90">
        <circle cx="40" cy="40" r={r} className="fill-none stroke-surface-highest" strokeWidth="4" />
        <circle
          cx="40"
          cy="40"
          r={r}
          className={`fill-none ${BAND_RING[band]}`}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
        />
      </svg>
      {/* the caption has to fit inside the ring, so it is clamped well under its diameter */}
      <span className="relative flex w-14 flex-col items-center leading-none">
        <span className={`text-xl font-bold ${BAND_TEXT[band]}`}>{score}</span>
        <span className="mt-0.5 font-label text-[8px] tracking-[0.06em] text-on-surface-variant uppercase">
          Priority
        </span>
      </span>
    </span>
  )
}

export default function CitizenComplaintDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [complaint, setComplaint] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api
      .get(`/api/citizen/complaints/${id}`)
      .then((res) => setComplaint(res.data.data.complaint))
      .catch((err) => setError(errorMessage(err, 'Could not load this complaint')))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <p className="text-sm text-on-surface-variant">Loading…</p>
  if (!complaint)
    return (
      <div>
        <p role="alert" className="text-sm text-error">
          {error || 'Complaint not found'}
        </p>
        <button
          onClick={() => navigate('/citizen/complaints')}
          className="mt-4 rounded-lg px-4 py-2 text-sm text-on-surface ring-1 ring-outline-variant"
        >
          Back to my complaints
        </button>
      </div>
    )

  const currentStep = STEPS.indexOf(complaint.status)
  const [, head, rest] = complaint.description.match(/^(.*?[.!?])\s*(.*)$/s) || [
    null,
    complaint.description,
    '',
  ]

  const share = async () => {
    await navigator.clipboard.writeText(window.location.href).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto max-w-[1280px]"
    >
      <BentoCard className="flex flex-wrap items-center gap-4 !p-4" magnetism={false}>
        <button
          type="button"
          onClick={() => navigate('/citizen/complaints')}
          aria-label="Back to my complaints"
          className="flex size-9 items-center justify-center rounded-full bg-surface-container text-on-surface transition-colors hover:bg-surface-high"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div>
          <h1 className="font-bold text-on-surface">Complaint #{complaintCode(complaint.id)}</h1>
          <p className="font-label text-xs tracking-[0.05em] text-on-surface-variant uppercase">
            Submitted on {formatDate(complaint.created_at)}
          </p>
        </div>
        <button
          type="button"
          onClick={share}
          className="ml-auto flex items-center gap-2 rounded-lg bg-surface-container px-4 py-2 text-sm text-on-surface transition-colors hover:bg-surface-high"
        >
          <Link2 className="size-4" />
          {copied ? 'Link copied' : 'Share'}
        </button>
      </BentoCard>

      <BentoSection className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <BentoCard className="relative overflow-hidden !p-0" magnetism={false}>
          {complaint.has_photo ? (
            <img
              src={photoUrl(complaint.id)}
              alt={`Complaint ${complaint.id}`}
              className="h-full max-h-[460px] w-full object-cover"
            />
          ) : (
            <div className="flex h-full min-h-56 flex-col items-center justify-center gap-2 text-on-surface-variant">
              <ImageOff className="size-7" />
              <p className="text-sm">No photo attached to this report</p>
            </div>
          )}
          <span className="absolute bottom-4 left-4 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 font-label text-xs tracking-[0.05em] text-on-surface uppercase backdrop-blur">
            <MapPin className="size-3.5" />
            {complaint.ward}
            {complaint.landmark ? ` · ${complaint.landmark}` : ''}
          </span>
          {complaint.latitude != null && (
            <span className="absolute right-4 bottom-4 rounded-lg bg-black/70 px-3 py-1.5 font-label text-xs text-on-surface backdrop-blur">
              {Number(complaint.latitude).toFixed(4)}, {Number(complaint.longitude).toFixed(4)}
            </span>
          )}
        </BentoCard>

        <div className="flex flex-col gap-4">
          <BentoCard magnetism={false}>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-md px-2.5 py-1 font-label text-[11px] tracking-[0.05em] text-on-surface-variant uppercase ring-1 ring-outline-variant">
                {complaint.issue_type}
              </span>
              <span
                className={`rounded-md px-2.5 py-1 font-label text-[11px] tracking-[0.05em] uppercase ring-1 ring-current ${BAND_TEXT[priorityBand(complaint.priority_score).label]}`}
              >
                {complaint.urgency_level} urgency
              </span>
            </div>

            <div className="mt-4 flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-on-surface">{head}</h2>
                {rest && <p className="mt-1 line-clamp-3 text-sm text-on-surface-variant">{rest}</p>}
              </div>
              <PriorityRing score={complaint.priority_score} />
            </div>

            <div className="mt-5 rounded-lg bg-surface-container p-4">
              <div className="flex items-center justify-between">
                <p className="font-label text-xs tracking-[0.05em] text-on-surface-variant uppercase">
                  Status tracker
                </p>
                <p className="text-xs text-on-surface-variant">
                  Updated {relativeTime(complaint.updated_at || complaint.created_at)}
                </p>
              </div>

              <div className="mt-4 flex items-center">
                {STEPS.map((step, i) => {
                  const Icon = STEP_ICON[step]
                  const done = i <= currentStep
                  return (
                    <div key={step} className="flex flex-1 items-center last:flex-none">
                      <div className="flex flex-col items-center gap-1.5">
                        <span
                          className={`flex size-6 items-center justify-center rounded-full ${
                            done ? 'bg-accent-sky text-on-accent-sky' : 'bg-surface-highest text-on-surface-variant'
                          }`}
                        >
                          <Icon className="size-3.5" />
                        </span>
                        <span
                          className={`text-[11px] whitespace-nowrap ${
                            i === currentStep ? 'font-semibold text-accent-sky' : 'text-on-surface-variant'
                          }`}
                        >
                          {step}
                        </span>
                      </div>
                      {i < STEPS.length - 1 && (
                        <span
                          className={`mx-2 mb-5 h-0.5 flex-1 rounded-full ${
                            i < currentStep ? 'bg-accent-sky' : 'bg-surface-highest'
                          }`}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </BentoCard>

          <BentoCard className="relative" magnetism={false}>
            <span className="pointer-events-none absolute -top-4 right-2 font-label text-7xl font-bold text-on-surface/5">
              #{complaint.id}
            </span>
            <p className="font-label text-xs tracking-[0.05em] text-on-surface-variant uppercase">
              Full description
            </p>
            <p className="relative mt-3 text-sm leading-relaxed text-on-surface-variant">
              {complaint.description}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-surface-container p-4">
                <p className="font-label text-[11px] tracking-[0.05em] text-on-surface-variant uppercase">
                  Assigned officer
                </p>
                <p className="mt-2 text-sm text-on-surface">
                  {complaint.officer?.name || 'Not assigned yet'}
                </p>
              </div>
              <div className="rounded-lg bg-surface-container p-4">
                <p className="font-label text-[11px] tracking-[0.05em] text-on-surface-variant uppercase">
                  Last updated
                </p>
                <p className="mt-2 text-sm text-on-surface">
                  {formatDate(complaint.updated_at || complaint.created_at)}
                </p>
              </div>
            </div>
          </BentoCard>
        </div>
      </BentoSection>
    </motion.div>
  )
}
