/**
 * OrderStatus — displays the state of a bill order with a reclaim countdown.
 */

import { type Hex } from 'viem'
import { Clock, CheckCircle2, XCircle, RotateCcw, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { useBillOrder } from '../../hooks/useBillOrder'
import { useReclaimOrder } from '../../hooks/usePayRouter'
import { formatUnits } from 'viem'
import { TxStatus } from '../shared/TxStatus'

const glass = {
  card: {
    background: 'rgba(255,255,255,0.64)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.68)',
    boxShadow: '0 8px 32px rgba(18,45,69,0.08)',
  } as React.CSSProperties,
}

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.24, ease: [0.25, 0.1, 0.25, 1.0] },
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface OrderStatusProps {
  orderId: Hex
}

export function OrderStatus({ orderId }: OrderStatusProps) {
  const { data, isLoading, isError } = useBillOrder(orderId)
  const reclaimHook = useReclaimOrder()

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4" style={{ color: 'var(--muted)' }}>
        <Loader2 className="size-4 animate-spin" />
        <span className="text-sm">Loading order…</span>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <p className="text-sm py-4" style={{ color: 'var(--danger)' }}>
        Could not load order. Check the order ID.
      </p>
    )
  }

  const amountFormatted = parseFloat(formatUnits(data.amount, 6)).toFixed(2)

  return (
    <motion.div className="rounded-2xl p-4 space-y-3" style={glass.card} {...fadeUp}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--muted)', letterSpacing: '0.06em' }}>
            Bill Order
          </p>
          <p className="display text-2xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
            {amountFormatted} <span className="text-base font-medium" style={{ color: 'var(--subtle)' }}>USDC</span>
          </p>
        </div>

        <StatusBadge status={data.status} />
      </div>

      <div
        className="rounded-xl px-3 py-2 font-mono text-xs break-all"
        style={{ background: 'rgba(18,45,69,0.05)', color: 'var(--muted)' }}
      >
        {orderId}
      </div>

      {data.status === 'Pending' && (
        <div className="space-y-2">
          {data.secondsUntilReclaim > 0 ? (
            <div
              className="rounded-xl px-3 py-2.5 flex items-center gap-2"
              style={{ background: 'rgba(255,180,0,0.08)', border: '1px solid rgba(255,180,0,0.18)' }}
            >
              <Clock className="size-4 shrink-0" style={{ color: '#b45309' }} />
              <p className="text-xs" style={{ color: '#b45309' }}>
                Processing… Reclaim available in {formatCountdown(data.secondsUntilReclaim)}
              </p>
            </div>
          ) : (
            <>
              <TxStatus
                isPending={reclaimHook.isPending}
                isConfirming={reclaimHook.isConfirming}
                isSuccess={reclaimHook.isSuccess}
                isError={reclaimHook.isError}
                error={reclaimHook.error}
                hash={reclaimHook.hash}
                successMessage="Order reclaimed. USDC returned."
                onDismiss={reclaimHook.reset}
              />
              {!reclaimHook.isSuccess && (
                <button
                  onClick={() => reclaimHook.reclaim(orderId)}
                  disabled={reclaimHook.isPending || reclaimHook.isConfirming}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold disabled:opacity-40"
                  style={{
                    background: 'rgba(186,43,76,0.08)',
                    border: '1px solid rgba(186,43,76,0.18)',
                    color: 'var(--danger)',
                  }}
                >
                  {reclaimHook.isPending ? <><Loader2 className="size-4 animate-spin" />Confirming…</> :
                   <><RotateCcw className="size-4" />Reclaim USDC</>}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </motion.div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { icon: React.ReactNode; label: string; bg: string; color: string }> = {
    Pending: { icon: <Clock className="size-3" />, label: 'Pending', bg: 'rgba(255,180,0,0.12)', color: '#b45309' },
    Fulfilled: { icon: <CheckCircle2 className="size-3" />, label: 'Fulfilled', bg: 'rgba(26,128,71,0.10)', color: 'var(--success)' },
    Rejected: { icon: <XCircle className="size-3" />, label: 'Rejected', bg: 'rgba(186,43,76,0.08)', color: 'var(--danger)' },
    Reclaimed: { icon: <RotateCcw className="size-3" />, label: 'Reclaimed', bg: 'rgba(107,101,128,0.10)', color: 'var(--muted)' },
  }
  const cfg = configs[status] ?? configs['Pending']

  return (
    <span
      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.icon}{cfg.label}
    </span>
  )
}
