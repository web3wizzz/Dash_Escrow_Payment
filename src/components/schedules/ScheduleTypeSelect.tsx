/**
 * ScheduleTypeSelect — horizontal scrollable chip row.
 * Compact, touch-friendly, preserves full type metadata on tap/click.
 */

import { motion } from 'framer-motion'
import { Clock, Repeat, TrendingUp, Users, Waves } from 'lucide-react'
import { ScheduleType, SCHEDULE_TYPE_LABELS, SCHEDULE_TYPE_DESCRIPTIONS, type ScheduleTypeValue } from '../../lib/schedules'

const TYPE_ICONS: Record<ScheduleTypeValue, React.ElementType> = {
  [ScheduleType.PayLater]:  Clock,
  [ScheduleType.Allowance]: Repeat,
  [ScheduleType.Vesting]:   TrendingUp,
  [ScheduleType.Payroll]:   Users,
  [ScheduleType.Streaming]: Waves,
}

interface ScheduleTypeSelectProps {
  value: ScheduleTypeValue
  onChange: (t: ScheduleTypeValue) => void
}

export function ScheduleTypeSelect({ value, onChange }: ScheduleTypeSelectProps) {
  const types = Object.values(ScheduleType) as ScheduleTypeValue[]

  return (
    <div className="space-y-3">
      {/* ── Chip row ── */}
      <div
        className="flex gap-2 overflow-x-auto pb-0.5 -mx-5 px-5"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        role="radiogroup"
        aria-label="Schedule type"
      >
        {types.map((t) => {
          const Icon = TYPE_ICONS[t]
          const active = value === t
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(t)}
              className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold whitespace-nowrap shrink-0 transition-all active:scale-95"
              style={{
                background: active ? 'var(--ink)' : 'var(--surface)',
                color: active ? '#fff' : 'var(--muted)',
                border: active ? '1.5px solid var(--ink)' : '1.5px solid var(--border)',
                fontFamily: '"Figtree",sans-serif',
                minHeight: 36,
              }}
            >
              <Icon
                className="size-3.5 shrink-0"
                strokeWidth={active ? 2.2 : 1.8}
              />
              {SCHEDULE_TYPE_LABELS[t]}
            </button>
          )
        })}
      </div>

      {/* ── Active type description card ── */}
      <motion.div
        key={value}
        initial={{ opacity: 0, y: 3 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1.0] }}
        className="flex items-start gap-2.5 rounded-xl px-4 py-3"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
        }}
      >
        {(() => {
          const Icon = TYPE_ICONS[value]
          return (
            <span
              className="flex shrink-0 items-center justify-center rounded-lg mt-0.5"
              style={{ width: 28, height: 28, background: 'rgba(242,169,0,0.12)' }}
            >
              <Icon className="size-3.5" style={{ color: '#9A6E00' }} strokeWidth={2} />
            </span>
          )
        })()}
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            {SCHEDULE_TYPE_LABELS[value]}
          </p>
          <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--muted)' }}>
            {SCHEDULE_TYPE_DESCRIPTIONS[value]}
          </p>
        </div>
      </motion.div>
    </div>
  )
}
