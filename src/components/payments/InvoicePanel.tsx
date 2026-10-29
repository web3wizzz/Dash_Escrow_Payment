/**
 * InvoicePanel — create and share USDC payment requests (invoices).
 *
 * LIVE functionality: uses PayRouter.requestPay via the existing RequestForm flow.
 * An "invoice" is a payment link that pre-fills the /pay route with recipient,
 * amount, memo, and a keccak requestId. The payer opens the link and signs a
 * Permit2 transfer that calls PayRouter.requestPay on-chain.
 *
 * No off-chain invoice state machine exists — this is purely link-based.
 */

import { useState } from 'react'
import { ChevronLeft, FileText, CheckCircle2, Info } from 'lucide-react'
import { motion } from 'framer-motion'
import { PageHeader, Badge, stagger } from '../ui'
import { RequestForm } from '../request/RequestForm'

type Tab = 'create' | 'how'

export function InvoicePanel({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('create')

  return (
    <div className="space-y-4">
      {/* Back + header */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm font-semibold min-h-[44px] -ml-1 transition-opacity hover:opacity-70"
        style={{ color: 'var(--muted)' }}
      >
        <ChevronLeft className="size-4" /> Payments
      </button>

      <PageHeader
        title="Invoices"
        subtitle="Request USDC with a shareable link"
        right={<Badge variant="success">Live</Badge>}
      />

      {/* How it works strip */}
      <motion.div
        {...stagger(0.04)}
        className="rounded-2xl px-4 py-3 flex items-start gap-2.5"
        style={{ background: 'rgba(24,165,139,0.07)', border: '1px solid rgba(24,165,139,0.16)' }}
      >
        <CheckCircle2 className="size-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--success-text)' }} />
        <p className="text-xs leading-relaxed font-medium" style={{ color: 'var(--success-text)' }}>
          Payment is settled on-chain via PayRouter. The payer signs once with their wallet — no custodian involved.
        </p>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1.5 rounded-2xl p-1.5" style={{ background: 'var(--surface-muted)' }}>
        {(['create', 'how'] as Tab[]).map((t) => (
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
            {t === 'create' ? <FileText className="size-3.5" /> : <Info className="size-3.5" />}
            {t === 'create' ? 'Create invoice' : 'How it works'}
          </button>
        ))}
      </div>

      {tab === 'create' && (
        <motion.div key="create" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
          <RequestForm />
        </motion.div>
      )}

      {tab === 'how' && (
        <motion.div
          key="how"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="space-y-3"
        >
          <div
            className="rounded-3xl overflow-hidden"
            style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
          >
            {[
              {
                step: '1',
                title: 'Set amount and note',
                body: 'Enter the USDC amount and an optional description for the invoice.',
              },
              {
                step: '2',
                title: 'Generate payment link',
                body: 'A unique link is generated with your address, amount, and a keccak requestId embedded.',
              },
              {
                step: '3',
                title: 'Share with payer',
                body: 'Send the link or QR code via any channel. The payer opens it on Da$h.',
              },
              {
                step: '4',
                title: 'Payer signs and pays',
                body: 'The payer connects their wallet and signs a Permit2 transfer. PayRouter.requestPay is called — USDC goes directly to your wallet.',
              },
              {
                step: '5',
                title: 'On-chain confirmation',
                body: 'A RequestPaid event is emitted on Arc. No intermediary holds funds at any point.',
              },
            ].map(({ step, title, body }, i) => (
              <div
                key={step}
                className="flex items-start gap-3.5 px-4 py-4"
                style={{ borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}
              >
                <span
                  className="flex size-7 items-center justify-center rounded-full flex-shrink-0 text-xs font-bold"
                  style={{ background: 'var(--gold-muted)', color: '#9A6E00' }}
                >
                  {step}
                </span>
                <div>
                  <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--ink)' }}>{title}</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{body}</p>
                </div>
              </div>
            ))}
          </div>

          <div
            className="rounded-2xl px-4 py-3"
            style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
          >
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>
              <span className="font-semibold">Limitation:</span> There is no invoice state machine (draft, sent, viewed, paid). Payment is confirmed on-chain but link expiry and read receipts require an off-chain backend that does not yet exist.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  )
}
