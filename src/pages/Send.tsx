import { useSearchParams } from 'react-router-dom'
import { type Hex } from 'viem'
import { SendForm } from '../components/send/SendForm'
import { Permit2Notice } from '../components/shared/Permit2Notice'
import { ChainGuard } from '../components/shared/ChainGuard'
import { PageHeader } from '../components/ui'

export function Send() {
  const [params] = useSearchParams()
  const to = params.get('to') ?? undefined
  const amount = params.get('amount') ?? undefined
  const memo = params.get('memo') ?? undefined
  const requestId = params.get('requestId') as Hex | undefined

  return (
    <div className="space-y-4">
      <PageHeader
        title={requestId ? 'Pay request' : 'Send USDC'}
        subtitle={requestId ? 'Completing a payment request' : 'Send to any @handle or address'}
      />
      <ChainGuard>
        <Permit2Notice />
      </ChainGuard>
      <SendForm
        prefillRecipient={to}
        prefillAmount={amount}
        prefillMemo={memo}
        requestId={requestId}
      />
    </div>
  )
}
