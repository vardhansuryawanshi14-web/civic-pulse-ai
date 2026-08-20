import { Suspense, lazy } from 'react'

// three.js is ~600 kB of the bundle and this is pure decoration, so it loads
// after the page is interactive rather than blocking first paint.
const LiquidEther = lazy(() => import('@/components/LiquidEther'))

const reduceMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * The cursor-reactive fluid field, shared by the landing page and the auth
 * screens so they stay identical. It listens on window, so pointer-events-none
 * keeps the page clickable while the fluid still follows the cursor.
 */
export default function EtherBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
      {!reduceMotion && (
        <Suspense fallback={null}>
          <LiquidEther
            colors={['#3B82F6', '#7DD3FC', '#ADC6FF']}
            mouseForce={14}
            cursorSize={100}
            resolution={0.5}
            autoDemo
            autoSpeed={0.32}
            autoIntensity={1.6}
          />
        </Suspense>
      )}
      <div className="absolute inset-0 bg-background/50" />
    </div>
  )
}
