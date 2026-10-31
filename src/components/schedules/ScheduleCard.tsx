/**
 * ScheduleCard — refined list row for a single schedule.
 * Progress bar: only for Vesting and Payroll (where % completion is meaningful).
 * Streaming: live per-second ticker only.
 * Pay Later / Allowance: simple status + next-unlock date.
 */

import { useState, useEffect } from 'react'
import { formatUnits } from 'viem'
import { type Hex, type Address } from 'viem'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock, CheckCircle2, XCircle, ChevronRight, Loader2,
  Lock, Unlock, Zap, Users, CalendarClock, ArrowRightLeft,
} from 'lucide-react'
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

/* ── Type palette ── */
const TYPE_META: Record<number, { icon: typeof Clock; hue: string }> = {
  [ScheduleType.PayLater]:  { icon: CalendarClock,   hue: '#6366f1' },
  [ScheduleType.Allowance]: { icon: ArrowRightLeft,  hue: '#0ea5e9' },
  [ScheduleType.Vesting]:   { icon: Lock,            hue: 'var(--success)' },
  [ScheduleType.Payroll]:   { icon: Users,           hue: '#8b5cf6' },
  [ScheduleType.Streaming]: { icon: Zap,             hue: 'var(--saffron)' },
}

function formatDate(ts: bigint): string {
  return new Date(Number(ts) * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  })
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
  const meta = TYPE_META[schedule.scheduleType] ?? TYPE_META[ScheduleType.PayLater]
  const TypeIcon = meta.icon

  const { claim, hash: claimHash, isPending: claiming, isConfirming: claimConfirming,
    isSuccess: claimSuccess, isError: claimError, error: claimErr, reset: claimReset } = useClaim()
  const { cancel, hash: cancelHash, isPending: cancelling, isConfirming: cancelConfirming,
    isSuccess: cancelSuccess, isError: cancelError, error: cancelErr, reset: cancelReset } = useCancel()

  const counterpart = isSender ? schedule.recipient : schedule.sender
  const dirLabel    = isSender ? 'To' : 'From'
  const short       = `${counterpart.slice(0, 6)}…${counterpart.slice(-4)}`

  const totalFmt = parseFloat(formatUnits(schedule.totalAmount, 6)).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })

  /* Show progress bar only for types where % completion is meaningful */
  const showProgress = !schedule.cancelled && (
    schedule.scheduleType === ScheduleType.Vesting ||
    schedule.scheduleType === ScheduleType.Payroll
  )

  /* State label */
  const stateLabel = schedule.cancelled
    ? 'Cancelled'
    : complete
    ? 'Complete'
    : claimable > 0n
    ? 'Claimable'
    : 'Locked'

  const stateColor = schedule.cancelled
    ? 'var(--danger)'
    : complete
    ? 'var(--success)'
    : claimable > 0n
    ? '#9A6E00'
    : 'var(--subtle)'

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
      className="overflow-hidden"
      style={{
        background: 'var(--surface)',
        border: `1px solid ${schedule.cancelled ? 'rgba(192,51,74,0.14)' : 'var(--border)'}`,
        borderRadius: 16,
      }}
    >
      {/* ── Main row ── */}
      <div className="flex items-center gap-3 px-4 py-3.5">

        {/* Type icon */}
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: 38, height: 38,
            background: `${meta.hue}18`,
            borderRadius: 10,
          }}
        >
          <TypeIcon className="size-4" style={{ color: meta.hue }} strokeWidth={1.8} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>
              {SCHEDULE_TYPE_LABELS[schedule.scheduleType]}
            </span>
            <span
              className="display text-sm font-bold tabular-nums shrink-0"
              style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
            >
              {totalFmt} <span className="text-xs font-semibold" style={{ color: 'var(--subtle)' }}>USDC</span>
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs truncate" style={{ color: 'var(--muted)' }}>
              {dirLabel}{' '}
              <span className="mono text-[11px]">{short}</span>
              {' · '}
              <span>{scheduleDescription(schedule)}</span>
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {/* State indicator */}
              {schedule.cancelled
                ? <XCircle className="size-3" style={{ color: 'var(--danger)' }} />
                : complete
                ? <CheckCircle2 className="size-3" style={{ color: 'var(--success)' }} />
                : claimable > 0n
                ? <Unlock className="size-3" style={{ color: '#9A6E00' }} />
                : <Lock className="size-3" style={{ color: 'var(--subtle)' }} />
              }
              <span className="text-[10px] font-semibold" style={{ color: stateColor }}>
                {stateLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Chevron */}
        <Link
          to={`/schedules/${scheduleId}`}
          className="shrink-0 flex items-center justify-center transition-all active:scale-90"
          aria-label="View details"
        >
          <ChevronRight className="size-4" style={{ color: 'var(--subtle)' }} />
        </Link>
      </div>

      {/* ── Streaming ticker ── */}
      {schedule.scheduleType === ScheduleType.Streaming && !schedule.cancelled && !complete && (
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ background: 'rgba(242,169,0,0.06)', borderTop: '1px solid rgba(242,169,0,0.12)' }}
        >
          <span className="text-[11px] font-semibold" style={{ color: '#9A6E00' }}>Streaming now</span>
          <StreamTicker schedule={schedule} className="display text-sm font-bold tabular-nums" />
        </div>
      )}

      {/* ── Progress bar (vesting / payroll only) ── */}
      {showProgress && (
        <div className="px-4 pb-3.5 pt-0">
          <div className="flex justify-between text-[10px] font-semibold mb-1.5" style={{ color: 'var(--subtle)' }}>
            <span>{progress}% vested</span>
            {schedule.endTime > 0n && (
              <span>Until {formatDate(schedule.endTime)}</span>
            )}
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--surface-muted)' }}>
            <motion.div
              className="h-full rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              style={{ background: complete ? 'var(--success)' : meta.hue }}
            />
          </div>
        </div>
      )}

      {/* ── Claimable row ── */}
      {!schedule.cancelled && !complete && claimable > 0n && (
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <div className="flex-1">
            <p className="text-[11px] font-semibold" style={{ color: 'var(--muted)' }}>Claimable now</p>
            <p
              className="display text-base font-bold tabular-nums"
              style={{ color: '#9A6E00', letterSpacing: '-0.02em' }}
            >
              {parseFloat(formatUnits(claimable, 6)).toFixed(6)} USDC
            </p>
          </div>
          <button
            onClick={() => claim(scheduleId)}
            disabled={claiming || claimConfirming}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold rounded-xl transition-all active:scale-95 disabled:opacity-40"
            style={{
              background: 'var(--saffron)',
              color: '#0A0F1E',
              boxShadow: '0 2px 8px rgba(242,169,0,0.25)',
            }}
          >
            {(claiming || claimConfirming) && <Loader2 className="size-3.5 animate-spin" />}
            {claiming || claimConfirming ? 'Claiming…' : 'Claim'}
          </button>
        </div>
      )}

      {/* ── Cancel row ── */}
      {isSender && schedule.revocable && !schedule.cancelled && !complete && (
        <div
          className="flex items-center justify-end px-4 py-2.5"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <button
            onClick={() => cancel(scheduleId)}
            disabled={cancelling || cancelConfirming}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all active:scale-95 disabled:opacity-40"
            style={{ background: 'var(--danger-muted)', color: 'var(--danger)' }}
          >
            {(cancelling || cancelConfirming) && <Loader2 className="size-3 animate-spin" />}
            {cancelling || cancelConfirming ? 'Cancelling…' : 'Cancel schedule'}
          </button>
        </div>
      )}

      {/* ── TX status ── */}
      <AnimatePresence>
        {(claiming || claimConfirming || claimSuccess || claimError) && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-0">
              <TxStatus isPending={claiming} isConfirming={claimConfirming}
                isSuccess={claimSuccess} isError={claimError}
                error={claimErr} hash={claimHash}
                successMessage="Claimed successfully." onDismiss={claimReset} />
            </div>
          </motion.div>
        )}
        {(cancelling || cancelConfirming || cancelSuccess || cancelError) && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-0">
              <TxStatus isPending={cancelling} isConfirming={cancelConfirming}
                isSuccess={cancelSuccess} isError={cancelError}
                error={cancelErr} hash={cancelHash}
                successMessage="Cancelled." onDismiss={cancelReset} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
