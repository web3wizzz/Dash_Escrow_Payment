/**
 * HomeCards — the sections below the balance hero on Home:
 *   • Quick-action circles + bill shortcuts
 *   • Protected payments (pending bill orders)
 *   • Limits card (tier, per-payment cap, daily meter)
 *   • Recent activity list
 */

import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import {
  ArrowUpRight, ArrowDownLeft, QrCode, Zap,
  Phone, Wifi, Bolt, ShieldCheck, ArrowRight, RefreshCw,
  Activity,
} from 'lucide-react'
import { useMyKycTier } from '../../hooks/useKycTier'
import { TIER_INFO } from '../../lib/tiers'
import { formatUnits } from 'viem'

// ─── Stagger helpers ─────────────────────────────────────────────────────────

function fadeItem(delay: number) {
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.22, delay, ease: [0.25, 0.1, 0.25, 1.0] as [number, number, number, number] },
  }
}

// ─── Section card wrapper ─────────────────────────────────────────────────────

function SectionCard({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      className="rounded-2xl p-4"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: '0 2px 8px rgba(27,31,75,0.05)',
      }}
      {...fadeItem(delay)}
    >
      {children}
    </motion.div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)', letterSpacing: '0.08em' }}>
      {children}
    </p>
  )
}

// ─── Quick actions ────────────────────────────────────────────────────────────

const quickActions = [
  { to: '/send',    label: 'Send',    icon: ArrowUpRight,   bg: 'rgba(27,31,75,0.08)',    fg: 'var(--ink)' },
  { to: '/request', label: 'Request', icon: ArrowDownLeft,  bg: 'rgba(27,31,75,0.08)',    fg: 'var(--ink)' },
  { to: '/scan',    label: 'Scan',    icon: QrCode,         bg: 'rgba(242,169,0,0.14)',   fg: '#C88B00' },
  { to: '/bills',   label: 'Pay bills', icon: Zap,          bg: 'rgba(27,31,75,0.08)',    fg: 'var(--ink)' },
]

const billShortcuts = [
  { label: 'Airtime',     icon: Phone,     to: '/bills?category=airtime' },
  { label: 'Data',        icon: Wifi,      to: '/bills?category=data' },
  { label: 'Electricity', icon: Bolt,      to: '/bills?category=electricity' },
]

function QuickActions() {
  return (
    <motion.div className="space-y-3" {...fadeItem(0.08)}>
      {/* Circular action row */}
      <div className="grid grid-cols-4 gap-2">
        {quickActions.map(({ to, label, icon: Icon, bg, fg }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-1.5 rounded-2xl py-3 px-1 text-center transition-all hover:scale-[1.03] active:scale-[0.97] min-h-[44px]"
          >
            <span
              className="flex size-12 items-center justify-center rounded-full"
              style={{ background: bg }}
            >
              <Icon className="size-5" style={{ color: fg }} strokeWidth={1.9} />
            </span>
            <span className="text-[11px] font-semibold" style={{ color: 'var(--ink-2)' }}>{label}</span>
          </Link>
        ))}
      </div>

      {/* Bill shortcuts */}
      <div className="grid grid-cols-3 gap-2">
        {billShortcuts.map(({ label, icon: Icon, to }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-2 rounded-xl px-3 py-2.5 transition-all active:scale-[0.97] min-h-[44px]"
            style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
          >
            <Icon className="size-4 flex-shrink-0" style={{ color: 'var(--muted)' }} strokeWidth={1.8} />
            <span className="text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>{label}</span>
          </Link>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Protected payments card ──────────────────────────────────────────────────

function ProtectedPayments() {
  // In a real implementation, we would read pending orders from an indexer
  // filtered by the connected wallet. No orders are shown while contracts aren't deployed.
  const pendingOrders: never[] = []

  return (
    <SectionCard delay={0.14}>
      <SectionLabel>Protected payments</SectionLabel>
      <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
        Bill payments are held securely and returned automatically after 30 minutes if not fulfilled.
      </p>

      {pendingOrders.length === 0 ? (
        <div className="flex flex-col items-center py-4 gap-1.5">
          <ShieldCheck className="size-8" style={{ color: 'var(--border-strong)' }} strokeWidth={1.4} />
          <p className="text-xs text-center" style={{ color: 'var(--subtle)' }}>
            No pending bill orders
          </p>
        </div>
      ) : null}

      <Link
        to="/bills"
        className="mt-2 flex items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-70"
        style={{ color: 'var(--saffron)' }}
      >
        Pay a bill
        <ArrowRight className="size-3.5" />
      </Link>
    </SectionCard>
  )
}

// ─── Limits card ─────────────────────────────────────────────────────────────

function LimitsCard() {
  const { address } = useAccount()
  const { data: tierData } = useMyKycTier()
  const tier = tierData?.tier ?? 0
  const info = TIER_INFO[tier]
  const navigate = useNavigate()

  // Daily cap in USDC display units
  const dailyCapDisplay = info.dailyCap === null
    ? 'Unlimited'
    : `$${parseFloat(formatUnits(info.dailyCap, 6)).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  const perPayDisplay = `$${parseFloat(formatUnits(info.perPaymentCap, 6)).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  return (
    <SectionCard delay={0.18}>
      <div className="flex items-start justify-between mb-3">
        <SectionLabel>Limits</SectionLabel>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
          style={{
            background: tier === 0 ? 'var(--surface-muted)' : tier === 1 ? 'rgba(16,97,166,0.10)' : 'rgba(26,128,71,0.10)',
            color: tier === 0 ? 'var(--muted)' : tier === 1 ? '#1061a6' : 'var(--success)',
            letterSpacing: '0.07em',
          }}
        >
          {info.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-xl p-3" style={{ background: 'var(--surface-muted)' }}>
          <p className="text-[10px] font-semibold uppercase mb-1" style={{ color: 'var(--subtle)', letterSpacing: '0.07em' }}>Per payment</p>
          <p className="text-base font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{perPayDisplay}</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'var(--surface-muted)' }}>
          <p className="text-[10px] font-semibold uppercase mb-1" style={{ color: 'var(--subtle)', letterSpacing: '0.07em' }}>Daily cap</p>
          <p className="text-base font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{dailyCapDisplay}</p>
        </div>
      </div>

      {/* Today's usage — live data would come from on-chain events; show 0 until deployed */}
      {address && (
        <div className="mb-3">
          <div className="flex justify-between text-[11px] mb-1" style={{ color: 'var(--muted)' }}>
            <span>Today's usage</span>
            <span className="tabular-nums">$0.00 / {dailyCapDisplay}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-muted)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: '0%', background: 'var(--saffron)' }}
            />
          </div>
        </div>
      )}

      <button
        onClick={() => { void navigate('/settings') }}
        className="flex items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-70"
        style={{ color: 'var(--ink)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        <ShieldCheck className="size-3.5" />
        <span>Verify identity <span style={{ color: 'var(--muted)' }}>(Sandbox)</span></span>
        <ArrowRight className="size-3.5" style={{ color: 'var(--subtle)' }} />
      </button>
    </SectionCard>
  )
}

// ─── Recent activity ──────────────────────────────────────────────────────────

function RecentActivity() {
  // Real transaction history would come from an event indexer.
  // Show a proper empty state rather than fake data.
  const navigate = useNavigate()

  return (
    <SectionCard delay={0.22}>
      <div className="flex items-center justify-between mb-3">
        <SectionLabel>Recent activity</SectionLabel>
        <Link
          to="/activity"
          className="text-[11px] font-semibold transition-opacity hover:opacity-70"
          style={{ color: 'var(--muted)' }}
        >
          See all
        </Link>
      </div>

      <div className="flex flex-col items-center py-6 gap-2">
        <div
          className="flex items-center justify-center size-12 rounded-full mb-1"
          style={{ background: 'var(--surface-muted)' }}
        >
          <Activity className="size-6" style={{ color: 'var(--border-strong)' }} strokeWidth={1.4} />
        </div>
        <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>No transactions yet</p>
        <p className="text-xs text-center max-w-[200px]" style={{ color: 'var(--subtle)' }}>
          Send or receive USDC to see your activity here.
        </p>
        <button
          onClick={() => { void navigate('/send') }}
          className="mt-2 flex items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-70"
          style={{ color: 'var(--saffron)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          Send USDC
          <ArrowUpRight className="size-3.5" />
        </button>
      </div>
    </SectionCard>
  )
}

// ─── Sandbox badge ────────────────────────────────────────────────────────────

function SandboxBadge() {
  return (
    <div className="flex items-center justify-center gap-1.5">
      <span
        className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase"
        style={{ background: 'rgba(186,43,76,0.10)', color: 'var(--danger)', letterSpacing: '0.07em' }}
      >
        Sandbox
      </span>
      <span className="text-[10px]" style={{ color: 'var(--subtle)' }}>
        Identity verification and billers are simulated
      </span>
      <RefreshCw className="size-3" style={{ color: 'var(--subtle)' }} />
    </div>
  )
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export { QuickActions, ProtectedPayments, LimitsCard, RecentActivity, SandboxBadge }
