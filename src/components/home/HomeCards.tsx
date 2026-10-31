/**
 * HomeCards — sections below the balance hero.
 *
 * UX fixes applied:
 *  - Send/Request removed from QuickActions (they live in BalanceHero — no duplicate)
 *  - QuickActions now has: Scan, Escrow, Schedule, Request (deeper flows)
 *  - Module wrapper: NO border+shadow on every block. Use whitespace + type hierarchy.
 *  - stagger() only on first mount. Max delay capped at 220ms.
 *  - SandboxBadge: quiet, top-right only
 */

import { motion } from 'framer-motion'
import { Link }   from 'react-router-dom'
import {
  QrCode, ShieldCheck, CalendarClock, ArrowDownLeft,
  ArrowRight, Activity, Clock, ChevronRight,
} from 'lucide-react'
import { formatUnits } from 'viem'
import { BRAND }   from '../../../config/brand'
import { stagger } from '../ui'
import type { ReactNode } from 'react'

// ─── Sandbox badge ────────────────────────────────────────────────────────────

export function SandboxBadge() {
  return (
    <span
      aria-label="Testnet environment"
      style={{
        fontFamily: '"Figtree",sans-serif',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase' as const,
        color: 'var(--warning)',
        background: 'var(--warning-muted)',
        border: '1px solid rgba(204,122,0,0.16)',
        borderRadius: 6,
        padding: '2px 8px',
        lineHeight: '16px',
        display: 'inline-block',
      }}
    >
      Testnet
    </span>
  )
}

// ─── Section head — typography hierarchy, no border ──────────────────────────

function SectionHead({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p
        style={{
          fontFamily: '"Figtree",sans-serif',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase' as const,
          color: 'var(--muted)',
        }}
      >
        {children}
      </p>
      {action}
    </div>
  )
}

// ─── Quick actions — 4 items, no Send/Request duplication ─────────────────────
// Send & Request already live in BalanceHero.

const ACTIONS = [
  { to: '/scan',      label: 'Scan',     Icon: QrCode,        bg: 'rgba(242,169,0,0.10)',  fg: '#8A6200' },
  { to: '/payments',  label: 'Escrow',   Icon: ShieldCheck,   bg: 'rgba(26,127,78,0.09)',  fg: 'var(--success)' },
  { to: '/schedules', label: 'Schedule', Icon: CalendarClock, bg: 'rgba(14,16,48,0.06)',   fg: 'var(--ink)' },
  { to: '/request',   label: 'Request',  Icon: ArrowDownLeft, bg: 'rgba(14,16,48,0.06)',   fg: 'var(--ink)' },
]

export function QuickActions() {
  return (
    <motion.div
      className="grid grid-cols-4 gap-2"
      initial="hidden"
      animate="visible"
    >
      {ACTIONS.map(({ to, label, Icon, bg, fg }, i) => (
        <motion.div
          key={to}
          variants={{
            hidden: { opacity: 0, y: 6 },
            visible: {
              opacity: 1, y: 0,
              transition: { duration: 0.18, delay: Math.min(i * 0.05, 0.18), ease: [0.25,0.1,0.25,1] },
            },
          }}
        >
          <Link
            to={to}
            className="flex flex-col items-center gap-2 py-3 rounded-2xl transition-all active:scale-[0.94]"
            style={{ background: 'var(--surface)' }}
            aria-label={label}
          >
            <span
              className="flex items-center justify-center rounded-xl"
              style={{ width: 40, height: 36, background: bg }}
              aria-hidden
            >
              <Icon className="size-[17px]" style={{ color: fg }} strokeWidth={1.9} />
            </span>
            <span
              style={{
                fontFamily: '"Figtree",sans-serif',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--muted)',
              }}
            >
              {label}
            </span>
          </Link>
        </motion.div>
      ))}
    </motion.div>
  )
}

// ─── Flat section — no border card, whitespace only ──────────────────────────

function Section({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <motion.div {...stagger(delay)}>
      {children}
    </motion.div>
  )
}

// ─── List row ─────────────────────────────────────────────────────────────────

function ListRow({
  icon, iconBg, label, meta, value, to,
}: {
  icon: ReactNode; iconBg: string; label: string; meta?: string
  value?: ReactNode; to?: string
}) {
  const inner = (
    <div
      className="flex items-center gap-3 py-3.5 min-h-[56px]"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <span
        aria-hidden
        className="flex items-center justify-center rounded-xl flex-shrink-0"
        style={{ width: 36, height: 36, background: iconBg }}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p style={{ fontFamily: '"Figtree",sans-serif', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
          {label}
        </p>
        {meta && (
          <p style={{ fontFamily: '"Figtree",sans-serif', fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>
            {meta}
          </p>
        )}
      </div>
      {value && (
        <div style={{ fontFamily: '"Figtree",sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--ink)', textAlign: 'right' as const, flexShrink: 0 }}>
          {value}
        </div>
      )}
      {to && <ChevronRight className="size-4 flex-shrink-0 text-[var(--subtle)]" />}
    </div>
  )

  if (to) {
    return (
      <Link to={to} className="block transition-colors hover:bg-slate-50/60 active:bg-slate-100/80 -mx-1 px-1 rounded-lg">
        {inner}
      </Link>
    )
  }
  return <div>{inner}</div>
}

// ─── Protected payments ───────────────────────────────────────────────────────

export function ProtectedPayments() {
  const pendingOrders: never[] = []

  return (
    <Section delay={0.08}>
      <SectionHead
        action={
          <Link
            to="/payments"
            className="flex items-center gap-0.5 text-[11px] font-semibold transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2A900] rounded"
            style={{ color: 'var(--saffron)', fontFamily: '"Figtree",sans-serif' }}
          >
            View all <ArrowRight className="size-3" aria-hidden />
          </Link>
        }
      >
        Protected payments
      </SectionHead>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)' }}>
        {pendingOrders.length === 0 ? (
          <div className="flex items-center gap-3 px-4 py-4">
            <span
              aria-hidden
              className="flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ width: 36, height: 36, background: 'rgba(26,127,78,0.09)' }}
            >
              <ShieldCheck className="size-4" style={{ color: 'var(--success)' }} strokeWidth={1.8} />
            </span>
            <div>
              <p style={{ fontFamily: '"Figtree",sans-serif', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                No pending orders
              </p>
              <p style={{ fontFamily: '"Figtree",sans-serif', fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Escrow payments auto-refund after 30 min
              </p>
            </div>
          </div>
        ) : null}

        <div className="px-4 pb-4 pt-1">
          <Link
            to="/payments"
            className="flex items-center justify-center gap-1.5 w-full rounded-xl py-2.5 text-[13px] font-semibold transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2A900]"
            style={{
              background: 'var(--surface-muted)',
              color: 'var(--ink)',
              fontFamily: '"Figtree",sans-serif',
              minHeight: 44,
            }}
            aria-label="Create an escrow order"
          >
            Create escrow order
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </Section>
  )
}

// ─── Scheduled / limits ───────────────────────────────────────────────────────

export function LimitsCard() {
  const globalCapFormatted = `$${parseFloat(formatUnits(25_000_000n, 6)).toFixed(0)}`

  return (
    <Section delay={0.12}>
      <SectionHead
        action={
          <Link
            to="/schedules"
            className="flex items-center gap-0.5 text-[11px] font-semibold transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2A900] rounded"
            style={{ color: 'var(--saffron)', fontFamily: '"Figtree",sans-serif' }}
          >
            View all <ArrowRight className="size-3" aria-hidden />
          </Link>
        }
      >
        Scheduled
      </SectionHead>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', padding: '0 16px' }}>
        <ListRow
          icon={<Clock className="size-4" style={{ color: 'var(--muted)' }} strokeWidth={1.8} />}
          iconBg="rgba(14,16,48,0.05)"
          label="Claimable now"
          meta="No claimable payouts"
        />
        <ListRow
          icon={<CalendarClock className="size-4" style={{ color: 'var(--muted)' }} strokeWidth={1.8} />}
          iconBg="rgba(14,16,48,0.05)"
          label="Per-payment cap"
          meta={`${globalCapFormatted} USDC · permissionless`}
          value={
            <span
              style={{
                background: 'rgba(26,127,78,0.10)',
                color: 'var(--success-text)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase' as const,
                borderRadius: 6,
                padding: '2px 7px',
                fontFamily: '"Figtree",sans-serif',
              }}
            >
              Active
            </span>
          }
        />
        <div className="py-4">
          <Link
            to="/schedules/new"
            className="flex items-center justify-center gap-1.5 w-full rounded-xl py-2.5 text-[13px] font-semibold transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2A900]"
            style={{
              background: 'var(--surface-muted)',
              color: 'var(--ink)',
              fontFamily: '"Figtree",sans-serif',
              minHeight: 44,
            }}
            aria-label="Create a new scheduled payment"
          >
            Create schedule
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </Section>
  )
}

// ─── Recent activity ──────────────────────────────────────────────────────────

export function RecentActivity() {
  return (
    <Section delay={0.16}>
      <SectionHead>Recent activity</SectionHead>

      {/* Empty state — small and elegant, not a full-height card */}
      <div className="flex items-center gap-4 py-6 px-1">
        <span
          aria-hidden
          className="flex items-center justify-center rounded-xl flex-shrink-0"
          style={{ width: 40, height: 40, background: 'var(--surface)' }}
        >
          <Activity className="size-[18px]" style={{ color: 'var(--subtle)' }} strokeWidth={1.6} />
        </span>
        <div>
          <p style={{ fontFamily: '"Figtree",sans-serif', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
            No transactions yet
          </p>
          <p style={{ fontFamily: '"Figtree",sans-serif', fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
            {`Send or receive USDC on ${BRAND.networkName}`}
          </p>
        </div>
      </div>
    </Section>
  )
}
