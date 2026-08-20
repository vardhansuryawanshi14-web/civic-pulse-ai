import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, ChevronRight, RotateCcw, SlidersHorizontal, TrendingUp, X } from 'lucide-react'
import { Link } from 'react-router-dom'

import api from '@/api/axios'
import ComplaintHeatmap from '@/components/ComplaintHeatmap'
import { priorityBand } from '@/components/PriorityBadge'
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button'
import { errorMessage, relativeTime } from '@/utils/helpers'

const RANGES = [
  { value: '30', label: '30 Days' },
  { value: '90', label: '90 Days' },
  { value: 'ytd', label: 'YTD' },
]

const CATEGORY_DOT = {
  Pothole: 'bg-error',
  Garbage: 'bg-tertiary',
  'Broken Light': 'bg-[#F59E0B]',
  'Water Leakage': 'bg-primary',
  Other: 'bg-on-surface-variant',
}

const BAND_TEXT = {
  Critical: 'text-error',
  Moderate: 'text-[#F59E0B]',
  Low: 'text-tertiary',
}

export default function ComplaintMap() {
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [range, setRange] = useState('30')
  const [wards, setWards] = useState([])
  const [categories, setCategories] = useState([])
  const [applied, setApplied] = useState({ range: '30', wards: [], categories: [] })
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    api
      .get('/api/admin/complaints')
      .then((res) => setComplaints(res.data.data.complaints))
      .catch((err) => setError(errorMessage(err, 'Could not load complaints')))
      .finally(() => setLoading(false))
  }, [])

  const allWards = useMemo(
    () => [...new Set(complaints.map((c) => c.ward).filter(Boolean))].sort(),
    [complaints],
  )
  const allCategories = useMemo(
    () => [...new Set(complaints.map((c) => c.issue_type).filter(Boolean))].sort(),
    [complaints],
  )

  const toggle = (setter) => (value) =>
    setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]))

  // empty selections mean "no filter", which beats showing an empty map
  const shown = useMemo(() => {
    const now = new Date()
    const cutoff =
      applied.range === 'ytd'
        ? new Date(now.getFullYear(), 0, 1).getTime()
        : now.getTime() - Number(applied.range) * 86400000

    return complaints.filter((c) => {
      if (applied.wards.length && !applied.wards.includes(c.ward)) return false
      if (applied.categories.length && !applied.categories.includes(c.issue_type)) return false
      return new Date(c.created_at).getTime() >= cutoff
    })
  }, [complaints, applied])

  const located = shown.filter((c) => c.latitude != null && c.longitude != null)
  const critical = shown.filter((c) => c.priority_score >= 20).length
  const criticalShare = shown.length ? Math.round((critical / shown.length) * 100) : 0

  const reset = () => {
    setRange('30')
    setWards([])
    setCategories([])
    setApplied({ range: '30', wards: [], categories: [] })
  }

  return (
    <div className="mx-auto max-w-[1280px]">
      <p className="flex items-center gap-1 text-sm text-on-surface-variant">
        Admin
        <ChevronRight className="size-3.5" />
        <span className="text-on-surface">Complaint Map</span>
      </p>
      <h1 className="mt-1 text-3xl font-bold text-on-surface">Complaint Density Map</h1>

      {error && (
        <p role="alert" className="mt-4 text-sm text-error">
          {error}
        </p>
      )}

      <div className="relative mt-5 overflow-hidden rounded-2xl border border-white/14 bg-[rgba(26,26,29,0.75)] shadow-[0_4px_18px_rgba(0,0,0,0.45)] lg:min-h-[620px]">
        <div className="h-[320px] sm:h-[440px] lg:h-[620px]">
          <ComplaintHeatmap complaints={shown} nightMode onSelect={setSelected} />
        </div>

        {/* Data filters */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="z-10 mx-3 mt-3 w-auto rounded-xl lg:absolute lg:top-4 lg:left-4 lg:mx-0 lg:mt-0 lg:w-64 border border-white/14 bg-surface-low/85 p-4 shadow-[0_4px_18px_rgba(0,0,0,0.45)] backdrop-blur-md"
        >
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-on-surface">
              <SlidersHorizontal className="size-4" />
              Data Filters
            </h2>
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-1 text-xs text-primary transition-colors hover:text-primary-container"
            >
              <RotateCcw className="size-3" />
              Reset
            </button>
          </div>

          <p className="mt-4 font-label text-[11px] tracking-[0.05em] text-on-surface-variant uppercase">
            Date range
          </p>
          <div className="mt-1.5 flex rounded-lg bg-surface-container p-1">
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRange(r.value)}
                className={`flex-1 rounded-md py-1.5 text-xs transition-colors ${
                  range === r.value
                    ? 'bg-surface-high text-on-surface'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="font-label text-[11px] tracking-[0.05em] text-on-surface-variant uppercase">
              Districts
            </p>
            <span className="text-[11px] text-on-surface-variant">
              {wards.length ? `Selected (${wards.length})` : 'All'}
            </span>
          </div>
          <div className="mt-1.5 max-h-32 space-y-1.5 overflow-y-auto pr-1">
            {allWards.length === 0 && <p className="text-xs text-on-surface-variant">No districts yet</p>}
            {allWards.map((w) => (
              <label key={w} className="flex cursor-pointer items-center gap-2 text-sm text-on-surface">
                <input
                  type="checkbox"
                  checked={wards.includes(w)}
                  onChange={() => toggle(setWards)(w)}
                  className="size-4 rounded bg-surface-container accent-[var(--primary)]"
                />
                {w}
              </label>
            ))}
          </div>

          <p className="mt-4 font-label text-[11px] tracking-[0.05em] text-on-surface-variant uppercase">
            Issue categories
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {allCategories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggle(setCategories)(c)}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors ${
                  categories.includes(c)
                    ? 'bg-primary/20 text-primary ring-1 ring-primary/40'
                    : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className={`size-1.5 rounded-full ${CATEGORY_DOT[c] || 'bg-on-surface-variant'}`} />
                {c}
              </button>
            ))}
          </div>

          <InteractiveHoverButton
            type="button"
            onClick={() => setApplied({ range, wards, categories })}
            text="Apply Filters"
            className="mt-4 w-full py-2.5"
          />
        </motion.div>

        {/* Active density */}
        <div className="z-10 mx-3 mt-3 w-auto rounded-xl lg:absolute lg:top-4 lg:right-4 lg:mx-0 lg:mt-0 lg:w-56 border border-white/14 bg-surface-low/85 p-4 shadow-[0_4px_18px_rgba(0,0,0,0.45)] backdrop-blur-md">
          <p className="font-label text-[11px] tracking-[0.05em] text-on-surface-variant uppercase">
            Active density
          </p>
          <div className="mt-1 flex items-end gap-2">
            <span className="text-3xl font-bold text-on-surface">{shown.length}</span>
            <span className="mb-1 flex items-center gap-1 text-xs text-tertiary">
              <TrendingUp className="size-3.5" />
              {criticalShare}% critical
            </span>
          </div>
          <p className="mt-1 text-xs text-on-surface-variant">
            {located.length} of {shown.length} have coordinates
          </p>
        </div>

        {/* Selected complaint */}
        {selected && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="z-10 mx-3 mt-3 w-auto rounded-xl lg:absolute lg:top-32 lg:right-4 lg:mx-0 lg:mt-0 lg:w-64 border border-white/14 bg-surface-low/85 p-4 shadow-[0_4px_18px_rgba(0,0,0,0.45)] backdrop-blur-md"
          >
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close"
              className="absolute top-3 right-3 text-on-surface-variant hover:text-on-surface"
            >
              <X className="size-4" />
            </button>
            <p
              className={`font-label text-[11px] tracking-[0.05em] uppercase ${BAND_TEXT[priorityBand(selected.priority_score).label]}`}
            >
              {priorityBand(selected.priority_score).label} priority
            </p>
            <h3 className="mt-1 pr-5 font-semibold text-on-surface">{selected.issue_type}</h3>
            <p className="mt-2 line-clamp-3 text-xs text-on-surface-variant">{selected.description}</p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-surface-container p-2">
                <p className="font-label text-[9px] tracking-[0.05em] text-on-surface-variant uppercase">
                  Reported
                </p>
                <p className="mt-0.5 text-xs text-on-surface">{relativeTime(selected.created_at)}</p>
              </div>
              <div className="rounded-lg bg-surface-container p-2">
                <p className="font-label text-[9px] tracking-[0.05em] text-on-surface-variant uppercase">
                  District
                </p>
                <p className="mt-0.5 text-xs text-on-surface">{selected.ward}</p>
              </div>
            </div>

            <Link
              to="/admin/complaints"
              className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-surface-container py-2 text-xs text-on-surface transition-colors hover:bg-surface-high"
            >
              View Full Report
              <ArrowRight className="size-3.5" />
            </Link>
          </motion.div>
        )}

        {/* Density scale */}
        <div className="z-10 mx-3 mt-3 mb-3 w-auto rounded-xl lg:absolute lg:right-4 lg:bottom-4 lg:mx-0 lg:mt-0 lg:mb-0 border border-white/14 bg-surface-low/85 p-3 shadow-[0_4px_18px_rgba(0,0,0,0.45)] backdrop-blur-md">
          <div className="flex items-center justify-between gap-6">
            <p className="font-label text-[11px] tracking-[0.05em] text-on-surface-variant uppercase">
              Density scale
            </p>
            <p className="font-label text-[9px] tracking-[0.05em] text-on-surface-variant uppercase">
              Reports / sq mi
            </p>
          </div>
          <div
            className="mt-1.5 h-1.5 w-48 rounded-full"
            style={{ background: 'linear-gradient(to right, #4edea3, #F59E0B, #ffb4ab)' }}
          />
          <div className="mt-1 flex justify-between text-[10px] text-on-surface-variant">
            <span>Low</span>
            <span>Medium</span>
            <span>High</span>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-on-surface-variant">
            <span className="size-2 rounded-full bg-error" />
            Critical hotspot ({critical})
          </p>
        </div>
      </div>

      {loading && <p className="mt-3 text-sm text-on-surface-variant">Loading…</p>}
    </div>
  )
}
