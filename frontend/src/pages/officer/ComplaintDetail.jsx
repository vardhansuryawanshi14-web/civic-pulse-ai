import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Download,
  ImageOff,
  Lock,
  MapPin,
  Send,
  User,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

import api, { photoUrl } from '@/api/axios'
import { BentoCard } from '@/components/MagicBento'
import { priorityBand } from '@/components/PriorityBadge'
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { complaintCode, errorMessage, formatDate, relativeTime } from '@/utils/helpers'

const STATUSES = ['Open', 'In Progress', 'Resolved']
const STATUS_ITEMS = STATUSES.map((s) => ({ label: s, value: s }))
const MAX_SCORE = 30 // Pothole 10 × High 3

const STATUS_PILL = {
  Open: 'bg-surface-container text-on-surface-variant ring-1 ring-outline-variant',
  'In Progress': 'bg-accent-sky/15 text-accent-sky ring-1 ring-accent-sky/30',
  Resolved: 'bg-tertiary/15 text-tertiary ring-1 ring-tertiary/30',
}

const BAND = {
  Critical: { text: 'text-error', bar: 'bg-error', chip: 'bg-error/15 text-error', label: 'High Priority' },
  Moderate: {
    text: 'text-[#F59E0B]',
    bar: 'bg-[#F59E0B]',
    chip: 'bg-[#F59E0B]/15 text-[#F59E0B]',
    label: 'Medium Priority',
  },
  Low: { text: 'text-tertiary', bar: 'bg-tertiary', chip: 'bg-tertiary/15 text-tertiary', label: 'Low Priority' },
}

function Card({ title, action, children, className = '' }) {
  return (
    <BentoCard className={className} magnetism={false}>
      {title && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-on-surface">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </BentoCard>
  )
}

export default function ComplaintDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [complaint, setComplaint] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [nextStatus, setNextStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    api
      .get(`/api/officer/complaints/${id}`)
      .then((res) => {
        setComplaint(res.data.data.complaint)
        setNextStatus(res.data.data.complaint.status)
      })
      .catch((err) => setError(errorMessage(err, 'Could not load this complaint')))
      .finally(() => setLoading(false))
  }, [id])

  const applyStatus = async (status) => {
    setError('')
    setNotice('')
    setSaving(true)
    try {
      const res = await api.patch(`/api/officer/complaints/${id}/status`, { status })
      setComplaint((prev) => ({ ...prev, ...res.data.data.complaint }))
      setNextStatus(status)
      setNotice(`${res.data.message}. The citizen has been notified by email.`)
    } catch (err) {
      setError(errorMessage(err, 'Could not update status'))
    } finally {
      setSaving(false)
    }
  }

  const addNote = async (e) => {
    e.preventDefault()
    if (!note.trim()) return
    setError('')
    try {
      const res = await api.post(`/api/officer/complaints/${id}/notes`, { text: note.trim() })
      setComplaint((prev) => ({ ...prev, internal_notes: res.data.data.internal_notes }))
      setNote('')
    } catch (err) {
      setError(errorMessage(err, 'Could not add note'))
    }
  }

  if (loading) return <p className="text-sm text-on-surface-variant">Loading…</p>
  if (!complaint)
    return (
      <div>
        <p role="alert" className="text-sm text-error">
          {error || 'Complaint not found'}
        </p>
        <button
          onClick={() => navigate('/officer/dashboard')}
          className="mt-4 rounded-lg px-4 py-2 text-sm text-on-surface ring-1 ring-outline-variant"
        >
          Back to ward queue
        </button>
      </div>
    )

  const band = BAND[priorityBand(complaint.priority_score).label]
  const [, head, rest] = complaint.description.match(/^(.*?[.!?])\s*(.*)$/s) || [
    null,
    complaint.description,
    '',
  ]
  const stepIndex = STATUSES.indexOf(complaint.status)
  const timeline = [
    { label: 'Reported', at: formatDate(complaint.created_at), done: true },
    {
      label: complaint.officer ? `Assigned to ${complaint.officer.name}` : 'Awaiting assignment',
      at: complaint.officer ? 'District queue' : 'Pending',
      done: Boolean(complaint.officer),
    },
    {
      label: 'In Progress',
      at: stepIndex >= 1 ? formatDate(complaint.updated_at) : 'Pending',
      done: stepIndex >= 1,
    },
    {
      label: 'Resolved',
      at: stepIndex === 2 ? formatDate(complaint.updated_at) : 'Pending',
      done: stepIndex === 2,
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto max-w-[1280px]"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => navigate('/officer/dashboard')}
            aria-label="Back to district queue"
            className="mt-1 flex size-9 items-center justify-center rounded-full bg-surface-container text-on-surface transition-colors hover:bg-surface-high"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-label text-xs tracking-[0.05em] text-on-surface-variant uppercase">
                Case #{complaintCode(complaint.id)}
              </span>
              <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${band.chip}`}>
                {band.label}
              </span>
              <span className="rounded-md bg-surface-container px-2 py-0.5 text-xs text-on-surface-variant">
                {complaint.issue_type}
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold text-on-surface">{head}</h1>
            <p className="mt-0.5 text-sm text-on-surface-variant">
              Submitted on {formatDate(complaint.created_at)}
            </p>
          </div>
        </div>

        {/* status is read-only here — the single control lives in Update Status */}
        <span
          className={`rounded-full px-4 py-2 font-label text-sm font-medium ${STATUS_PILL[complaint.status]}`}
        >
          {complaint.status}
        </span>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 text-sm text-tertiary">
          {notice}
        </p>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-4">
          <BentoCard className="relative overflow-hidden !p-0" magnetism={false}>
            {complaint.has_photo ? (
              <>
                <img
                  src={photoUrl(complaint.id)}
                  alt={`Evidence for complaint ${complaint.id}`}
                  className="max-h-[420px] w-full object-cover"
                />
                <a
                  href={photoUrl(complaint.id)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open full-size evidence photo"
                  className="absolute right-3 bottom-3 flex size-9 items-center justify-center rounded-lg bg-black/70 text-on-surface backdrop-blur transition-colors hover:bg-black"
                >
                  <Download className="size-4" />
                </a>
              </>
            ) : (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-on-surface-variant">
                <ImageOff className="size-7" />
                <p className="text-sm">No photo attached to this report</p>
              </div>
            )}
          </BentoCard>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="!p-4">
              <p className="font-label text-[11px] tracking-[0.05em] text-on-surface-variant uppercase">
                Location
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-sm text-on-surface">
                <MapPin className="size-4" />
                {complaint.ward}
              </p>
              {complaint.landmark && (
                <p className="mt-1 text-sm text-on-surface-variant">{complaint.landmark}</p>
              )}
              {complaint.latitude != null && (
                <p className="mt-1 font-label text-xs text-on-surface-variant">
                  {Number(complaint.latitude).toFixed(4)}, {Number(complaint.longitude).toFixed(4)}
                </p>
              )}
            </Card>

            <Card className="!p-4">
              <p className="font-label text-[11px] tracking-[0.05em] text-on-surface-variant uppercase">
                AI risk assessment
              </p>
              <p className="mt-2">
                <span className={`text-3xl font-bold ${band.text}`}>{complaint.priority_score}</span>
                <span className="text-sm text-on-surface-variant"> / {MAX_SCORE}</span>
              </p>
              <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-surface-highest">
                <span
                  className={`block h-full rounded-full ${band.bar}`}
                  style={{ width: `${(complaint.priority_score / MAX_SCORE) * 100}%` }}
                />
              </span>
              <p className="mt-2 text-xs text-on-surface-variant">
                {complaint.issue_type} · {complaint.urgency_level} urgency
              </p>
            </Card>
          </div>

          <Card title="Citizen Report">
            <p className="text-sm leading-relaxed text-on-surface-variant">{rest || head}</p>
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <span className="flex size-9 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
                <User className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-on-surface">{complaint.citizen?.name}</p>
                <p className="text-xs text-on-surface-variant">
                  {complaint.ward} resident · {complaint.citizen?.email}
                  {complaint.citizen?.phone ? ` · ${complaint.citizen.phone}` : ''}
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card title="Resolution Timeline">
            <ol className="flex flex-col gap-4">
              {timeline.map((step) => (
                <li key={step.label} className="flex gap-3">
                  <span
                    className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${
                      step.done ? 'bg-primary text-on-primary' : 'bg-surface-highest text-on-surface-variant'
                    }`}
                  >
                    {step.done ? <CheckCircle2 className="size-3" /> : <Circle className="size-2.5" />}
                  </span>
                  <div>
                    <p className={`text-sm ${step.done ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                      {step.label}
                    </p>
                    <p className="text-xs text-on-surface-variant">{step.at}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <Card title="Update Status">
            <p className="-mt-2 mb-4 text-sm text-on-surface-variant">
              The only place a case changes state. Currently{' '}
              <span className="font-medium text-on-surface">{complaint.status}</span>.
            </p>
            <p className="font-label text-[11px] tracking-[0.05em] text-on-surface-variant uppercase">
              Move to
            </p>
            <Select items={STATUS_ITEMS} value={nextStatus} onValueChange={setNextStatus}>
              <SelectTrigger aria-label="New status" className="mt-2 h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Status</SelectLabel>
                  {STATUS_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <InteractiveHoverButton
              type="button"
              disabled={saving || nextStatus === complaint.status}
              onClick={() => applyStatus(nextStatus)}
              text={saving ? 'Applying…' : 'Apply State Transition'}
              className="mt-3 h-10 w-full disabled:opacity-50"
            />
          </Card>

          <Card
            title={
              <span className="flex items-center gap-2">
                <Lock className="size-4 text-tertiary" />
                Internal Notes
              </span>
            }
            action={
              <span className="rounded-md bg-surface-container px-2 py-1 text-[11px] text-on-surface-variant">
                Officer eyes only
              </span>
            }
          >
            <div className="flex flex-col gap-3">
              {(complaint.internal_notes || []).length === 0 && (
                <p className="text-sm text-on-surface-variant">No internal notes yet.</p>
              )}
              {(complaint.internal_notes || []).map((n, i) => (
                <div key={i} className="rounded-lg border-l-2 border-tertiary bg-surface-container p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-tertiary">{n.author}</span>
                    <span className="text-xs text-on-surface-variant">{relativeTime(n.at)}</span>
                  </div>
                  <p className="mt-1 text-sm text-on-surface-variant">{n.text}</p>
                </div>
              ))}
            </div>

            <form onSubmit={addNote} className="relative mt-4">
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a secure internal note..."
                className="w-full rounded-lg bg-surface-container p-3 pr-12 text-sm text-on-surface ring-1 ring-outline-variant outline-none placeholder:text-on-surface-variant/60 focus:ring-2 focus:ring-primary"
              />
              <button
                type="submit"
                aria-label="Add note"
                className="absolute right-2 bottom-3 flex size-8 items-center justify-center rounded-md bg-tertiary text-on-tertiary transition-opacity hover:opacity-90"
              >
                <Send className="size-4" />
              </button>
            </form>
          </Card>
        </div>
      </div>
    </motion.div>
  )
}
