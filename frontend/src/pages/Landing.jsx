import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Brain, Camera, Gauge, ShieldCheck } from 'lucide-react'

import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button'

import BlurText from '@/components/BlurText'
import FoldText from '@/components/FoldText'
import EtherBackground from '@/components/EtherBackground'
import MagicBento, { BentoCard, BentoSection } from '@/components/MagicBento'
import { Logo, PulseMark } from '@/components/Brand'
import { CountUp } from '@/components/motion'
import { HOME_FOR, useAuth } from '@/context/AuthContext'

/** Same numbers the backend scores with — kept in sync with services/priority.py. */
const ISSUE_WEIGHTS = {
  Pothole: 10,
  'Broken Light': 8,
  'Water Leakage': 7,
  Garbage: 5,
  Other: 3,
}
const URGENCY_MULTIPLIERS = { High: 3, Medium: 2, Low: 1 }

const STEPS = [
  {
    icon: Camera,
    title: 'Snap and describe',
    body: 'Upload a photo of the pothole, overflowing bin or leaking main, add a line about it and pick the district.',
  },
  {
    icon: Brain,
    title: 'Two models read it',
    body: 'Cloud Vision classifies the photo into an issue type. A TF-IDF urgency classifier reads your words and rates them Low, Medium or High.',
  },
  {
    icon: Gauge,
    title: 'It jumps the queue, or waits',
    body: 'Issue weight times urgency multiplier gives a priority score. The officer for that district sees the worst thing first, and you get an email at every status change.',
  },
]

/* The six feature cards live in MagicBento's own cardData. */

const ROLES = [
  { title: 'Citizen', body: 'Report issues, track your own complaints, get notified. You see your reports and nothing else.' },
  { title: 'Officer', body: 'One district, one queue, sorted by priority score. Update status as work progresses.' },
  { title: 'Admin', body: 'Every complaint, every officer account, analytics, the heatmap and the report export.' },
]

const rise = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
}

function Section({ id, eyebrow, title, blurb, children }) {
  return (
    <section id={id} className="mx-auto w-full max-w-6xl px-6 py-20 sm:py-24">
      <motion.div {...rise} className="max-w-2xl">
        <p className="font-label text-xs font-medium tracking-[0.18em] text-primary uppercase">
          {eyebrow}
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.02em] text-on-surface sm:text-4xl">
          <FoldText
            text={title}
            splitBy="word"
            hinge="top"
            trigger="scroll"
            duration={1.05}
            stagger={0.085}
            fontSize="inherit"
            fontWeight="inherit"
            color="currentColor"
          />
        </h2>
        {blurb && <p className="mt-3 text-base text-on-surface-variant">{blurb}</p>}
      </motion.div>
      <div className="mt-12">{children}</div>
    </section>
  )
}

/** The scoring rule itself, made pokeable — this is what the whole system turns on. */
function ScoreDial() {
  const [issue, setIssue] = useState('Pothole')
  const [urgency, setUrgency] = useState('High')
  const score = ISSUE_WEIGHTS[issue] * URGENCY_MULTIPLIERS[urgency]
  const band =
    score >= 20
      ? { label: 'Critical', color: 'text-error', ring: 'ring-error/40', bar: 'bg-error' }
      : score >= 10
        ? { label: 'Moderate', color: 'text-warning', ring: 'ring-warning/40', bar: 'bg-warning' }
        : { label: 'Low', color: 'text-tertiary', ring: 'ring-tertiary/40', bar: 'bg-tertiary' }

  const chip = (active) =>
    `rounded-full px-3.5 py-1.5 font-label text-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
      active
        ? 'bg-primary text-on-primary'
        : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
    }`

  return (
    <BentoSection>
      <BentoCard className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center" particleCount={10}>
      <div className="flex flex-col gap-6">
        <fieldset>
          <legend className="font-label text-sm font-medium text-on-surface">Issue type</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(ISSUE_WEIGHTS).map(([name, weight]) => (
              <button
                key={name}
                type="button"
                onClick={() => setIssue(name)}
                aria-pressed={issue === name}
                className={chip(issue === name)}
              >
                {name} <span className="opacity-60">×{weight}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="font-label text-sm font-medium text-on-surface">Urgency read from your text</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(URGENCY_MULTIPLIERS).map(([name, mult]) => (
              <button
                key={name}
                type="button"
                onClick={() => setUrgency(name)}
                aria-pressed={urgency === name}
                className={chip(urgency === name)}
              >
                {name} <span className="opacity-60">×{mult}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <p className="font-mono-data text-sm text-on-surface-variant">
          {ISSUE_WEIGHTS[issue]} × {URGENCY_MULTIPLIERS[urgency]} = {score}
        </p>
      </div>

      <div
        className={`flex min-w-56 flex-col items-center justify-center gap-2 rounded-xl bg-surface-container p-8 ring-1 ${band.ring}`}
        aria-live="polite"
      >
        <span className="font-label text-xs tracking-[0.18em] text-on-surface-variant uppercase">
          Priority score
        </span>
        <CountUp
          value={score}
          duration={700}
          className={`font-mono-data text-6xl font-semibold tabular-nums ${band.color}`}
        />
        <span className={`font-label text-sm font-medium ${band.color}`}>{band.label}</span>
        <span className="track mt-2 h-1.5 w-full">
          <span
            className={`track-fill ${band.bar}`}
            style={{ width: `${Math.min(100, (score / 30) * 100)}%` }}
          />
        </span>
      </div>
      </BentoCard>
    </BentoSection>
  )
}

export default function Landing() {
  const { user } = useAuth()
  if (user) return <Navigate to={HOME_FOR[user.role] || '/login'} replace />

  return (
    <div className="relative min-h-screen text-on-surface">
      <EtherBackground />

      {/* Floating glass pill, not a full-width bar — the fluid stays visible around it */}
      <header className="fixed inset-x-0 top-4 z-30 px-4 sm:top-6">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between rounded-2xl border border-white/10 bg-white/[0.06] px-3 shadow-[0_8px_32px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl sm:px-6">
          <Logo />
          <nav className="flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-lg px-4 py-2 font-label text-sm font-medium text-accent-sky transition-colors hover:text-on-surface focus-visible:ring-2 focus-visible:ring-accent-sky focus-visible:outline-none"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="rounded-lg bg-accent-sky px-4 py-2 font-label text-sm font-medium text-on-accent-sky transition-colors hover:bg-accent-sky/85 focus-visible:ring-2 focus-visible:ring-accent-sky focus-visible:outline-none"
            >
              Sign up
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative flex min-h-screen items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none mx-auto w-full max-w-3xl px-6 pt-24 pb-16 text-center"
        >
          <span className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-outline-variant/50 bg-surface-low/70 px-3.5 py-1.5 font-label text-xs tracking-[0.08em] text-on-surface-variant backdrop-blur-sm">
            <PulseMark className="size-4 text-accent-sky" />
            AI-ranked civic complaints
          </span>

          <div className="mt-6 text-4xl leading-[1.05] font-semibold tracking-[-0.03em] sm:text-6xl">
            <BlurText
              as="h1"
              text="The pothole that hurts someone"
              delay={70}
              animateBy="words"
              direction="top"
              className="justify-center text-on-surface"
            />
            <BlurText
              text="should not wait behind a poster."
              delay={70}
              stepDuration={0.4}
              animateBy="words"
              direction="top"
              className="justify-center text-primary"
            />
          </div>

          <p className="mx-auto mt-6 max-w-xl text-lg text-on-surface-variant">
            CivicPulse reads the photo and the words in every complaint, scores how badly it
            needs attention, and hands your municipal officer a queue that is already in the
            right order.
          </p>

          <div className="pointer-events-auto mt-9 flex flex-wrap items-center justify-center gap-3">
            <InteractiveHoverButton as={Link} to="/register" text="Report an issue" className="w-full sm:w-48 py-3.5" />
            <InteractiveHoverButton as={Link} to="/login" text="Sign in" className="w-full sm:w-32 py-3.5" />
          </div>

          <p className="mt-6 font-label text-xs tracking-[0.08em] text-on-surface-variant/80">
            Citizens · Officers · Admins — one account each, nothing shared across roles
          </p>
        </motion.div>
      </section>

      <Section
        id="how"
        eyebrow="How it works"
        title="Three steps, no forms to fight with"
        blurb="You give it a photo and a sentence. Everything after that is automatic."
      >
        <BentoSection className="grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <motion.div key={step.title} {...rise} transition={{ ...rise.transition, delay: i * 0.08 }}>
              <BentoCard className="h-full">
              <div className="flex items-center justify-between">
                <span className="icon-glow flex size-11 items-center justify-center rounded-lg bg-primary/10">
                  <step.icon className="size-5 text-primary" />
                </span>
                <span className="font-mono-data text-sm text-on-surface-variant/60">
                  0{i + 1}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-on-surface">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{step.body}</p>
              </BentoCard>
            </motion.div>
          ))}
        </BentoSection>
      </Section>

      <Section
        id="score"
        eyebrow="The priority score"
        title="Why one complaint outranks another"
        blurb="Every issue type carries a weight, every urgency level a multiplier. Multiply them and you get the number officers sort by. Try it."
      >
        <motion.div {...rise}>
          <ScoreDial />
        </motion.div>
      </Section>

      <Section
        id="features"
        eyebrow="What you get"
        title="Built for the whole chain, not just the complaint box"
      >
        <motion.div {...rise}>
          <MagicBento
            textAutoHide={false}
            enableStars
            enableSpotlight
            enableBorderGlow
            enableTilt={false}
            enableMagnetism
            clickEffect
            spotlightRadius={320}
            particleCount={10}
            glowColor="125, 180, 255"
          />
        </motion.div>
      </Section>

      <Section
        id="roles"
        eyebrow="Access"
        title="Three roles, walled off from each other"
        blurb="Ownership and district checks run on every route, not just in the interface."
      >
        <BentoSection className="grid gap-6 md:grid-cols-3">
          {ROLES.map((r, i) => (
            <motion.div key={r.title} {...rise} transition={{ ...rise.transition, delay: i * 0.08 }}>
              <BentoCard className="h-full">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-tertiary" />
                <h3 className="font-label font-medium tracking-[0.02em] text-on-surface">
                  {r.title}
                </h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">{r.body}</p>
              </BentoCard>
            </motion.div>
          ))}
        </BentoSection>
      </Section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <motion.div
          {...rise}
        >
          <BentoSection>
          <BentoCard className="text-center" particleCount={12}>
          <div className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative py-6 sm:py-10">
            <h2 className="text-3xl font-semibold tracking-[-0.02em] text-on-surface sm:text-4xl">
              <FoldText
                text="Something broken on your street?"
                splitBy="word"
                trigger="scroll"
                duration={1.05}
                stagger={0.085}
                fontSize="inherit"
                fontWeight="inherit"
                color="currentColor"
              />
            </h2>
            <p className="mx-auto mt-3 max-w-md text-on-surface-variant">
              Create a citizen account in under a minute and file your first report.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <InteractiveHoverButton as={Link} to="/register" text="Create account" className="w-full sm:w-44 py-3.5" />
              <InteractiveHoverButton
                as={Link}
                to="/login"
                text="I already have one"
                className="w-full sm:w-52 py-3.5"
              />
            </div>
          </div>
          </BentoCard>
          </BentoSection>
        </motion.div>
      </section>

      <footer className="border-t border-outline-variant/25">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <PulseMark className="size-5 text-accent-sky" />
            <span className="font-label text-sm">Civic<span className="text-accent-sky">Pulse</span></span>
          </div>
          <div className="flex items-center gap-6 font-label text-sm text-on-surface-variant">
            <Link to="/login" className="transition-colors hover:text-on-surface">
              Sign in
            </Link>
            <Link to="/register" className="transition-colors hover:text-on-surface">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

