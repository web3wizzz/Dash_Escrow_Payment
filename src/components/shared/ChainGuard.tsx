/**
 * ChainGuard — blocks interaction when the wallet is not on Arc mainnet.
 * Shows an inline prompt to switch chains rather than a modal overlay.
 */

import { useAccount, useSwitchChain } from 'wagmi'
import { AlertTriangle } from 'lucide-react'
import { TARGET_CHAIN_ID } from '../../config'

interface ChainGuardProps {
  children: React.ReactNode
}

export function ChainGuard({ children }: ChainGuardProps) {
  const { isConnected, chainId } = useAccount()
  const { switchChain, isPending } = useSwitchChain()

  if (!isConnected) return <>{children}</>
  if (chainId === TARGET_CHAIN_ID) return <>{children}</>

  return (
    <div
      className="rounded-2xl p-4 flex items-start gap-3"
      style={{
        background: 'rgba(186, 43, 76, 0.07)',
        border: '1px solid rgba(186, 43, 76, 0.18)',
      }}
    >
      <AlertTriangle className="size-4 mt-0.5 shrink-0" style={{ color: 'var(--danger)' }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          Switch to Arc
        </p>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
          This app runs on Arc mainnet. Your wallet is on a different network.
        </p>
      </div>
      <button
        onClick={() => { void switchChain({ chainId: TARGET_CHAIN_ID }) }}
        disabled={isPending}
        className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        style={{ background: 'var(--accent)' }}
      >
        {isPending ? 'Switching…' : 'Switch'}
      </button>
    </div>
  )
}
