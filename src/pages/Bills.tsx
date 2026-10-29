/**
 * Bills — catalog → pay flow.
 * Panel 1: BillerCatalog. Panel 2: BillOrderForm.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { BillerCatalog } from '../components/bills/BillerCatalog'
import { BillOrderForm } from '../components/bills/BillOrderForm'
import { Permit2Notice } from '../components/shared/Permit2Notice'
import { ChainGuard } from '../components/shared/ChainGuard'
import { type Biller } from '../lib/billers'
import { PageHeader, Badge } from '../components/ui'

const slideIn = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit:    { opacity: 0, x: -20 },
  transition: { duration: 0.20, ease: [0.25, 0.1, 0.25, 1.0] },
}

export function Bills() {
  const [selectedBiller, setSelectedBiller] = useState<Biller | null>(null)
  const navigate = useNavigate()

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pay Bills"
        subtitle="Airtime, data, utilities & more"
        right={<Badge variant="sandbox">Sandbox</Badge>}
      />

      {/* Escrow info strip */}
      <div
        className="flex items-start gap-3 rounded-2xl px-4 py-3"
        style={{
          background: 'rgba(24,165,139,0.08)',
          border: '1px solid rgba(24,165,139,0.18)',
        }}
      >
        <ShieldCheck className="size-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--success-text)' }} />
        <p className="text-xs leading-relaxed font-medium" style={{ color: 'var(--success-text)' }}>
          Payments are held in escrow until the bill is fulfilled. Automatically refunded after 30 minutes if not processed.
        </p>
      </div>

      <ChainGuard>
        <Permit2Notice />
      </ChainGuard>

      {/* Two-panel animated transition */}
      <AnimatePresence mode="wait">
        {!selectedBiller ? (
          <motion.div key="catalog" {...slideIn}>
            <BillerCatalog
              selected={selectedBiller}
              onSelect={setSelectedBiller}
            />
          </motion.div>
        ) : (
          <motion.div key="form" {...slideIn}>
            <BillOrderForm
              biller={selectedBiller}
              onBack={() => setSelectedBiller(null)}
              onSuccess={(orderId) => { void navigate(`/orders/${orderId}`) }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
