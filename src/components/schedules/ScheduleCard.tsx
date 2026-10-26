/**
 * ScheduleCard — compact card for a single schedule.
 * Shows: type badge, direction, amount, progress bar, claimable, claim/cancel actions.
 */

import { useState, useEffect } from 'react'
import { formatUnits } from 'viem'
import { type Hex, type Address } from 'viem'
import { motion } from 'framer-motion'
import { Clock, CheckCircle2, XCircle, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  type ScheduleData,
  ScheduleType,
  SCHEDULE_TYPE_LABELS,
  claimableNow,
  claimProgress,
  isComplete,
  scheduleDescription,
} from '../../lib/schedules'
import { TxStatus } from '../shared/TxStatus'
import { useClaim, useCancel } from '../../hooks/useScheduledPayouts'
import { StreamTicker } from './StreamTicker'

const TYPE_COLORS: Record<number, { bg: string; text: string }> = {
  [ScheduleType.PayLater]:  { bg: 'rgba(27,31,75,0.07)',    text: 'var(--ink)' },
  [ScheduleType.Allowance]: { bg: 'rgba(16,97,166,0.10)',   text: '#0c5fa8' },
  [ScheduleType.Vesting]:   { bg: 'rgba(26,128,71,0.10)',   text: '#156b3a' },
  [ScheduleType.Payroll]:   { bg: 'rgba(126,58,243,0.10)',  text: '#6d28d9' },
  [ScheduleType.Streaming]: { bg: 'rgba(242,169,0,0.12)',   text: '#b47900' },
}

interface ScheduleCardProps {
  scheduleId: Hex
  schedule: ScheduleData
  /** Connected wallet address — used to show correct action buttons */
  viewer: Address
}

export function ScheduleCard({ scheduleId, schedule, viewer }: ScheduleCardProps) {
  // nowSec lives in state so Date.now is never called during render
  const [nowSec, setNowSec] = useState<bigint>(() => BigInt(Math.floor(performance.timeOrigin / 1000) + Math.floor(performance.now() / 1000)))
  useEffect(() => {
    const id = setInterval(() => setNowSec(BigInt(Math.floor(performance.timeOrigin / 1000) + Math.floor(performance.now() / 1000))), 5000)
    return () => clearInterval(id)
  }, [])

  const claimable = claimableNow(schedule, nowSec)
  const progress = claimProgress(schedule)
  const complete = isComplete(schedule)
  const isSender = viewer.toLowerCase() === schedule.sender.toLowerCase()
  const typeColor = TYPE_COLORS[schedule.scheduleType] ?? TYPE_COLORS[ScheduleType.PayLater]

  const { claim, hash: claimHash, isPending: claiming, isConfirming: claimConfirming, isSuccess: claimSuccess, isError: claimError, error: claimErr, reset: claimReset } = useClaim()
  const { cancel, hash: cancelHash, isPending: cancelling, isConfirming: cancelConfirming, isSuccess: cancelSuccess, isError: cancelError, error: cancelErr, reset: cancelReset } = useCancel()

  const counterpart = isSender ? schedule.recipient : schedule.sender
  const dirLabel = isSender ? 'To' : 'From'
  const short = `${counterpart.slice(0, 6)}…${counterpart.slice(-4)}`

  const totalFmt = parseFloat(formatUnits(schedule.totalAmount, 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const claimedFmt = parseFloat(formatUnits(schedule.claimed, 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: schedule.cancelled ? 'rgba(186,43,76,0.04)' : 'rgba(255,255,255,0.72)',
        border: schedule.cancelled ? '1px solid rgba(186,43,76,0.15)' : '1px solid rgba(27,31,75,0.08)',
        boxShadow: '0 2px 12px rgba(27,31,75,0.05)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shrink-0"
            style={{ background: typeColor.bg, color: typeColor.text, letterSpacing: '0.07em' }}
          >
            {SCHEDULE_TYPE_LABELS[schedule.scheduleType]}
          </span>
          <span className="text-xs truncate" style={{ color: 'var(--muted)' }}>
            {dirLabel} <span className="font-mono">{short}</span>
          </span>
        </div>
        {/* Status icon */}
        <span className="shrink-0">
          {schedule.cancelled
            ? <XCircle className="size-4" style={{ color: 'var(--danger)' }} />
            : complete
            ? <CheckCircle2 className="size-4" style={{ color: 'var(--success)' }} />
            : <Clock className="size-4" style={{ color: 'var(--muted)' }} />}
        </span>
      </div>

      {/* Amount + description */}
      <div className="px-4 pb-3">
        <div className="flex items-baseline gap-1.5">
          <span className="display text-2xl font-bold tabular-nums" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            {totalFmt}
          </span>
          <span className="text-sm" style={{ color: 'var(--subtle)' }}>USDC</span>
        </div>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
          {scheduleDescription(schedule)}
        </p>
      </div>

      {/* Progress bar */}
      {!schedule.cancelled && (
        <div className="px-4 pb-3">
          <div className="flex justify-between text-[10px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>
            <span>Claimed {claimedFmt} USDC</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(27,31,75,0.08)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, background: complete ? 'var(--success)' : '#F2A900' }}
            />
          </div>
        </div>
      )}

      {/* Live stream ticker */}
      {schedule.scheduleType === ScheduleType.Streaming && !schedule.cancelled && !complete && (
        <div className="px-4 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--muted)' }}>
            Claimable now
          </p>
          <StreamTicker schedule={schedule} className="text-sm font-bold" />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 pb-4">
        {/* Claim button — shown to recipient or anyone if claimable > 0 */}
        {!schedule.cancelled && !complete && claimable > 0n && (
          <button
            onClick={() => claim(scheduleId)}
            disabled={claiming || claimConfirming}
            className="btn-primary flex-1 text-sm py-2.5 rounded-xl"
            style={{ minHeight: 44 }}
          >
            {claiming || claimConfirming ? 'Claiming…' : 'Claim'}
          </button>
        )}

        {/* Cancel button — sender only, revocable, not cancelled, not complete */}
        {isSender && schedule.revocable && !schedule.cancelled && !complete && (
          <button
            onClick={() => cancel(scheduleId)}
            disabled={cancelling || cancelConfirming}
            className="btn-secondary flex-1 text-sm py-2.5 rounded-xl"
            style={{ minHeight: 44 }}
          >
            {cancelling || cancelConfirming ? 'Cancelling…' : 'Cancel'}
          </button>
        )}

        {/* Detail link */}
        <Link
          to={`/schedules/${scheduleId}`}
          className="flex items-center justify-center rounded-xl transition-all hover:opacity-70"
          style={{ minHeight: 44, minWidth: 44, background: 'rgba(27,31,75,0.05)' }}
          aria-label="View schedule details"
        >
          <ChevronRight className="size-4" style={{ color: 'var(--ink)' }} />
        </Link>
      </div>

      {/* Tx status inline */}
      {(claiming || claimConfirming || claimSuccess || claimError) && (
        <div className="px-4 pb-4">
          <TxStatus isPending={claiming} isConfirming={claimConfirming} isSuccess={claimSuccess} isError={claimError} error={claimErr} hash={claimHash} successMessage="Claimed successfully." onDismiss={claimReset} />
        </div>
      )}
      {(cancelling || cancelConfirming || cancelSuccess || cancelError) && (
        <div className="px-4 pb-4">
          <TxStatus isPending={cancelling} isConfirming={cancelConfirming} isSuccess={cancelSuccess} isError={cancelError} error={cancelErr} hash={cancelHash} successMessage="Schedule cancelled." onDismiss={cancelReset} />
        </div>
      )}
    </motion.div>
  )
}
