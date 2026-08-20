import { motion } from 'framer-motion'

import { cn } from '@/lib/utils'

/** Score bands come straight from the scoring spec: >=20 critical, 10-19 moderate, <10 low. */
export function priorityBand(score) {
  if (score >= 20)
    return { label: 'Critical', className: 'bg-error/12 text-error', bar: 'bg-error', critical: true }
  if (score >= 10)
    return { label: 'Moderate', className: 'bg-[#F59E0B]/12 text-[#F59E0B]', bar: 'bg-[#F59E0B]' }
  return { label: 'Low', className: 'bg-tertiary/12 text-tertiary', bar: 'bg-tertiary' }
}

export default function PriorityBadge({ score, className }) {
  const band = priorityBand(score)

  return (
    <motion.span
      // ANIMATIONS.md §7: the slow pulse is reserved for Critical only
      animate={band.critical ? { opacity: [1, 0.6, 1] } : undefined}
      transition={band.critical ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        band.className,
        className,
      )}
    >
      {band.label}
      <span className="font-label opacity-70">{score}</span>
    </motion.span>
  )
}

/* Each status gets its own hue over a matching 10% tint. */
const STATUS_STYLES = {
  Open: 'bg-[#3B82F6]/10 text-[#7EA6FF]',
  'In Progress': 'bg-[#F59E0B]/10 text-[#F59E0B]',
  Resolved: 'bg-tertiary/10 text-tertiary',
}

export function StatusBadge({ status, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        STATUS_STYLES[status] || STATUS_STYLES.Open,
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  )
}

/** Left edge accent — the loudest signal on a complaint card. */
export function statusAccent(status, score) {
  if (status === 'Resolved') return 'bg-tertiary'
  if (status === 'In Progress') return 'bg-[#F59E0B]'
  return priorityBand(score).bar
}
