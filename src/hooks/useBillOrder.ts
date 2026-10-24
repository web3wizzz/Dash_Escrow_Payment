/**
 * Hook for reading and tracking a bill order's status and reclaim countdown.
 */

import { useReadContract } from 'wagmi'
import { type Address, type Hex } from 'viem'
import { useEffect, useState } from 'react'
import { TARGET_CHAIN_ID } from '../config'
import { ORDER_TIMEOUT_SECONDS } from '../../config/brand'

const PAY_ROUTER_ADDRESS = (
  import.meta.env.VITE_PAY_ROUTER_ADDRESS ?? '0x0000000000000000000000000000000000000000'
) as Address

const ORDERS_ABI = [
  {
    name: 'orders',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'orderId', type: 'bytes32' }],
    outputs: [
      { name: 'payer', type: 'address' },
      { name: 'billerTreasury', type: 'address' },
      { name: 'amount', type: 'uint128' },
      { name: 'feeBps', type: 'uint128' },
      { name: 'createdAt', type: 'uint64' },
      { name: 'status', type: 'uint8' },
    ],
  },
] as const

export type OrderStatus = 'Pending' | 'Fulfilled' | 'Rejected' | 'Reclaimed' | 'Unknown'

const STATUS_MAP: Record<number, OrderStatus> = {
  0: 'Pending',
  1: 'Fulfilled',
  2: 'Rejected',
  3: 'Reclaimed',
}

export interface BillOrderData {
  payer: Address
  billerTreasury: Address
  amount: bigint
  feeBps: bigint
  createdAt: bigint
  status: OrderStatus
  /** Seconds remaining before payer can reclaim. 0 when reclaimable. */
  secondsUntilReclaim: number
  /** Whether the 30-minute window has passed and reclaimOrder can be called. */
  canReclaim: boolean
}

export function useBillOrder(orderId: Hex | undefined): {
  data: BillOrderData | undefined
  isLoading: boolean
  isError: boolean
  refetch: () => void
} {
  const { data, isLoading, isError, refetch } = useReadContract({
    address: PAY_ROUTER_ADDRESS,
    abi: ORDERS_ABI,
    functionName: 'orders',
    args: orderId ? [orderId] : undefined,
    query: {
      enabled: !!orderId,
      refetchInterval: 10_000,
    },
    chainId: TARGET_CHAIN_ID,
  })

  // Countdown ticker — initialized lazily to avoid impure call during render
  const [now, setNow] = useState<number>(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = setInterval(() => {
      setNow(() => Math.floor(Date.now() / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // Wrap refetch so the return type is void
  const refetchVoid = () => { void refetch() }

  if (!data) return { data: undefined, isLoading, isError, refetch: refetchVoid }

  const [payer, billerTreasury, amount, feeBps, createdAt, statusRaw] =
    data as [Address, Address, bigint, bigint, bigint, number]
  const status = STATUS_MAP[statusRaw] ?? 'Unknown'
  const reclaimAt = Number(createdAt) + ORDER_TIMEOUT_SECONDS
  const secondsUntilReclaim = status === 'Pending' ? Math.max(0, reclaimAt - now) : 0

  return {
    data: {
      payer,
      billerTreasury,
      amount,
      feeBps,
      createdAt,
      status,
      secondsUntilReclaim,
      canReclaim: status === 'Pending' && secondsUntilReclaim === 0,
    },
    isLoading,
    isError,
    refetch: refetchVoid,
  }
}
