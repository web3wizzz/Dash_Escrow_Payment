/**
 * WalletBar — top bar with brand name, USDC balance, ConnectKit button.
 * Never shows native balance. Always reads the 6-decimal ERC-20 USDC balance.
 */

import { ConnectKitButton } from 'connectkit'
import { useAccount, useReadContract } from 'wagmi'
import { erc20Abi, formatUnits, type Address } from 'viem'
import { getUsdc } from '../../onchain-facts'
import { TARGET_CHAIN_ID } from '../../config'
import { BRAND } from '../../../config/brand'

const usdcFact = getUsdc(TARGET_CHAIN_ID)
const USDC_ADDRESS = (usdcFact?.address ?? '0x3600000000000000000000000000000000000000') as Address
const USDC_DECIMALS = usdcFact?.decimals ?? 6

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

  const formatted = balanceRaw !== undefined
    ? parseFloat(formatUnits(balanceRaw, USDC_DECIMALS)).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : null

  return (
    <header className="flex items-center justify-between gap-3">
      <span
        className="display text-lg font-bold tracking-tight"
        style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
      >
        {BRAND.name}
      </span>

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
        <ConnectKitButton />
      </div>
    </header>
  )
}
