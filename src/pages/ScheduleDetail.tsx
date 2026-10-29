/**
 * ScheduleDetail — full single-schedule view with progress ring,
 * claimable display, claim/cancel actions, detail rows, explorer link.
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { type Hex } from 'viem'
import { formatUnits } from 'viem'
import { useAccount } from 'wagmi'
import { ArrowLeft, ExternalLink, Loader2, AlertCircle, CheckCircle2, XCircle, Download } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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
import { Badge, Skeleton, Divider } from '../components/ui'

function fmt(amount: bigint, decimals = 6) {
  return parseFloat(formatUnits(amount, decimals)).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })
}

function fmtDate(sec: bigint) {
  if (sec === 0n) return '—'
  return new Date(Number(sec) * 1000).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function AddrRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3">
      <span className="text-xs font-semibold shrink-0 mt-0.5" style={{ color: 'var(--muted)' }}>{label}</span>
      <span className="mono text-[11px] font-medium text-right break-all" style={{ color: 'var(--ink)' }}>{value}</span>
    </div>
  )
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <span className="text-xs font-semibold shrink-0" style={{ color: 'var(--muted)' }}>{label}</span>
      <span className="text-sm font-semibold text-right" style={{ color: 'var(--ink)' }}>{value}</span>
    </div>
  )
}

function StatusBadge({ cancelled, complete }: { cancelled: boolean; complete: boolean }) {
  if (cancelled) return <Badge variant="danger">Cancelled</Badge>
  if (complete) return <Badge variant="success">Complete</Badge>
  return <Badge variant="warning">Active</Badge>
}

export function ScheduleDetail() {
  const { scheduleId } = useParams<{ scheduleId: string }>()
  const navigate = useNavigate()
  const { address } = useAccount()

  const id = scheduleId as Hex | undefined

  const { schedule, isLoading, isError } = useSchedule(
    id && id.startsWith('0x') ? id : undefined,
  )

  const { claim, hash: claimHash, isPending: claiming, isConfirming: claimConfirming, isSuccess: claimSuccess, isError: claimError, error: claimErr, reset: claimReset } = useClaim()
  const { cancel, hash: cancelHash, isPending: cancelling, isConfirming: cancelConfirming, isSuccess: cancelSuccess, isError: cancelError, error: cancelErr, reset: cancelReset } = useCancel()
  const { withdraw, hash: wdHash, isPending: withdrawing, isConfirming: wdConfirming, isSuccess: wdSuccess, isError: wdError, error: wdErr, reset: wdReset } = useWithdraw()

  const [nowSec, setNowSec] = useState<bigint>(
    () => BigInt(Math.floor(performance.timeOrigin / 1000) + Math.floor(performance.now() / 1000)),
  )
  useEffect(() => {
    const id2 = setInterval(
      () => setNowSec(BigInt(Math.floor(performance.timeOrigin / 1000) + Math.floor(performance.now() / 1000))),
      5000,
    )
    return () => clearInterval(id2)
  }, [])

  // ── Error / missing ID ──────────────────────────────────────────────────────

  if (!id || !id.startsWith('0x')) {
    return (
      <div className="space-y-3 pt-2">
        <BackButton onBack={() => { void navigate('/schedules') }} />
        <div className="flex items-start gap-2 rounded-2xl p-4"
          style={{ background: 'var(--danger-muted)', border: '1px solid rgba(192,51,74,0.18)' }}>
          <AlertCircle className="size-4 mt-0.5 shrink-0" style={{ color: 'var(--danger)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--danger)' }}>Invalid schedule ID.</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4 pt-2">
        <BackButton onBack={() => { void navigate('/schedules') }} />
        <Skeleton className="h-8 w-56 rounded-xl" />
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-24 w-full rounded-3xl" />
      </div>
    )
  }

  if (isError || !schedule) {
    return (
      <div className="space-y-3 pt-2">
        <BackButton onBack={() => { void navigate('/schedules') }} />
        <div className="flex items-start gap-2 rounded-2xl p-4"
          style={{ background: 'var(--danger-muted)', border: '1px solid rgba(192,51,74,0.18)' }}>
          <AlertCircle className="size-4 mt-0.5 shrink-0" style={{ color: 'var(--danger)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--danger)' }}>Schedule not found or failed to load.</p>
        </div>
      </div>
    )
  }

  const isSender = address?.toLowerCase() === schedule.sender.toLowerCase()
  const currentClaimable = claimableNow(schedule, nowSec)
  const progress = claimProgress(schedule)
  const isStreaming = schedule.scheduleType === ScheduleType.Streaming
  const complete = !schedule.cancelled && schedule.claimed >= schedule.totalAmount
  const canClaim = !schedule.cancelled && !complete && currentClaimable > 0n
  const canCancel = isSender && schedule.revocable && !schedule.cancelled && !complete

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.20, ease: [0.25, 0.1, 0.25, 1.0] }}
    >
      {/* Back + title */}
      <div className="space-y-2 pt-1">
        <BackButton onBack={() => { void navigate('/schedules') }} />
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="display text-xl font-bold leading-tight" style={{ color: 'var(--ink)', letterSpacing: '-0.025em' }}>
              {scheduleDescription(schedule)}
            </h1>
            <p className="text-[11px] mt-1 mono truncate" style={{ color: 'var(--subtle)' }}>{id}</p>
          </div>
          <StatusBadge cancelled={schedule.cancelled} complete={complete} />
        </div>
      </div>

      {/* Progress card */}
      {!schedule.cancelled && (
        <div
          className="rounded-3xl overflow-hidden"
          style={{
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 20px rgba(16,25,52,0.06)',
          }}
        >
          {/* Progress bar */}
          <div className="h-1.5 w-full" style={{ background: 'var(--surface-muted)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: complete ? 'var(--success)' : 'var(--gold)' }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(progress, 100)}%` }}
              transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1.0] }}
            />
          </div>

          <div className="p-5 space-y-4">
            {/* Claimable */}
            <div>
              <p className="text-[11px] font-bold uppercase mb-1.5"
                style={{ color: 'var(--muted)', letterSpacing: '0.09em' }}>
                Claimable now
              </p>
              <div className="flex items-baseline gap-2">
                {isStreaming ? (
                  <StreamTicker
                    schedule={schedule}
                    className="display text-3xl font-bold tabular-nums"
                  />
                ) : (
                  <>
                    <span
                      className="display text-3xl font-bold tabular-nums"
                      style={{ color: currentClaimable > 0n ? 'var(--ink)' : 'var(--subtle)', letterSpacing: '-0.03em' }}
                    >
                      {fmt(currentClaimable)}
                    </span>
                    <span className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>USDC</span>
                  </>
                )}
              </div>
            </div>

            {/* Progress stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Total',    value: `${fmt(schedule.totalAmount)} USDC` },
                { label: 'Claimed',  value: `${fmt(schedule.claimed)} USDC` },
                { label: 'Progress', value: `${progress}%` },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-2xl p-3 text-center" style={{ background: 'var(--surface-muted)' }}>
                  <p className="text-[10px] font-bold uppercase mb-1" style={{ color: 'var(--subtle)', letterSpacing: '0.07em' }}>{label}</p>
                  <p className="display text-sm font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tx statuses */}
      <AnimatePresence>
        {(claiming || claimConfirming || claimSuccess || claimError) && (
          <TxStatus isPending={claiming} isConfirming={claimConfirming} isSuccess={claimSuccess}
            isError={claimError} error={claimErr} hash={claimHash} successMessage="Claimed successfully." onDismiss={claimReset} />
        )}
        {(cancelling || cancelConfirming || cancelSuccess || cancelError) && (
          <TxStatus isPending={cancelling} isConfirming={cancelConfirming} isSuccess={cancelSuccess}
            isError={cancelError} error={cancelErr} hash={cancelHash} successMessage="Schedule cancelled." onDismiss={cancelReset} />
        )}
        {(withdrawing || wdConfirming || wdSuccess || wdError) && (
          <TxStatus isPending={withdrawing} isConfirming={wdConfirming} isSuccess={wdSuccess}
            isError={wdError} error={wdErr} hash={wdHash} successMessage="Withdrawn." onDismiss={wdReset} />
        )}
      </AnimatePresence>

      {/* Actions */}
      {(canClaim || canCancel) && (
        <div className="flex gap-2.5">
          {canClaim && (
            <button
              onClick={() => claim(id)}
              disabled={claiming || claimConfirming}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold transition-all active:scale-[0.97] disabled:opacity-40"
              style={{
                background: '#F3B51C',
                color: '#0A0F1E',
                boxShadow: '0 2px 12px rgba(243,181,28,0.38)',
                minHeight: 52,
              }}
            >
              {claiming || claimConfirming
                ? <><Loader2 className="size-4 animate-spin" />Claiming…</>
                : <><CheckCircle2 className="size-4" />Claim now</>
              }
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => cancel(id)}
              disabled={cancelling || cancelConfirming}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold transition-all active:scale-[0.97] disabled:opacity-40"
              style={{
                background: 'var(--danger-muted)',
                color: 'var(--danger)',
                border: '1px solid rgba(192,51,74,0.18)',
                minHeight: 52,
              }}
            >
              {cancelling || cancelConfirming
                ? <><Loader2 className="size-4 animate-spin" />Cancelling…</>
                : <><XCircle className="size-4" />Cancel</>
              }
            </button>
          )}
        </div>
      )}

      {/* Detail rows */}
      <div
        className="rounded-3xl overflow-hidden"
        style={{
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border)',
          boxShadow: '0 2px 8px rgba(16,25,52,0.04)',
        }}
      >
        <div className="px-4 pt-4 pb-1">
          <p className="text-[11px] font-bold uppercase" style={{ color: 'var(--muted)', letterSpacing: '0.09em' }}>Details</p>
        </div>
        <div className="px-4 divide-y" style={{ borderColor: 'var(--border)' }}>
          <DataRow label="Type" value={SCHEDULE_TYPE_LABELS[schedule.scheduleType]} />
          <DataRow label="Start" value={fmtDate(schedule.startTime)} />
          <DataRow label="End" value={fmtDate(schedule.endTime)} />
          {schedule.scheduleType === ScheduleType.Vesting && (
            <DataRow label="Cliff" value={fmtDate(schedule.cliffEnd)} />
          )}
          {(schedule.scheduleType === ScheduleType.Allowance || schedule.scheduleType === ScheduleType.Payroll) && (
            <>
              <DataRow label="Period" value={`${Number(schedule.period) / 86400}d`} />
              <DataRow label="Per period" value={`${fmt(schedule.periodAmount)} USDC`} />
            </>
          )}
          <DataRow label="Revocable" value={schedule.revocable ? 'Yes' : 'No'} />
        </div>
        <div className="px-4 py-1 divide-y" style={{ borderColor: 'var(--border)' }}>
          <Divider className="mb-0" />
          <AddrRow label="Sender" value={schedule.sender} />
          <AddrRow label="Recipient" value={schedule.recipient} />
        </div>
      </div>

      {/* Withdraw fallback */}
      <button
        onClick={withdraw}
        disabled={withdrawing || wdConfirming}
        className="w-full flex items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-semibold transition-all active:scale-[0.98] disabled:opacity-40"
        style={{
          background: 'var(--surface-muted)',
          color: 'var(--muted)',
          border: '1px solid var(--border)',
          minHeight: 40,
        }}
      >
        <Download className="size-3.5" />
        Withdraw pending balance (if transfer failed)
      </button>

      {/* Explorer */}
      <a
        href={buildTxExplorerUrl(TARGET_CHAIN_ID, SCHEDULED_PAYOUTS_ADDRESS) ?? '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-semibold transition-all active:scale-[0.98]"
        style={{ color: 'var(--muted)', background: 'var(--surface-muted)', border: '1px solid var(--border)', minHeight: 40 }}
      >
        <ExternalLink className="size-3.5" />
        View contract on explorer
      </a>
    </motion.div>
  )
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      className="flex items-center gap-1.5 text-sm font-semibold min-h-[44px] -ml-1 transition-opacity hover:opacity-70"
      style={{ color: 'var(--muted)' }}
    >
      <ArrowLeft className="size-4" />
      Schedules
    </button>
  )
}
