/**
 * Settings — handle management and KYC tier status.
 */

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { motion } from 'framer-motion'
import { AtSign, ShieldCheck, Loader2, CheckCircle2 } from 'lucide-react'
import { useMyHandle, useClaimHandle, useReleaseHandle } from '../hooks/useHandleRegistry'
import { useMyKycTier } from '../hooks/useKycTier'
import { TxStatus } from '../components/shared/TxStatus'
import { PageHeader, Badge, Divider, SectionLabel } from '../components/ui'

export function Settings() {
  const { isConnected } = useAccount()
  const { data: handle, refetch: refetchHandle } = useMyHandle()
  const { data: tierData } = useMyKycTier()
  const [newHandle, setNewHandle] = useState('')
  const claimHook = useClaimHandle()
  const releaseHook = useReleaseHandle()

  const handleValid = /^[a-z][a-z0-9_]{2,19}$/.test(newHandle)

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" />

      {!isConnected ? (
        <div
          className="rounded-3xl p-6 text-center"
          style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
        >
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Connect your wallet to manage settings.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Handle section */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.20, delay: 0.04 }}
            className="rounded-3xl overflow-hidden"
            style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(16,25,52,0.04)' }}
          >
            <div className="px-4 pt-4 pb-1">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-xl" style={{ background: 'rgba(16,25,52,0.07)' }}>
                  <AtSign className="size-3.5" style={{ color: 'var(--navy)' }} />
                </span>
                <SectionLabel>Your Handle</SectionLabel>
              </div>
            </div>
            <div className="px-4 pb-4 pt-2 space-y-3">
              {handle ? (
                <>
                  <div
                    className="flex items-center justify-between rounded-2xl px-4 py-3"
                    style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="size-4" style={{ color: 'var(--success)' }} />
                      <span className="text-sm font-bold" style={{ color: 'var(--ink)' }}>@{handle}</span>
                    </div>
                    <Badge variant="success">Claimed</Badge>
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
                      className="w-full flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-sm font-bold btn-danger disabled:opacity-40"
                    >
                      {(releaseHook.isPending || releaseHook.isConfirming) && <Loader2 className="size-3.5 animate-spin" />}
                      Release @{handle}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                    Claim a handle so others can pay you by @name. Free, one per wallet, non-transferable.
                  </p>
                  <div
                    className="flex items-center gap-1 rounded-2xl px-4 py-3 field-base"
                  >
                    <span className="text-sm font-bold flex-shrink-0" style={{ color: 'var(--muted)' }}>@</span>
                    <input
                      type="text"
                      value={newHandle}
                      onChange={(e) => setNewHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="your_handle"
                      maxLength={20}
                      autoCapitalize="none"
                      spellCheck={false}
                      className="flex-1 bg-transparent text-sm font-semibold outline-none"
                      style={{ color: 'var(--ink)' }}
                    />
                  </div>

                  {newHandle && !handleValid && (
                    <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                      3–20 chars, start with a letter, lowercase only.
                    </p>
                  )}

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
                      className="w-full flex items-center justify-center gap-1.5 rounded-2xl py-3 text-sm font-bold btn-navy disabled:opacity-40"
                    >
                      {(claimHook.isPending || claimHook.isConfirming) && <Loader2 className="size-3.5 animate-spin" />}
                      Claim handle
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.section>

          {/* Identity verification section */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.20, delay: 0.08 }}
            className="rounded-3xl overflow-hidden"
            style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(16,25,52,0.04)' }}
          >
            <div className="px-4 pt-4 pb-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-xl" style={{ background: 'rgba(24,165,139,0.12)' }}>
                    <ShieldCheck className="size-3.5" style={{ color: 'var(--success-text)' }} />
                  </span>
                  <SectionLabel>Identity Verification</SectionLabel>
                </div>
                <Badge variant="sandbox">Sandbox</Badge>
              </div>
            </div>

            <div className="px-4 pb-4 pt-2 space-y-3">
              {tierData && (
                <div
                  className="rounded-2xl p-3 space-y-2"
                  style={{ background: 'var(--surface-muted)' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>Current tier</span>
                    <span className="text-xs font-bold" style={{ color: 'var(--ink)' }}>
                      Tier {tierData.tier} — {tierData.info.label}
                    </span>
                  </div>
                  <Divider />
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>Per-payment limit</span>
                    <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
                      {tierData.info.perPaymentFormatted} USDC
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>Daily limit</span>
                    <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
                      {tierData.info.dailyFormatted}{tierData.info.dailyFormatted !== 'Unlimited' ? ' USDC' : ''}
                    </span>
                  </div>
                </div>
              )}

              <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                {tierData?.info.description ?? 'Identity verification is sandboxed for this demo.'}
              </p>
            </div>
          </motion.section>
        </div>
      )}
    </div>
  )
}
