/**
 * ScheduleCreate — hosts ScheduleForm, navigates to detail on success.
 */

import { useNavigate } from 'react-router-dom'
import { type Hex } from 'viem'
import { ArrowLeft } from 'lucide-react'
import { ScheduleForm } from '../components/schedules/ScheduleForm'
import { ChainGuard } from '../components/shared/ChainGuard'
import { Permit2Notice } from '../components/shared/Permit2Notice'

export function ScheduleCreate() {
  const navigate = useNavigate()

  const handleSuccess = (ids: Hex[]) => {
    if (ids.length > 0) {
      void navigate(`/schedules/${ids[0]}`)
    } else {
      void navigate('/schedules')
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => { void navigate('/schedules') }}
        className="flex items-center gap-1.5 text-sm font-semibold min-h-[44px] -ml-1 transition-opacity hover:opacity-70"
        style={{ color: 'var(--muted)' }}
      >
        <ArrowLeft className="size-4" />
        Schedules
      </button>

      <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
        New schedule
      </h1>

      <ChainGuard>
        <Permit2Notice />
        <ScheduleForm onSuccess={handleSuccess} />
      </ChainGuard>
    </div>
  )
}
