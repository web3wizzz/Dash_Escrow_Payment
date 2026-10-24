/**
 * Hook for reading KYC tier data from KycRegistry.sol
 *
 * Uses `effectiveTier` (which accounts for expiry on-chain) as the source of truth,
 * and `getTier` for the raw expiry timestamp shown in the UI.
 */

import { useReadContract, useAccount } from 'wagmi'
import { type Address } from 'viem'
import { TARGET_CHAIN_ID } from '../config'
import { type Tier, TIER_INFO } from '../lib/tiers'

const KYC_REGISTRY_ABI = [
  {
    name: 'getTier',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [
      { name: 'tier', type: 'uint8' },
      { name: 'expiry', type: 'uint64' },
    ],
  },
  {
    name: 'effectiveTier',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const

const KYC_REGISTRY_ADDRESS = (
  import.meta.env.VITE_KYC_REGISTRY_ADDRESS ?? '0x0000000000000000000000000000000000000000'
) as Address

export interface KycTierData {
  tier: Tier
  expiry: bigint
  isExpired: boolean
  info: typeof TIER_INFO[Tier]
}

/** Returns the KYC tier for a given wallet address. */
export function useKycTier(wallet: Address | undefined): {
  data: KycTierData | undefined
  isLoading: boolean
  isError: boolean
  refetch: () => void
} {
  // effectiveTier handles expiry on-chain — no client-side Date.now() needed
  const { data: effectiveTierRaw, isLoading: loadingEff, isError: errEff, refetch: refetchEff } =
    useReadContract({
      address: KYC_REGISTRY_ADDRESS,
      abi: KYC_REGISTRY_ABI,
      functionName: 'effectiveTier',
      args: wallet ? [wallet] : undefined,
      query: { enabled: !!wallet },
      chainId: TARGET_CHAIN_ID,
    })

  // Raw tier + expiry for UI display
  const { data: rawData } = useReadContract({
    address: KYC_REGISTRY_ADDRESS,
    abi: KYC_REGISTRY_ABI,
    functionName: 'getTier',
    args: wallet ? [wallet] : undefined,
    query: { enabled: !!wallet },
    chainId: TARGET_CHAIN_ID,
  })

  const refetchVoid = () => { void refetchEff() }

  if (effectiveTierRaw === undefined) {
    return { data: undefined, isLoading: loadingEff, isError: errEff, refetch: refetchVoid }
  }

  const tier = (effectiveTierRaw) as Tier
  const [, expiry] = (rawData as [number, bigint] | undefined) ?? [0, 0n]
  const tierRaw = (rawData as [number, bigint] | undefined)?.[0] ?? tier
  const isExpired = tierRaw !== tier // effective < stored → expiry has passed

  return {
    data: { tier, expiry: expiry ?? 0n, isExpired, info: TIER_INFO[tier] },
    isLoading: loadingEff,
    isError: errEff,
    refetch: refetchVoid,
  }
}

/** Returns the connected wallet's KYC tier. */
export function useMyKycTier() {
  const { address } = useAccount()
  return useKycTier(address)
}
