import { RequestForm } from '../components/request/RequestForm'

export function Request() {
  return (
    <div className="space-y-3">
      <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
        Request USDC
      </h1>
      <RequestForm />
    </div>
  )
}
