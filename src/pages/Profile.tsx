/**
 * Profile — four clean sections: Wallet, Permissions, Security, About.
 * Compact rows, hairline dividers, no oversized cards.
 */

import { useState, useEffect, type ReactNode } from 'react'
import { useAccount } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2, XCircle, Copy, Check, ExternalLink,
  Wallet, ShieldOff, Loader2, ChevronRight,
  Lock,
} from 'lucide-react'
import { useRevokePermit2, usePermit2Status } from '../hooks/usePayRouter'
import { TxStatus } from '../components/shared/TxStatus'
import { formatAddress } from '../onchain-patterns-utils'
import { buildAddressExplorerUrl } from '../onchain-facts'
import { TARGET_CHAIN_ID, DISPLAY_NETWORK_NAME } from '../config'

const CHAIN_ID_DISPLAY = TARGET_CHAIN_ID.toString()
const APP_VERSION = '1.0.0-beta'

/* ── Section shell ── */
function Section({
  label,
  children,
  delay = 0,
}: {
  label: string
  children: ReactNode
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay }}
    >
      <p
        className="text-[10px] font-bold uppercase mb-2"
        style={{ color: 'var(--subtle)', letterSpacing: '0.10em' }}
      >
        {label}
      </p>
      <div
        className="overflow-hidden"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
        }}
      >
        {children}
      </div>
    </motion.div>
  )
}

/* ── Row ── */
function Row({
  label,
  value,
  valueColor,
  icon,
  href,
  onClick,
  danger,
  last = false,
}: {
  label: string
  value?: ReactNode
  valueColor?: string
  icon?: ReactNode
  href?: string
  onClick?: () => void
  danger?: boolean
  last?: boolean
}) {
  const divider = !last && (
    <div className="mx-4 h-px" style={{ background: 'var(--border)' }} />
  )

  const inner = (
    <div
      className="flex items-center justify-between px-4 py-3.5"
      style={{ minHeight: 50 }}
    >
      <span
        className="text-sm"
        style={{ color: danger ? 'var(--danger)' : 'var(--muted)' }}
      >
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        {value !== undefined && (
          <span
            className="text-sm font-semibold"
            style={{ color: valueColor ?? 'var(--ink)' }}
          >
            {value}
          </span>
        )}
        {icon}
        {(href || onClick) && !icon && (
          <ChevronRight className="size-4" style={{ color: 'var(--subtle)' }} />
        )}
      </div>
    </div>
  )

  const el = href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="block hover:bg-slate-50/50 transition-colors">
      {inner}
    </a>
  ) : onClick ? (
    <button onClick={onClick} className="w-full text-left hover:bg-slate-50/50 transition-colors active:bg-slate-100/80">
      {inner}
    </button>
  ) : (
    <div>{inner}</div>
  )

  return (
    <>
      {el}
      {divider}
    </>
  )
}

/* ── Copyable address ── */
function CopyRow({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    })
  }
  return (
    <div
      className="flex items-center justify-between px-4 py-3.5"
      style={{ minHeight: 50 }}
    >
      <span className="text-sm" style={{ color: 'var(--muted)' }}>Address</span>
      <button
        onClick={copy}
        className="flex items-center gap-1.5 transition-opacity active:opacity-60"
      >
        <span className="mono text-xs font-medium" style={{ color: 'var(--ink)' }}>
          {formatAddress(address)}
        </span>
        <AnimatePresence mode="wait" initial={false}>
          {copied
            ? <motion.span key="c" initial={{ scale: 0.6 }} animate={{ scale: 1 }} exit={{ scale: 0.6 }}>
                <Check className="size-3.5" style={{ color: 'var(--success)' }} />
              </motion.span>
            : <motion.span key="n" initial={{ scale: 0.6 }} animate={{ scale: 1 }} exit={{ scale: 0.6 }}>
                <Copy className="size-3.5" style={{ color: 'var(--subtle)' }} />
              </motion.span>
          }
        </AnimatePresence>
      </button>
    </div>
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
  const explorerUrl = address ? buildAddressExplorerUrl(TARGET_CHAIN_ID, address) : undefined

  if (!isConnected) {
    return (
      <div className="space-y-4">
        <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
          Profile
        </h1>
        <div
          className="flex flex-col items-center text-center py-14 gap-3"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14 }}
        >
          <div
            className="flex items-center justify-center rounded-full"
            style={{ width: 44, height: 44, background: 'var(--surface-muted)' }}
          >
            <Wallet className="size-5" style={{ color: 'var(--subtle)' }} strokeWidth={1.6} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>No wallet connected</p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              Connect your wallet to view your profile.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-2">

      <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
        Profile
      </h1>

      {/* ── Wallet ── */}
      <Section label="Wallet" delay={0.04}>
        {address && (
          <>
            <CopyRow address={address} />
            <div className="mx-4 h-px" style={{ background: 'var(--border)' }} />
          </>
        )}
        <Row
          label="Network"
          value={
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full" style={{ background: 'var(--success)' }} />
              {DISPLAY_NETWORK_NAME}
              <span className="mono text-[11px]" style={{ color: 'var(--subtle)' }}>
                {CHAIN_ID_DISPLAY}
              </span>
            </span>
          }
        />
        <div className="mx-4 h-px" style={{ background: 'var(--border)' }} />
        <Row
          label="View on explorer"
          href={explorerUrl}
          icon={<ExternalLink className="size-3.5" style={{ color: 'var(--subtle)' }} />}
          last
        />
      </Section>

      {/* ── Permissions ── */}
      <Section label="Permissions" delay={0.08}>
        <div className="px-4 py-3.5" style={{ minHeight: 50 }}>
          <div className="flex items-start gap-3">
            {approved === null
              ? <Loader2 className="size-4 mt-0.5 animate-spin shrink-0" style={{ color: 'var(--muted)' }} />
              : approved
              ? <CheckCircle2 className="size-4 mt-0.5 shrink-0" style={{ color: 'var(--success)' }} />
              : <XCircle className="size-4 mt-0.5 shrink-0" style={{ color: 'var(--subtle)' }} />
            }
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                {approved === null ? 'Checking…' : approved ? 'Permit2 approved' : 'Not approved'}
              </p>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--muted)' }}>
                {approved
                  ? 'Payments use Permit2 signature transfers. Each transaction signs only the exact amount.'
                  : "You'll be prompted to approve Permit2 on your first payment."
                }
              </p>
            </div>
          </div>
        </div>

        {approved && (
          <>
            <div className="mx-4 h-px" style={{ background: 'var(--border)' }} />

            {/* Revoke status */}
            {(revokeHook.isPending || revokeHook.isConfirming || revokeHook.isSuccess || revokeHook.isError) && (
              <div className="px-4 pb-3">
                <TxStatus
                  isPending={revokeHook.isPending}
                  isConfirming={revokeHook.isConfirming}
                  isSuccess={revokeHook.isSuccess}
                  isError={revokeHook.isError}
                  error={revokeHook.error}
                  hash={revokeHook.hash}
                  successMessage="Permit2 approval revoked."
                  onDismiss={revokeHook.reset}
                />
              </div>
            )}

            {!revokeHook.isSuccess && (
              <div className="px-4 pb-3.5">
                <button
                  onClick={() => revokeHook.revoke()}
                  disabled={revokeHook.isPending || revokeHook.isConfirming}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all active:scale-95 disabled:opacity-40"
                  style={{
                    background: 'var(--danger-muted)',
                    color: 'var(--danger)',
                    border: '1px solid rgba(192,51,74,0.18)',
                  }}
                >
                  <ShieldOff className="size-3.5" />
                  {revokeHook.isPending || revokeHook.isConfirming ? 'Revoking…' : 'Revoke approval'}
                </button>
              </div>
            )}
          </>
        )}
      </Section>

      {/* ── Security ── */}
      <Section label="Security" delay={0.12}>
        <div className="px-4 py-3.5 flex items-start gap-3">
          <Lock className="size-4 mt-0.5 shrink-0" style={{ color: 'var(--subtle)' }} strokeWidth={1.8} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Non-custodial</p>
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--muted)' }}>
              DA$H never holds your funds or keys. Every payment requires your explicit
              wallet signature. Smart contracts on Arc enforce your limits on-chain.
            </p>
          </div>
        </div>
      </Section>

      {/* ── About ── */}
      <Section label="About" delay={0.16}>
        <Row label="Version" value={APP_VERSION} valueColor="var(--muted)" />
        <Row label="Network" value={DISPLAY_NETWORK_NAME} valueColor="var(--muted)" />
        <Row label="Global cap" value="25 USDC" valueColor="var(--muted)" />
        <Row label="Protocol fee" value="0%" valueColor="var(--success)" />
        <div className="mx-4 h-px" style={{ background: 'var(--border)' }} />
        <Row
          label="Permit2 source"
          href="https://github.com/Uniswap/permit2"
          icon={<ExternalLink className="size-3.5" style={{ color: 'var(--subtle)' }} />}
        />
        <Row
          label="Arc documentation"
          href="https://docs.arc.io"
          icon={<ExternalLink className="size-3.5" style={{ color: 'var(--subtle)' }} />}
          last
        />
      </Section>

    </div>
  )
}
