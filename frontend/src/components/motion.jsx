import { useEffect, useRef } from 'react'
import { useInView, useMotionValue, useSpring } from 'framer-motion'

import AnimatedContent from '@/components/AnimatedContent'

/**
 * Wraps a route's content so navigating lifts and fades it into place
 * (react-bits AnimatedContent). AppLayout keys this on the pathname, so it
 * replays on every navigation.
 */
export function PageTransition({ children }) {
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  if (reduced) return children

  return (
    <AnimatedContent distance={28} duration={0.55} ease="power3.out" scale={0.985} threshold={0.05}>
      {children}
    </AnimatedContent>
  )
}

/**
 * Spring-driven count-up (react-bits CountUp), started when the number scrolls
 * into view and re-run whenever `value` changes. Respects reduced motion.
 * `duration` is in ms and shapes the spring, it is not a fixed timing.
 */
export function CountUp({ value, duration = 900, className, separator = '' }) {
  const ref = useRef(null)
  const inView = useInView(ref, { margin: '-40px' })
  const target = Number(value) || 0

  const seconds = duration / 1000
  const motionValue = useMotionValue(0)
  const spring = useSpring(motionValue, {
    damping: 20 + 40 * (1 / seconds),
    stiffness: 100 * (1 / seconds),
  })

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return motionValue.jump(target)
    if (inView) motionValue.set(target)
  }, [inView, target, motionValue])

  useEffect(() => {
    const format = (n) => {
      const text = Intl.NumberFormat('en-US', {
        useGrouping: !!separator,
        maximumFractionDigits: 0,
      }).format(n)
      return separator ? text.replace(/,/g, separator) : text
    }
    if (ref.current) ref.current.textContent = format(spring.get())
    return spring.on('change', (latest) => {
      if (ref.current) ref.current.textContent = format(latest)
    })
  }, [spring, separator])

  return <span ref={ref} className={className} />
}
