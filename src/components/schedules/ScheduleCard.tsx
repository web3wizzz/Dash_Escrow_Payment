/**
 * ScheduleCard — compact card for a single schedule.
 * Shows: type badge, direction, amount, progress, claimable, actions.
 */

import { useState, useEffect } from 'react'
import { formatUnits } from 'viem'
import { type Hex, type Address } from 'viem'
import { motion } from 'framer-motion'
import { Clock, CheckCircle2, XCircle, ChevronRight, Loader2 } from 'lucide-react'
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
  [ScheduleType.PayLater]:  { bg: 'rgba(16,25,52,0.07)',    text: 'var(--navy)' },
  [ScheduleType.Allowance]: { bg: 'rgba(16,97,166,0.10)',   text: '#0c5fa8' },
  [ScheduleType.Vesting]:   { bg: 'rgba(24,165,139,0.13)',  text: 'var(--success-text)' },
  [ScheduleType.Payroll]:   { bg: 'rgba(126,58,243,0.10)',  text: '#6d28d9' },
  [ScheduleType.Streaming]: { bg: 'var(--gold-muted)',       text: '#9A6E00' },
}

interface ScheduleCardProps {
  scheduleId: Hex
  schedule: ScheduleData
  viewer: Address
}

export function ScheduleCard({ scheduleId, schedule, viewer }: ScheduleCardProps) {
  const [nowSec, setNowSec] = useState<bigint>(
    () => BigInt(Math.floor(performance.timeOrigin / 1000) + Math.floor(performance.now() / 1000))
  )
  useEffect(() => {
    const id = setInterval(
      () => setNowSec(BigInt(Math.floor(performance.timeOrigin / 1000) + Math.floor(performance.now() / 1000))),
      5000
    )
    return () => clearInterval(id)
  }, [])

  const claimable = claimableNow(schedule, nowSec)
  const progress = claimProgress(schedule)
  const complete = isComplete(schedule)
  const isSender = viewer.toLowerCase() === schedule.sender.toLowerCase()
  const typeColor = TYPE_COLORS[schedule.scheduleType] ?? TYPE_COLORS[ScheduleType.PayLater]

  const {
    claim, hash: claimHash, isPending: claiming, isConfirming: claimConfirming,
    isSuccess: claimSuccess, isError: claimError, error: claimErr, reset: claimReset,
  } = useClaim()
  const {
    cancel, hash: cancelHash, isPending: cancelling, isConfirming: cancelConfirming,
    isSuccess: cancelSuccess, isError: cancelError, error: cancelErr, reset: cancelReset,
  } = useCancel()

  const counterpart = isSender ? schedule.recipient : schedule.sender
  const dirLabel = isSender ? 'To' : 'From'
  const short = `${counterpart.slice(0, 6)}…${counterpart.slice(-4)}`

  const totalFmt = parseFloat(formatUnits(schedule.totalAmount, 6)).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
  const claimedFmt = parseFloat(formatUnits(schedule.claimed, 6)).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.20, ease: [0.25, 0.1, 0.25, 1] }}
      className="rounded-3xl overflow-hidden"
      style={{
        background: schedule.cancelled ? 'rgba(192,51,74,0.03)' : 'var(--surface-elevated)',
        border: schedule.cancelled
          ? '1px solid rgba(192,51,74,0.14)'
          : '1px solid var(--border)',
        boxShadow: '0 2px 10px rgba(16,25,52,0.05)',
      }}
    >
      {/* Type stripe */}
      <div className="h-0.5" style={{ background: typeColor.text, opacity: 0.35 }} />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest shrink-0"
            style={{ background: typeColor.bg, color: typeColor.text, letterSpacing: '0.08em' }}
          >
            {SCHEDULE_TYPE_LABELS[schedule.scheduleType]}
          </span>
          <span className="text-xs truncate" style={{ color: 'var(--muted)' }}>
            {dirLabel} <span className="mono text-[11px]">{short}</span>
          </span>
        </div>
        <span className="shrink-0">
          {schedule.cancelled
            ? <XCircle className="size-4" style={{ color: 'var(--danger)' }} />
            : complete
            ? <CheckCircle2 className="size-4" style={{ color: 'var(--success)' }} />
            : <Clock className="size-4" style={{ color: 'var(--muted)' }} />}
        </span>
      </div>

      {/* Amount */}
      <div className="px-4 pb-3">
        <div className="flex items-baseline gap-1.5">
          <span
            className="display text-2xl font-bold tabular-nums"
            style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
          >
            {totalFmt}
          </span>
          <span className="text-sm font-semibold" style={{ color: 'var(--subtle)' }}>USDC</span>
        </div>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
          {scheduleDescription(schedule)}
        </p>
      </div>

      {/* Progress bar */}
      {!schedule.cancelled && (
        <div className="px-4 pb-3">
          <div className="flex justify-between text-[11px] font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>
            <span>Claimed {claimedFmt} USDC</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-muted)' }}>
            <motion.div
              className="h-full rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{ background: complete ? 'var(--success)' : 'var(--gold)' }}
            />
          </div>
        </div>
      )}

      {/* Streaming ticker */}
      {schedule.scheduleType === ScheduleType.Streaming && !schedule.cancelled && !complete && (
        <div className="px-4 pb-2">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--muted)', letterSpacing: '0.09em' }}>
            Claimable now
          </p>
          <StreamTicker schedule={schedule} className="display text-sm font-bold tabular-nums" />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 pb-4">
        {!schedule.cancelled && !complete && claimable > 0n && (
          <button
            onClick={() => claim(scheduleId)}
            disabled={claiming || claimConfirming}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-sm font-bold transition-all active:scale-95 disabled:opacity-40"
            style={{
              background: '#F3B51C',
              color: '#0A0F1E',
              boxShadow: '0 2px 8px rgba(243,181,28,0.30)',
              minHeight: 44,
            }}
          >
            {(claiming || claimConfirming) && <Loader2 className="size-3.5 animate-spin" />}
            {claiming || claimConfirming ? 'Claiming…' : 'Claim'}
          </button>
        )}

        {isSender && schedule.revocable && !schedule.cancelled && !complete && (
          <button
            onClick={() => cancel(scheduleId)}
            disabled={cancelling || cancelConfirming}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-sm font-bold transition-all active:scale-95 disabled:opacity-40"
            style={{
              background: 'var(--danger-muted)',
              color: 'var(--danger)',
              border: '1px solid rgba(192,51,74,0.20)',
              minHeight: 44,
            }}
          >
            {(cancelling || cancelConfirming) && <Loader2 className="size-3.5 animate-spin" />}
            {cancelling || cancelConfirming ? 'Cancelling…' : 'Cancel'}
          </button>
        )}

        <Link
          to={`/schedules/${scheduleId}`}
          className="flex items-center justify-center rounded-2xl transition-all hover:bg-opacity-70 active:scale-95"
          style={{ minHeight: 44, minWidth: 44, background: 'var(--surface-muted)' }}
          aria-label="View schedule details"
        >
          <ChevronRight className="size-4" style={{ color: 'var(--ink)' }} />
        </Link>
      </div>

      {/* TX status */}
      {(claiming || claimConfirming || claimSuccess || claimError) && (
        <div className="px-4 pb-4">
          <TxStatus
            isPending={claiming} isConfirming={claimConfirming}
            isSuccess={claimSuccess} isError={claimError}
            error={claimErr} hash={claimHash}
            successMessage="Claimed successfully." onDismiss={claimReset}
          />
        </div>
      )}
      {(cancelling || cancelConfirming || cancelSuccess || cancelError) && (
        <div className="px-4 pb-4">
          <TxStatus
            isPending={cancelling} isConfirming={cancelConfirming}
            isSuccess={cancelSuccess} isError={cancelError}
            error={cancelErr} hash={cancelHash}
            successMessage="Schedule cancelled." onDismiss={cancelReset}
          />
        </div>
      )}
    </motion.div>
  )
}
