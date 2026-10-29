/**
 * Schedules — Sent and Received tabs listing all schedules for the connected wallet.
 */

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { type Hex } from 'viem'
import { Link } from 'react-router-dom'
import { Plus, ArrowUpRight, Inbox, Loader2, CalendarClock } from 'lucide-react'
import { motion } from 'framer-motion'
import { useMySchedules, useSchedule } from '../hooks/useScheduledPayouts'
import { ScheduleCard } from '../components/schedules/ScheduleCard'
import { EmptyState, stagger, PageHeader } from '../components/ui'

type Tab = 'sent' | 'received'

function ScheduleItem({ id, viewer }: { id: Hex; viewer: `0x${string}` }) {
  const { schedule } = useSchedule(id)
  if (!schedule) return null
  return <ScheduleCard scheduleId={id} schedule={schedule} viewer={viewer} />
}

export function Schedules() {
  const { address } = useAccount()
  const [tab, setTab] = useState<Tab>('sent')
  const { sentIds, receivedIds, isLoading, isError } = useMySchedules()

  const activeIds = tab === 'sent' ? sentIds : receivedIds

  return (
    <div className="space-y-4">
      <PageHeader
        title="Schedules"
        subtitle="Automated USDC payouts"
        right={
          <Link
            to="/schedules/new"
            className="flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm font-bold transition-all active:scale-95"
            style={{
              background: '#F3B51C',
              color: '#0A0F1E',
              boxShadow: '0 2px 8px rgba(243,181,28,0.30)',
              minHeight: 40,
            }}
          >
            <Plus className="size-4" strokeWidth={2.5} />
            New
          </Link>
        }
      />

      {/* Tab bar */}
      <div className="flex gap-1.5 rounded-2xl p-1.5" style={{ background: 'var(--surface-muted)' }}>
        {(['sent', 'received'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition-all min-h-[40px]"
            style={{
              background: tab === t ? '#fff' : 'transparent',
              color: tab === t ? 'var(--navy)' : 'var(--muted)',
              boxShadow: tab === t ? '0 1px 6px rgba(16,25,52,0.10)' : 'none',
            }}
          >
            {t === 'sent' ? <ArrowUpRight className="size-3.5" /> : <Inbox className="size-3.5" />}
            {t === 'sent' ? 'Sent' : 'Received'}
            {t === 'sent' && sentIds.length > 0 && (
              <span
                className="rounded-full px-1.5 text-[10px] font-bold"
                style={{ background: 'var(--gold-muted)', color: '#9A6E00' }}
              >
                {sentIds.length}
              </span>
            )}
            {t === 'received' && receivedIds.length > 0 && (
              <span
                className="rounded-full px-1.5 text-[10px] font-bold"
                style={{ background: 'var(--gold-muted)', color: '#9A6E00' }}
              >
                {receivedIds.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2.5 py-12" style={{ color: 'var(--muted)' }}>
          <Loader2 className="size-5 animate-spin" />
          <span className="text-sm">Loading schedules…</span>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div
          className="rounded-2xl p-4 text-center text-sm font-medium"
          style={{ background: 'var(--danger-muted)', color: 'var(--danger)', border: '1px solid rgba(192,51,74,0.18)' }}
        >
          Failed to load schedules. Check your connection and try again.
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && activeIds.length === 0 && (
        <div
          className="rounded-3xl"
          style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
        >
          {tab === 'sent' ? (
            <EmptyState
              icon={<CalendarClock className="size-6" />}
              title="No schedules sent yet"
              body="Create a scheduled payout — pay later, allowances, vesting, payroll, or a live salary stream."
              action={
                <Link
                  to="/schedules/new"
                  className="flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm font-bold"
                  style={{ background: '#F3B51C', color: '#0A0F1E', boxShadow: '0 2px 8px rgba(243,181,28,0.30)' }}
                >
                  <Plus className="size-4" strokeWidth={2.5} />
                  Create schedule
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon={<Inbox className="size-6" />}
              title="No incoming schedules"
              body="When someone sends you a scheduled payout, it will appear here."
            />
          )}
        </div>
      )}

      {/* Schedule list */}
      {!isLoading && !isError && activeIds.length > 0 && address && (
        <motion.div className="space-y-3" {...stagger(0)}>
          {activeIds.map((id, i) => (
            <motion.div key={id} {...stagger(i * 0.06)}>
              <ScheduleItem id={id} viewer={address} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
