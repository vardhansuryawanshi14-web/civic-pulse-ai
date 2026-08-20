import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowDown, CalendarDays, ChevronRight, ImageOff, Map, SlidersHorizontal } from 'lucide-react'
import { Link } from 'react-router-dom'

import api, { photoUrl } from '@/api/axios'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { complaintCode, errorMessage, formatDate } from '@/utils/helpers'

const FILTERS = ['All', 'Open', 'In Progress', 'Resolved']
const FILTER_ITEMS = FILTERS.map((f) => ({ label: f === 'All' ? 'All statuses' : f, value: f }))
const PAGE = 4

const STATUS_CHIP = {
  Open: { dot: 'bg-error', text: 'text-error' },
  'In Progress': { dot: 'bg-tertiary', text: 'text-tertiary' },
  Resolved: { dot: 'bg-on-surface-variant', text: 'text-on-surface-variant' },
}

/** The schema has no title, so the first sentence stands in for one. */
function splitDescription(text = '') {
  const [, head, rest] = text.match(/^(.*?[.!?])\s*(.*)$/s) || [null, text, '']
  return { head, rest }
}

export default function MyComplaints() {
  const [complaints, setComplaints] = useState([])
  const [filter, setFilter] = useState('All')
  const [visible, setVisible] = useState(PAGE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get('/api/citizen/complaints')
      .then((res) => setComplaints(res.data.data.complaints))
      .catch((err) => setError(errorMessage(err, 'Could not load complaints')))
      .finally(() => setLoading(false))
  }, [])

  const shown = useMemo(
    () => (filter === 'All' ? complaints : complaints.filter((c) => c.status === filter)),
    [complaints, filter],
  )

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-on-surface">My Complaints</h1>

        <Select
          items={FILTER_ITEMS}
          value={filter}
          onValueChange={(value) => {
            setFilter(value)
            setVisible(PAGE)
          }}
        >
          <SelectTrigger aria-label="Filter by status" className="w-full sm:w-48">
            <SlidersHorizontal className="size-4 text-on-surface-variant" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Status</SelectLabel>
              {FILTER_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
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
            ? 'You have not reported any issues yet.'
            : `No ${filter.toLowerCase()} complaints.`}
        </p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {shown.slice(0, visible).map((c, i) => {
          const { head, rest } = splitDescription(c.description)
          const chip = STATUS_CHIP[c.status] || STATUS_CHIP.Open
          return (
            <motion.article
              key={c.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: Math.min(i * 0.04, 0.3) }}
              style={{ position: 'relative' }}
              className="flex gap-4 rounded-2xl border border-white/14 bg-[rgba(26,26,29,0.75)] p-4 shadow-[0_4px_18px_rgba(0,0,0,0.45)] transition-colors hover:border-accent-sky/35"
            >
              <Link
                to={`/citizen/complaints/${c.id}`}
                aria-label={`Open complaint ${complaintCode(c.id)}`}
                className="absolute inset-0 rounded-xl"
              />
              {c.has_photo ? (
                <img
                  src={photoUrl(c.id)}
                  alt=""
                  loading="lazy"
                  className="size-[72px] shrink-0 rounded-lg object-cover"
                />
              ) : (
                <span className="flex size-[72px] shrink-0 items-center justify-center rounded-lg bg-surface-container text-on-surface-variant">
                  <ImageOff className="size-6" />
                </span>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-surface-container px-2 py-0.5 font-label text-[11px] tracking-[0.05em] text-on-surface-variant uppercase">
                    {c.issue_type}
                  </span>
                  <span
                    className={`flex items-center gap-1.5 rounded-md bg-surface-container px-2 py-0.5 font-label text-[11px] tracking-[0.05em] uppercase ${chip.text}`}
                  >
                    <span className={`size-1.5 rounded-full ${chip.dot}`} />
                    {c.status}
                  </span>
                </div>

                <h2 className="mt-2 line-clamp-1 font-bold text-on-surface">{head}</h2>
                {rest && <p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">{rest}</p>}

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-on-surface-variant">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="size-3.5" />
                    {formatDate(c.created_at)}
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Map className="size-3.5" />
                    {c.ward}
                  </span>
                  <span className="ml-auto rounded bg-surface-container px-2 py-0.5 font-label text-[11px] text-on-surface-variant">
                    #{complaintCode(c.id)}
                  </span>
                  <ChevronRight className="size-4 text-on-surface-variant" />
                </div>
              </div>
            </motion.article>
          )
        })}
      </div>

      {shown.length > visible && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE)}
            className="flex items-center gap-2 rounded-lg bg-surface-low px-5 py-2.5 text-sm text-on-surface ring-1 ring-outline-variant transition-colors hover:bg-surface-container"
          >
            Load More
            <ArrowDown className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}
