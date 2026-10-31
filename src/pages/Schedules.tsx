/**
 * Schedules — Sent / Received tabs with sliding indicator.
 * Empty states are inline and minimal, not full-page cards.
 */

import { useState, useRef } from 'react'
import { useAccount } from 'wagmi'
import { type Hex } from 'viem'
import { Link } from 'react-router-dom'
import { Plus, ArrowUpRight, Inbox, Loader2, CalendarClock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMySchedules, useSchedule } from '../hooks/useScheduledPayouts'
import { ScheduleCard } from '../components/schedules/ScheduleCard'
import { stagger } from '../components/ui'

type Tab = 'sent' | 'received'

const TABS: { id: Tab; label: string; icon: typeof ArrowUpRight }[] = [
  { id: 'sent',     label: 'Sent',     icon: ArrowUpRight },
  { id: 'received', label: 'Received', icon: Inbox },
]

function ScheduleItem({ id, viewer }: { id: Hex; viewer: `0x${string}` }) {
  const { schedule } = useSchedule(id)
  if (!schedule) return null
  return <ScheduleCard scheduleId={id} schedule={schedule} viewer={viewer} />
}

export function Schedules() {
  const { address } = useAccount()
  const [tab, setTab] = useState<Tab>('sent')
  const { sentIds, receivedIds, isLoading, isError } = useMySchedules()
  const tabsRef = useRef<HTMLDivElement>(null)

  const activeIds = tab === 'sent' ? sentIds : receivedIds
  const counts = { sent: sentIds.length, received: receivedIds.length }

  return (
    <div className="space-y-0">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1
            className="display text-2xl font-bold"
            style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
          >
            Schedules
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
            Automated USDC payouts
          </p>
        </div>
        <Link
          to="/schedules/new"
          className="flex items-center gap-1.5 text-sm font-bold transition-all active:scale-95 mt-1"
          style={{
            background: 'var(--saffron)',
            color: '#0A0F1E',
            borderRadius: 12,
            padding: '9px 16px',
          }}
        >
          <Plus className="size-4" strokeWidth={2.5} />
          New
        </Link>
      </div>

      {/* ── Sliding tab bar ── */}
      <div
        ref={tabsRef}
        className="relative flex mb-4"
        style={{
          background: 'var(--surface)',
          borderRadius: 14,
          padding: 4,
          boxShadow: 'inset 0 1px 3px rgba(14,16,48,0.07)',
        }}
      >
        {/* Sliding pill */}
        <motion.div
          layout
          layoutId="schedules-tab-pill"
          className="absolute top-1 bottom-1"
          style={{
            left: tab === 'sent' ? 4 : 'calc(50% + 2px)',
            right: tab === 'sent' ? 'calc(50% + 2px)' : 4,
            background: 'var(--ink)',
            borderRadius: 10,
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        />

        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id
          const count = counts[id]
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="relative flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors z-10"
              style={{ color: active ? '#fff' : 'var(--muted)' }}
            >
              <Icon className="size-3.5" />
              {label}
              {count > 0 && (
                <span
                  className="rounded-full px-1.5 text-[10px] font-bold tabular-nums"
                  style={{
                    background: active ? 'rgba(255,255,255,0.18)' : 'var(--surface-muted)',
                    color: active ? '#fff' : 'var(--subtle)',
                    lineHeight: '18px',
                    minWidth: 18,
                    textAlign: 'center',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2.5 py-16" style={{ color: 'var(--muted)' }}>
          <Loader2 className="size-4 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      )}

      {/* ── Error ── */}
      {isError && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: 'var(--danger-muted)', color: 'var(--danger)', border: '1px solid rgba(184,50,72,0.15)' }}
        >
          Failed to load schedules. Check your connection.
        </div>
      )}

      {/* ── Empty state ── */}
      <AnimatePresence mode="wait">
        {!isLoading && !isError && activeIds.length === 0 && (
          <motion.div
            key={`empty-${tab}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col items-center text-center py-14 gap-3"
          >
            <div
              className="flex items-center justify-center rounded-full"
              style={{ width: 44, height: 44, background: 'var(--surface-muted)' }}
            >
              {tab === 'sent'
                ? <CalendarClock className="size-5" style={{ color: 'var(--subtle)' }} strokeWidth={1.6} />
                : <Inbox className="size-5" style={{ color: 'var(--subtle)' }} strokeWidth={1.6} />
              }
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                {tab === 'sent' ? 'No schedules yet' : 'No incoming schedules'}
              </p>
              <p className="text-xs mt-1 max-w-[220px] mx-auto leading-relaxed" style={{ color: 'var(--muted)' }}>
                {tab === 'sent'
                  ? 'Pay later, allowances, vesting, payroll, and streaming are all here.'
                  : 'Scheduled payouts sent to your address will appear here.'}
              </p>
            </div>
            {tab === 'sent' && (
              <Link
                to="/schedules/new"
                className="text-sm font-semibold transition-all active:scale-95"
                style={{ color: 'var(--accent)' }}
              >
                Create your first schedule →
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Schedule list ── */}
      <AnimatePresence mode="wait">
        {!isLoading && !isError && activeIds.length > 0 && address && (
          <motion.div
            key={`list-${tab}`}
            className="space-y-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
          >
            {activeIds.map((id, i) => (
              <motion.div key={id} {...stagger(i * 0.05)}>
                <ScheduleItem id={id} viewer={address} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
