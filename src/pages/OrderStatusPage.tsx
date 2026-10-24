import { useParams } from 'react-router-dom'
import { type Hex } from 'viem'
import { OrderStatus } from '../components/bills/OrderStatus'
import { ChainGuard } from '../components/shared/ChainGuard'

export function OrderStatusPage() {
  const { orderId } = useParams<{ orderId: string }>()

  if (!orderId || !orderId.startsWith('0x')) {
    return (
      <div>
        <h1 className="display text-2xl font-bold mb-3" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
          Order Status
        </h1>
        <p className="text-sm" style={{ color: 'var(--danger)' }}>Invalid order ID.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
        Order Status
      </h1>
      <ChainGuard>
        <OrderStatus orderId={orderId as Hex} />
      </ChainGuard>
    </div>
  )
}
