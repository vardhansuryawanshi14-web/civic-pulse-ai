import React, { useState } from 'react'
import { ArrowRight } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Hover fills the pill from the left edge, in the light blue of the landing
 * page's liquid-ether field rather than the stock white.
 *
 * Touch mirrors hover: a finger down fills the pill and holds it until the
 * finger lifts, since `:hover` on a phone flashes for a frame at most.
 *
 * `as` lets it render a router `<Link>` (or an `<a>`) instead of a `<button>`,
 * so navigation stays a real link rather than a button wrapped in an anchor.
 */
const InteractiveHoverButton = React.forwardRef(
  (
    { text = 'Button', className, as: Comp = 'button', children, onTouchStart, onTouchEnd, ...props },
    ref,
  ) => {
    const [touched, setTouched] = useState(false)

    const startTouch = (e) => {
      setTouched(true)
      onTouchStart?.(e)
    }
    const endTouch = (e) => {
      setTouched(false)
      onTouchEnd?.(e)
    }

    return (
      <Comp
        ref={ref}
        onTouchStart={startTouch}
        onTouchEnd={endTouch}
        onTouchCancel={endTouch}
        className={cn(
          'group relative w-32 cursor-pointer overflow-hidden rounded-full border border-white/15',
          'bg-white/[0.06] p-2 text-center font-label text-sm font-medium tracking-[0.02em]',
          'text-on-surface backdrop-blur-md transition-colors',
          'focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
          className,
        )}
        {...props}
      >
        <span
          className={cn(
            'inline-block transition-all duration-300 group-hover:translate-x-12 group-hover:opacity-0',
            touched && 'translate-x-12 opacity-0',
          )}
        >
          {text}
        </span>
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-0 left-0 z-10 flex h-full w-full translate-x-12 items-center justify-center gap-2',
            'text-on-accent-sky opacity-0 transition-all duration-300',
            'group-hover:translate-x-0 group-hover:opacity-100',
            touched && 'translate-x-0 opacity-100',
          )}
        >
          {text}
          <ArrowRight className="size-4" />
        </span>
        {/* No resting dot — the fill grows out of the left edge only on hover */}
        <span
          className={cn(
            'absolute top-1/2 left-0 h-0 w-0 rounded-full bg-accent-sky opacity-0 transition-all duration-300',
            'group-hover:top-0 group-hover:h-full group-hover:w-full group-hover:opacity-100',
            touched && 'top-0 h-full w-full opacity-100',
          )}
        />
        {children}
      </Comp>
    )
  },
)

InteractiveHoverButton.displayName = 'InteractiveHoverButton'

export { InteractiveHoverButton }
