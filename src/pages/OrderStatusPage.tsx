/**
 * OrderStatusPage — polished order status view with countdown, reclaim, and explorer link.
 */

import { useParams, useNavigate, Link } from 'react-router-dom'
import { type Hex } from 'viem'
import { formatUnits } from 'viem'
import { ArrowLeft, Clock, CheckCircle2, XCircle, RotateCcw, Loader2, ExternalLink, ShieldCheck } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChainGuard } from '../components/shared/ChainGuard'
import { TxStatus } from '../components/shared/TxStatus'
import { Badge, Skeleton } from '../components/ui'
import { useBillOrder } from '../hooks/useBillOrder'
import { useReclaimOrder } from '../hooks/usePayRouter'
import { buildTxExplorerUrl } from '../onchain-facts'
import { TARGET_CHAIN_ID } from '../config'
import { PAY_ROUTER_ADDRESS } from '../hooks/usePayRouter'

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

type OrderStatus = 'Pending' | 'Fulfilled' | 'Rejected' | 'Reclaimed'

const statusConfig: Record<OrderStatus, {
  icon: React.ElementType
  label: string
  badgeVariant: 'warning' | 'success' | 'danger' | 'muted'
  description: string
}> = {
  Pending:   { icon: Clock,         label: 'Pending',   badgeVariant: 'warning', description: 'Your payment is in escrow while the bill is being processed.' },
  Fulfilled: { icon: CheckCircle2,  label: 'Fulfilled', badgeVariant: 'success', description: 'Bill fulfilled. Payment has been released from escrow.' },
  Rejected:  { icon: XCircle,       label: 'Rejected',  badgeVariant: 'danger',  description: 'Order was rejected. You can reclaim your USDC.' },
  Reclaimed: { icon: RotateCcw,     label: 'Reclaimed', badgeVariant: 'muted',   description: 'USDC has been returned to your wallet.' },
}

function OrderContent({ orderId }: { orderId: Hex }) {
  const { data, isLoading, isError } = useBillOrder(orderId)
  const reclaimHook = useReclaimOrder()

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex items-start gap-2 rounded-2xl p-4"
        style={{ background: 'var(--danger-muted)', border: '1px solid rgba(192,51,74,0.18)' }}>
        <XCircle className="size-4 mt-0.5 shrink-0" style={{ color: 'var(--danger)' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--danger)' }}>
          Could not load order. Check the order ID and try again.
        </p>
      </div>
    )
  }

  const status = (data.status as OrderStatus) ?? 'Pending'
  const config = statusConfig[status] ?? statusConfig.Pending
  const StatusIcon = config.icon
  const amountFormatted = parseFloat(formatUnits(data.amount, 6)).toFixed(2)
  const canReclaim = status === 'Pending' && data.secondsUntilReclaim <= 0
  const countingDown = status === 'Pending' && data.secondsUntilReclaim > 0

  return (
    <motion.div
      className="space-y-3"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.20, ease: [0.25, 0.1, 0.25, 1.0] }}
    >
      {/* Main status card */}
      <div
        className="rounded-3xl overflow-hidden"
        style={{
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border)',
          boxShadow: '0 4px 20px rgba(16,25,52,0.06)',
        }}
      >
        {/* Top accent */}
        <div
          className="h-1.5"
          style={{
            background: status === 'Fulfilled' ? 'var(--success)'
              : status === 'Rejected' ? 'var(--danger)'
              : status === 'Reclaimed' ? 'var(--muted)'
              : 'var(--gold)',
          }}
        />

        <div className="p-5 space-y-4">
          {/* Amount + status */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase mb-1.5"
                style={{ color: 'var(--muted)', letterSpacing: '0.09em' }}>
                Bill payment
              </p>
              <div className="flex items-baseline gap-1.5">
                <span className="display text-3xl font-bold tabular-nums"
                  style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
                  {amountFormatted}
                </span>
                <span className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>USDC</span>
              </div>
            </div>
            <Badge variant={config.badgeVariant}>
              <StatusIcon className="size-3 mr-0.5" />
              {config.label}
            </Badge>
          </div>

          <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
            {config.description}
          </p>

          {/* Order ID */}
          <div className="rounded-2xl px-3 py-2.5"
            style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
            <p className="text-[10px] font-bold uppercase mb-1" style={{ color: 'var(--subtle)', letterSpacing: '0.07em' }}>Order ID</p>
            <p className="mono text-[11px] break-all" style={{ color: 'var(--ink)' }}>{orderId}</p>
          </div>

          {/* Escrow protection notice */}
          <div className="flex items-start gap-2.5 rounded-2xl px-3.5 py-3"
            style={{ background: 'rgba(24,165,139,0.07)', border: '1px solid rgba(24,165,139,0.16)' }}>
            <ShieldCheck className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--success-text)' }} />
            <p className="text-xs font-medium leading-relaxed" style={{ color: 'var(--success-text)' }}>
              Protected by on-chain escrow. Funds are held until fulfilled or refunded.
            </p>
          </div>
        </div>
      </div>

      {/* Countdown / Reclaim */}
      <AnimatePresence mode="wait">
        {countingDown && (
          <motion.div
            key="countdown"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="rounded-2xl px-4 py-3.5 flex items-center gap-3"
            style={{
              background: 'rgba(243,181,28,0.09)',
              border: '1px solid rgba(243,181,28,0.22)',
            }}
          >
            <Clock className="size-5 shrink-0" style={{ color: 'var(--warning)' }} />
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--warning)' }}>
                Processing — {formatCountdown(data.secondsUntilReclaim)} until reclaim available
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                If not fulfilled, you can reclaim your USDC after the timer expires.
              </p>
            </div>
          </motion.div>
        )}

        {canReclaim && !reclaimHook.isSuccess && (
          <motion.div
            key="reclaim"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="space-y-2.5"
          >
            <div className="rounded-2xl px-4 py-3"
              style={{ background: 'var(--danger-muted)', border: '1px solid rgba(192,51,74,0.18)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--danger)' }}>
                Order expired without fulfillment. You can reclaim your USDC now.
              </p>
            </div>
            <TxStatus
              isPending={reclaimHook.isPending}
              isConfirming={reclaimHook.isConfirming}
              isSuccess={reclaimHook.isSuccess}
              isError={reclaimHook.isError}
              error={reclaimHook.error}
              hash={reclaimHook.hash}
              successMessage="USDC returned to your wallet."
              onDismiss={reclaimHook.reset}
            />
            <button
              onClick={() => reclaimHook.reclaim(orderId)}
              disabled={reclaimHook.isPending || reclaimHook.isConfirming}
              className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold transition-all active:scale-[0.97] disabled:opacity-40"
              style={{
                background: 'var(--danger-muted)',
                color: 'var(--danger)',
                border: '1px solid rgba(192,51,74,0.25)',
                minHeight: 52,
              }}
            >
              {reclaimHook.isPending || reclaimHook.isConfirming
                ? <><Loader2 className="size-4 animate-spin" />Reclaiming…</>
                : <><RotateCcw className="size-4" />Reclaim USDC</>
              }
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2.5">
        <Link
          to="/bills"
          className="flex items-center justify-center gap-1.5 rounded-2xl py-3 text-sm font-bold transition-all active:scale-[0.97]"
          style={{
            background: '#F3B51C',
            color: '#0A0F1E',
            boxShadow: '0 2px 10px rgba(243,181,28,0.35)',
            minHeight: 48,
          }}
        >
          Pay another bill
        </Link>
        <a
          href={buildTxExplorerUrl(TARGET_CHAIN_ID, PAY_ROUTER_ADDRESS) ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-2xl py-3 text-sm font-semibold transition-all active:scale-[0.97]"
          style={{
            background: 'var(--surface-muted)',
            color: 'var(--muted)',
            border: '1px solid var(--border)',
            minHeight: 48,
          }}
        >
          <ExternalLink className="size-3.5" />
          Explorer
        </a>
      </div>
    </motion.div>
  )
}

export function OrderStatusPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()

  return (
    <div className="space-y-4">
      {/* Back */}
      <button
        onClick={() => { void navigate('/bills') }}
        className="flex items-center gap-1.5 text-sm font-semibold min-h-[44px] -ml-1 transition-opacity hover:opacity-70"
        style={{ color: 'var(--muted)' }}
      >
        <ArrowLeft className="size-4" />
        Bills
      </button>

      <div>
        <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
          Order Status
        </h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
          Escrow-protected bill payment
        </p>
      </div>

      {!orderId || !orderId.startsWith('0x') ? (
        <div className="flex items-start gap-2 rounded-2xl p-4"
          style={{ background: 'var(--danger-muted)', border: '1px solid rgba(192,51,74,0.18)' }}>
          <XCircle className="size-4 mt-0.5 shrink-0" style={{ color: 'var(--danger)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--danger)' }}>Invalid order ID.</p>
        </div>
      ) : (
        <ChainGuard>
          <OrderContent orderId={orderId as Hex} />
        </ChainGuard>
      )}
    </div>
  )
}
