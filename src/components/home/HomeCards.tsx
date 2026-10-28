/**
 * HomeCards — sections below the balance hero:
 *   • Quick actions + bill shortcuts
 *   • Protected payments / pending orders
 *   • Spend limits card
 *   • Recent activity placeholder
 */

import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import {
  ArrowUpRight, ArrowDownLeft, QrCode, Zap,
  Phone, Wifi, Bolt, ShieldCheck, ArrowRight,
  CalendarClock, Activity,
} from 'lucide-react'
import { formatUnits } from 'viem'
import { BRAND } from '../../../config/brand'
import { SectionLabel, Badge, EmptyState, stagger } from '../ui'

// ─── Sandbox badge ────────────────────────────────────────────────────────────

export function SandboxBadge() {
  return (
    <Badge variant="sandbox">Sandbox</Badge>
  )
}

// ─── Quick actions ────────────────────────────────────────────────────────────

const quickActions = [
  { to: '/send',      label: 'Send',      icon: ArrowUpRight,  bg: 'rgba(16,25,52,0.07)',    fg: 'var(--navy)' },
  { to: '/request',   label: 'Request',   icon: ArrowDownLeft, bg: 'rgba(16,25,52,0.07)',    fg: 'var(--navy)' },
  { to: '/scan',      label: 'Scan',      icon: QrCode,        bg: 'var(--gold-muted)',       fg: '#9A6E00' },
  { to: '/payments',  label: 'Payments',  icon: Zap,           bg: 'rgba(16,25,52,0.07)',    fg: 'var(--navy)' },
  { to: '/schedules', label: 'Schedule',  icon: CalendarClock, bg: 'rgba(16,25,52,0.07)',    fg: 'var(--navy)' },
]

const billShortcuts = [
  { label: 'Invoice',     icon: Phone, to: '/payments' },
  { label: 'Escrow',      icon: Wifi,  to: '/payments' },
  { label: 'Schedule',    icon: Bolt,  to: '/schedules' },
]

export function QuickActions() {
  return (
    <motion.div className="space-y-3" {...stagger(0)}>
      {/* Five action pills in a row */}
      <div className="grid grid-cols-5 gap-1.5">
        {quickActions.map(({ to, label, icon: Icon, bg, fg }, i) => (
          <motion.div key={to} {...stagger(i * 0.04)}>
            <Link
              to={to}
              className="flex flex-col items-center gap-1.5 rounded-2xl py-2.5 px-1 text-center transition-all hover:scale-[1.04] active:scale-[0.96] min-h-[44px]"
            >
              <span
                className="flex size-10 items-center justify-center rounded-xl"
                style={{ background: bg }}
              >
                <Icon className="size-[18px]" style={{ color: fg }} strokeWidth={2} />
              </span>
              <span className="text-[10px] font-semibold" style={{ color: 'var(--ink-2)' }}>
                {label}
              </span>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Bill shortcuts */}
      <div className="grid grid-cols-3 gap-2">
        {billShortcuts.map(({ label, icon: Icon, to }, i) => (
          <motion.div key={to} {...stagger(0.14 + i * 0.05)}>
            <Link
              to={to}
              className="flex items-center gap-2 rounded-2xl px-3 py-2.5 transition-all active:scale-[0.97] min-h-[44px]"
              style={{
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border)',
              }}
            >
              <Icon className="size-4 flex-shrink-0" style={{ color: 'var(--muted)' }} strokeWidth={1.8} />
              <span className="text-xs font-semibold truncate" style={{ color: 'var(--ink-2)' }}>{label}</span>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Protected payments ───────────────────────────────────────────────────────

export function ProtectedPayments() {
  // Live: would read pending bill orders filtered by wallet from an indexer.
  // Contracts not deployed yet — show empty state + explanation.
  const pendingOrders: never[] = []

  return (
    <motion.div
      className="rounded-3xl overflow-hidden"
      style={{
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border)',
        boxShadow: '0 2px 8px rgba(16,25,52,0.04)',
      }}
      {...stagger(0.10)}
    >
      {/* Header strip */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <span
            className="flex size-7 items-center justify-center rounded-xl"
            style={{ background: 'rgba(24,165,139,0.12)' }}
          >
            <ShieldCheck className="size-3.5" style={{ color: 'var(--success-text)' }} strokeWidth={2} />
          </span>
          <SectionLabel>Protected payments</SectionLabel>
        </div>
        <Badge variant="sandbox">Sandbox</Badge>
      </div>

      <div className="px-4 pb-4">
        <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--muted)' }}>
          Bill payments are held in escrow until fulfilled. Automatically refunded after 30 minutes if not processed.
        </p>

        {pendingOrders.length === 0 ? (
          <div className="rounded-2xl py-5 px-4 flex flex-col items-center gap-2 text-center"
            style={{ background: 'var(--surface-muted)' }}>
            <ShieldCheck className="size-7" style={{ color: 'var(--subtle)' }} strokeWidth={1.4} />
            <p className="text-xs" style={{ color: 'var(--subtle)' }}>No pending orders</p>
          </div>
        ) : null}

        <Link
          to="/payments"
          className="mt-3 flex items-center gap-1 text-xs font-bold transition-opacity hover:opacity-70"
          style={{ color: 'var(--gold-hover)' }}
        >
          Open Payments hub
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Spend limits card ────────────────────────────────────────────────────────

export function LimitsCard() {
  const { address } = useAccount()

  // All payments use the global per-payment cap. No identity verification required.
  const globalCapFormatted = `$${parseFloat(formatUnits(25_000_000n, 6)).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  return (
    <motion.div
      className="rounded-3xl"
      style={{
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border)',
        boxShadow: '0 2px 8px rgba(16,25,52,0.04)',
      }}
      {...stagger(0.14)}
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <SectionLabel>Payment limit</SectionLabel>
        <Badge variant="success">Permissionless</Badge>
      </div>

      <div className="px-4 pb-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl p-3" style={{ background: 'var(--surface-muted)' }}>
            <p className="text-[10px] font-bold uppercase mb-1.5" style={{ color: 'var(--subtle)', letterSpacing: '0.07em' }}>
              Per payment
            </p>
            <p className="display text-lg font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{globalCapFormatted}</p>
          </div>
          <div className="rounded-2xl p-3" style={{ background: 'var(--surface-muted)' }}>
            <p className="text-[10px] font-bold uppercase mb-1.5" style={{ color: 'var(--subtle)', letterSpacing: '0.07em' }}>
              Required KYC
            </p>
            <p className="display text-lg font-bold" style={{ color: 'var(--teal)' }}>None</p>
          </div>
        </div>

        {/* Usage bar — $0.00 until on-chain daily spend tracking ships */}
        {address && (
          <div>
            <div className="flex justify-between text-[11px] mb-1.5" style={{ color: 'var(--muted)' }}>
              <span>Today&apos;s usage</span>
              <span className="tabular-nums font-semibold">$0.00</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-muted)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: '0%', background: 'var(--gold)' }}
              />
            </div>
          </div>
        )}

        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          The {globalCapFormatted} per-payment limit is enforced on-chain and can only be changed by the admin after a 24-hour governance timelock.
        </p>
      </div>
    </motion.div>
  )
}

// ─── Recent activity ──────────────────────────────────────────────────────────

export function RecentActivity() {
  // Live activity will come from on-chain event indexer once contracts are deployed.
  return (
    <motion.div
      className="rounded-3xl"
      style={{
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border)',
        boxShadow: '0 2px 8px rgba(16,25,52,0.04)',
      }}
      {...stagger(0.18)}
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <SectionLabel>Activity</SectionLabel>
      </div>
      <div className="px-4 pb-4">
        <EmptyState
          icon={<Activity className="size-6" />}
          title="No transactions yet"
          body={`Send or receive USDC on ${BRAND.networkName} to see activity here.`}
        />
      </div>
    </motion.div>
  )
}
