/**
 * Settings — handle management and KYC tier status (Sandbox label).
 */

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { motion } from 'framer-motion'
import { AtSign, ShieldCheck } from 'lucide-react'
import { useMyHandle, useClaimHandle, useReleaseHandle } from '../hooks/useHandleRegistry'
import { useMyKycTier } from '../hooks/useKycTier'
import { TxStatus } from '../components/shared/TxStatus'
import { ConnectKitButton } from 'connectkit'

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.24, ease: [0.25, 0.1, 0.25, 1.0] },
}

const glass = {
  card: {
    background: 'rgba(255,255,255,0.64)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.68)',
    boxShadow: '0 8px 32px rgba(18,45,69,0.08)',
  } as React.CSSProperties,
  inner: {
    background: 'rgba(255,255,255,0.46)',
    border: '1px solid rgba(255,255,255,0.56)',
  } as React.CSSProperties,
}

export function Settings() {
  const { isConnected } = useAccount()
  const { data: handle, refetch: refetchHandle } = useMyHandle()
  const { data: tierData } = useMyKycTier()
  const [newHandle, setNewHandle] = useState('')
  const claimHook = useClaimHandle()
  const releaseHook = useReleaseHandle()

  const handleValid = /^[a-z][a-z0-9_]{2,19}$/.test(newHandle)

  if (!isConnected) {
    return (
      <div className="space-y-4">
        <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>Settings</h1>
        <div className="rounded-2xl p-5 text-center" style={glass.card}>
          <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>Connect your wallet to manage your settings.</p>
          <ConnectKitButton />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>Settings</h1>

      {/* Handle */}
      <motion.section className="rounded-2xl p-4 space-y-3" style={glass.card} {...fadeUp}>
        <div className="flex items-center gap-2">
          <AtSign className="size-4" style={{ color: 'var(--accent)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Your Handle</h2>
        </div>

        {handle ? (
          <>
            <div className="rounded-xl px-3 py-2.5" style={glass.inner}>
              <p className="text-base font-bold" style={{ color: 'var(--ink)' }}>@{handle}</p>
            </div>
            <TxStatus
              isPending={releaseHook.isPending}
              isConfirming={releaseHook.isConfirming}
              isSuccess={releaseHook.isSuccess}
              isError={releaseHook.isError}
              error={releaseHook.error}
              hash={releaseHook.hash}
              successMessage="Handle released."
              onDismiss={() => { releaseHook.reset(); void refetchHandle() }}
            />
            {!releaseHook.isSuccess && (
              <button
                onClick={() => releaseHook.release()}
                disabled={releaseHook.isPending || releaseHook.isConfirming}
                className="w-full rounded-2xl py-2.5 text-sm font-semibold disabled:opacity-40"
                style={{ background: 'rgba(186,43,76,0.08)', color: 'var(--danger)', border: '1px solid rgba(186,43,76,0.15)' }}
              >
                Release @{handle}
              </button>
            )}
          </>
        ) : (
          <>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Choose a handle so others can send USDC to @you. Free, one per wallet, non-transferable.
            </p>
            <div className="rounded-xl px-3 py-2.5 flex items-center gap-1" style={glass.inner}>
              <span className="text-sm font-medium" style={{ color: 'var(--subtle)' }}>@</span>
              <input
                type="text"
                value={newHandle}
                onChange={(e) => setNewHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="choose_handle"
                maxLength={20}
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: 'var(--ink)' }}
              />
            </div>
            <TxStatus
              isPending={claimHook.isPending}
              isConfirming={claimHook.isConfirming}
              isSuccess={claimHook.isSuccess}
              isError={claimHook.isError}
              error={claimHook.error}
              hash={claimHook.hash}
              successMessage="Handle claimed!"
              onDismiss={() => { claimHook.reset(); void refetchHandle() }}
            />
            {!claimHook.isSuccess && (
              <button
                onClick={() => claimHook.claim(newHandle)}
                disabled={!handleValid || claimHook.isPending || claimHook.isConfirming}
                className="w-full rounded-2xl py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: 'var(--accent)' }}
              >
                Claim handle
              </button>
            )}
          </>
        )}
      </motion.section>

      {/* KYC tier */}
      <motion.section
        className="rounded-2xl p-4 space-y-2"
        style={glass.card}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.08, ease: [0.25, 0.1, 0.25, 1.0] }}
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4" style={{ color: 'var(--accent)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Identity Verification</h2>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ background: 'rgba(255,180,0,0.12)', color: '#b45309', letterSpacing: '0.06em' }}
          >
            Sandbox
          </span>
        </div>

        {tierData && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Current tier</span>
              <span className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                Tier {tierData.tier} — {tierData.info.label}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Per-payment limit</span>
              <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
                {tierData.info.perPaymentFormatted} USDC
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Daily limit</span>
              <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
                {tierData.info.dailyFormatted} {tierData.info.dailyFormatted !== 'Unlimited' ? 'USDC' : ''}
              </span>
            </div>
          </div>
        )}

        <p className="text-xs pt-1" style={{ color: 'var(--muted)' }}>
          {tierData?.info.description ?? 'Identity verification is sandboxed for this demo.'}
        </p>
      </motion.section>
    </div>
  )
}
