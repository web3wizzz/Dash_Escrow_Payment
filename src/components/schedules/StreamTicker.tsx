/**
 * StreamTicker — real-time per-second USDC counter for Streaming schedules.
 * Uses requestAnimationFrame for 60fps updates.
 * Degrades to a static formatted number under prefers-reduced-motion.
 */

import { useEffect, useRef, useState } from 'react'
import { formatUnits } from 'viem'
import { type ScheduleData, claimableNow } from '../../lib/schedules'

interface StreamTickerProps {
  schedule: ScheduleData
  /** Additional className for the outer span */
  className?: string
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function nowSec(): bigint {
  return BigInt(Math.floor(performance.timeOrigin / 1000) + Math.floor(performance.now() / 1000))
}

export function StreamTicker({ schedule, className }: StreamTickerProps) {
  const reduced = prefersReducedMotion()
  // Lazy initializer avoids calling any time API during render
  const [amount, setAmount] = useState<bigint>(() => claimableNow(schedule, nowSec()))
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (reduced) {
      // Static fallback: one interval update per minute is enough for accessibility
      const id = setInterval(() => { setAmount(claimableNow(schedule, nowSec())) }, 60_000)
      return () => clearInterval(id)
    }

    const tick = () => {
      setAmount(claimableNow(schedule, nowSec()))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [schedule, reduced])

  const display = parseFloat(formatUnits(amount, 6)).toFixed(6)

  return (
    <span
      className={['mono tabular-nums', className].filter(Boolean).join(' ')}
      aria-live={reduced ? 'off' : 'polite'}
      aria-atomic="true"
    >
      {display} USDC
    </span>
  )
}
