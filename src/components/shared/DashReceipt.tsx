/**
 * DashReceipt — market-style digital receipt shown after a confirmed transaction.
 *
 * Animation: staggered print-in (line by line), under 900ms total.
 * prefers-reduced-motion: immediate static display.
 *
 * NOT a replacement for TxStatus (inline state).
 * Use this in full-page or bottom-sheet success states.
 */

import { motion, useReducedMotion } from 'framer-motion'
import { CheckCircle2, ExternalLink, Share2, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { buildTxExplorerUrl } from '../../onchain-facts'
import { TARGET_CHAIN_ID, DISPLAY_NETWORK_NAME } from '../../config'

const NETWORK_LABEL = DISPLAY_NETWORK_NAME

export interface ReceiptData {
  amount: string          // e.g. "5.00"
  currency?: string       // default "USDC"
  recipient: string       // address or handle
  txType: string          // "Sent" | "Claimed" | "Deposited" | "Order placed" …
  hash: `0x${string}`
  timestamp?: number      // unix ms — defaults to Date.now()
}

interface DashReceiptProps {
  data: ReceiptData
  onDismiss?: () => void
  onShare?: () => void
}

function ReceiptRow({
  label,
  value,
  mono = false,
  delay = 0,
  last = false,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
  delay?: number
  last?: boolean
}) {
  const reduced = useReducedMotion()
  return (
    <>
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 3 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex items-center justify-between py-2.5"
      >
        <span className="text-xs" style={{ color: 'var(--muted)' }}>{label}</span>
        <span
          className={mono ? 'mono text-xs' : 'text-xs font-semibold'}
          style={{ color: 'var(--ink)' }}
        >
          {value}
        </span>
      </motion.div>
      {!last && <div style={{ height: 1, background: 'var(--border)' }} />}
    </>
  )
}

export function DashReceipt({ data, onDismiss, onShare }: DashReceiptProps) {
  const reduced = useReducedMotion()
  const [copied, setCopied] = useState(false)
  // Capture timestamp once at mount to avoid impure call during re-renders
  const [ts] = useState<number>(() => data.timestamp ?? performance.timeOrigin + performance.now())
  const date = new Date(ts)
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const currency = data.currency ?? 'USDC'

  const explorerUrl = buildTxExplorerUrl(TARGET_CHAIN_ID, data.hash)
  const shortHash = `${data.hash.slice(0, 10)}…${data.hash.slice(-8)}`
  const shortRecipient = data.recipient.startsWith('0x')
    ? `${data.recipient.slice(0, 8)}…${data.recipient.slice(-6)}`
    : data.recipient

  const copyHash = async () => {
    await navigator.clipboard.writeText(data.hash)
    setCopied(true)
    setTimeout(() => setCopied(false), 2200)
  }

  return (
    <div className="space-y-4">

      {/* ── Amount hero ── */}
      <motion.div
        initial={reduced ? false : { opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex flex-col items-center text-center py-6"
      >
        {/* Check ring */}
        <motion.div
          initial={reduced ? false : { scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, ease: [0.175, 0.885, 0.32, 1.275] }}
          className="flex items-center justify-center mb-4"
          style={{
            width: 56, height: 56,
            background: 'rgba(26,128,71,0.10)',
            borderRadius: '50%',
          }}
        >
          <CheckCircle2 className="size-7" style={{ color: 'var(--success)' }} />
        </motion.div>

        <motion.p
          initial={reduced ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.12 }}
          className="text-xs font-semibold uppercase tracking-widest mb-1"
          style={{ color: 'var(--success)', letterSpacing: '0.10em' }}
        >
          {data.txType}
        </motion.p>

        <motion.div
          initial={reduced ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.16 }}
          className="flex items-baseline gap-2"
        >
          <span
            className="display font-bold tabular-nums"
            style={{ fontSize: '2.6rem', color: 'var(--ink)', letterSpacing: '-0.04em', lineHeight: 1 }}
          >
            {parseFloat(data.amount).toLocaleString('en-US', {
              minimumFractionDigits: 2, maximumFractionDigits: 6,
            })}
          </span>
          <span
            className="text-base font-bold pb-1"
            style={{ color: 'var(--muted)' }}
          >
            {currency}
          </span>
        </motion.div>
      </motion.div>

      {/* ── Receipt lines ── */}
      <div
        className="rounded-2xl px-4 overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {/* Top perforation line */}
        <div
          className="w-full h-px mb-0"
          style={{
            background: 'repeating-linear-gradient(90deg, var(--border) 0, var(--border) 4px, transparent 4px, transparent 8px)',
          }}
        />

        <ReceiptRow label="To" value={shortRecipient} delay={0.20} />
        <ReceiptRow label="Network" value={NETWORK_LABEL} delay={0.26} />
        <ReceiptRow label="Date" value={`${dateStr} · ${timeStr}`} delay={0.32} />
        <ReceiptRow label="Status" value={
          <span className="flex items-center gap-1" style={{ color: 'var(--success)' }}>
            <span className="size-1.5 rounded-full" style={{ background: 'var(--success)' }} />
            Confirmed
          </span>
        } delay={0.38} />
        <ReceiptRow
          label="Tx hash"
          mono
          delay={0.44}
          value={
            <button
              onClick={() => { void copyHash() }}
              className="flex items-center gap-1 transition-opacity hover:opacity-70"
            >
              <span>{shortHash}</span>
              {copied
                ? <Check className="size-3" style={{ color: 'var(--success)' }} />
                : <Copy className="size-3" style={{ color: 'var(--subtle)' }} />
              }
            </button>
          }
          last
        />

        {/* Bottom perforation */}
        <div
          className="w-full h-px mt-0"
          style={{
            background: 'repeating-linear-gradient(90deg, var(--border) 0, var(--border) 4px, transparent 4px, transparent 8px)',
          }}
        />
      </div>

      {/* ── Actions ── */}
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.54 }}
        className="flex gap-2"
      >
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold rounded-xl transition-all active:scale-95"
          style={{
            background: 'var(--surface-muted)',
            color: 'var(--ink)',
            border: '1px solid var(--border)',
          }}
        >
          <ExternalLink className="size-4" />
          Explorer
        </a>

        {onShare && (
          <button
            onClick={onShare}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold rounded-xl transition-all active:scale-95"
            style={{
              background: 'var(--surface-muted)',
              color: 'var(--ink)',
              border: '1px solid var(--border)',
            }}
          >
            <Share2 className="size-4" />
            Share
          </button>
        )}

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-bold rounded-xl transition-all active:scale-95"
            style={{
              background: 'var(--saffron)',
              color: '#0A0F1E',
              boxShadow: '0 2px 10px rgba(242,169,0,0.28)',
            }}
          >
            Done
          </button>
        )}
      </motion.div>

    </div>
  )
}
