/**
 * BalanceHero — deep-indigo balance card with handle chip, Add USDC, and Send actions.
 * Wallet disconnected: shows a single saffron Connect button + getting-started checklist.
 */

import { useState } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { erc20Abi, formatUnits, type Address } from 'viem'
import { motion, AnimatePresence } from 'framer-motion'
import { ConnectKitButton } from 'connectkit'
import { Copy, Check, QrCode, ArrowUpRight, ShieldCheck, Wallet, BadgeCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getUsdc } from '../../onchain-facts'
import { TARGET_CHAIN_ID } from '../../config'
import { useMyHandle } from '../../hooks/useHandleRegistry'
import { useMyKycTier } from '../../hooks/useKycTier'
import { BRAND } from '../../../config/brand'

const usdcFact = getUsdc(TARGET_CHAIN_ID)
const USDC_ADDRESS = (usdcFact?.address ?? '0x3600000000000000000000000000000000000000') as Address
const USDC_DECIMALS = usdcFact?.decimals ?? 6

// ─── Address QR sheet ───────────────────────────────────────────────────────

function AddressSheet({ address, onClose }: { address: Address; onClose: () => void }) {
  const short = `${address.slice(0, 10)}…${address.slice(-8)}`
  const [copied, setCopied] = useState(false)

  const copy = () => {
    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(14,16,48,0.55)', backdropFilter: 'blur(4px)' }} />
      <motion.div
        className="relative w-full max-w-md rounded-t-3xl px-6 pt-3 pb-10"
        style={{ background: '#ffffff', zIndex: 1 }}
        initial={{ y: 80 }}
        animate={{ y: 0 }}
        exit={{ y: 80 }}
        transition={{ type: 'spring', stiffness: 360, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="mx-auto mb-5 w-10 h-1 rounded-full" style={{ background: 'var(--border-strong)' }} />

        <p className="text-center text-sm font-semibold mb-1" style={{ color: 'var(--ink)' }}>
          Your address
        </p>
        <p className="text-center text-xs mb-5" style={{ color: 'var(--muted)' }}>
          Receive USDC on Arc Mainnet
        </p>

        {/* QR placeholder — real QRCode rendered via canvas once library is available */}
        <div
          className="mx-auto mb-5 flex items-center justify-center rounded-2xl"
          style={{ width: 180, height: 180, background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
        >
          <QrCode className="size-20" style={{ color: 'var(--subtle)' }} strokeWidth={1} />
        </div>

        <button
          onClick={copy}
          className="mx-auto flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all active:scale-95"
          style={{ background: 'var(--surface-muted)', color: 'var(--ink)' }}
        >
          <span className="mono text-xs">{short}</span>
          {copied
            ? <Check className="size-4" style={{ color: 'var(--success)' }} />
            : <Copy className="size-4" style={{ color: 'var(--muted)' }} />
          }
        </button>

        <p className="mt-4 text-center text-[11px]" style={{ color: 'var(--subtle)' }}>
          Arc Mainnet · USDC only
        </p>
      </motion.div>
    </motion.div>
  )
}

// ─── Handle chip ────────────────────────────────────────────────────────────

function HandleChip({ handle }: { handle: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    void navigator.clipboard.writeText(`@${handle}`).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all active:scale-95"
      style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.90)', border: '1px solid rgba(255,255,255,0.18)' }}
    >
      <span>@{handle}</span>
      {copied
        ? <Check className="size-3" />
        : <Copy className="size-3 opacity-70" />
      }
    </button>
  )
}

// ─── Getting-started checklist ──────────────────────────────────────────────

interface ChecklistStep {
  label: string
  done: boolean
  icon: React.ReactNode
}

function GettingStarted({ steps }: { steps: ChecklistStep[] }) {
  return (
    <motion.div
      className="rounded-2xl p-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(27,31,75,0.06)' }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: 0.1 }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)', letterSpacing: '0.08em' }}>
        Get started
      </p>
      <div className="space-y-2.5">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            <span
              className="flex items-center justify-center size-7 rounded-full flex-shrink-0"
              style={{
                background: step.done ? 'rgba(26,128,71,0.12)' : 'var(--surface-muted)',
                color: step.done ? 'var(--success)' : 'var(--muted)',
              }}
            >
              {step.done ? <Check className="size-3.5" strokeWidth={2.5} /> : step.icon}
            </span>
            <span
              className="text-sm"
              style={{
                color: step.done ? 'var(--muted)' : 'var(--ink)',
                textDecoration: step.done ? 'line-through' : 'none',
              }}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

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

  const { data: handleData } = useMyHandle()
  const { data: tierData } = useMyKycTier()

  const handle = handleData && handleData.length > 0 ? handleData : null

  const formatted = balanceRaw !== undefined
    ? parseFloat(formatUnits(balanceRaw, USDC_DECIMALS)).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : null

  // Getting-started steps (disconnected view)
  const gettingStartedSteps: ChecklistStep[] = [
    { label: 'Connect wallet',     done: isConnected,       icon: <Wallet className="size-3.5" /> },
    { label: 'Fund your wallet',   done: balanceRaw !== undefined && balanceRaw > 0n,  icon: <QrCode className="size-3.5" /> },
    { label: 'Claim a handle',     done: !!handle,          icon: <BadgeCheck className="size-3.5" /> },
    { label: 'Verify identity (Sandbox)', done: (tierData?.tier ?? 0) >= 1, icon: <ShieldCheck className="size-3.5" /> },
  ]

  return (
    <>
      {/* Balance hero card */}
      <motion.section
        className="rounded-3xl p-5"
        style={{ background: '#0E1030', boxShadow: '0 12px 36px rgba(14,16,48,0.28)' }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, ease: [0.25, 0.1, 0.25, 1.0] }}
      >
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.09em' }}>
            Available balance
          </p>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
            style={{ background: 'rgba(242,169,0,0.18)', color: '#F2A900', letterSpacing: '0.07em' }}
          >
            Arc Mainnet
          </span>
        </div>

        {!isConnected ? (
          /* ── Disconnected ── */
          <div className="space-y-4">
            <p className="bricolage text-5xl font-bold" style={{ color: 'rgba(255,255,255,0.20)', letterSpacing: '-0.03em' }}>
              —
            </p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Connect your wallet to see your balance.
            </p>
            {/* Saffron connect button */}
            <ConnectKitButton.Custom>
              {({ show }) => (
                <button
                  onClick={show}
                  className="btn-primary w-full py-3 text-sm text-center"
                >
                  Connect wallet
                </button>
              )}
            </ConnectKitButton.Custom>
          </div>
        ) : (
          /* ── Connected ── */
          <>
            {/* Amount */}
            <div className="flex items-baseline gap-2 mb-3">
              <span
                className="bricolage text-5xl font-bold tabular-nums"
                style={{ color: '#ffffff', letterSpacing: '-0.03em', lineHeight: 1 }}
              >
                {isLoading ? (
                  <span style={{ color: 'rgba(255,255,255,0.35)' }}>…</span>
                ) : (formatted ?? '0.00')}
              </span>
              <span className="text-lg font-medium" style={{ color: 'rgba(255,255,255,0.50)' }}>USDC</span>
            </div>

            {/* Handle chip */}
            {handle && <div className="mb-4"><HandleChip handle={handle} /></div>}
            {!handle && (
              <Link
                to="/settings"
                className="inline-flex items-center gap-1 text-xs mb-4 transition-opacity hover:opacity-80"
                style={{ color: 'rgba(255,255,255,0.45)' }}
              >
                <BadgeCheck className="size-3.5" />
                <span>Claim a handle in {BRAND.name}</span>
              </Link>
            )}

            {/* Action row */}
            <div className="flex gap-2.5 mt-1">
              <button
                onClick={() => setShowAddress(true)}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-sm font-semibold transition-all active:scale-95"
                style={{ background: 'rgba(255,255,255,0.10)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.14)' }}
              >
                <QrCode className="size-4" />
                Add USDC
              </button>
              <Link
                to="/send"
                className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-sm font-semibold transition-all active:scale-95"
                style={{ background: '#F2A900', color: '#0E1030' }}
              >
                <ArrowUpRight className="size-4" strokeWidth={2.4} />
                Send
              </Link>
            </div>
          </>
        )}
      </motion.section>

      {/* Getting-started checklist — disconnected only */}
      {!isConnected && (
        <GettingStarted steps={gettingStartedSteps} />
      )}

      {/* Address / QR sheet */}
      <AnimatePresence>
        {showAddress && address && (
          <AddressSheet address={address} onClose={() => setShowAddress(false)} />
        )}
      </AnimatePresence>
    </>
  )
}
