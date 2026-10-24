/**
 * TxStatus — inline transaction state surface.
 * Shows pending → confirming → success / error states tied to real wagmi hooks.
 * Never simulates progress.
 */

import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, Loader2, ExternalLink } from 'lucide-react'
import { buildTxExplorerUrl } from '../../onchain-facts'
import { TARGET_CHAIN_ID } from '../../config'

const springs = {
  gentle: { type: 'spring', stiffness: 300, damping: 26 },
} as const

interface TxStatusProps {
  isPending: boolean
  isConfirming: boolean
  isSuccess: boolean
  isError: boolean
  error?: Error | null
  hash?: `0x${string}`
  successMessage?: string
  onDismiss?: () => void
}

/** Parses a wagmi/viem error into a user-facing message. */
function parseError(error: Error | null | undefined): string {
  if (!error) return 'Something went wrong. Please try again.'
  const msg = error.message?.toLowerCase() ?? ''
  if (msg.includes('user rejected') || msg.includes('4001')) return 'Transaction cancelled.'
  if (msg.includes('insufficient') || msg.includes('exceeds balance')) return 'Insufficient USDC balance.'
  if (msg.includes('blocklisted') || msg.includes('blocklist')) return 'This address is restricted by USDC.'
  if (msg.includes('exceedsglobalcap')) return 'Amount exceeds the maximum payment limit.'
  if (msg.includes('exceedstierper')) return 'Amount exceeds your tier limit per payment.'
  if (msg.includes('exceedstier') && msg.includes('daily')) return 'Daily spending limit reached.'
  if (msg.includes('handlenotfound')) return 'That handle does not exist.'
  if (msg.includes('reverted')) {
    const match = msg.match(/reason="([^"]+)"/)
    if (match) return `Transaction failed: ${match[1]}`
    return 'Transaction failed. Please try again.'
  }
  if (msg.includes('network') || msg.includes('timeout')) return 'Network error. Please retry.'
  return 'Something went wrong. Please try again.'
}

export function TxStatus({
  isPending,
  isConfirming,
  isSuccess,
  isError,
  error,
  hash,
  successMessage = 'Transaction confirmed',
  onDismiss,
}: TxStatusProps) {
  const explorerUrl = hash ? buildTxExplorerUrl(TARGET_CHAIN_ID, hash) : undefined

  return (
    <AnimatePresence>
      {(isPending || isConfirming || isSuccess || isError) && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={springs.gentle}
        >
          {(isPending || isConfirming) && (
            <div
              className="rounded-2xl p-3.5 flex items-center gap-3"
              style={{
                background: 'rgba(255,255,255,0.7)',
                border: '1px solid rgba(255,255,255,0.56)',
              }}
            >
              <Loader2
                className="size-4 shrink-0 animate-spin"
                style={{ color: 'var(--accent)' }}
              />
              <span className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>
                {isPending ? 'Confirm in wallet…' : 'Confirming on Arc…'}
              </span>
            </div>
          )}

          {isSuccess && (
            <div
              className="rounded-2xl p-3.5 flex items-center gap-3"
              style={{
                background: 'rgba(26,128,71,0.08)',
                border: '1px solid rgba(26,128,71,0.18)',
              }}
            >
              <CheckCircle2 className="size-4 shrink-0" style={{ color: 'var(--success)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                  {successMessage}
                </p>
                {explorerUrl && (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-flex items-center gap-1 text-xs"
                    style={{ color: 'var(--accent-hover)' }}
                  >
                    View on explorer <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="shrink-0 text-xs font-medium"
                  style={{ color: 'var(--muted)' }}
                >
                  Dismiss
                </button>
              )}
            </div>
          )}

          {isError && (
            <div
              className="rounded-2xl p-3.5 flex items-center gap-3"
              style={{
                background: 'rgba(186, 43, 76, 0.07)',
                border: '1px solid rgba(186, 43, 76, 0.18)',
              }}
            >
              <XCircle className="size-4 shrink-0" style={{ color: 'var(--danger)' }} />
              <p className="flex-1 text-sm" style={{ color: 'var(--ink)' }}>
                {parseError(error)}
              </p>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
