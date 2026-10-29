/**
 * ScheduleTypeSelect — five schedule type tiles with icons and descriptions.
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
    <div className="space-y-2">
      <p
        className="text-[11px] font-bold uppercase"
        style={{ color: 'var(--muted)', letterSpacing: '0.09em' }}
      >
        Schedule type
      </p>
      <div className="grid grid-cols-1 gap-1.5">
        {types.map((t) => {
          const Icon = TYPE_ICONS[t]
          const active = value === t
          return (
            <motion.button
              key={t}
              type="button"
              onClick={() => onChange(t)}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left w-full transition-all active:scale-[0.98] min-h-[52px]"
              style={{
                background: active ? 'rgba(243,181,28,0.10)' : 'var(--surface-elevated)',
                border: active ? '1.5px solid rgba(243,181,28,0.40)' : '1.5px solid var(--border)',
                boxShadow: active ? '0 2px 10px rgba(243,181,28,0.12)' : 'none',
              }}
              initial={false}
              animate={{
                scale: active ? 1 : 1,
              }}
              transition={{ duration: 0.12 }}
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors"
                style={{
                  background: active ? 'rgba(243,181,28,0.20)' : 'var(--surface-muted)',
                }}
              >
                <Icon
                  className="size-4"
                  style={{ color: active ? '#A07210' : 'var(--muted)' }}
                  strokeWidth={active ? 2.2 : 1.8}
                />
              </span>
              <span className="min-w-0 flex-1">
                <p
                  className="text-sm font-bold"
                  style={{ color: active ? 'var(--ink)' : 'var(--ink-2)' }}
                >
                  {SCHEDULE_TYPE_LABELS[t]}
                </p>
                <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--muted)' }}>
                  {SCHEDULE_TYPE_DESCRIPTIONS[t]}
                </p>
              </span>
              {/* Active dot */}
              <span
                className="size-2 rounded-full shrink-0 transition-all"
                style={{
                  background: active ? 'var(--gold)' : 'transparent',
                  boxShadow: active ? '0 0 6px rgba(243,181,28,0.5)' : 'none',
                }}
              />
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
