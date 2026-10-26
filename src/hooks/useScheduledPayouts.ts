/**
 * Hooks for ScheduledPayouts.sol
 * Covers: deposit, claim, cancel, withdraw, read single schedule, enumerate by sender/recipient.
 */

import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  usePublicClient,
  useAccount,
} from 'wagmi'
import { type Address, type Hex } from 'viem'
import { TARGET_CHAIN_ID } from '../config'
import { generateNonce, permit2Domain } from '../lib/permit2'
import { SCHEDULE_DEPOSIT_WITNESS_TYPEHASH, USDC_ADDRESS } from '../../config/brand'
import { type ScheduleData, type ScheduleTypeValue, type ScheduleWitnessParams, computeScheduleId } from '../lib/schedules'

const SCHEDULED_PAYOUTS_ADDRESS = (
  import.meta.env.VITE_SCHEDULED_PAYOUTS_ADDRESS ?? '0x0000000000000000000000000000000000000000'
) as Address

// ---------------------------------------------------------------------------
// Minimal ABI — only functions used by the frontend
// ---------------------------------------------------------------------------

const SCHEDULED_PAYOUTS_ABI = [
  // deposit — canonical PermitTransferFrom (no witness field in struct; contract handles witness separately)
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'permit',
        type: 'tuple',
        components: [
          { name: 'permitted', type: 'tuple', components: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' }] },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      { name: 'sig', type: 'bytes' },
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'recipient', type: 'address' },
          { name: 'scheduleType', type: 'uint8' },
          { name: 'revocable', type: 'bool' },
          { name: 'totalAmount', type: 'uint128' },
          { name: 'startTime', type: 'uint64' },
          { name: 'endTime', type: 'uint64' },
          { name: 'cliffEnd', type: 'uint64' },
          { name: 'period', type: 'uint64' },
          { name: 'periodAmount', type: 'uint128' },
        ],
      },
    ],
    outputs: [{ name: 'scheduleId', type: 'bytes32' }],
  },
  // claim
  {
    name: 'claim',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'scheduleId', type: 'bytes32' }],
    outputs: [],
  },
  // cancel
  {
    name: 'cancel',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'scheduleId', type: 'bytes32' }],
    outputs: [],
  },
  // withdraw
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  // schedules(bytes32)
  {
    name: 'schedules',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'scheduleId', type: 'bytes32' }],
    outputs: [
      { name: 'sender', type: 'address' },
      { name: 'recipient', type: 'address' },
      { name: 'scheduleType', type: 'uint8' },
      { name: 'revocable', type: 'bool' },
      { name: 'cancelled', type: 'bool' },
      { name: 'totalAmount', type: 'uint128' },
      { name: 'claimed', type: 'uint128' },
      { name: 'startTime', type: 'uint64' },
      { name: 'endTime', type: 'uint64' },
      { name: 'cliffEnd', type: 'uint64' },
      { name: 'period', type: 'uint64' },
      { name: 'periodAmount', type: 'uint128' },
    ],
  },
  // claimableNow(bytes32)
  {
    name: 'claimableNow',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'scheduleId', type: 'bytes32' }],
    outputs: [{ name: 'amount', type: 'uint128' }],
  },
  // nextDepositNonce(address)
  {
    name: 'nextDepositNonce',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'sender', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // pendingWithdrawals(address)
  {
    name: 'pendingWithdrawals',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint128' }],
  },
  // Events for enumeration
  {
    name: 'ScheduleCreated',
    type: 'event',
    inputs: [
      { name: 'scheduleId', type: 'bytes32', indexed: true },
      { name: 'sender', type: 'address', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'scheduleType', type: 'uint8', indexed: false },
      { name: 'totalAmount', type: 'uint128', indexed: false },
    ],
  },
] as const

// ---------------------------------------------------------------------------
// Permit2 typed-data for deposit (witness variant)
// ---------------------------------------------------------------------------

const SCHEDULE_WITNESS_TYPE_STRING = SCHEDULE_DEPOSIT_WITNESS_TYPEHASH

/** EIP-712 types for permitWitnessTransferFrom with ScheduleWitness */
function schedulePermitTypes(_witnessTypeString: string) {
  return {
    PermitWitnessTransferFrom: [
      { name: 'permitted', type: 'TokenPermissions' },
      { name: 'spender', type: 'address' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'witness', type: 'ScheduleWitness' },
    ],
    TokenPermissions: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    ScheduleWitness: [
      { name: 'scheduleId', type: 'bytes32' },
      { name: 'recipient', type: 'address' },
      { name: 'scheduleType', type: 'uint8' },
      { name: 'revocable', type: 'bool' },
      { name: 'startTime', type: 'uint64' },
      { name: 'endTime', type: 'uint64' },
      { name: 'cliffEnd', type: 'uint64' },
      { name: 'period', type: 'uint64' },
      { name: 'periodAmount', type: 'uint128' },
      { name: 'totalAmount', type: 'uint128' },
    ],
  } as const
}

// ---------------------------------------------------------------------------
// useDeposit
// ---------------------------------------------------------------------------

export interface DepositParams {
  recipient: Address
  scheduleType: ScheduleTypeValue
  revocable: boolean
  totalAmount: bigint
  startTime: bigint
  endTime: bigint
  cliffEnd: bigint
  period: bigint
  periodAmount: bigint
  signTypedDataAsync: (args: object) => Promise<Hex>
}

export function useDeposit() {
  const { address } = useAccount()
  const publicClient = usePublicClient({ chainId: TARGET_CHAIN_ID })
  const { writeContractAsync, data: hash, isPending, isError, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const deposit = async (p: DepositParams) => {
    if (!address || !publicClient) throw new Error('Wallet not connected')

    // 1. Read nonce from contract
    const nonce = await publicClient.readContract({
      address: SCHEDULED_PAYOUTS_ADDRESS,
      abi: SCHEDULED_PAYOUTS_ABI,
      functionName: 'nextDepositNonce',
      args: [address],
    })

    // 2. Compute deterministic scheduleId
    const scheduleId = computeScheduleId(address, p.recipient, nonce)

    // 3. Build Permit2 witness fields
    const permit2Nonce = generateNonce()
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600) // 1 hour

    // 4. Sign the permit2 witness typed data
    const domain = permit2Domain(TARGET_CHAIN_ID)
    const types = schedulePermitTypes(SCHEDULE_WITNESS_TYPE_STRING)

    const signature = await p.signTypedDataAsync({
      domain,
      types,
      primaryType: 'PermitWitnessTransferFrom',
      message: {
        permitted: { token: USDC_ADDRESS, amount: p.totalAmount },
        spender: SCHEDULED_PAYOUTS_ADDRESS,
        nonce: permit2Nonce,
        deadline,
        witness: {
          scheduleId,
          recipient: p.recipient,
          scheduleType: p.scheduleType,
          revocable: p.revocable,
          startTime: p.startTime,
          endTime: p.endTime,
          cliffEnd: p.cliffEnd,
          period: p.period,
          periodAmount: p.periodAmount,
          totalAmount: p.totalAmount,
        },
      },
    })

    // 5. Submit deposit transaction — plain PermitTransferFrom (no witness field).
    //    The contract computes the witness hash from params and passes it to Permit2 separately.
    await writeContractAsync({
      address: SCHEDULED_PAYOUTS_ADDRESS,
      abi: SCHEDULED_PAYOUTS_ABI,
      functionName: 'deposit',
      args: [
        {
          permitted: { token: USDC_ADDRESS, amount: p.totalAmount },
          nonce: permit2Nonce,
          deadline,
        },
        signature,
        {
          recipient: p.recipient,
          scheduleType: p.scheduleType,
          revocable: p.revocable,
          totalAmount: p.totalAmount,
          startTime: p.startTime,
          endTime: p.endTime,
          cliffEnd: p.cliffEnd,
          period: p.period,
          periodAmount: p.periodAmount,
        },
      ],
      chainId: TARGET_CHAIN_ID,
    })

    return scheduleId
  }

  return { deposit, hash, isPending, isConfirming, isSuccess, isError, error, reset }
}

// ---------------------------------------------------------------------------
// useClaim
// ---------------------------------------------------------------------------

export function useClaim() {
  const { writeContract, data: hash, isPending, isError, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const claim = (scheduleId: Hex) => {
    writeContract({
      address: SCHEDULED_PAYOUTS_ADDRESS,
      abi: SCHEDULED_PAYOUTS_ABI,
      functionName: 'claim',
      args: [scheduleId],
      chainId: TARGET_CHAIN_ID,
    })
  }

  return { claim, hash, isPending, isConfirming, isSuccess, isError, error, reset }
}

// ---------------------------------------------------------------------------
// useCancel
// ---------------------------------------------------------------------------

export function useCancel() {
  const { writeContract, data: hash, isPending, isError, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const cancel = (scheduleId: Hex) => {
    writeContract({
      address: SCHEDULED_PAYOUTS_ADDRESS,
      abi: SCHEDULED_PAYOUTS_ABI,
      functionName: 'cancel',
      args: [scheduleId],
      chainId: TARGET_CHAIN_ID,
    })
  }

  return { cancel, hash, isPending, isConfirming, isSuccess, isError, error, reset }
}

// ---------------------------------------------------------------------------
// useWithdraw (pull pending balance after blocked transfer)
// ---------------------------------------------------------------------------

export function useWithdraw() {
  const { writeContract, data: hash, isPending, isError, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const withdraw = () => {
    writeContract({
      address: SCHEDULED_PAYOUTS_ADDRESS,
      abi: SCHEDULED_PAYOUTS_ABI,
      functionName: 'withdraw',
      chainId: TARGET_CHAIN_ID,
    })
  }

  return { withdraw, hash, isPending, isConfirming, isSuccess, isError, error, reset }
}

// ---------------------------------------------------------------------------
// useSchedule — read a single schedule by ID
// ---------------------------------------------------------------------------

export function useSchedule(scheduleId: Hex | undefined) {
  const { data, isLoading, isError, refetch } = useReadContract({
    address: SCHEDULED_PAYOUTS_ADDRESS,
    abi: SCHEDULED_PAYOUTS_ABI,
    functionName: 'schedules',
    args: scheduleId ? [scheduleId] : undefined,
    query: { enabled: !!scheduleId, refetchInterval: 10_000 },
    chainId: TARGET_CHAIN_ID,
  })

  const { data: claimable } = useReadContract({
    address: SCHEDULED_PAYOUTS_ADDRESS,
    abi: SCHEDULED_PAYOUTS_ABI,
    functionName: 'claimableNow',
    args: scheduleId ? [scheduleId] : undefined,
    query: { enabled: !!scheduleId, refetchInterval: 5_000 },
    chainId: TARGET_CHAIN_ID,
  })

  let schedule: ScheduleData | undefined
  if (data) {
    const [sender, recipient, scheduleType, revocable, cancelled,
      totalAmount, claimed, startTime, endTime, cliffEnd, period, periodAmount] =
      data as [Address, Address, number, boolean, boolean, bigint, bigint, bigint, bigint, bigint, bigint, bigint]
    schedule = {
      sender,
      recipient,
      scheduleType: scheduleType as ScheduleTypeValue,
      revocable,
      cancelled,
      totalAmount,
      claimed,
      startTime,
      endTime,
      cliffEnd,
      period,
      periodAmount,
    }
  }

  return {
    schedule,
    claimable: (claimable ?? 0n),
    isLoading,
    isError,
    refetch: () => { void refetch() },
  }
}

// ---------------------------------------------------------------------------
// useMySchedules — enumerate sent + received schedules from on-chain events
// ---------------------------------------------------------------------------

export function useMySchedules() {
  const { address } = useAccount()
  const publicClient = usePublicClient({ chainId: TARGET_CHAIN_ID })
  const [sentIds, setSentIds] = useState<Hex[]>([])
  const [receivedIds, setReceivedIds] = useState<Hex[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)

  useEffect(() => {
    if (!address || !publicClient) return
    let cancelled = false
    const run = async () => {
      setIsLoading(true)
      setIsError(false)
      try {
        // Fetch logs from a bounded recent window (last 50,000 blocks)
        const head = await publicClient.getBlockNumber()
        const fromBlock = head > 50_000n ? head - 50_000n : 0n

        const [sentLogs, receivedLogs] = await Promise.all([
          publicClient.getContractEvents({
            address: SCHEDULED_PAYOUTS_ADDRESS,
            abi: SCHEDULED_PAYOUTS_ABI,
            eventName: 'ScheduleCreated',
            args: { sender: address },
            fromBlock,
          }),
          publicClient.getContractEvents({
            address: SCHEDULED_PAYOUTS_ADDRESS,
            abi: SCHEDULED_PAYOUTS_ABI,
            eventName: 'ScheduleCreated',
            args: { recipient: address },
            fromBlock,
          }),
        ])

        if (cancelled) return
        setSentIds(sentLogs.map(l => (l.args as { scheduleId: Hex }).scheduleId))
        setReceivedIds(receivedLogs.map(l => (l.args as { scheduleId: Hex }).scheduleId))
      } catch {
        if (!cancelled) setIsError(true)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [address, publicClient])

  return { sentIds, receivedIds, isLoading, isError }
}

// React imports needed by useMySchedules
import { useState, useEffect } from 'react'

// Re-export address so pages can reference it
export { SCHEDULED_PAYOUTS_ADDRESS }
// Re-export unused import to satisfy TS (computeScheduleId already used above)
export type { ScheduleWitnessParams }
