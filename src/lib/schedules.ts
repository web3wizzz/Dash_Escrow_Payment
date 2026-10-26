/**
 * schedules.ts — Schedule type constants, on-chain unlock math, Permit2 witness
 * helpers for ScheduledPayouts.deposit.
 *
 * The unlock math here MUST mirror _totalUnlocked() in ScheduledPayouts.sol exactly.
 * Run the Foundry tests to verify parity before changing either file.
 */

import { keccak256, encodePacked, encodeAbiParameters, parseAbiParameters, type Address, type Hex } from 'viem'
import { SCHEDULE_DEPOSIT_WITNESS_TYPEHASH } from '../../config/brand'

// ---------------------------------------------------------------------------
// Schedule types (mirrors ScheduleType enum in ScheduledPayouts.sol)
// ---------------------------------------------------------------------------

export const ScheduleType = {
  PayLater:  0,
  Allowance: 1,
  Vesting:   2,
  Payroll:   3,
  Streaming: 4,
} as const

export type ScheduleTypeValue = (typeof ScheduleType)[keyof typeof ScheduleType]

export const SCHEDULE_TYPE_LABELS: Record<ScheduleTypeValue, string> = {
  [ScheduleType.PayLater]:  'Pay Later',
  [ScheduleType.Allowance]: 'Allowance',
  [ScheduleType.Vesting]:   'Vesting',
  [ScheduleType.Payroll]:   'Payroll',
  [ScheduleType.Streaming]: 'Streaming',
}

export const SCHEDULE_TYPE_DESCRIPTIONS: Record<ScheduleTypeValue, string> = {
  [ScheduleType.PayLater]:  'Full amount unlocks at a future date.',
  [ScheduleType.Allowance]: 'Fixed amount unlocks every period (weekly, monthly…).',
  [ScheduleType.Vesting]:   'Linear unlock after a cliff, over a vesting window.',
  [ScheduleType.Payroll]:   'Recurring payroll to one or more recipients.',
  [ScheduleType.Streaming]: 'Continuous per-second unlock over a time window.',
}

// ---------------------------------------------------------------------------
// Schedule data shape (mirrors Schedule struct in ScheduledPayouts.sol)
// ---------------------------------------------------------------------------

export interface ScheduleData {
  sender: Address
  recipient: Address
  scheduleType: ScheduleTypeValue
  revocable: boolean
  cancelled: boolean
  totalAmount: bigint   // 6-decimal USDC
  claimed: bigint
  startTime: bigint     // unix seconds
  endTime: bigint
  cliffEnd: bigint      // 0 for non-vesting
  period: bigint        // 0 for non-allowance
  periodAmount: bigint  // 0 for non-allowance
}

// ---------------------------------------------------------------------------
// Unlock math — mirrors _totalUnlocked() in ScheduledPayouts.sol
// ---------------------------------------------------------------------------

/** Total amount unlocked from schedule inception to `nowSec` (does NOT subtract claimed). */
export function totalUnlocked(s: ScheduleData, nowSec: bigint): bigint {
  const t = s.scheduleType

  if (t === ScheduleType.PayLater) {
    return nowSec >= s.endTime ? s.totalAmount : 0n
  }

  if (t === ScheduleType.Allowance || t === ScheduleType.Payroll) {
    if (s.period === 0n) return 0n
    const elapsed = nowSec >= s.startTime ? nowSec - s.startTime : 0n
    const periods = elapsed / s.period
    const raw = periods * s.periodAmount
    return raw >= s.totalAmount ? s.totalAmount : raw
  }

  if (t === ScheduleType.Vesting) {
    if (nowSec < s.cliffEnd) return 0n
    const tClamped = nowSec < s.endTime ? nowSec : s.endTime
    const window = s.endTime - s.startTime
    if (window === 0n) return s.totalAmount
    return (s.totalAmount * (tClamped - s.startTime)) / window
  }

  if (t === ScheduleType.Streaming) {
    if (nowSec <= s.startTime) return 0n
    const tClamped = nowSec < s.endTime ? nowSec : s.endTime
    const window = s.endTime - s.startTime
    if (window === 0n) return s.totalAmount
    return (s.totalAmount * (tClamped - s.startTime)) / window
  }

  return 0n
}

/** Newly claimable amount (total unlocked minus already claimed). Returns 0 for cancelled. */
export function claimableNow(s: ScheduleData, nowSec: bigint): bigint {
  if (s.cancelled) return 0n
  const unlocked = totalUnlocked(s, nowSec)
  return unlocked > s.claimed ? unlocked - s.claimed : 0n
}

/** Streaming: USDC unlocking per second at `nowSec` (0 outside active window). */
export function streamingRatePerSec(s: ScheduleData): bigint {
  if (s.scheduleType !== ScheduleType.Streaming) return 0n
  const window = s.endTime - s.startTime
  if (window === 0n) return 0n
  return s.totalAmount / window  // integer division; display should show fractional
}

// ---------------------------------------------------------------------------
// scheduleId derivation — mirrors deposit() in ScheduledPayouts.sol
// ---------------------------------------------------------------------------

/** Compute scheduleId from sender, recipient, and their current depositNonce. */
export function computeScheduleId(sender: Address, recipient: Address, nonce: bigint): Hex {
  return keccak256(encodePacked(['address', 'address', 'uint256'], [sender, recipient, nonce]))
}

// ---------------------------------------------------------------------------
// Permit2 witness for deposit — mirrors witness computation in deposit()
// ---------------------------------------------------------------------------

export interface ScheduleWitnessParams {
  scheduleId: Hex
  recipient: Address
  scheduleType: ScheduleTypeValue
  revocable: boolean
  startTime: bigint
  endTime: bigint
  cliffEnd: bigint
  period: bigint
  periodAmount: bigint
  totalAmount: bigint
}

/** Compute the witness hash passed to Permit2.permitWitnessTransferFrom for deposit. */
export function computeScheduleWitness(params: ScheduleWitnessParams): Hex {
  const typeHash = keccak256(
    // keccak256 of the typehash string
    new TextEncoder().encode(SCHEDULE_DEPOSIT_WITNESS_TYPEHASH) as Uint8Array,
  )
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters(
        'bytes32,bytes32,address,uint8,bool,uint64,uint64,uint64,uint64,uint128,uint128',
      ),
      [
        typeHash,
        params.scheduleId,
        params.recipient,
        params.scheduleType,
        params.revocable,
        params.startTime,
        params.endTime,
        params.cliffEnd,
        params.period,
        params.periodAmount,
        params.totalAmount,
      ],
    ),
  )
}

// ---------------------------------------------------------------------------
// Human-readable formatters
// ---------------------------------------------------------------------------

/** Short description of a schedule shown in list cards. */
export function scheduleDescription(s: ScheduleData): string {
  const t = s.scheduleType
  if (t === ScheduleType.PayLater) {
    return `Unlocks ${new Date(Number(s.endTime) * 1000).toLocaleDateString()}`
  }
  if (t === ScheduleType.Allowance || t === ScheduleType.Payroll) {
    const periodDays = Number(s.period) / 86400
    const label = periodDays === 7 ? 'weekly' : periodDays === 30 ? 'monthly' : periodDays === 1 ? 'daily' : `every ${periodDays.toFixed(0)}d`
    return `${label} allowance`
  }
  if (t === ScheduleType.Vesting) {
    const cliffDate = new Date(Number(s.cliffEnd) * 1000).toLocaleDateString()
    return `Vesting · cliff ${cliffDate}`
  }
  if (t === ScheduleType.Streaming) {
    return `Streaming until ${new Date(Number(s.endTime) * 1000).toLocaleDateString()}`
  }
  return SCHEDULE_TYPE_LABELS[t] ?? 'Schedule'
}

/** Progress percentage 0–100 based on claimed / totalAmount. */
export function claimProgress(s: ScheduleData): number {
  if (s.totalAmount === 0n) return 0
  return Math.min(100, Number((s.claimed * 100n) / s.totalAmount))
}

/** True if the schedule is fully claimed and not cancelled. */
export function isComplete(s: ScheduleData): boolean {
  return !s.cancelled && s.claimed >= s.totalAmount
}
