/**
 * Hook for interacting with HandleRegistry.sol
 * Provides: claim, release, resolve handle ↔ address lookups.
 */

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi'
import { type Address } from 'viem'
import { TARGET_CHAIN_ID } from '../config'

// ---------------------------------------------------------------------------
// Placeholder ABI — replace with artifact import once contracts are deployed.
// Only the functions used by the frontend are listed here.
// ---------------------------------------------------------------------------
const HANDLE_REGISTRY_ABI = [
  {
    name: 'claimHandle',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'handle', type: 'string' }],
    outputs: [],
  },
  {
    name: 'releaseHandle',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'resolveHandle',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'handle', type: 'string' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'handleOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'isReserved',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'handle', type: 'string' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

// Address set from env after deploy — see AGENTS.md
const HANDLE_REGISTRY_ADDRESS = (
  import.meta.env.VITE_HANDLE_REGISTRY_ADDRESS ?? '0x0000000000000000000000000000000000000000'
) as Address

// ---------------------------------------------------------------------------
// Lookup: handle → address
// ---------------------------------------------------------------------------

export function useResolveHandle(handle: string | undefined) {
  return useReadContract({
    address: HANDLE_REGISTRY_ADDRESS,
    abi: HANDLE_REGISTRY_ABI,
    functionName: 'resolveHandle',
    args: handle ? [handle] : undefined,
    query: { enabled: !!handle && handle.length >= 3 },
    chainId: TARGET_CHAIN_ID,
  })
}

// ---------------------------------------------------------------------------
// Lookup: address → handle
// ---------------------------------------------------------------------------

export function useHandleOf(wallet: Address | undefined) {
  return useReadContract({
    address: HANDLE_REGISTRY_ADDRESS,
    abi: HANDLE_REGISTRY_ABI,
    functionName: 'handleOf',
    args: wallet ? [wallet] : undefined,
    query: { enabled: !!wallet },
    chainId: TARGET_CHAIN_ID,
  })
}

// ---------------------------------------------------------------------------
// Connected wallet's own handle
// ---------------------------------------------------------------------------

export function useMyHandle() {
  const { address } = useAccount()
  return useHandleOf(address)
}

// ---------------------------------------------------------------------------
// Claim handle
// ---------------------------------------------------------------------------

export function useClaimHandle() {
  const {
    writeContract,
    data: hash,
    isPending,
    isError,
    error,
    reset,
  } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const claim = (handle: string) => {
    writeContract({
      address: HANDLE_REGISTRY_ADDRESS,
      abi: HANDLE_REGISTRY_ABI,
      functionName: 'claimHandle',
      args: [handle],
      chainId: TARGET_CHAIN_ID,
    })
  }

  return { claim, hash, isPending, isConfirming, isSuccess, isError, error, reset }
}

// ---------------------------------------------------------------------------
// Release handle
// ---------------------------------------------------------------------------

export function useReleaseHandle() {
  const {
    writeContract,
    data: hash,
    isPending,
    isError,
    error,
    reset,
  } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const release = () => {
    writeContract({
      address: HANDLE_REGISTRY_ADDRESS,
      abi: HANDLE_REGISTRY_ABI,
      functionName: 'releaseHandle',
      chainId: TARGET_CHAIN_ID,
    })
  }

  return { release, hash, isPending, isConfirming, isSuccess, isError, error, reset }
}
