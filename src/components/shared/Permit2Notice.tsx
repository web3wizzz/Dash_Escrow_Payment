/**
 * Permit2Notice — explains the one-time USDC approval before the user approves it.
 * Shown only when the wallet has not yet approved Permit2.
 * Per AUDIT.md: this approval targets Permit2's own contract, not PayRouter.
 */

import { useState, useEffect } from 'react'
import { Shield, ExternalLink } from 'lucide-react'
import { useAccount, usePublicClient } from 'wagmi'
import { useApprovePermit2 } from '../../hooks/usePayRouter'
import { hasPermit2Approval } from '../../lib/permit2'
import { PERMIT2_ADDRESS } from '../../../config/brand'
import { TARGET_CHAIN_ID } from '../../config'
import { TxStatus } from './TxStatus'

interface Permit2NoticeProps {
  onApproved?: () => void
}

export function Permit2Notice({ onApproved }: Permit2NoticeProps) {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient({ chainId: TARGET_CHAIN_ID })
  const [approved, setApproved] = useState<boolean | null>(null)
  const { approve, hash, isPending, isConfirming, isSuccess, isError, error, reset } = useApprovePermit2()
  useEffect(() => {
    if (!address || !publicClient || !isConnected) return
    void hasPermit2Approval(publicClient as Parameters<typeof hasPermit2Approval>[0], address).then(setApproved)
  }, [address, publicClient, isConnected])

  // After a successful approve transaction, mark as approved without a second setState effect
  const effectiveApproved = isSuccess ? true : approved

  useEffect(() => {
    if (isSuccess) onApproved?.()
  }, [isSuccess, onApproved])

  // Not connected or already approved — render nothing
  if (!isConnected || effectiveApproved !== false) return null

  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{
        background: 'rgba(255,255,255,0.72)',
        border: '1px solid rgba(255,255,255,0.68)',
        boxShadow: '0 8px 32px rgba(18,45,69,0.08)',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex size-8 items-center justify-center rounded-xl shrink-0"
          style={{ background: 'rgba(16,97,166,0.10)' }}
        >
          <Shield className="size-4" style={{ color: 'var(--accent-hover)' }} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            One-time setup required
          </p>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
            To send payments without per-transaction approvals, allow Permit2 to manage your USDC.
            This approves <strong>Permit2</strong> — a widely audited Uniswap contract — not this app.
            Every payment is still signed individually for the exact amount.
          </p>
          <a
            href={`https://explorer.arc.io/address/${PERMIT2_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs"
            style={{ color: 'var(--accent-hover)' }}
          >
            View Permit2 on explorer <ExternalLink className="size-3" />
          </a>
          <p className="mt-1 text-xs" style={{ color: 'var(--subtle)' }}>
            You can revoke this approval at any time from your Profile settings.
          </p>
        </div>
      </div>

      <TxStatus
        isPending={isPending}
        isConfirming={isConfirming}
        isSuccess={isSuccess}
        isError={isError}
        error={error}
        hash={hash}
        successMessage="Permit2 approved. You can now send payments."
        onDismiss={reset}
      />

      {!isPending && !isConfirming && !isSuccess && (
        <button
          onClick={approve}
          className="w-full rounded-2xl py-3 text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}
        >
          Allow Permit2
        </button>
      )}
    </div>
  )
}
