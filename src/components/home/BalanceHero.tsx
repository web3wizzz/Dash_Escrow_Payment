/**
 * BalanceHero — Navy hero card with live USDC balance, handle, address sheet with real QR.
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

// ─── QR Canvas ───────────────────────────────────────────────────────────────

function QRCanvas({ value, size = 200 }: { value: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!canvasRef.current) return
    setReady(false)
    void QRCodeLib.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: { dark: '#101934', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    }).then(() => setReady(true))
  }, [value, size])

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {!ready && (
        <div
          className="absolute inset-0 rounded-2xl skeleton"
          style={{ borderRadius: 16 }}
        />
      )}
      <canvas
        ref={canvasRef}
        style={{
          borderRadius: 16,
          opacity: ready ? 1 : 0,
          transition: 'opacity 0.2s ease',
          display: 'block',
        }}
      />
    </div>
  )
}

// ─── Address sheet ────────────────────────────────────────────────────────────

function AddressSheet({ address, onClose }: { address: Address; onClose: () => void }) {
  const short = `${address.slice(0, 10)}…${address.slice(-8)}`
  const [copied, setCopied] = useState(false)

  const copy = (text: string, setter: (v: boolean) => void) => {
    void navigator.clipboard.writeText(text).then(() => {
      setter(true)
      setTimeout(() => setter(false), 2200)
    })
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(8,15,34,0.65)', backdropFilter: 'blur(8px)' }} />

      <motion.div
        className="relative w-full max-w-md rounded-t-3xl pb-safe"
        style={{
          background: '#fff',
          boxShadow: '0 -12px 48px rgba(16,25,52,0.22)',
          paddingBottom: 'max(env(safe-area-inset-bottom, 20px), 20px)',
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gold accent strip */}
        <div className="absolute top-0 inset-x-0 h-0.5 rounded-t-3xl" style={{ background: 'var(--gold)' }} />

        {/* Close + drag */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="mx-auto w-9 h-1 rounded-full" style={{ background: 'var(--border-strong)' }} />
        </div>
        <button
          onClick={onClose}
          className="absolute top-3.5 right-4 flex size-8 items-center justify-center rounded-full transition-colors hover:bg-slate-100 active:scale-90"
          aria-label="Close"
        >
          <X className="size-4" style={{ color: 'var(--muted)' }} />
        </button>

        <div className="px-6 pt-1 pb-2 text-center">
          <p className="text-base font-bold mb-0.5" style={{ color: 'var(--ink)' }}>Your address</p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>Receive USDC on {BRAND.networkName}</p>
        </div>

        {/* QR */}
        <div className="flex justify-center px-6 py-4">
          <div
            className="rounded-3xl p-3"
            style={{ background: '#fff', boxShadow: '0 4px 24px rgba(16,25,52,0.10)', border: '1px solid var(--border)' }}
          >
            <QRCanvas value={address} size={200} />
          </div>
        </div>

        {/* Copy address */}
        <div className="px-6 space-y-2.5">
          <button
            onClick={() => copy(address, setCopied)}
            className="w-full flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all active:scale-[0.98]"
            style={{ background: 'var(--surface-muted)', color: 'var(--ink)', border: '1px solid var(--border)' }}
          >
            <span className="mono text-xs truncate">{short}</span>
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

          <p className="text-center text-[11px] pt-1" style={{ color: 'var(--subtle)' }}>
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

  const [whole, frac] = (() => {
    if (balanceRaw === undefined) return [null, null]
    const n = parseFloat(formatUnits(balanceRaw, USDC_DECIMALS))
    const parts = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.')
    return [parts[0], parts[1] ?? '00']
  })()

  const shortAddress = address ? `${address.slice(0, 8)}…${address.slice(-6)}` : ''

  if (!isConnected) return null

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, ease: [0.25, 0.1, 0.25, 1.0] }}
        className="relative overflow-hidden rounded-3xl"
        style={{
          background: 'linear-gradient(148deg, #16224A 0%, #0D1838 55%, #0A1220 100%)',
          boxShadow: '0 8px 36px rgba(8,15,34,0.38)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {/* Gold radial glow — top right */}
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            top: -50, right: -50,
            width: 240, height: 240,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(243,181,28,0.18) 0%, transparent 65%)',
            filter: 'blur(24px)',
          }}
        />
        {/* Teal glow — bottom left */}
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            bottom: -30, left: -30,
            width: 160, height: 160,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(24,165,139,0.12) 0%, transparent 70%)',
            filter: 'blur(20px)',
          }}
        />

        <div className="relative z-10 p-5">
          {/* Top row: address chip + tier */}
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={() => setShowAddress(true)}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all active:scale-95 hover:bg-white/10"
              style={{
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.55)',
                border: '1px solid rgba(255,255,255,0.10)',
              }}
            >
              <span className="mono">{shortAddress}</span>
              <QrCode className="size-3" />
            </button>
            {/* Tier pill removed — payments are permissionless at launch */}
          </div>

          {/* Balance */}
          <div className="mb-2">
            <p
              className="text-[11px] font-semibold uppercase mb-2"
              style={{ color: 'rgba(255,255,255,0.38)', letterSpacing: '0.10em' }}
            >
              Available balance
            </p>
            {isLoading || whole === null ? (
              <div className="flex items-end gap-1 mb-1">
                <Skeleton className="h-12 w-40 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)' }} />
              </div>
            ) : (
              <motion.div
                key={whole + frac}
                initial={{ opacity: 0.6 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="flex items-baseline gap-1.5"
              >
                <span
                  className="display font-bold tabular-nums"
                  style={{ color: '#fff', fontSize: '3.2rem', lineHeight: 1, letterSpacing: '-0.04em' }}
                >
                  {whole}
                </span>
                <span
                  className="display font-bold tabular-nums"
                  style={{ color: 'rgba(255,255,255,0.48)', fontSize: '1.7rem', lineHeight: 1, letterSpacing: '-0.03em' }}
                >
                  .{frac}
                </span>
                <span className="text-sm font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.42)' }}>
                  USDC
                </span>
              </motion.div>
            )}
          </div>

          {/* Divider */}
          <div className="h-px mb-4" style={{ background: 'rgba(255,255,255,0.08)' }} />

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-2.5">
            <Link
              to="/send"
              className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold transition-all active:scale-[0.97] hover:brightness-110"
              style={{
                background: '#F3B51C',
                color: '#0A0F1E',
                boxShadow: '0 2px 12px rgba(243,181,28,0.44)',
              }}
            >
              <ArrowUpRight className="size-4" strokeWidth={2.5} />
              Send
            </Link>
            <Link
              to="/request"
              className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold transition-all active:scale-[0.97]"
              style={{
                background: 'rgba(255,255,255,0.10)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.14)',
              }}
            >
              <ArrowDownLeft className="size-4" strokeWidth={2.5} />
              Request
            </Link>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showAddress && address && (
          <AddressSheet
            address={address}
            onClose={() => setShowAddress(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
