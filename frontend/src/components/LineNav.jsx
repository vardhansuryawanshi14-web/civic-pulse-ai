import { useCallback, useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'

import './LineNav.css'

const FALLOFF_CURVES = {
  linear: (p) => p,
  smooth: (p) => p * p * (3 - 2 * p),
  sharp: (p) => p * p * p,
}

/**
 * react-bits LineSidebar, rewired for routing: each row is a real <NavLink>
 * and "active" comes from the current route instead of internal state.
 *
 * A single rAF loop eases every item's --effect toward its target with
 * frame-rate independent smoothing, so colour, shift and the marker line all
 * move together instead of staggering separate CSS transitions.
 */
export default function LineNav({
  items = [],
  onNavigate,
  proximityRadius = 100,
  maxShift = 18,
  falloff = 'smooth',
  markerLength = 28,
  markerGap = 8,
  tickScale = 0.5,
  itemGap = 18,
  smoothing = 100,
  className = '',
}) {
  const listRef = useRef(null)
  const itemRefs = useRef([])
  const targetsRef = useRef([])
  const currentRef = useRef([])
  const rafRef = useRef(null)
  const lastRef = useRef(0)
  const smoothingRef = useRef(smoothing)

  smoothingRef.current = smoothing

  const runFrame = useCallback((now) => {
    const dt = Math.min((now - lastRef.current) / 1000, 0.05)
    lastRef.current = now
    const tau = Math.max(smoothingRef.current, 1) / 1000
    const k = 1 - Math.exp(-dt / tau)

    let moving = false
    const items = itemRefs.current
    for (let i = 0; i < items.length; i++) {
      const el = items[i]
      if (!el) continue
      // an active row stays fully lit even when the pointer is elsewhere
      const active = el.querySelector('[aria-current="page"]') ? 1 : 0
      const target = Math.max(targetsRef.current[i] || 0, active)
      const cur = currentRef.current[i] || 0
      const next = cur + (target - cur) * k
      const settled = Math.abs(target - next) < 0.0015
      const value = settled ? target : next
      currentRef.current[i] = value
      el.style.setProperty('--effect', value.toFixed(4))
      if (!settled) moving = true
    }

    rafRef.current = moving ? requestAnimationFrame(runFrame) : null
  }, [])

  const startLoop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    lastRef.current = performance.now()
    rafRef.current = requestAnimationFrame(runFrame)
  }, [runFrame])

  const handlePointerMove = useCallback(
    (e) => {
      const list = listRef.current
      if (!list) return
      const rect = list.getBoundingClientRect()
      const pointerY = e.clientY - rect.top
      const ease = FALLOFF_CURVES[falloff] ?? FALLOFF_CURVES.linear
      const items = itemRefs.current
      for (let i = 0; i < items.length; i++) {
        const el = items[i]
        if (!el) continue
        const center = el.offsetTop + el.offsetHeight / 2
        const distance = Math.abs(pointerY - center)
        targetsRef.current[i] = ease(Math.max(0, 1 - distance / proximityRadius))
      }
      startLoop()
    },
    [falloff, proximityRadius, startLoop],
  )

  const handlePointerLeave = useCallback(() => {
    targetsRef.current = targetsRef.current.map(() => 0)
    startLoop()
  }, [startLoop])

  // re-settle after a route change so the new active row lights up
  useEffect(() => {
    startLoop()
  })

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    },
    [],
  )

  return (
    <nav
      className={`line-nav${className ? ` ${className}` : ''}`}
      style={{
        '--marker-length': `${markerLength}px`,
        '--marker-gap': `${markerGap}px`,
        '--tick-scale': tickScale,
        '--max-shift': `${maxShift}px`,
        '--item-gap': `${itemGap}px`,
      }}
    >
      <ul
        ref={listRef}
        className="line-nav__list"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {items.map(({ to, label, icon: Icon, badge }, index) => (
          <li
            key={to}
            ref={(el) => {
              itemRefs.current[index] = el
            }}
            className="line-nav__item"
          >
            <span className="line-nav__marker" aria-hidden="true" />
            <NavLink to={to} onClick={onNavigate} className="line-nav__link" end={false}>
              {Icon && <Icon className="size-5 shrink-0" />}
              <span className="line-nav__text">{label}</span>
              {badge > 0 && (
                <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-accent-sky text-[11px] font-semibold text-on-accent-sky">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
