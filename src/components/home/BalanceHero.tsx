/**
 * BalanceHero — the dominant financial surface on the Home screen.
 *
 * Layout:
 *   Available balance  (Figtree label, 11px, muted)
 *   $0.00              (Bricolage, 3.4rem, white — the single dominant object)
 *   USDC               (Figtree, 14px, white/50%)
 *   wallet address     (mono, 11px, white/38%)
 *   [ Send ]  [ Request ]  — integrated inside the card
 *
 * Address sheet opens on tap of the address row.
 * No KYC tier pill. No glows. One restrained depth accent at the top edge.
 */

import { useState, useEffect, useRef } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { erc20Abi, formatUnits, type Address } from 'viem'
import { motion, AnimatePresence } from 'framer-motion'
import { Copy, Check, QrCode, ArrowUpRight, ArrowDownLeft, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import QRCodeLib from 'qrcode'
import { getUsdc } from '../../onchain-facts'
import { TARGET_CHAIN_ID } from '../../config'
import { BRAND } from '../../../config/brand'
import { Skeleton } from '../ui'

const usdcFact = getUsdc(TARGET_CHAIN_ID)
const USDC_ADDRESS = (usdcFact?.address ?? '0x3600000000000000000000000000000000000000') as Address
const USDC_DECIMALS = usdcFact?.decimals ?? 6

// ─── QR canvas ───────────────────────────────────────────────────────────────

function QRCanvas({ value, size = 200 }: { value: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!canvasRef.current) return
    setReady(false)
    void QRCodeLib.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: { dark: '#0E1030', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    }).then(() => setReady(true))
  }, [value, size])

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {!ready && (
        <div className="absolute inset-0 skeleton" style={{ borderRadius: 12 }} />
      )}
      <canvas
        ref={canvasRef}
        style={{ borderRadius: 12, opacity: ready ? 1 : 0, transition: 'opacity 0.18s', display: 'block' }}
      />
    </div>
  )
}

// ─── Address sheet ────────────────────────────────────────────────────────────

function AddressSheet({ address, onClose }: { address: Address; onClose: () => void }) {
  const short = `${address.slice(0, 10)}…${address.slice(-8)}`
  const [copied, setCopied] = useState(false)

  const copy = () => {
    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    })
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      onClick={onClose}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(8,10,24,0.60)', backdropFilter: 'blur(6px)' }} />

      <motion.div
        className="relative w-full max-w-md rounded-t-2xl"
        style={{
          background: 'var(--surface)',
          boxShadow: '0 -8px 40px rgba(14,16,48,0.18)',
          paddingBottom: 'max(env(safe-area-inset-bottom, 20px), 20px)',
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 36 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Saffron accent strip */}
        <div className="absolute top-0 inset-x-0 h-[2px] rounded-t-2xl" style={{ background: 'var(--saffron)' }} />

        {/* Drag handle + close */}
        <div className="flex items-center justify-center pt-4 pb-2">
          <div className="h-[3px] w-8 rounded-full" style={{ background: 'var(--border-mid)' }} />
        </div>
        <button
          onClick={onClose}
          className="absolute top-3 right-4 flex size-8 items-center justify-center rounded-full transition-colors hover:bg-slate-100 active:scale-90"
          aria-label="Close"
        >
          <X className="size-4" style={{ color: 'var(--muted)' }} />
        </button>

        <div className="px-6 pt-1 pb-2 text-center">
          <p className="text-[15px] font-semibold mb-0.5" style={{ color: 'var(--ink)', fontFamily: '"Figtree",sans-serif' }}>
            Your address
          </p>
          <p className="text-xs" style={{ color: 'var(--muted)', fontFamily: '"Figtree",sans-serif' }}>
            Receive USDC on {BRAND.networkName}
          </p>
        </div>

        {/* QR */}
        <div className="flex justify-center px-6 py-4">
          <div
            className="rounded-2xl p-3"
            style={{ background: '#fff', boxShadow: '0 2px 16px rgba(14,16,48,0.08)', border: '1px solid var(--border)' }}
          >
            <QRCanvas value={address} size={188} />
          </div>
        </div>

        {/* Copy row */}
        <div className="px-5">
          <button
            onClick={copy}
            className="w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm transition-all active:scale-[0.98]"
            style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
          >
            <span className="mono text-[13px] truncate" style={{ color: 'var(--ink)' }}>{short}</span>
            <AnimatePresence mode="wait" initial={false}>
              {copied
                ? <motion.span key="c" initial={{ scale: 0.6 }} animate={{ scale: 1 }} exit={{ scale: 0.6 }}>
                    <Check className="size-4 shrink-0" style={{ color: 'var(--success)' }} />
                  </motion.span>
                : <motion.span key="n" initial={{ scale: 0.6 }} animate={{ scale: 1 }} exit={{ scale: 0.6 }}>
                    <Copy className="size-4 shrink-0" style={{ color: 'var(--muted)' }} />
                  </motion.span>
              }
            </AnimatePresence>
          </button>
          <p className="text-center text-[11px] mt-2.5" style={{ color: 'var(--subtle)', fontFamily: '"Figtree",sans-serif' }}>
            {BRAND.networkName} · USDC only
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BalanceHero() {
  const { address, isConnected } = useAccount()
  const [showAddress, setShowAddress] = useState(false)

  const { data: balanceRaw, isLoading } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
    chainId: TARGET_CHAIN_ID,
  })

  // Split balance into dollars and cents for typographic treatment
  const [whole, frac] = (() => {
    if (balanceRaw === undefined) return [null, null]
    const n = parseFloat(formatUnits(balanceRaw, USDC_DECIMALS))
    const s = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const parts = s.split('.')
    return [parts[0], parts[1] ?? '00']
  })()

  const shortAddress = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : ''

  if (!isConnected) return null

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1.0] }}
        className="relative overflow-hidden rounded-2xl"
        style={{
          background: 'linear-gradient(155deg, #1B1F4B 0%, #0E1030 60%, #090B20 100%)',
          boxShadow: '0 6px 28px rgba(8,10,32,0.32)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Subtle top-edge saffron reflection */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 inset-x-0 h-[1px]"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(242,169,0,0.40), transparent)' }}
        />

        <div className="relative z-10 px-5 pt-5 pb-5">
          {/* Label */}
          <p
            className="mb-3"
            style={{
              fontFamily: '"Figtree",sans-serif',
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.36)',
            }}
          >
            Available balance
          </p>

          {/* Balance figure — dominant object, live region for screen readers */}
          {isLoading || whole === null ? (
            <div className="flex items-end gap-1 mb-4" aria-hidden>
              <Skeleton className="h-14 w-44 rounded-lg" style={{ background: 'rgba(255,255,255,0.08)' }} />
            </div>
          ) : (
            <motion.div
              key={whole + frac}
              initial={{ opacity: 0.75 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.18, ease: [0.25,0.1,0.25,1] }}
              className="flex items-start mb-3"
              aria-live="polite"
              aria-label={`Available balance: ${whole}.${frac ?? '00'} USDC`}
            >
              {/* Dollar prefix */}
              <span
                aria-hidden
                style={{
                  fontFamily: '"Bricolage Grotesque",sans-serif',
                  fontWeight: 600,
                  fontSize: '1.5rem',
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                  color: 'rgba(255,255,255,0.50)',
                  marginTop: '0.55rem',
                  marginRight: '0.1rem',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                $
              </span>
              {/* Integer part */}
              <span
                style={{
                  fontFamily: '"Bricolage Grotesque",sans-serif',
                  fontWeight: 700,
                  fontSize: '3.4rem',
                  lineHeight: 1,
                  letterSpacing: '-0.04em',
                  color: '#FFFFFF',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {whole}
              </span>
              {/* Decimal part */}
              <span
                style={{
                  fontFamily: '"Bricolage Grotesque",sans-serif',
                  fontWeight: 600,
                  fontSize: '1.6rem',
                  lineHeight: 1,
                  letterSpacing: '-0.03em',
                  color: 'rgba(255,255,255,0.40)',
                  marginTop: '0.65rem',
                  marginLeft: '0.08rem',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                .{frac}
              </span>
              {/* Currency label */}
              <span
                style={{
                  fontFamily: '"Figtree",sans-serif',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  color: 'rgba(255,255,255,0.32)',
                  marginTop: 'auto',
                  marginLeft: '0.4rem',
                  marginBottom: '0.35rem',
                }}
              >
                USDC
              </span>
            </motion.div>
          )}

          {/* Wallet address — tappable to open sheet */}
          <button
            onClick={() => setShowAddress(true)}
            className="flex items-center gap-1.5 mb-5 transition-opacity hover:opacity-70 active:opacity-50"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            aria-label="View wallet address"
          >
            <span
              className="mono"
              style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', letterSpacing: '0.04em' }}
            >
              {shortAddress}
            </span>
            <QrCode className="size-3" style={{ color: 'rgba(255,255,255,0.25)' }} />
          </button>

          {/* Hairline */}
          <div className="mb-4" style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />

          {/* Send / Request — integrated into card */}
          <div className="grid grid-cols-2 gap-2.5">
            <Link
              to="/send"
              className="flex items-center justify-center gap-1.5 rounded-xl py-3 text-[13px] font-semibold transition-all active:scale-[0.97]"
              style={{
                background: 'var(--saffron)',
                color: '#0A0B1E',
                fontFamily: '"Figtree",sans-serif',
              }}
            >
              <ArrowUpRight className="size-4" strokeWidth={2.2} />
              Send
            </Link>
            <Link
              to="/request"
              className="flex items-center justify-center gap-1.5 rounded-xl py-3 text-[13px] font-semibold transition-all active:scale-[0.97]"
              style={{
                background: 'rgba(255,255,255,0.09)',
                color: 'rgba(255,255,255,0.85)',
                border: '1px solid rgba(255,255,255,0.12)',
                fontFamily: '"Figtree",sans-serif',
              }}
            >
              <ArrowDownLeft className="size-4" strokeWidth={2.2} />
              Request
            </Link>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showAddress && address && (
          <AddressSheet address={address} onClose={() => setShowAddress(false)} />
        )}
      </AnimatePresence>
    </>
  )
}
