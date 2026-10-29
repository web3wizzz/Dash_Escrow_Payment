import { RequestForm } from '../components/request/RequestForm'
import { PageHeader } from '../components/ui'

export function Request() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Request USDC"
        subtitle="Generate a payment link or QR code"
      />
      <RequestForm />
    </div>
  )
}
