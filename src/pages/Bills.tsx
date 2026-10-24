/**
 * Bills — catalog → pay flow.
 * Panel 1: BillerCatalog (search, categories, recents, favorites).
 * Panel 2: BillOrderForm for the selected biller.
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

const fadeSlide = {
  initial: { opacity: 0, x: 18 },
  animate: { opacity: 1, x: 0 },
  exit:    { opacity: 0, x: -18 },
  transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1.0] },
}

export function Bills() {
  const [selectedBiller, setSelectedBiller] = useState<Biller | null>(null)
  const navigate = useNavigate()

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
          Pay Bills
        </h1>
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
          style={{ background: 'rgba(242,169,0,0.14)', color: '#b37800', letterSpacing: '0.06em' }}
        >
          Sandbox
        </span>
      </div>

      {/* Escrow explainer — always visible at top of bills */}
      <div
        className="rounded-2xl p-3.5 flex items-start gap-2.5"
        style={{ background: 'rgba(14,16,48,0.04)', border: '1px solid rgba(14,16,48,0.07)' }}
      >
        <ShieldCheck className="size-4 mt-0.5 shrink-0" style={{ color: 'var(--ink)' }} />
        <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          Your payment is held until the bill is fulfilled, and returned automatically after 30 minutes if it is not.
        </p>
      </div>

      <ChainGuard>
        <Permit2Notice />
      </ChainGuard>

      {/* Two-panel animated transition */}
      <AnimatePresence mode="wait">
        {!selectedBiller ? (
          <motion.div key="catalog" {...fadeSlide}>
            <BillerCatalog
              selected={selectedBiller}
              onSelect={setSelectedBiller}
            />
          </motion.div>
        ) : (
          <motion.div key="form" {...fadeSlide}>
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
