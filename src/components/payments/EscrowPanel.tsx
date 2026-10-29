/**
 * EscrowPanel — condition-based USDC escrow for Web3 services.
 *
 * LIVE functionality via PayRouter.createOrder:
 *   - USDC is held in the PayRouter contract.
 *   - A registered OPERATOR releases funds (fulfillOrder) or returns them (rejectOrder).
 *   - Anyone can reclaim after orderTimeoutSeconds (30 min on launch config).
 *
 * IMPORTANT LIMITATIONS (accurate, not hidden):
 *   - The escrow is atomic: one release or one refund. No milestone / partial release.
 *   - The service provider must be a registered biller address in the contract.
 *     Until contracts are deployed and billers registered by admin, createOrder cannot be called.
 *   - This panel surfaces the sandbox biller catalog for demonstration.
 *
 * Tab "Services" = sandbox biller flow (existing BillOrderForm + BillerCatalog).
 * Tab "How it works" = accurate escrow explainer.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ShieldCheck, Info, Clock, CheckCircle2, XCircle, RotateCcw, AlertCircle } from 'lucide-react'
import { PageHeader, Badge, stagger } from '../ui'
import { BillerCatalog } from '../bills/BillerCatalog'
import { BillOrderForm } from '../bills/BillOrderForm'
import { Permit2Notice } from '../shared/Permit2Notice'
import { ChainGuard } from '../shared/ChainGuard'
import { type Biller } from '../../lib/billers'

type Tab = 'services' | 'how'

// ─── Escrow lifecycle explainer ────────────────────────────────────────────

function EscrowLifecycle() {
  const states = [
    {
      icon: ShieldCheck,
      color: '#F3B51C',
      bg: 'rgba(243,181,28,0.12)',
      label: 'Pending',
      body: 'USDC is locked in the PayRouter contract. Neither party can access it.',
    },
    {
      icon: CheckCircle2,
      color: 'var(--success-text)',
      bg: 'rgba(24,165,139,0.10)',
      label: 'Fulfilled',
      body: 'Operator confirms delivery. USDC is released to the service provider treasury.',
    },
    {
      icon: XCircle,
      color: 'var(--danger)',
      bg: 'rgba(192,51,74,0.08)',
      label: 'Rejected',
      body: 'Operator rejects the order. USDC is returned to the payer immediately.',
    },
    {
      icon: RotateCcw,
      color: 'var(--muted)',
      bg: 'var(--surface-muted)',
      label: 'Reclaimed',
      body: 'No action after 30 minutes. Anyone can call reclaimOrder to return USDC to payer.',
    },
  ]

  return (
    <div className="space-y-2">
      {states.map(({ icon: Icon, color, bg, label, body }) => (
        <div
          key={label}
          className="flex items-start gap-3 rounded-2xl px-4 py-3.5"
          style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
        >
          <span
            className="flex size-8 items-center justify-center rounded-xl flex-shrink-0 mt-0.5"
            style={{ background: bg }}
          >
            <Icon className="size-4" style={{ color }} strokeWidth={1.8} />
          </span>
          <div>
            <p className="text-sm font-bold mb-0.5" style={{ color: 'var(--ink)' }}>{label}</p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{body}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

export function EscrowPanel({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('services')
  const [selectedBiller, setSelectedBiller] = useState<Biller | null>(null)
  const navigate = useNavigate()

  const slideIn = {
    initial: { opacity: 0, x: 16 },
    animate: { opacity: 1, x: 0 },
    exit:    { opacity: 0, x: -12 },
    transition: { duration: 0.18, ease: [0.25, 0.1, 0.25, 1.0] as [number,number,number,number] },
  }

  return (
    <div className="space-y-4">
      {/* Back + header */}
      <button
        onClick={() => {
          if (selectedBiller) { setSelectedBiller(null); return }
          onBack()
        }}
        className="flex items-center gap-1 text-sm font-semibold min-h-[44px] -ml-1 transition-opacity hover:opacity-70"
        style={{ color: 'var(--muted)' }}
      >
        <ChevronLeft className="size-4" />
        {selectedBiller ? 'Services' : 'Payments'}
      </button>

      {!selectedBiller && (
        <PageHeader
          title="Escrow"
          subtitle="Conditional USDC payments"
          right={<Badge variant="success">Live</Badge>}
        />
      )}

      {/* How escrow works — info strip */}
      {!selectedBiller && (
        <motion.div
          {...stagger(0.04)}
          className="flex items-start gap-2.5 rounded-2xl px-4 py-3"
          style={{ background: 'rgba(243,181,28,0.09)', border: '1px solid rgba(243,181,28,0.20)' }}
        >
          <ShieldCheck className="size-4 mt-0.5 flex-shrink-0" style={{ color: '#9A6E00' }} />
          <p className="text-xs leading-relaxed font-medium" style={{ color: '#9A6E00' }}>
            USDC is held by the PayRouter contract — not by any wallet — until the service is confirmed or the 30-minute timeout expires.
          </p>
        </motion.div>
      )}

      {/* Limitation notice — always visible */}
      {!selectedBiller && (
        <motion.div
          {...stagger(0.08)}
          className="flex items-start gap-2.5 rounded-2xl px-4 py-3"
          style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
        >
          <AlertCircle className="size-3.5 mt-0.5 flex-shrink-0" style={{ color: 'var(--muted)' }} />
          <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
            <span className="font-semibold">Escrow is atomic.</span> Release is all-or-nothing — no milestone or partial release. Service providers must be registered on-chain by the admin. Sandbox billers are used for demonstration.
          </p>
        </motion.div>
      )}

      {/* Tabs (hidden when biller selected) */}
      {!selectedBiller && (
        <div className="flex gap-1.5 rounded-2xl p-1.5" style={{ background: 'var(--surface-muted)' }}>
          {(['services', 'how'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-bold transition-all min-h-[40px]"
              style={{
                background: tab === t ? '#fff' : 'transparent',
                color: tab === t ? 'var(--navy)' : 'var(--muted)',
                boxShadow: tab === t ? '0 1px 6px rgba(16,25,52,0.10)' : 'none',
              }}
            >
              {t === 'services' ? <ShieldCheck className="size-3.5" /> : <Info className="size-3.5" />}
              {t === 'services' ? 'Services' : 'How it works'}
            </button>
          ))}
        </div>
      )}

      {/* Permit2 notice */}
      {!selectedBiller && tab === 'services' && (
        <ChainGuard>
          <Permit2Notice />
        </ChainGuard>
      )}

      {/* Content area */}
      <AnimatePresence mode="wait">
        {!selectedBiller && tab === 'services' && (
          <motion.div key="catalog" {...slideIn}>
            {/* Sandbox label */}
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="sandbox">Sandbox billers</Badge>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                No real-world services are connected.
              </p>
            </div>
            <BillerCatalog selected={selectedBiller} onSelect={setSelectedBiller} />
          </motion.div>
        )}

        {!selectedBiller && tab === 'how' && (
          <motion.div key="how" {...slideIn} className="space-y-4">
            {/* Lifecycle states */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'var(--subtle)', letterSpacing: '0.09em' }}>
                Order states
              </p>
              <EscrowLifecycle />
            </div>

            {/* Timeline */}
            <div
              className="rounded-3xl overflow-hidden"
              style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
            >
              <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs font-bold" style={{ color: 'var(--ink)' }}>Escrow timeline</p>
              </div>
              {[
                { time: 'T+0', label: 'Payer signs', body: 'Permit2 witness transfer. USDC moves from payer to PayRouter.' },
                { time: 'T+0–30m', label: 'Processing window', body: 'Operator has 30 minutes to fulfill or reject the order.' },
                { time: 'T+30m', label: 'Reclaim window opens', body: 'If not fulfilled, anyone can call reclaimOrder to return USDC to payer.' },
              ].map(({ time, label, body }, i) => (
                <div
                  key={time}
                  className="flex items-start gap-3 px-4 py-3.5"
                  style={{ borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}
                >
                  <div className="flex items-center gap-1 flex-shrink-0 w-16">
                    <Clock className="size-3.5" style={{ color: 'var(--subtle)' }} />
                    <span className="mono text-[10px] font-semibold" style={{ color: 'var(--subtle)' }}>{time}</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--ink)' }}>{label}</p>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{body}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* What it can't do */}
            <div
              className="rounded-2xl px-4 py-3 space-y-2"
              style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
            >
              <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--subtle)', letterSpacing: '0.09em' }}>
                Current limitations
              </p>
              {[
                'No milestone or partial release.',
                'Service provider must be registered on-chain by the contract admin.',
                'Operator role required for fulfillment — permissionless delivery is not yet supported.',
                'Escrow does not verify off-chain delivery — it relies on operator attestation.',
              ].map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <span className="size-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--subtle)' }} />
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{item}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {selectedBiller && (
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
