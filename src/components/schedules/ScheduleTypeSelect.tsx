/**
 * ScheduleTypeSelect — five schedule type chips with one-line descriptions.
 */

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
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)', letterSpacing: '0.06em' }}>
        Schedule type
      </p>
      <div className="grid grid-cols-1 gap-2">
        {types.map((t) => {
          const Icon = TYPE_ICONS[t]
          const active = value === t
          return (
            <button
              key={t}
              type="button"
              onClick={() => onChange(t)}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all min-h-[44px]"
              style={{
                background: active ? 'rgba(242,169,0,0.12)' : 'rgba(255,255,255,0.55)',
                border: active ? '1.5px solid rgba(242,169,0,0.45)' : '1px solid rgba(27,31,75,0.08)',
              }}
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-xl"
                style={{ background: active ? 'rgba(242,169,0,0.20)' : 'rgba(27,31,75,0.06)' }}
              >
                <Icon className="size-4" style={{ color: active ? '#b47900' : 'var(--ink)' }} />
              </span>
              <span className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                  {SCHEDULE_TYPE_LABELS[t]}
                </p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  {SCHEDULE_TYPE_DESCRIPTIONS[t]}
                </p>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
