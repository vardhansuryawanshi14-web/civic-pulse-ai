import { Link } from 'react-router-dom'

import { HOME_FOR, useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

/**
 * The reference's `pulse_alert` mark, drawn as SVG so we do not pull in the
 * Material Symbols icon font just for one glyph.
 */
export function PulseMark({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} aria-hidden="true">
      <path
        d="M2.5 12.5h4l2.2-5.6 3.2 10 2.4-6.2 1.6 1.8h5.6"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Logo lockup: mark + wordmark. Same on every screen. */
export function Logo({ className, showWord = true }) {
  const { user } = useAuth()
  const to = user ? HOME_FOR[user.role] || '/' : '/'

  return (
    <Link to={to} className={cn('group flex items-center gap-2.5', className)}>
      {/* the mark sits in a glass tile that lights up on hover, so the lockup
          reads as a badge rather than a loose icon next to text */}
      <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-md transition-colors duration-300 group-hover:border-accent-sky/45">
        <span className="pointer-events-none absolute -inset-1 rounded-2xl bg-accent-sky/25 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100" />
        <PulseMark className="relative size-5 text-accent-sky" />
      </span>
      {showWord && (
        <span className="text-[22px] leading-none font-semibold tracking-[-0.02em] text-on-surface">
          Civic<span className="text-accent-sky">Pulse</span>
        </span>
      )}
    </Link>
  )
}

/**
 * The reference's three blurred colour fields. Rendered once behind every
 * screen so the background is identical across the whole app.
 */
export function GlowBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div className="absolute -top-1/4 -left-1/4 size-[800px] rounded-full bg-primary/20 opacity-50 blur-[120px]" />
      <div className="absolute -right-1/4 -bottom-1/4 size-[800px] rounded-full bg-secondary/20 opacity-50 blur-[120px]" />
      <div className="absolute top-1/2 left-1/2 size-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[160px]" />
    </div>
  )
}
