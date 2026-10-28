/**
 * Profile — wallet address, network, and Permit2 approval status.
 * Per AUDIT.md: revoke button calls USDC.approve(Permit2, 0).
 */

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { motion } from 'framer-motion'
import {
  CheckCircle2, XCircle, Copy, Check, ExternalLink,
  Wallet, ShieldOff, Loader2,
} from 'lucide-react'
import { useRevokePermit2, usePermit2Status } from '../hooks/usePayRouter'
import { TxStatus } from '../components/shared/TxStatus'
import { formatAddress } from '../onchain-patterns-utils'
import { PageHeader, Divider, SectionLabel } from '../components/ui'
import { TARGET_CHAIN_ID } from '../config'

const NETWORK_LABEL = TARGET_CHAIN_ID === 5042 ? 'Arc Mainnet' : 'Arc Testnet'
const CHAIN_ID_DISPLAY = TARGET_CHAIN_ID.toString()

function CopyableAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    })
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 group transition-opacity hover:opacity-70 active:scale-95"
    >
      <span className="mono text-xs font-medium" style={{ color: 'var(--ink)' }}>
        {formatAddress(address)}
      </span>
      {copied
        ? <Check className="size-3.5" style={{ color: 'var(--success)' }} />
        : <Copy className="size-3.5" style={{ color: 'var(--subtle)' }} />
      }
    </button>
  )
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

  const approved = revokeHook.isSuccess ? false : checkedApproved

  const profileSections = [
    {
      key: 'wallet',
      title: 'Wallet',
      delay: 0.04,
      content: (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-xl" style={{ background: 'var(--surface-muted)' }}>
                <Wallet className="size-4" style={{ color: 'var(--muted)' }} />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--muted)', letterSpacing: '0.09em' }}>Address</p>
                {address && <CopyableAddress address={address} />}
              </div>
            </div>
          </div>

          <Divider />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--muted)', letterSpacing: '0.09em' }}>Network</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="size-1.5 rounded-full" style={{ background: 'var(--success)' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{NETWORK_LABEL}</span>
              </div>
            </div>
            <span className="mono text-xs" style={{ color: 'var(--muted)' }}>{CHAIN_ID_DISPLAY}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'permit2',
      title: 'Permit2 Approval',
      delay: 0.12,
      content: (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {approved === null ? (
              <>
                <Loader2 className="size-4 animate-spin" style={{ color: 'var(--muted)' }} />
                <span className="text-xs" style={{ color: 'var(--muted)' }}>Checking approval…</span>
              </>
            ) : approved ? (
              <>
                <CheckCircle2 className="size-4" style={{ color: 'var(--success)' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--success-text)' }}>
                  Approved — payments use exact-amount signatures
                </span>
              </>
            ) : (
              <>
                <XCircle className="size-4" style={{ color: 'var(--muted)' }} />
                <span className="text-xs" style={{ color: 'var(--muted)' }}>
                  Not approved — you&apos;ll be prompted on first payment
                </span>
              </>
            )}
          </div>

          <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
            This approves the{' '}
            <a
              href="https://github.com/Uniswap/permit2"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold inline-flex items-center gap-0.5"
              style={{ color: 'var(--navy)' }}
            >
              Permit2 contract
              <ExternalLink className="size-3" />
            </a>
            {' '}— not this app. Every payment is still individually signed for the exact amount.
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
                successMessage="Permit2 approval revoked. You'll be prompted on next payment."
                onDismiss={revokeHook.reset}
              />
              {!revokeHook.isSuccess && (
                <button
                  onClick={() => revokeHook.revoke()}
                  disabled={revokeHook.isPending || revokeHook.isConfirming}
                  className="w-full flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-sm font-bold btn-danger disabled:opacity-40"
                >
                  <ShieldOff className="size-4" />
                  {revokeHook.isPending || revokeHook.isConfirming ? 'Revoking…' : 'Revoke approval'}
                </button>
              )}
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Profile" />

      {!isConnected ? (
        <div
          className="rounded-3xl p-6 text-center"
          style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
        >
          <Wallet className="size-8 mx-auto mb-3" style={{ color: 'var(--subtle)' }} strokeWidth={1.5} />
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--ink)' }}>No wallet connected</p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>Connect your wallet to view your profile.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {profileSections.map(({ key, title, delay, content }) => (
            <motion.section
              key={key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.20, delay, ease: [0.25, 0.1, 0.25, 1.0] }}
              className="rounded-3xl overflow-hidden"
              style={{
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border)',
                boxShadow: '0 2px 8px rgba(16,25,52,0.04)',
              }}
            >
              <div className="px-4 pt-4 pb-1">
                <SectionLabel>{title}</SectionLabel>
              </div>
              <div className="px-4 pb-4">
                {content}
              </div>
            </motion.section>
          ))}
        </div>
      )}
    </div>
  )
}
