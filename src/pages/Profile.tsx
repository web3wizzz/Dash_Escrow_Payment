/**
 * Profile — wallet overview with Permit2 revoke button.
 * Per AUDIT.md: the revoke button calls USDC.approve(Permit2, 0).
 */

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { motion } from 'framer-motion'
import { Shield, CheckCircle2, XCircle } from 'lucide-react'
import { useRevokePermit2, usePermit2Status } from '../hooks/usePayRouter'
import { TxStatus } from '../components/shared/TxStatus'
import { formatAddress } from '../onchain-patterns-utils'
import { ConnectKitButton } from 'connectkit'

const glass = {
  card: {
    background: 'rgba(255,255,255,0.64)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.68)',
    boxShadow: '0 8px 32px rgba(18,45,69,0.08)',
  } as React.CSSProperties,
}

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.24, ease: [0.25, 0.1, 0.25, 1.0] },
}

export function Profile() {
  const { address, isConnected } = useAccount()
  const { check } = usePermit2Status()
  const revokeHook = useRevokePermit2()
  const [checkedApproved, setCheckedApproved] = useState<boolean | null>(null)

  useEffect(() => {
    if (!isConnected) return
    void check().then(setCheckedApproved)
  }, [isConnected, check])

  // After a successful revoke, derive the approved state without a second effect
  const approved = revokeHook.isSuccess ? false : checkedApproved

  if (!isConnected) {
    return (
      <div className="space-y-4">
        <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>Profile</h1>
        <div className="rounded-2xl p-5 text-center" style={glass.card}>
          <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>Connect your wallet to view your profile.</p>
          <ConnectKitButton />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>Profile</h1>

      {/* Wallet */}
      <motion.section className="rounded-2xl p-4 space-y-2" style={glass.card} {...fadeUp}>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)', letterSpacing: '0.06em' }}>
          Wallet
        </p>
        <p className="font-mono text-sm" style={{ color: 'var(--ink)' }}>
          {address ? formatAddress(address) : '—'}
        </p>
        <p className="text-xs" style={{ color: 'var(--subtle)' }}>Arc Mainnet (Chain ID 5042)</p>
      </motion.section>

      {/* Permit2 approval */}
      <motion.section
        className="rounded-2xl p-4 space-y-3"
        style={glass.card}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.06, ease: [0.25, 0.1, 0.25, 1.0] }}
      >
        <div className="flex items-center gap-2">
          <Shield className="size-4" style={{ color: 'var(--accent)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Permit2 Approval</h2>
        </div>

        <div className="flex items-center gap-2">
          {approved === null ? (
            <span className="text-xs" style={{ color: 'var(--muted)' }}>Checking…</span>
          ) : approved ? (
            <>
              <CheckCircle2 className="size-4" style={{ color: 'var(--success)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--success)' }}>
                Permit2 approved — payments use exact-amount signatures
              </span>
            </>
          ) : (
            <>
              <XCircle className="size-4" style={{ color: 'var(--muted)' }} />
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                Permit2 not approved — you'll be prompted on first payment
              </span>
            </>
          )}
        </div>

        <p className="text-xs" style={{ color: 'var(--subtle)' }}>
          This approval is for the Permit2 contract, not for this app. Every payment is still
          signed individually for the exact amount. See{' '}
          <a
            href="https://github.com/Uniswap/permit2"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent-hover)' }}
          >
            Permit2 on GitHub
          </a>.
        </p>

        {approved && (
          <>
            <TxStatus
              isPending={revokeHook.isPending}
              isConfirming={revokeHook.isConfirming}
              isSuccess={revokeHook.isSuccess}
              isError={revokeHook.isError}
              error={revokeHook.error}
              hash={revokeHook.hash}
              successMessage="Permit2 approval revoked. You'll be prompted again on next payment."
              onDismiss={revokeHook.reset}
            />
            {!revokeHook.isSuccess && (
              <button
                onClick={() => revokeHook.revoke()}
                disabled={revokeHook.isPending || revokeHook.isConfirming}
                className="w-full rounded-2xl py-2.5 text-sm font-semibold disabled:opacity-40"
                style={{ background: 'rgba(186,43,76,0.07)', color: 'var(--danger)', border: '1px solid rgba(186,43,76,0.15)' }}
              >
                Revoke approval
              </button>
            )}
          </>
        )}
      </motion.section>
    </div>
  )
}
