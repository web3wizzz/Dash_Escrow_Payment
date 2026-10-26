/**
 * ScheduleDetail — full single-schedule view with timeline, claim/cancel, explorer link.
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { type Hex } from 'viem'
import { formatUnits } from 'viem'
import { useAccount } from 'wagmi'
import { ArrowLeft, ExternalLink, Loader2, AlertCircle } from 'lucide-react'
import { useSchedule, useClaim, useCancel, useWithdraw, SCHEDULED_PAYOUTS_ADDRESS } from '../hooks/useScheduledPayouts'
import {
  ScheduleType,
  SCHEDULE_TYPE_LABELS,
  claimableNow,
  scheduleDescription,
  claimProgress,
} from '../lib/schedules'
import { TxStatus } from '../components/shared/TxStatus'
import { StreamTicker } from '../components/schedules/StreamTicker'
import { buildTxExplorerUrl } from '../onchain-facts'
import { TARGET_CHAIN_ID } from '../config'

function fmt(amount: bigint, decimals = 6) {
  return parseFloat(formatUnits(amount, decimals)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
}

function fmtDate(sec: bigint) {
  if (sec === 0n) return '—'
  return new Date(Number(sec) * 1000).toLocaleString()
}

export function ScheduleDetail() {
  const { scheduleId } = useParams<{ scheduleId: string }>()
  const navigate = useNavigate()
  const { address } = useAccount()

  const id = scheduleId as Hex | undefined

  const { schedule, isLoading, isError } = useSchedule(id && id.startsWith('0x') ? id : undefined)

  const { claim, hash: claimHash, isPending: claiming, isConfirming: claimConfirming, isSuccess: claimSuccess, isError: claimError, error: claimErr, reset: claimReset } = useClaim()
  const { cancel, hash: cancelHash, isPending: cancelling, isConfirming: cancelConfirming, isSuccess: cancelSuccess, isError: cancelError, error: cancelErr, reset: cancelReset } = useCancel()
  const { withdraw, hash: wdHash, isPending: withdrawing, isConfirming: wdConfirming, isSuccess: wdSuccess, isError: wdError, error: wdErr, reset: wdReset } = useWithdraw()

  // Hooks MUST be called unconditionally — before any early returns
  const [nowSec, setNowSec] = useState<bigint>(() => BigInt(Math.floor(performance.timeOrigin / 1000) + Math.floor(performance.now() / 1000)))
  useEffect(() => {
    const timerId = setInterval(() => setNowSec(BigInt(Math.floor(performance.timeOrigin / 1000) + Math.floor(performance.now() / 1000))), 5000)
    return () => clearInterval(timerId)
  }, [])

  if (!id || !id.startsWith('0x')) {
    return (
      <div className="space-y-3 pt-4">
        <button onClick={() => { void navigate('/schedules') }} className="flex items-center gap-1.5 text-sm font-semibold min-h-[44px]" style={{ color: 'var(--muted)' }}>
          <ArrowLeft className="size-4" /> Schedules
        </button>
        <p className="text-sm" style={{ color: 'var(--danger)' }}>Invalid schedule ID.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20" style={{ color: 'var(--muted)' }}>
        <Loader2 className="size-5 animate-spin" />
        <span className="text-sm">Loading schedule…</span>
      </div>
    )
  }

  if (isError || !schedule) {
    return (
      <div className="space-y-3 pt-4">
        <button onClick={() => { void navigate('/schedules') }} className="flex items-center gap-1.5 text-sm font-semibold min-h-[44px]" style={{ color: 'var(--muted)' }}>
          <ArrowLeft className="size-4" /> Schedules
        </button>
        <div className="flex items-start gap-2 rounded-2xl p-4" style={{ background: 'rgba(186,43,76,0.06)', color: 'var(--danger)' }}>
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          <p className="text-sm">Schedule not found or failed to load.</p>
        </div>
      </div>
    )
  }

  const isSender = address?.toLowerCase() === schedule.sender.toLowerCase()
  const currentClaimable = claimableNow(schedule, nowSec)
  const progress = claimProgress(schedule)
  const isStreaming = schedule.scheduleType === ScheduleType.Streaming

  const rows: { label: string; value: string }[] = [
    { label: 'Type', value: SCHEDULE_TYPE_LABELS[schedule.scheduleType] },
    { label: 'Sender', value: schedule.sender },
    { label: 'Recipient', value: schedule.recipient },
    { label: 'Total', value: `${fmt(schedule.totalAmount)} USDC` },
    { label: 'Claimed', value: `${fmt(schedule.claimed)} USDC` },
    { label: 'Start', value: fmtDate(schedule.startTime) },
    { label: 'End', value: fmtDate(schedule.endTime) },
  ]
  if (schedule.scheduleType === ScheduleType.Vesting) {
    rows.push({ label: 'Cliff', value: fmtDate(schedule.cliffEnd) })
  }
  if (schedule.scheduleType === ScheduleType.Allowance || schedule.scheduleType === ScheduleType.Payroll) {
    rows.push({ label: 'Period', value: `${Number(schedule.period) / 86400}d` })
    rows.push({ label: 'Per period', value: `${fmt(schedule.periodAmount)} USDC` })
  }
  rows.push({ label: 'Revocable', value: schedule.revocable ? 'Yes' : 'No' })
  rows.push({ label: 'Status', value: schedule.cancelled ? 'Cancelled' : schedule.claimed >= schedule.totalAmount ? 'Complete' : 'Active' })

  return (
    <div className="space-y-4">
      {/* Back */}
      <button onClick={() => { void navigate('/schedules') }} className="flex items-center gap-1.5 text-sm font-semibold min-h-[44px] -ml-1" style={{ color: 'var(--muted)' }}>
        <ArrowLeft className="size-4" /> Schedules
      </button>

      <div>
        <h1 className="display text-xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
          {scheduleDescription(schedule)}
        </h1>
        <p className="text-xs mt-0.5 mono truncate" style={{ color: 'var(--subtle)' }}>{id}</p>
      </div>

      {/* Progress */}
      {!schedule.cancelled && (
        <div className="rounded-2xl p-4 space-y-2" style={{ background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(27,31,75,0.08)' }}>
          <div className="flex items-center justify-between text-xs font-semibold" style={{ color: 'var(--muted)' }}>
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(27,31,75,0.08)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: progress >= 100 ? 'var(--success)' : '#F2A900' }} />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="display text-2xl font-bold tabular-nums" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
              {isStreaming ? (
                <StreamTicker schedule={schedule} />
              ) : (
                <>{fmt(currentClaimable)} USDC</>
              )}
            </span>
            {!isStreaming && <span className="text-xs" style={{ color: 'var(--muted)' }}>claimable now</span>}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {!schedule.cancelled && schedule.claimed < schedule.totalAmount && currentClaimable > 0n && (
          <button
            onClick={() => claim(id)}
            disabled={claiming || claimConfirming}
            className="btn-primary flex-1 py-3 rounded-2xl text-sm font-semibold"
            style={{ minHeight: 52 }}
          >
            {claiming || claimConfirming
              ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Claiming…</span>
              : 'Claim now'}
          </button>
        )}
        {isSender && schedule.revocable && !schedule.cancelled && schedule.claimed < schedule.totalAmount && (
          <button
            onClick={() => cancel(id)}
            disabled={cancelling || cancelConfirming}
            className="btn-secondary flex-1 py-3 rounded-2xl text-sm font-semibold"
            style={{ minHeight: 52 }}
          >
            {cancelling || cancelConfirming
              ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Cancelling…</span>
              : 'Cancel schedule'}
          </button>
        )}
      </div>

      {/* Withdraw pending balance (fallback for blocklisted addresses) */}
      <button
        onClick={withdraw}
        disabled={withdrawing || wdConfirming}
        className="w-full py-2.5 rounded-xl text-xs font-semibold"
        style={{ background: 'rgba(27,31,75,0.05)', color: 'var(--muted)', minHeight: 40 }}
      >
        Withdraw pending balance (if transfer failed)
      </button>

      {/* Tx statuses */}
      <TxStatus isPending={claiming} isConfirming={claimConfirming} isSuccess={claimSuccess} isError={claimError} error={claimErr} hash={claimHash} successMessage="Claimed." onDismiss={claimReset} />
      <TxStatus isPending={cancelling} isConfirming={cancelConfirming} isSuccess={cancelSuccess} isError={cancelError} error={cancelErr} hash={cancelHash} successMessage="Cancelled." onDismiss={cancelReset} />
      <TxStatus isPending={withdrawing} isConfirming={wdConfirming} isSuccess={wdSuccess} isError={wdError} error={wdErr} hash={wdHash} successMessage="Withdrawn." onDismiss={wdReset} />

      {/* Detail rows */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(27,31,75,0.08)' }}>
        {rows.map((row, i) => (
          <div
            key={row.label}
            className="flex items-start justify-between gap-3 px-4 py-3"
            style={{ borderBottom: i < rows.length - 1 ? '1px solid rgba(27,31,75,0.06)' : 'none' }}
          >
            <span className="text-xs font-semibold shrink-0" style={{ color: 'var(--muted)' }}>{row.label}</span>
            <span className="text-xs font-medium text-right break-all mono" style={{ color: 'var(--ink)' }}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* Explorer link */}
      <a
        href={`${buildTxExplorerUrl(TARGET_CHAIN_ID, SCHEDULED_PAYOUTS_ADDRESS)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1.5 text-xs font-semibold min-h-[44px] rounded-xl"
        style={{ color: 'var(--muted)', background: 'rgba(27,31,75,0.04)' }}
      >
        <ExternalLink className="size-3.5" />
        View contract on explorer
      </a>
    </div>
  )
}
