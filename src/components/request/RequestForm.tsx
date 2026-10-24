/**
 * RequestForm — generates a payment link and QR code for requesting USDC.
 * The link pre-fills the Send page with recipient, amount, memo, and requestId.
 */

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { Copy, Check } from 'lucide-react'
import QRCode from 'qrcode'
import { buildShareLink } from '../../lib/share'
import { keccak256, encodePacked } from 'viem'

const glass = {
  card: {
    background: 'rgba(255,255,255,0.64)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.68)',
    boxShadow: '0 8px 32px rgba(18,45,69,0.08), inset 0 1px 0 rgba(255,255,255,0.55)',
  } as React.CSSProperties,
  inner: {
    background: 'rgba(255,255,255,0.46)',
    border: '1px solid rgba(255,255,255,0.56)',
  } as React.CSSProperties,
}

export function RequestForm() {
  const { address, isConnected } = useAccount()
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [link, setLink] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const generateLink = async () => {
    if (!address || !amount) return
    // Deterministic request ID derived from address + amount + memo + timestamp
    const requestId = keccak256(
      encodePacked(
        ['address', 'string', 'string', 'uint256'],
        [address, amount, memo, BigInt(Date.now())],
      ),
    )
    const params = new URLSearchParams({
      to: address,
      amount,
      requestId,
    })
    if (memo) params.set('memo', memo)

    const base = await buildShareLink(`/pay?${params.toString()}`)
    setLink(base)

    // Generate QR
    try {
      const dataUrl = await QRCode.toDataURL(base, { width: 200, margin: 1 })
      setQrDataUrl(dataUrl)
    } catch {
      setQrDataUrl(null)
    }
  }

  const copyLink = async () => {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!isConnected) {
    return (
      <div className="rounded-2xl p-5 text-center" style={glass.card}>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Connect your wallet to create a payment request.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl p-4 space-y-3" style={glass.card}>
        {/* Amount */}
        <div className="rounded-2xl p-3.5" style={glass.inner}>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9.]/g, '')
              if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v)
            }}
            placeholder="0.00"
            className="display w-full bg-transparent text-4xl font-bold tabular-nums outline-none placeholder:text-slate-300"
            style={{ color: 'var(--ink)' }}
          />
          <span className="text-xs mt-1 block" style={{ color: 'var(--subtle)' }}>USDC</span>
        </div>

        {/* Memo */}
        <div className="rounded-2xl px-3.5 py-3" style={glass.inner}>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Add a note (optional)"
            maxLength={80}
            className="w-full bg-transparent text-sm outline-none placeholder:opacity-40"
            style={{ color: 'var(--ink)' }}
          />
        </div>

        <button
          onClick={() => { void generateLink() }}
          disabled={!amount}
          className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: 'var(--accent)' }}
        >
          Generate payment link
        </button>
      </div>

      {link && (
        <div className="rounded-2xl p-4 space-y-4" style={glass.card}>
          {qrDataUrl && (
            <div className="flex justify-center">
              <img src={qrDataUrl} alt="Payment QR code" className="rounded-xl" style={{ width: 160, height: 160 }} />
            </div>
          )}
          <div className="rounded-2xl px-3.5 py-3 flex items-center gap-2" style={glass.inner}>
            <p className="flex-1 text-xs font-mono truncate" style={{ color: 'var(--ink-2)' }}>
              {link}
            </p>
            <button
              onClick={() => { void copyLink() }}
              className="shrink-0 flex items-center gap-1 text-xs font-semibold"
              style={{ color: copied ? 'var(--success)' : 'var(--accent-hover)' }}
            >
              {copied ? <><Check className="size-3.5" />Copied</> : <><Copy className="size-3.5" />Copy</>}
            </button>
          </div>
          <p className="text-xs text-center" style={{ color: 'var(--subtle)' }}>
            Share this link or QR code to request payment.
          </p>
        </div>
      )}
    </div>
  )
}
