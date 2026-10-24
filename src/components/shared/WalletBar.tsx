/**
 * WalletBar — top bar with ConnectKit button, USDC balance (ERC-20 only), tier badge.
 * Never shows native balance. Always reads the 6-decimal ERC-20 USDC balance.
 */

import { ConnectKitButton } from 'connectkit'
import { useAccount, useReadContract } from 'wagmi'
import { erc20Abi, formatUnits, type Address } from 'viem'
import { getUsdc } from '../../onchain-facts'
import { TARGET_CHAIN_ID } from '../../config'
import { useMyKycTier } from '../../hooks/useKycTier'
import { useMyHandle } from '../../hooks/useHandleRegistry'
import { BRAND } from '../../../config/brand'

const usdcFact = getUsdc(TARGET_CHAIN_ID)
const USDC_ADDRESS = (usdcFact?.address ?? '0x3600000000000000000000000000000000000000') as Address
const USDC_DECIMALS = usdcFact?.decimals ?? 6

const TIER_COLORS: Record<0 | 1 | 2, string> = {
  0: 'rgba(107,101,128,0.12)',
  1: 'rgba(16,97,166,0.12)',
  2: 'rgba(26,128,71,0.12)',
}
const TIER_TEXT_COLORS: Record<0 | 1 | 2, string> = {
  0: 'var(--muted)',
  1: 'var(--accent-hover)',
  2: 'var(--success)',
}

export function WalletBar() {
  const { address, isConnected } = useAccount()

  // USDC ERC-20 balance — the only balance shown on Arc
  const { data: balanceRaw } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
    chainId: TARGET_CHAIN_ID,
  })

  const { data: tierData } = useMyKycTier()
  const { data: handle } = useMyHandle()

  const formatted = balanceRaw !== undefined
    ? parseFloat(formatUnits(balanceRaw, USDC_DECIMALS)).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : null

  const tier = tierData?.tier ?? 0

  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span
          className="display text-lg font-bold tracking-tight"
          style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
        >
          {BRAND.name}
        </span>
        {tierData && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{
              background: TIER_COLORS[tier],
              color: TIER_TEXT_COLORS[tier],
              letterSpacing: '0.06em',
            }}
          >
            {tierData.info.label}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        {isConnected && formatted !== null && (
          <div className="flex items-center gap-1">
            <span
              className="display text-sm font-bold tabular-nums"
              style={{ color: 'var(--ink)' }}
            >
              {formatted}
            </span>
            <span className="text-xs" style={{ color: 'var(--subtle)' }}>
              USDC
            </span>
          </div>
        )}
        {isConnected && handle && (
          <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
            @{handle}
          </span>
        )}
        <ConnectKitButton />
      </div>
    </header>
  )
}
