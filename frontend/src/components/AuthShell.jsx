import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, ChevronDown, Eye, EyeOff, X } from 'lucide-react'

import api from '@/api/axios'
import EtherBackground from '@/components/EtherBackground'
import { BentoCard, BentoSection } from '@/components/MagicBento'
import { PulseMark } from '@/components/Brand'
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button'
import { cn } from '@/lib/utils'

/** Centered card used by every auth page, over the shared glow background. */
export default function AuthShell({
  title,
  subtitle,
  children,
  lockup = false,
  width = 420,
  icon: Icon = PulseMark,
  /** 'soft' = login's tinted square, 'round' = solid circle, 'solid' = solid square */
  tile = 'soft',
}) {
  const compact = tile !== 'soft'
  const tileClass = {
    soft: 'mb-2 size-12 rounded-lg bg-primary/10',
    round: 'mb-3 size-11 rounded-full bg-primary-container text-on-primary',
    solid: 'mb-3 size-11 rounded-lg bg-primary text-on-primary',
  }[tile]
  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 text-on-surface">
      <EtherBackground />
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex w-full flex-col items-center"
        style={{ maxWidth: width }}
      >
        {/* register puts the brand lockup above the card; login puts the mark inside it */}
        {/* same lockup as the sidebar and landing header */}
        {lockup && (
          <div className="mb-6 flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-xl border border-white/12 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-md">
              <PulseMark className="size-5 text-accent-sky" />
            </span>
            <span className="text-[22px] leading-none font-semibold tracking-[-0.02em] text-on-surface">
              Civic<span className="text-accent-sky">Pulse</span>
            </span>
          </div>
        )}

        {/* Same card treatment as the landing page: glass, border glow, particles */}
        <BentoSection className="w-full">
          <BentoCard className="w-full shadow-xl shadow-black/50" particleCount={10}>
          <div className="relative z-10 flex flex-col items-center gap-1 text-center">
            {!lockup && (
              <span className={cn('flex items-center justify-center', tileClass)}>
                <Icon className={compact ? 'size-5' : 'size-8 text-primary'} />
              </span>
            )}
            <h1
              className={cn(
                'font-semibold tracking-[-0.01em] text-on-surface',
                compact ? 'text-xl' : 'text-[30px] leading-tight',
              )}
            >
              {title}
            </h1>
            {subtitle && <p className="text-base text-on-surface-variant">{subtitle}</p>}
          </div>
          <div className="relative z-10 mt-6">{children}</div>
          </BentoCard>
        </BentoSection>
      </motion.div>
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-white/10 bg-white/[0.05] py-2.5 text-base text-on-surface outline-none transition-all ' +
  'placeholder:text-on-surface-variant/50 focus:border-transparent focus:ring-2 focus:ring-accent-sky'

const labelClass = 'font-label text-sm font-medium tracking-[0.02em] text-on-surface'

export function Field({ label, icon: Icon, className, wrapperClassName, ...props }) {
  return (
    <label className={cn('flex flex-col gap-1', wrapperClassName)}>
      <span className={labelClass}>{label}</span>
      <span className="relative block">
        {Icon && (
          <Icon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-on-surface-variant" />
        )}
        <input {...props} className={cn(inputClass, Icon ? 'pr-4 pl-11' : 'px-4', className)} />
      </span>
    </label>
  )
}

/** Password input with a leading lock and a visibility toggle. */
export function PasswordField({ label, icon: Icon, className, ...props }) {
  const [visible, setVisible] = useState(false)
  const Toggle = visible ? EyeOff : Eye

  return (
    <label className="flex flex-col gap-1">
      <span className={labelClass}>{label}</span>
      <span className="relative block">
        {Icon && (
          <Icon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-on-surface-variant" />
        )}
        <input
          {...props}
          type={visible ? 'text' : 'password'}
          className={cn(inputClass, Icon ? 'pl-11' : 'pl-4', 'pr-11', className)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-on-surface-variant transition-colors hover:text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
        >
          <Toggle className="size-5" />
        </button>
      </span>
    </label>
  )
}

export function SelectField({ label, children, className, ...props }) {
  return (
    <label className="relative flex flex-col gap-1">
      <span className={labelClass}>{label}</span>
      <select
        {...props}
        className={cn(
          'h-10 w-full cursor-pointer appearance-none rounded-lg bg-white/[0.05] px-4 text-base text-on-surface',
          'ring-1 ring-white/10 transition-all outline-none focus:ring-accent-sky',
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 bottom-2.5 size-5 text-on-surface-variant" />
    </label>
  )
}

/**
 * Segmented strength meter. `inline` is register's four bars with a word;
 * `labeled` is the reset screen's three bars over a caption row.
 */
export function PasswordStrength({ value = '', variant = 'inline' }) {
  const checks = [
    value.length >= 6,
    value.length >= 10,
    /[A-Z]/.test(value) && /[a-z]/.test(value),
    /\d/.test(value) && /[^A-Za-z0-9]/.test(value),
  ]
  const score = checks.filter(Boolean).length
  const longEnough = value.length >= 8

  if (variant === 'labeled') {
    const filled = Math.min(score, 3)
    return (
      <div className="mt-2">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`h-1 w-full rounded-full ${i < filled ? 'bg-primary' : 'bg-surface-highest'}`}
            />
          ))}
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="font-label text-xs font-medium text-on-surface">Password strength</span>
          <span
            className={`font-label flex items-center gap-1 text-xs ${longEnough ? 'text-tertiary' : 'text-on-surface-variant'}`}
          >
            {longEnough ? (
              <Check className="size-3.5" aria-hidden="true" />
            ) : (
              <X className="size-3.5" aria-hidden="true" />
            )}
            8+ chars
          </span>
        </div>
      </div>
    )
  }

  if (!value) return null
  const label = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'][score]
  return (
    <div className="mt-1 flex items-center gap-1">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`h-1 w-full rounded-full ${i < score ? 'bg-tertiary-container' : 'bg-surface-highest'}`}
        />
      ))}
      <span className="ml-2 font-label text-xs font-medium tracking-[0.05em] whitespace-nowrap text-tertiary-container">
        {label}
      </span>
    </div>
  )
}

export function Checkbox({ label, ...props }) {
  return (
    <label className="group flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        {...props}
        className="size-4 cursor-pointer rounded-[4px] bg-surface accent-[var(--color-accent-sky)] outline-none focus-visible:ring-2 focus-visible:ring-accent-sky"
      />
      <span className="text-sm text-on-surface-variant transition-colors group-hover:text-on-surface">
        {label}
      </span>
    </label>
  )
}

export function FormError({ children }) {
  if (!children) return null
  return (
    <p role="alert" className="text-sm text-error">
      {children}
    </p>
  )
}

export function FormNotice({ children }) {
  if (!children) return null
  return (
    <p role="status" className="text-sm text-tertiary">
      {children}
    </p>
  )
}

export function Divider({ label = 'Or' }) {
  return (
    <div className="my-6 flex w-full items-center gap-4">
      <span className="h-px flex-1 bg-outline-variant/50" />
      <span className="font-label text-xs font-medium tracking-[0.05em] text-on-surface-variant uppercase">
        {label}
      </span>
      <span className="h-px flex-1 bg-outline-variant/50" />
    </div>
  )
}

/** Primary action — the landing page's hover-fill pill. */
export function SubmitButton({ busy, busyLabel, children }) {
  return (
    <InteractiveHoverButton
      type="submit"
      disabled={busy}
      text={busy ? busyLabel : children}
      className="mt-2 w-full py-4 disabled:opacity-70"
    />
  )
}

/** Full page reload on purpose — OAuth is a redirect flow, not an XHR. */
export function GoogleButton() {
  return (
    <a
      href={`${api.defaults.baseURL}/api/auth/google`}
      className="flex w-full items-center justify-center gap-4 rounded-full border border-white/15 bg-white/[0.06] py-4 font-label text-sm font-medium tracking-[0.02em] text-on-surface backdrop-blur-md transition-colors hover:bg-white/[0.12] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-accent-sky focus-visible:outline-none"
    >
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M23.5 12.3c0-.9-.1-1.5-.2-2.2H12v4.2h6.6c-.1 1.1-.8 2.7-2.4 3.8v3.1h4c2.3-2.2 3.3-5.2 3.3-8.9z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-4-3.1c-1 .7-2.4 1.2-3.9 1.2-3.1 0-5.7-2-6.6-4.9H1.3v3.2C3.3 21.4 7.3 24 12 24z"
        />
        <path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.5H1.3a12 12 0 0 0 0 11z" />
        <path
          fill="#EA4335"
          d="M12 4.7c1.8 0 3.3.6 4.5 1.7l3.4-3.3C17.9 1.2 15.2 0 12 0 7.3 0 3.3 2.6 1.3 6.5l4.1 3.2C6.3 6.8 8.9 4.7 12 4.7z"
        />
      </svg>
      Continue with Google
    </a>
  )
}
