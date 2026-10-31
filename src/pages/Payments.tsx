/**
 * Payments — financial services hub.
 *
 * Organized into groups:
 *   Core        — Send, Request, Invoices, Escrow
 *   Automation  — Scheduled Payouts, Payroll / Vesting
 *   Future      — Subscriptions (coming soon)
 *
 * Each item is a compact list row with icon, title, description, status, and chevron.
 * No large cards. Status badges are small and quiet.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowUpRight, ArrowDownLeft, FileText, ShieldCheck,
  CalendarClock, Users, RefreshCw, ChevronRight,
  ChevronLeft,
} from 'lucide-react'
import { InvoicePanel } from '../components/payments/InvoicePanel'
import { EscrowPanel } from '../components/payments/EscrowPanel'

// ─── Types ────────────────────────────────────────────────────────────────────

type PanelId = 'hub' | 'invoices' | 'escrow' | 'schedules' | 'subscriptions'

interface ServiceItem {
  id: PanelId
  icon: React.ElementType
  iconBg: string
  iconFg: string
  label: string
  description: string
  status: 'live' | 'coming-soon'
  isLink?: string  // navigate directly rather than open panel
}

// ─── Service definitions ──────────────────────────────────────────────────────

const CORE: ServiceItem[] = [
  {
    id: 'invoices',
    icon: FileText,
    iconBg: 'rgba(26,127,78,0.10)',
    iconFg: 'var(--success)',
    label: 'Invoices',
    description: 'Request USDC with a shareable link or QR code.',
    status: 'live',
  },
  {
    id: 'escrow',
    icon: ShieldCheck,
    iconBg: 'rgba(242,169,0,0.11)',
    iconFg: '#8A6200',
    label: 'Escrow',
    description: 'Hold funds until a service is confirmed. Auto-refund in 30 min.',
    status: 'live',
  },
]

const CORE_QUICK: ServiceItem[] = [
  {
    id: 'hub',
    icon: ArrowUpRight,
    iconBg: 'rgba(14,16,48,0.07)',
    iconFg: 'var(--ink)',
    label: 'Send',
    description: 'Send USDC to any address.',
    status: 'live',
    isLink: '/send',
  },
  {
    id: 'hub',
    icon: ArrowDownLeft,
    iconBg: 'rgba(14,16,48,0.07)',
    iconFg: 'var(--ink)',
    label: 'Request',
    description: 'Create a payment request.',
    status: 'live',
    isLink: '/request',
  },
]

const AUTOMATION: ServiceItem[] = [
  {
    id: 'schedules',
    icon: CalendarClock,
    iconBg: 'rgba(27,31,75,0.09)',
    iconFg: 'var(--indigo)',
    label: 'Scheduled Payouts',
    description: 'Pay later, allowances, cliff vesting, streaming.',
    status: 'live',
    isLink: '/schedules',
  },
  {
    id: 'schedules',
    icon: Users,
    iconBg: 'rgba(27,31,75,0.09)',
    iconFg: 'var(--indigo)',
    label: 'Payroll',
    description: 'Multi-recipient periodic USDC disbursements.',
    status: 'live',
    isLink: '/schedules/new',
  },
]

const FUTURE: ServiceItem[] = [
  {
    id: 'subscriptions',
    icon: RefreshCw,
    iconBg: 'rgba(105,114,143,0.09)',
    iconFg: 'var(--muted)',
    label: 'Subscriptions',
    description: 'Recurring authorized USDC billing.',
    status: 'coming-soon',
  },
]

// ─── Row ──────────────────────────────────────────────────────────────────────

function ServiceRow({
  item,
  onPress,
}: {
  item: ServiceItem
  onPress: (id: PanelId) => void
}) {
  const isLive = item.status === 'live'

  const inner = (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span
        className="flex items-center justify-center rounded-xl flex-shrink-0"
        style={{ width: 38, height: 38, background: item.iconBg }}
      >
        <item.icon className="size-[17px]" style={{ color: item.iconFg }} strokeWidth={1.8} />
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            style={{
              fontFamily: '"Figtree",sans-serif',
              fontSize: 14,
              fontWeight: 600,
              color: isLive ? 'var(--ink)' : 'var(--muted)',
            }}
          >
            {item.label}
          </span>
          {item.status === 'coming-soon' && (
            <span
              style={{
                fontFamily: '"Figtree",sans-serif',
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--muted)',
                background: 'var(--surface-muted)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '1px 5px',
              }}
            >
              Soon
            </span>
          )}
        </div>
        <p
          style={{
            fontFamily: '"Figtree",sans-serif',
            fontSize: 12,
            color: 'var(--muted)',
            lineHeight: 1.4,
          }}
        >
          {item.description}
        </p>
      </div>

      <ChevronRight
        className="size-4 flex-shrink-0"
        style={{ color: isLive ? 'var(--subtle)' : 'var(--border-mid)' }}
      />
    </div>
  )

  if (item.isLink) {
    return (
      <Link
        to={item.isLink}
        className="block transition-colors"
        style={{ '--hover-bg': 'var(--surface-muted)' } as React.CSSProperties}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-muted)')}
        onMouseLeave={e => (e.currentTarget.style.background = '')}
      >
        {inner}
      </Link>
    )
  }

  return (
    <button
      onClick={() => isLive && onPress(item.id)}
      disabled={!isLive}
      className="w-full text-left block transition-colors disabled:cursor-default"
      onMouseEnter={e => isLive && (e.currentTarget.style.background = 'var(--surface-muted)')}
      onMouseLeave={e => (e.currentTarget.style.background = '')}
    >
      {inner}
    </button>
  )
}

// ─── Group card ───────────────────────────────────────────────────────────────

function ServiceGroup({
  heading,
  items,
  delay,
  onPress,
}: {
  heading: string
  items: ServiceItem[]
  delay: number
  onPress: (id: PanelId) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay, ease: [0.25, 0.1, 0.25, 1.0] }}
    >
      <p
        className="mb-2 px-1"
        style={{
          fontFamily: '"Figtree",sans-serif',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
        }}
      >
        {heading}
      </p>
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 1px 4px rgba(14,16,48,0.04)',
        }}
      >
        {items.map((item, i) => (
          <div key={`${item.label}-${i}`}>
            {i > 0 && <div style={{ height: 1, background: 'var(--border)', marginLeft: 54 }} />}
            <ServiceRow item={item} onPress={onPress} />
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Back button ─────────────────────────────────────────────────────────────

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      className="flex items-center gap-1 text-[14px] font-semibold min-h-[44px] -ml-1 mb-3 transition-opacity hover:opacity-70"
      style={{ color: 'var(--muted)', fontFamily: '"Figtree",sans-serif' }}
    >
      <ChevronLeft className="size-4" />
      Payments
    </button>
  )
}

// ─── Subscriptions placeholder ────────────────────────────────────────────────

function SubscriptionsPanel({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-4">
      <BackButton onBack={onBack} />
      <div>
        <h1
          style={{
            fontFamily: '"Bricolage Grotesque",sans-serif',
            fontWeight: 700,
            fontSize: '1.5rem',
            letterSpacing: '-0.03em',
            color: 'var(--ink)',
            marginBottom: 4,
          }}
        >
          Subscriptions
        </h1>
        <p style={{ fontFamily: '"Figtree",sans-serif', fontSize: 13, color: 'var(--muted)' }}>
          Recurring on-chain billing — coming soon
        </p>
      </div>

      <div
        className="rounded-xl p-4 space-y-3"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <p style={{ fontFamily: '"Figtree",sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
          Why it doesn't exist yet
        </p>
        <p style={{ fontFamily: '"Figtree",sans-serif', fontSize: 13, color: 'var(--muted)', lineHeight: 1.55 }}>
          True recurring payments require a subscriber to authorize a keeper to pull USDC on a schedule
          — without a manual signature each time. The current Permit2 flow is correct for single
          payments but not for automated recurring billing. A subscription registry contract and
          off-chain keeper are required.
        </p>
        <p style={{ fontFamily: '"Figtree",sans-serif', fontSize: 13, color: 'var(--muted)', lineHeight: 1.55 }}>
          In the meantime, use{' '}
          <Link to="/schedules" className="font-semibold" style={{ color: 'var(--ink)' }}>Scheduled Payouts</Link>
          {' '}for fixed allowances and payroll.
        </p>
      </div>
    </div>
  )
}

// ─── Schedules redirect panel ─────────────────────────────────────────────────

function SchedulesPanel({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-4">
      <BackButton onBack={onBack} />
      <div>
        <h1
          style={{
            fontFamily: '"Bricolage Grotesque",sans-serif',
            fontWeight: 700,
            fontSize: '1.5rem',
            letterSpacing: '-0.03em',
            color: 'var(--ink)',
            marginBottom: 4,
          }}
        >
          Scheduled Payouts
        </h1>
        <p style={{ fontFamily: '"Figtree",sans-serif', fontSize: 13, color: 'var(--muted)' }}>
          Automated USDC disbursements on-chain
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Pay Later',  desc: 'Lock and release at a future date.' },
          { label: 'Allowance',  desc: 'Recurring periodic releases.' },
          { label: 'Vesting',    desc: 'Linear vesting with cliff.' },
          { label: 'Payroll',    desc: 'Multi-recipient periodic.' },
          { label: 'Streaming',  desc: 'Per-second real-time stream.' },
          { label: 'Claim',      desc: 'Recipient claims any time.' },
        ].map(({ label, desc }) => (
          <div
            key={label}
            className="rounded-xl p-3"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <p style={{ fontFamily: '"Figtree",sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>
              {label}
            </p>
            <p style={{ fontFamily: '"Figtree",sans-serif', fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
              {desc}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Link
          to="/schedules/new"
          className="flex items-center justify-center gap-1.5 w-full rounded-xl py-3.5 text-[14px] font-semibold transition-all active:scale-[0.98]"
          style={{ background: 'var(--saffron)', color: '#0A0B1E', fontFamily: '"Figtree",sans-serif' }}
        >
          <CalendarClock className="size-4" strokeWidth={2} />
          Create a schedule
        </Link>
        <Link
          to="/schedules"
          className="flex items-center justify-center gap-1.5 w-full rounded-xl py-3.5 text-[14px] font-semibold transition-all active:scale-[0.98]"
          style={{ background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--border)', fontFamily: '"Figtree",sans-serif' }}
        >
          View all schedules
        </Link>
      </div>
    </div>
  )
}

// ─── Hub ──────────────────────────────────────────────────────────────────────

function PaymentsHub({ onPress }: { onPress: (id: PanelId) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h1
          style={{
            fontFamily: '"Bricolage Grotesque",sans-serif',
            fontWeight: 700,
            fontSize: '1.5rem',
            letterSpacing: '-0.03em',
            color: 'var(--ink)',
            marginBottom: 3,
          }}
        >
          Payments
        </h1>
        <p style={{ fontFamily: '"Figtree",sans-serif', fontSize: 13, color: 'var(--muted)' }}>
          Non-custodial USDC flows — all on Arc
        </p>
      </div>

      <ServiceGroup heading="Core" items={[...CORE_QUICK, ...CORE]} delay={0.04} onPress={onPress} />
      <ServiceGroup heading="Automation" items={AUTOMATION} delay={0.10} onPress={onPress} />
      <ServiceGroup heading="Future" items={FUTURE} delay={0.16} onPress={onPress} />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Payments() {
  const [panel, setPanel] = useState<PanelId>('hub')

  const transition = { duration: 0.18, ease: [0.25, 0.1, 0.25, 1.0] as [number,number,number,number] }
  const slide = {
    initial: { opacity: 0, x: 18 },
    animate: { opacity: 1, x: 0 },
    exit:    { opacity: 0, x: -14 },
  }

  return (
    <AnimatePresence mode="wait">
      {panel === 'hub' && (
        <motion.div key="hub" {...slide} transition={transition}>
          <PaymentsHub onPress={setPanel} />
        </motion.div>
      )}
      {panel === 'invoices' && (
        <motion.div key="invoices" {...slide} transition={transition}>
          <InvoicePanel onBack={() => setPanel('hub')} />
        </motion.div>
      )}
      {panel === 'escrow' && (
        <motion.div key="escrow" {...slide} transition={transition}>
          <EscrowPanel onBack={() => setPanel('hub')} />
        </motion.div>
      )}
      {panel === 'schedules' && (
        <motion.div key="schedules" {...slide} transition={transition}>
          <SchedulesPanel onBack={() => setPanel('hub')} />
        </motion.div>
      )}
      {panel === 'subscriptions' && (
        <motion.div key="subscriptions" {...slide} transition={transition}>
          <SubscriptionsPanel onBack={() => setPanel('hub')} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
