/**
 * Payments — Web3-native payments hub.
 *
 * Four categories:
 *   Invoices    — requestPay + share link (LIVE via PayRouter.requestPay)
 *   Escrow      — createOrder escrow (LIVE via PayRouter.createOrder, 30-min timeout)
 *   Schedules   — payroll, vesting, allowances, streams (LIVE via ScheduledPayouts)
 *   Subscriptions — coming soon (no on-chain automation exists yet)
 *
 * No fake balances, histories, or merchants are shown.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, ShieldCheck, CalendarClock, RefreshCw,
  ArrowRight, AlertCircle, ChevronLeft, Info,
} from 'lucide-react'
import { PageHeader, Badge, stagger } from '../components/ui'
import { InvoicePanel } from '../components/payments/InvoicePanel'
import { EscrowPanel } from '../components/payments/EscrowPanel'

type Category = 'hub' | 'invoices' | 'escrow' | 'schedules' | 'subscriptions'

// ─── Category definitions ──────────────────────────────────────────────────

const categories = [
  {
    id: 'invoices' as Category,
    icon: FileText,
    label: 'Invoices',
    description: 'Request USDC payments with a shareable link or QR code.',
    status: 'live' as const,
    statusLabel: 'Live',
    accentColor: '#18A58B',
    accentBg: 'rgba(24,165,139,0.10)',
  },
  {
    id: 'escrow' as Category,
    icon: ShieldCheck,
    label: 'Escrow',
    description: 'Hold USDC in escrow until a service is delivered. Auto-refund after 30 minutes.',
    status: 'live' as const,
    statusLabel: 'Live',
    accentColor: '#F3B51C',
    accentBg: 'rgba(243,181,28,0.12)',
  },
  {
    id: 'schedules' as Category,
    icon: CalendarClock,
    label: 'Scheduled Payouts',
    description: 'Payroll, vesting schedules, allowances, and per-second salary streams.',
    status: 'live' as const,
    statusLabel: 'Live',
    accentColor: '#101934',
    accentBg: 'rgba(16,25,52,0.08)',
  },
  {
    id: 'subscriptions' as Category,
    icon: RefreshCw,
    label: 'Subscriptions',
    description: 'Recurring USDC billing agreements with on-chain authorization.',
    status: 'planned' as const,
    statusLabel: 'Coming soon',
    accentColor: '#6675A0',
    accentBg: 'rgba(102,117,160,0.10)',
  },
]

// ─── Hub card ──────────────────────────────────────────────────────────────

function CategoryCard({
  id: _id, icon: Icon, label, description, status, statusLabel, accentColor, accentBg,
  delay, onClick,
}: typeof categories[0] & { delay: number; onClick: () => void }) {
  const isLive = status === 'live'

  return (
    <motion.button
      onClick={onClick}
      className="w-full text-left rounded-3xl overflow-hidden transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F3B51C]"
      style={{
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border)',
        boxShadow: '0 2px 12px rgba(16,25,52,0.05)',
      }}
      {...stagger(delay)}
      whileHover={{ y: -1, boxShadow: '0 6px 24px rgba(16,25,52,0.10)' }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="p-4 flex items-start gap-3.5">
        {/* Icon */}
        <span
          className="flex size-11 items-center justify-center rounded-2xl flex-shrink-0 mt-0.5"
          style={{ background: accentBg }}
        >
          <Icon className="size-5" style={{ color: accentColor }} strokeWidth={1.8} />
        </span>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-bold" style={{ color: 'var(--ink)' }}>{label}</p>
            <Badge variant={isLive ? 'success' : 'muted'} className="text-[9px]">
              {statusLabel}
            </Badge>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
            {description}
          </p>
        </div>

        {/* Arrow */}
        <ArrowRight
          className="size-4 flex-shrink-0 mt-1"
          style={{ color: isLive ? 'var(--muted)' : 'var(--subtle)' }}
        />
      </div>
    </motion.button>
  )
}

// ─── Subscriptions placeholder ─────────────────────────────────────────────

function SubscriptionsPanel({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm font-semibold min-h-[44px] -ml-1 transition-opacity hover:opacity-70"
          style={{ color: 'var(--muted)' }}
        >
          <ChevronLeft className="size-4" /> Payments
        </button>
      </div>

      <PageHeader
        title="Subscriptions"
        subtitle="Recurring on-chain billing"
        right={<Badge variant="muted">Coming soon</Badge>}
      />

      {/* Why it doesn't exist yet */}
      <div
        className="rounded-3xl p-5 space-y-4"
        style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-start gap-3">
          <span
            className="flex size-9 items-center justify-center rounded-2xl flex-shrink-0"
            style={{ background: 'rgba(102,117,160,0.12)' }}
          >
            <Info className="size-4" style={{ color: 'var(--muted)' }} />
          </span>
          <div>
            <p className="text-sm font-bold mb-1" style={{ color: 'var(--ink)' }}>
              Why subscriptions need a new design
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
              True recurring payments require a subscriber to authorize a keeper or contract to
              pull USDC on a schedule — without needing a manual signature each time. The current
              Permit2 flow requires one signature per transfer, which is correct for single
              payments but not for automated recurring billing.
            </p>
          </div>
        </div>

        <div className="h-px" style={{ background: 'var(--border)' }} />

        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--subtle)', letterSpacing: '0.09em' }}>
            What's needed
          </p>
          {[
            { label: 'Subscription registry contract', detail: 'Stores authorized billing relationships on-chain.' },
            { label: 'Keeper / executor', detail: 'Off-chain or on-chain agent that triggers pulls when due.' },
            { label: 'Cancellation mechanism', detail: 'Subscriber can revoke authorization at any time.' },
            { label: 'Funding check', detail: 'Graceful handling of insufficient USDC at billing time.' },
          ].map(({ label, detail }) => (
            <div key={label} className="flex items-start gap-2.5">
              <AlertCircle className="size-3.5 mt-0.5 flex-shrink-0" style={{ color: 'var(--subtle)' }} />
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{label}</p>
                <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{detail}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="h-px" style={{ background: 'var(--border)' }} />

        <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
          In the meantime, use{' '}
          <Link to="/schedules" className="font-semibold" style={{ color: 'var(--navy)' }}>
            Scheduled Payouts
          </Link>
          {' '}for fixed allowances and payroll, or{' '}
          <Link to="/request" className="font-semibold" style={{ color: 'var(--navy)' }}>
            Invoices
          </Link>
          {' '}to request each payment manually.
        </p>
      </div>
    </div>
  )
}

// ─── Schedules redirect panel ──────────────────────────────────────────────

function SchedulesPanel({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm font-semibold min-h-[44px] -ml-1 transition-opacity hover:opacity-70"
        style={{ color: 'var(--muted)' }}
      >
        <ChevronLeft className="size-4" /> Payments
      </button>

      <PageHeader
        title="Scheduled Payouts"
        subtitle="Automated USDC disbursements"
        right={<Badge variant="success">Live</Badge>}
      />

      {/* Feature grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { label: 'Pay Later', desc: 'Lock USDC to unlock at a future date.' },
          { label: 'Allowance', desc: 'Recurring periodic USDC releases.' },
          { label: 'Vesting', desc: 'Linear vesting with cliff date.' },
          { label: 'Payroll', desc: 'Multi-recipient periodic disbursements.' },
          { label: 'Streaming', desc: 'Per-second real-time USDC stream.' },
          { label: 'Claim', desc: 'Recipient claims at any time.' },
        ].map(({ label, desc }) => (
          <div
            key={label}
            className="rounded-2xl p-3.5"
            style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
          >
            <p className="text-xs font-bold mb-0.5" style={{ color: 'var(--ink)' }}>{label}</p>
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>{desc}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2.5">
        <Link
          to="/schedules/new"
          className="flex items-center justify-center gap-2 w-full rounded-2xl py-4 text-sm font-bold transition-all active:scale-[0.98]"
          style={{
            background: '#F3B51C',
            color: '#0A0F1E',
            boxShadow: '0 2px 12px rgba(243,181,28,0.35)',
          }}
        >
          <CalendarClock className="size-4" strokeWidth={2.2} />
          Create a schedule
        </Link>
        <Link
          to="/schedules"
          className="flex items-center justify-center gap-2 w-full rounded-2xl py-3.5 text-sm font-bold transition-all active:scale-[0.98]"
          style={{
            background: 'var(--surface-elevated)',
            color: 'var(--navy)',
            border: '1px solid var(--border)',
          }}
        >
          View all schedules
          <ArrowRight className="size-4" />
        </Link>
      </div>

      <p className="text-[11px] text-center" style={{ color: 'var(--subtle)' }}>
        All schedules are non-custodial. Funds are deposited once and released by the contract.
      </p>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

export function Payments() {
  const [category, setCategory] = useState<Category>('hub')

  const slideVariants = {
    initial: { opacity: 0, x: 24 },
    animate: { opacity: 1, x: 0 },
    exit:    { opacity: 0, x: -20 },
  }
  const transition = { duration: 0.20, ease: [0.25, 0.1, 0.25, 1.0] as [number,number,number,number] }

  return (
    <AnimatePresence mode="wait">
      {category === 'hub' && (
        <motion.div key="hub" {...slideVariants} transition={transition} className="space-y-4">
          <PageHeader title="Payments" subtitle="Invoices, escrow, schedules & more" />

          <div className="space-y-2.5">
            {categories.map((cat, i) => (
              <CategoryCard
                key={cat.id}
                {...cat}
                delay={i * 0.06}
                onClick={() => setCategory(cat.id)}
              />
            ))}
          </div>

          {/* Quick links strip */}
          <div
            className="rounded-2xl px-4 py-3 flex items-center justify-between"
            style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
          >
            <p className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Quick actions</p>
            <div className="flex items-center gap-3">
              <Link
                to="/send"
                className="text-xs font-bold transition-opacity hover:opacity-70 min-h-[44px] flex items-center"
                style={{ color: 'var(--navy)' }}
              >
                Send
              </Link>
              <span style={{ color: 'var(--border-mid)' }}>·</span>
              <Link
                to="/request"
                className="text-xs font-bold transition-opacity hover:opacity-70 min-h-[44px] flex items-center"
                style={{ color: 'var(--navy)' }}
              >
                Request
              </Link>
              <span style={{ color: 'var(--border-mid)' }}>·</span>
              <Link
                to="/scan"
                className="text-xs font-bold transition-opacity hover:opacity-70 min-h-[44px] flex items-center"
                style={{ color: 'var(--navy)' }}
              >
                Scan
              </Link>
            </div>
          </div>
        </motion.div>
      )}

      {category === 'invoices' && (
        <motion.div key="invoices" {...slideVariants} transition={transition}>
          <InvoicePanel onBack={() => setCategory('hub')} />
        </motion.div>
      )}

      {category === 'escrow' && (
        <motion.div key="escrow" {...slideVariants} transition={transition}>
          <EscrowPanel onBack={() => setCategory('hub')} />
        </motion.div>
      )}

      {category === 'schedules' && (
        <motion.div key="schedules" {...slideVariants} transition={transition}>
          <SchedulesPanel onBack={() => setCategory('hub')} />
        </motion.div>
      )}

      {category === 'subscriptions' && (
        <motion.div key="subscriptions" {...slideVariants} transition={transition}>
          <SubscriptionsPanel onBack={() => setCategory('hub')} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
