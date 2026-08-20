import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Search,
  SlidersHorizontal,
  User,
} from 'lucide-react'

import api, { photoUrl } from '@/api/axios'
import ComplaintCard from '@/components/ComplaintCard'
import { BentoCard } from '@/components/MagicBento'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button'
import { complaintCode, errorMessage, formatDate } from '@/utils/helpers'

/** Filter state uses '' for "no filter", which Base UI reads as unset. */
const ANY = '__any__'
const PER_PAGE = 10
const MAX_SCORE = 30

const COLUMNS = [
  { key: 'photo', label: 'Photo', sortable: false },
  { key: 'id', label: 'ID' },
  { key: 'issue_type', label: 'Issue Type' },
  { key: 'ward', label: 'District' },
  { key: 'urgency_level', label: 'Urgency' },
  { key: 'priority_score', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'officer', label: 'Assigned To' },
]

const URGENCY_ORDER = { High: 3, Medium: 2, Low: 1 }
const URGENCY_CHIP = {
  High: 'text-error',
  Medium: 'text-[#F59E0B]',
  Low: 'text-tertiary',
}
const STATUS_CHIP = {
  Open: 'bg-surface-high text-on-surface-variant',
  'In Progress': 'bg-secondary-container/50 text-on-secondary-container',
  Resolved: 'bg-tertiary-container/25 text-tertiary',
}

function uniqueValues(rows, key) {
  return [...new Set(rows.map((r) => r[key]).filter(Boolean))].sort()
}

export default function AllComplaints() {
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ ward: '', issue_type: '', status: '', urgency_level: '' })
  const [moreFilters, setMoreFilters] = useState(false)
  const [sort, setSort] = useState({ key: 'priority_score', direction: 'desc' })
  const [page, setPage] = useState(1)
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    api
      .get('/api/admin/complaints')
      .then((res) => setComplaints(res.data.data.complaints))
      .catch((err) => setError(errorMessage(err, 'Could not load complaints')))
      .finally(() => setLoading(false))
  }, [])

  const toggleSort = (key) => {
    setPage(1)
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'desc' },
    )
  }

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    const filtered = complaints.filter((c) => {
      if (filters.ward && c.ward !== filters.ward) return false
      if (filters.issue_type && c.issue_type !== filters.issue_type) return false
      if (filters.status && c.status !== filters.status) return false
      if (filters.urgency_level && c.urgency_level !== filters.urgency_level) return false
      if (!term) return true
      return (
        c.description.toLowerCase().includes(term) ||
        complaintCode(c.id).toLowerCase().includes(term) ||
        (c.citizen?.name || '').toLowerCase().includes(term) ||
        (c.ward || '').toLowerCase().includes(term)
      )
    })

    const factor = sort.direction === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      let left = a[sort.key]
      let right = b[sort.key]
      if (sort.key === 'urgency_level') {
        left = URGENCY_ORDER[left] || 0
        right = URGENCY_ORDER[right] || 0
      } else if (sort.key === 'officer') {
        left = a.officer?.name || ''
        right = b.officer?.name || ''
      }
      if (left == null) return 1
      if (right == null) return -1
      if (typeof left === 'number' && typeof right === 'number') return (left - right) * factor
      return String(left).localeCompare(String(right)) * factor
    })
  }, [complaints, filters, search, sort])

  const pageCount = Math.max(1, Math.ceil(rows.length / PER_PAGE))
  const current = Math.min(page, pageCount)
  const visible = rows.slice((current - 1) * PER_PAGE, current * PER_PAGE)
  const firstRow = rows.length === 0 ? 0 : (current - 1) * PER_PAGE + 1

  /** Export what is on screen, filters and sort included. */
  const exportCsv = () => {
    const header = ['ID', 'Issue Type', 'District', 'Urgency', 'Priority', 'Status', 'Assigned To', 'Reported', 'Description']
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const body = rows.map((c) =>
      [
        complaintCode(c.id),
        c.issue_type,
        c.ward,
        c.urgency_level,
        c.priority_score,
        c.status,
        c.officer?.name || 'Unassigned',
        formatDate(c.created_at),
        c.description,
      ]
        .map(escape)
        .join(','),
    )
    const blob = new Blob([[header.map(escape).join(','), ...body].join('\n')], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'civicpulse-complaints.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const FilterSelect = ({ name, label, options }) => {
    const items = [{ label, value: ANY }, ...options.map((o) => ({ label: o, value: o }))]
    return (
      <Select
        items={items}
        value={filters[name] || ANY}
        onValueChange={(next) => {
          setFilters({ ...filters, [name]: next === ANY ? '' : next })
          setPage(1)
        }}
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

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-on-surface">All Complaints</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Manage and track civic issues reported across all districts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMoreFilters((v) => !v)}
            className="flex items-center gap-2 rounded-lg bg-surface-container px-4 py-2.5 text-sm text-on-surface transition-colors hover:bg-surface-high"
          >
            <SlidersHorizontal className="size-4" />
            More Filters
          </button>
          <InteractiveHoverButton
            type="button"
            onClick={exportCsv}
            text="Export CSV"
            className="w-full sm:w-36 py-2.5"
          />
        </div>
      </div>

      <BentoCard className="mt-5" magnetism={false}>
        <div className="flex flex-wrap gap-2">
          <label className="relative w-full min-w-0 flex-1 sm:min-w-56">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-on-surface-variant" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search ID, keyword, or address..."
              aria-label="Search complaints"
              className="h-11 w-full rounded-lg bg-surface-container pr-3 pl-9 text-sm text-on-surface ring-1 ring-outline-variant outline-none placeholder:text-on-surface-variant/60 focus:ring-2 focus:ring-primary"
            />
          </label>
          <FilterSelect name="ward" label="All Districts" options={uniqueValues(complaints, 'ward')} />
          <FilterSelect name="issue_type" label="Category" options={uniqueValues(complaints, 'issue_type')} />
          <FilterSelect name="status" label="Status" options={uniqueValues(complaints, 'status')} />
        </div>
        {moreFilters && (
          <div className="mt-2 flex flex-wrap gap-2">
            <FilterSelect name="urgency_level" label="Urgency" options={uniqueValues(complaints, 'urgency_level')} />
          </div>
        )}
      </BentoCard>

      {error && (
        <p role="alert" className="mt-4 text-sm text-error">
          {error}
        </p>
      )}

      <BentoCard className="mt-4 !p-0" magnetism={false}>
        {/* the card itself sets overflow:hidden inline, so the table needs its
            own scroller or it stretches the page on narrow screens */}
        <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-container text-left">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 font-label text-[11px] font-medium tracking-[0.05em] text-on-surface-variant uppercase"
                >
                  {col.sortable === false ? (
                    col.label
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-on-surface"
                    >
                      {col.label}
                      {sort.key === col.key ? (
                        sort.direction === 'asc' ? (
                          <ArrowUp className="size-3" />
                        ) : (
                          <ArrowDown className="size-3" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 opacity-40" />
                      )}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-6 text-on-surface-variant">
                  No complaints match these filters.
                </td>
              </tr>
            )}
            {visible.map((c) => (
              <tr
                key={c.id}
                onClick={() => setPreview(c)}
                className="cursor-pointer border-b border-border last:border-0 hover:bg-surface-container"
              >
                <td className="px-4 py-3">
                  {c.has_photo ? (
                    <img
                      src={photoUrl(c.id)}
                      alt=""
                      loading="lazy"
                      className="size-9 rounded-md object-cover"
                    />
                  ) : (
                    <span className="flex size-9 items-center justify-center rounded-md bg-surface-container text-on-surface-variant">
                      <ImageOff className="size-4" />
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-label text-on-surface">#{complaintCode(c.id)}</td>
                <td className="px-4 py-3 text-on-surface">{c.issue_type}</td>
                <td className="px-4 py-3 text-on-surface-variant">{c.ward}</td>
                <td className="px-4 py-3">
                  <span className={`flex items-center gap-1.5 ${URGENCY_CHIP[c.urgency_level] || ''}`}>
                    <span className="size-1.5 rounded-full bg-current" />
                    {c.urgency_level}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2">
                    <span className="font-label text-on-surface">{c.priority_score}</span>
                    <span className="h-1 w-16 overflow-hidden rounded-full bg-surface-highest">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${(c.priority_score / MAX_SCORE) * 100}%` }}
                      />
                    </span>
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-md px-2 py-1 font-label text-[11px] tracking-[0.05em] uppercase ${STATUS_CHIP[c.status]}`}
                  >
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {c.officer ? (
                    <span className="flex items-center gap-2 text-on-surface">
                      <span className="flex size-6 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
                        <User className="size-3" />
                      </span>
                      {c.officer.name}
                    </span>
                  ) : (
                    <span className="text-on-surface-variant italic">Unassigned</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
          <p className="text-sm text-on-surface-variant">
            Showing {firstRow}-{Math.min(current * PER_PAGE, rows.length)} of {rows.length} complaints
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={current === 1}
              aria-label="Previous page"
              className="flex size-8 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
            </button>
            {Array.from({ length: Math.min(pageCount, 3) }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className={`size-8 rounded-md text-sm transition-colors ${
                  n === current
                    ? 'bg-accent-sky text-on-accent-sky'
                    : 'text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {n}
              </button>
            ))}
            {pageCount > 3 && <span className="px-1 text-on-surface-variant">…</span>}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={current === pageCount}
              aria-label="Next page"
              className="flex size-8 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container disabled:opacity-40"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </BentoCard>

      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Complaint ${complaintCode(preview.id)}`}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8"
        >
          {/* click-outside closes, matching the drawer on Manage Officers */}
          <button
            type="button"
            aria-label="Close preview"
            onClick={() => setPreview(null)}
            className="absolute inset-0 cursor-default"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 my-auto w-full max-w-xl"
          >
            <ComplaintCard complaint={preview}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-on-surface-variant">
                  Reported by {preview.citizen?.name} · {preview.citizen?.email}
                </span>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="ml-auto rounded-lg px-4 py-2 text-sm text-on-surface ring-1 ring-outline-variant transition-colors hover:bg-surface-container"
                >
                  Close
                </button>
              </div>
            </ComplaintCard>
          </motion.div>
        </div>
      )}
    </div>
  )
}
