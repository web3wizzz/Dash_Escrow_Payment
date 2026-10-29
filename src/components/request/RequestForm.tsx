/**
 * RequestForm — generates a payment link and QR code for requesting USDC.
 * Link pre-fills /pay with recipient, amount, memo, and requestId.
 */

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { Copy, Check, Link2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import QRCode from 'qrcode'
import { buildShareLink } from '../../lib/share'
import { keccak256, encodePacked } from 'viem'

export function RequestForm() {
  const { address, isConnected } = useAccount()
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [link, setLink] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const generateLink = async () => {
    if (!address || !amount) return
    const requestId = keccak256(
      encodePacked(
        ['address', 'string', 'string', 'uint256'],
        [address, amount, memo, BigInt(Date.now())],
      ),
    )
    const params = new URLSearchParams({ to: address, amount, requestId })
    if (memo) params.set('memo', memo)

    const base = await buildShareLink(`/pay?${params.toString()}`)
    setLink(base)

    try {
      const dataUrl = await QRCode.toDataURL(base, {
        width: 220,
        margin: 2,
        color: { dark: '#101934', light: '#FFFFFF' },
      })
      setQrDataUrl(dataUrl)
    } catch {
      setQrDataUrl(null)
    }
  }

  const copyLink = async () => {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  if (!isConnected) {
    return (
      <div className="rounded-3xl p-6 text-center"
        style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Connect your wallet to create a payment request.</p>
      </div>
    )
  }

  const quickAmounts = ['1', '5', '10', '25']

  return (
    <div className="space-y-3">
      <div
        className="rounded-3xl overflow-hidden"
        style={{
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border)',
          boxShadow: '0 4px 20px rgba(16,25,52,0.06)',
        }}
      >
        {/* Amount field */}
        <div className="px-4 pt-5 pb-3">
          <label className="block text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)', letterSpacing: '0.09em' }}>
            Amount
          </label>
          <div className="field-base rounded-2xl px-4 py-3">
            <div className="flex items-baseline gap-2">
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9.]/g, '')
                  if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v)
                }}
                placeholder="0.00"
                className="display flex-1 bg-transparent text-4xl font-bold tabular-nums outline-none placeholder:text-slate-300"
                style={{ color: 'var(--ink)', letterSpacing: '-0.03em', minWidth: 0 }}
              />
              <span className="text-base font-bold pb-1 flex-shrink-0" style={{ color: 'var(--muted)' }}>USDC</span>
            </div>
          </div>

          <div className="flex gap-2 mt-2.5">
            {quickAmounts.map((q) => (
              <button
                key={q}
                onClick={() => setAmount(q)}
                className="flex-1 rounded-xl py-1.5 text-xs font-bold transition-all active:scale-95"
                style={{
                  background: amount === q ? 'var(--gold-muted-mid)' : 'var(--surface-muted)',
                  color: amount === q ? '#9A6E00' : 'var(--muted)',
                  border: amount === q ? '1px solid rgba(243,181,28,0.35)' : '1px solid transparent',
                }}
              >
                ${q}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="mx-4 h-px" style={{ background: 'var(--border)' }} />

        {/* Memo field */}
        <div className="px-4 pt-3 pb-5">
          <label className="block text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)', letterSpacing: '0.09em' }}>
            Note (optional)
          </label>
          <div className="field-base rounded-2xl px-4 py-3">
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="What's this for?"
              maxLength={80}
              className="w-full bg-transparent text-sm font-medium outline-none placeholder:opacity-40"
              style={{ color: 'var(--ink)' }}
            />
          </div>

          <button
            onClick={() => { void generateLink() }}
            disabled={!amount}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
            style={{
              background: amount ? '#101934' : 'var(--surface-muted)',
              color: amount ? '#fff' : 'var(--muted)',
              boxShadow: amount ? '0 2px 12px rgba(16,25,52,0.25)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <Link2 className="size-4" strokeWidth={2.2} />
            Generate payment link
          </button>
        </div>
      </div>

      {/* Result card */}
      <AnimatePresence>
        {link && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1.0] }}
            className="rounded-3xl overflow-hidden"
            style={{
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              boxShadow: '0 4px 20px rgba(16,25,52,0.06)',
            }}
          >
            {/* Gold strip */}
            <div className="h-1" style={{ background: '#F3B51C' }} />

            <div className="p-5 space-y-4">
              {/* QR code */}
              {qrDataUrl && (
                <div className="flex justify-center">
                  <div
                    className="rounded-2xl p-3"
                    style={{ background: '#fff', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(16,25,52,0.06)' }}
                  >
                    <img
                      src={qrDataUrl}
                      alt="Payment QR code"
                      className="rounded-xl block"
                      style={{ width: 180, height: 180 }}
                    />
                  </div>
                </div>
              )}

              {/* Amount summary */}
              {amount && (
                <div className="text-center">
                  <p className="display text-2xl font-bold tabular-nums" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
                    {parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                  </p>
                  {memo && <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{memo}</p>}
                </div>
              )}

              {/* Copy link */}
              <div
                className="flex items-center gap-2 rounded-2xl px-3.5 py-3"
                style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
              >
                <p className="flex-1 text-xs mono truncate" style={{ color: 'var(--ink-2)' }}>{link}</p>
                <button
                  onClick={() => { void copyLink() }}
                  className="flex-shrink-0 flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all active:scale-95"
                  style={{
                    background: copied ? 'var(--success-muted)' : 'var(--gold-muted)',
                    color: copied ? 'var(--success-text)' : '#9A6E00',
                  }}
                >
                  {copied
                    ? <><Check className="size-3.5" />Copied</>
                    : <><Copy className="size-3.5" />Copy</>
                  }
                </button>
              </div>

              <p className="text-[11px] text-center" style={{ color: 'var(--subtle)' }}>
                Share this link or QR code. The sender will be taken directly to the payment form.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
