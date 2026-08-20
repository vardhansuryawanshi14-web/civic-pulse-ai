import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Mail,
  Map,
  Pencil,
  Phone,
  Search,
  SlidersHorizontal,
} from 'lucide-react'

import api from '@/api/axios'
import { Field, FormError, FormNotice } from '@/components/AuthShell'
import { BentoCard } from '@/components/MagicBento'
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
import { errorMessage } from '@/utils/helpers'

const BLANK = { name: '', email: '', ward: '', phone: '', password: '' }
const PER_PAGE = 10
/** Filters use '' for "no filter", which Base UI reads as unset. */
const ANY = '__any__'

function FilterSelect({ label, icon: Icon, value, onChange, options }) {
  const items = [{ label, value: ANY }, ...options]
  return (
    <Select items={items} value={value || ANY} onValueChange={(next) => onChange(next === ANY ? '' : next)}>
      <SelectTrigger aria-label={label} className="w-full sm:w-44">
        {Icon && <Icon className="size-4 text-on-surface-variant" />}
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

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}

const officerCode = (id) => `OP-${String(id).padStart(4, '0')}`

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors ${
        checked ? 'bg-tertiary' : 'bg-surface-highest'
      }`}
    >
      <span
        className={`absolute top-1 size-4 rounded-full bg-white transition-all ${
          checked ? 'left-6' : 'left-1'
        }`}
      />
    </button>
  )
}

export default function ManageOfficers() {
  const [officers, setOfficers] = useState([])
  const [performance, setPerformance] = useState({})
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [wardFilter, setWardFilter] = useState('')
  const [page, setPage] = useState(1)
  const [panelOpen, setPanelOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () =>
    Promise.all([api.get('/api/admin/officers'), api.get('/api/admin/analytics')])
      .then(([list, stats]) => {
        setOfficers(list.data.data.officers)
        setPerformance(
          Object.fromEntries(
            (stats.data.data.analytics.officer_performance || []).map((o) => [o.id, o]),
          ),
        )
      })
      .catch((err) => setError(errorMessage(err, 'Could not load officers')))

  useEffect(() => {
    load()
  }, [])

  // a slide-over is a modal — Escape has to close it
  useEffect(() => {
    if (!panelOpen) return
    const onKey = (e) => e.key === 'Escape' && setPanelOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [panelOpen])

  const wards = [...new Set(officers.map((o) => o.ward).filter(Boolean))].sort()

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return officers.filter((o) => {
      if (statusFilter === 'active' && !o.is_active) return false
      if (statusFilter === 'inactive' && o.is_active) return false
      if (wardFilter && o.ward !== wardFilter) return false
      if (!term) return true
      return (
        o.name.toLowerCase().includes(term) ||
        o.email.toLowerCase().includes(term) ||
        (o.ward || '').toLowerCase().includes(term)
      )
    })
  }, [officers, search, statusFilter, wardFilter])

  const pageCount = Math.max(1, Math.ceil(rows.length / PER_PAGE))
  const current = Math.min(page, pageCount)
  const visible = rows.slice((current - 1) * PER_PAGE, current * PER_PAGE)

  const openCreate = () => {
    setEditing(null)
    setForm(BLANK)
    setError('')
    setNotice('')
    setPanelOpen(true)
  }

  const openEdit = (officer) => {
    setEditing(officer.id)
    setForm({
      name: officer.name,
      email: officer.email,
      ward: officer.ward || '',
      phone: officer.phone || '',
      password: '',
    })
    setError('')
    setNotice('')
    setPanelOpen(true)
  }

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (editing) {
        const payload = { name: form.name, email: form.email, ward: form.ward, phone: form.phone }
        if (form.password) payload.password = form.password
        await api.patch(`/api/admin/officers/${editing}`, payload)
        setNotice(`${form.name} updated`)
      } else {
        await api.post('/api/admin/officers', form)
        setNotice(`${form.name} can now sign in as an officer`)
      }
      setPanelOpen(false)
      await load()
    } catch (err) {
      setError(errorMessage(err, 'Could not save officer'))
    } finally {
      setBusy(false)
    }
  }

  const setActive = async (officer, active) => {
    setError('')
    setNotice('')
    try {
      if (active) await api.patch(`/api/admin/officers/${officer.id}`, { is_active: true })
      else await api.delete(`/api/admin/officers/${officer.id}`)
      setNotice(`${officer.name} ${active ? 'reactivated' : 'deactivated'}`)
      await load()
    } catch (err) {
      setError(errorMessage(err, 'Could not change account status'))
    }
  }

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-on-surface">Manage Officers</h1>
          <p className="mt-1 text-sm text-primary/80">
            View, add, and manage personnel across all districts.
          </p>
        </div>
        <InteractiveHoverButton
          type="button"
          onClick={openCreate}
          text="Add Officer"
          className="w-full sm:w-36 py-2.5"
        />
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
              placeholder="Search officers by name, email, or district..."
              aria-label="Search officers"
              className="h-11 w-full rounded-lg bg-surface-container pr-3 pl-9 text-sm text-on-surface ring-1 ring-outline-variant outline-none placeholder:text-on-surface-variant/60 focus:ring-2 focus:ring-primary"
            />
          </label>

          <FilterSelect
            label="Filter Status"
            icon={SlidersHorizontal}
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v)
              setPage(1)
            }}
            options={[
              { label: 'Active', value: 'active' },
              { label: 'Deactivated', value: 'inactive' },
            ]}
          />

          <FilterSelect
            label="All Districts"
            icon={Map}
            value={wardFilter}
            onChange={(v) => {
              setWardFilter(v)
              setPage(1)
            }}
            options={wards.map((w) => ({ label: w, value: w }))}
          />
        </div>
      </BentoCard>

      <FormError>{error}</FormError>
      <FormNotice>{notice}</FormNotice>

      <BentoCard className="mt-4 !p-0" magnetism={false}>
        {/* the card sets overflow:hidden inline, so the table scrolls in here */}
        <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-container text-left font-label text-[11px] tracking-[0.05em] text-on-surface-variant uppercase">
              <th className="px-4 py-3 font-medium">Officer</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Assigned District(s)</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Resolved</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-on-surface-variant">
                  {officers.length === 0 ? 'No officers yet.' : 'No officers match these filters.'}
                </td>
              </tr>
            )}
            {visible.map((o) => (
              <tr key={o.id} className="border-b border-border last:border-0 hover:bg-surface-container">
                <td className="px-4 py-3">
                  <span className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-full bg-secondary-container text-xs font-medium text-on-secondary-container">
                      {initials(o.name)}
                    </span>
                    <span>
                      <span className="block font-semibold text-on-surface">{o.name}</span>
                      <span className="block font-label text-xs text-on-surface-variant">
                        ID: {officerCode(o.id)}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="px-4 py-3 text-on-surface-variant">
                  <span className="flex items-center gap-1.5">
                    <Mail className="size-3.5" />
                    {o.email}
                  </span>
                  <span className="mt-1 flex items-center gap-1.5">
                    <Phone className="size-3.5" />
                    {o.phone || 'N/A'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-block rounded-md bg-surface-high px-2 py-1 text-xs text-on-surface">
                    {o.ward || '—'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Toggle
                    checked={o.is_active}
                    onChange={(next) => setActive(o, next)}
                    label={`${o.is_active ? 'Deactivate' : 'Reactivate'} ${o.name}`}
                  />
                </td>
                <td className="px-4 py-3 font-label text-tertiary">
                  {performance[o.id]?.resolved ?? 0}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => openEdit(o)}
                    aria-label={`Edit ${o.name}`}
                    className="flex size-8 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-high hover:text-on-surface"
                  >
                    <Pencil className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
          <p className="text-sm text-on-surface-variant">
            Showing {rows.length === 0 ? 0 : (current - 1) * PER_PAGE + 1} to{' '}
            {Math.min(current * PER_PAGE, rows.length)} of {rows.length} officers
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

      <AnimatePresence>
        {panelOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPanelOpen(false)}
              className="fixed inset-0 z-40 bg-black/60"
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label={editing ? 'Edit officer' : 'Add officer'}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="fixed top-0 right-0 z-50 h-full w-full max-w-md overflow-y-auto border-l border-border bg-surface-low p-6"
            >
              <h2 className="text-xl font-semibold text-on-surface">
                {editing ? 'Edit officer' : 'Add officer'}
              </h2>
              <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
                <Field label="Name" required value={form.name} onChange={set('name')} />
                <Field label="Email" type="email" required value={form.email} onChange={set('email')} />
                <Field label="District assignment" required value={form.ward} onChange={set('ward')} />
                <Field label="Phone (optional)" type="tel" value={form.phone} onChange={set('phone')} />
                <Field
                  label={editing ? 'New password (blank keeps current)' : 'Temporary password'}
                  type="password"
                  required={!editing}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={set('password')}
                />
                <FormError>{error}</FormError>
                <div className="flex flex-wrap gap-2">
                  <InteractiveHoverButton
                    type="submit"
                    disabled={busy}
                    text={busy ? 'Saving…' : editing ? 'Save changes' : 'Create officer'}
                    className="h-11 flex-1 disabled:opacity-70"
                  />
                  <button
                    type="button"
                    onClick={() => setPanelOpen(false)}
                    className="h-11 rounded-lg px-5 text-sm text-on-surface ring-1 ring-outline-variant transition-colors hover:bg-surface-container"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
