/**
 * Schedules — Sent and Received tabs listing all schedules for the connected wallet.
 */

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { type Hex } from 'viem'
import { Link } from 'react-router-dom'
import { Plus, Send as SendIcon, Inbox, Loader2 } from 'lucide-react'
import { ConnectKitButton } from 'connectkit'
import { useMySchedules, useSchedule } from '../hooks/useScheduledPayouts'
import { ScheduleCard } from '../components/schedules/ScheduleCard'

type Tab = 'sent' | 'received'

/** Thin wrapper that loads a single schedule and renders it as a card */
function ScheduleItem({ id, viewer }: { id: Hex; viewer: `0x${string}` }) {
  const { schedule } = useSchedule(id)
  if (!schedule) return null
  return <ScheduleCard scheduleId={id} schedule={schedule} viewer={viewer} />
}

export function Schedules() {
  const { address, isConnected } = useAccount()
  const [tab, setTab] = useState<Tab>('sent')
  const { sentIds, receivedIds, isLoading, isError } = useMySchedules()

  const activeIds = tab === 'sent' ? sentIds : receivedIds

  if (!isConnected) {
    return (
      <div className="space-y-4 pt-6 text-center">
        <p className="display text-2xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
          Schedules
        </p>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Connect your wallet to view and create scheduled payouts.
        </p>
        <ConnectKitButton />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <h1 className="display text-xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
          Schedules
        </h1>
        <Link
          to="/schedules/new"
          className="btn-primary flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold"
          style={{ minHeight: 40 }}
        >
          <Plus className="size-4" />
          New
        </Link>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-2xl p-1" style={{ background: 'rgba(27,31,75,0.06)' }}>
        {(['sent', 'received'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold transition-all min-h-[40px]"
            style={{
              background: tab === t ? '#fff' : 'transparent',
              color: tab === t ? 'var(--ink)' : 'var(--muted)',
              boxShadow: tab === t ? '0 1px 4px rgba(27,31,75,0.10)' : 'none',
            }}
          >
            {t === 'sent' ? <SendIcon className="size-3.5" /> : <Inbox className="size-3.5" />}
            {t === 'sent' ? 'Sent' : 'Received'}
            {t === 'sent' && sentIds.length > 0 && (
              <span className="rounded-full px-1.5 text-[10px] font-bold" style={{ background: 'rgba(27,31,75,0.10)', color: 'var(--ink)' }}>
                {sentIds.length}
              </span>
            )}
            {t === 'received' && receivedIds.length > 0 && (
              <span className="rounded-full px-1.5 text-[10px] font-bold" style={{ background: 'rgba(27,31,75,0.10)', color: 'var(--ink)' }}>
                {receivedIds.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-10" style={{ color: 'var(--muted)' }}>
          <Loader2 className="size-5 animate-spin" />
          <span className="text-sm">Loading schedules…</span>
        </div>
      )}

      {isError && (
        <div className="rounded-2xl p-4 text-center text-sm" style={{ background: 'rgba(186,43,76,0.06)', color: 'var(--danger)' }}>
          Failed to load schedules. Check your connection and try again.
        </div>
      )}

      {!isLoading && !isError && activeIds.length === 0 && (
        <div className="rounded-3xl p-8 text-center space-y-3" style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(27,31,75,0.07)' }}>
          {tab === 'sent' ? (
            <>
              <SendIcon className="size-8 mx-auto" style={{ color: 'var(--subtle)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>No schedules sent yet</p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Create a scheduled payout — pay later, allowances, vesting, payroll, or a live salary stream.
              </p>
              <Link to="/schedules/new" className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold mt-2">
                <Plus className="size-4" /> Create schedule
              </Link>
            </>
          ) : (
            <>
              <Inbox className="size-8 mx-auto" style={{ color: 'var(--subtle)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>No incoming schedules</p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                When someone sends you a scheduled payout, it will appear here.
              </p>
            </>
          )}
        </div>
      )}

      {!isLoading && !isError && activeIds.length > 0 && address && (
        <div className="space-y-3">
          {activeIds.map(id => (
            <ScheduleItem key={id} id={id} viewer={address} />
          ))}
        </div>
      )}
    </div>
  )
}
