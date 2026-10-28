/**
 * Tier limit constants — mirrors PayRouter.sol constructor values.
 * Keep in sync with config/brand.ts TIER_LIMITS and GLOBAL_PER_PAYMENT_CAP.
 */

import { formatUnits } from 'viem'
import { TIER_LIMITS, GLOBAL_PER_PAYMENT_CAP } from '../../config/brand'

export type Tier = 0 | 1 | 2

export interface TierInfo {
  tier: Tier
  label: string
  /** Human-readable description shown in the UI (Sandbox label for tier 0/1) */
  description: string
  perPaymentCap: bigint
  dailyCap: bigint | null // null = unlimited
  perPaymentFormatted: string
  dailyFormatted: string
  /** Whether bill orders are allowed at this tier (tier >= minBillTier = 1) */
  canUseBills: boolean
}

/**
 * Tier info is kept for optional display in Profile (verification status)
 * and for forward-compatibility with governance-controlled tier limits.
 *
 * At launch, identity verification is NOT required for any payment flow:
 * send, request, escrow, and scheduled payouts are all permissionless.
 * The only enforced limit is the global per-payment cap (25 USDC).
 */
export const TIER_INFO: Record<Tier, TierInfo> = {
  0: {
    tier: 0,
    label: 'Standard',
    description: 'No identity verification required. Full access to all payment features.',
    perPaymentCap: TIER_LIMITS[0].perPayment,
    dailyCap: TIER_LIMITS[0].daily,
    perPaymentFormatted: formatUsdc(TIER_LIMITS[0].perPayment),
    dailyFormatted: formatUsdc(TIER_LIMITS[0].daily),
    canUseBills: true, // permissionless — escrow open to all wallets
  },
  1: {
    tier: 1,
    label: 'Verified',
    description: 'Optional identity verification. Higher limits available via governance.',
    perPaymentCap: TIER_LIMITS[1].perPayment,
    dailyCap: TIER_LIMITS[1].daily,
    perPaymentFormatted: formatUsdc(TIER_LIMITS[1].perPayment),
    dailyFormatted: formatUsdc(TIER_LIMITS[1].daily),
    canUseBills: true,
  },
  2: {
    tier: 2,
    label: 'Enhanced',
    description: 'Optional enhanced verification. Reserved for future regulated services.',
    perPaymentCap: TIER_LIMITS[2].perPayment,
    dailyCap: null, // unlimited
    perPaymentFormatted: formatUsdc(TIER_LIMITS[2].perPayment),
    dailyFormatted: 'Unlimited',
    canUseBills: true,
  },
}

export const GLOBAL_CAP_FORMATTED = formatUsdc(GLOBAL_PER_PAYMENT_CAP)

/** Returns the effective per-payment cap for a given tier, respecting the global cap. */
export function effectivePerPaymentCap(tier: Tier): bigint {
  const tierCap = TIER_LIMITS[tier].perPayment
  return tierCap < GLOBAL_PER_PAYMENT_CAP ? tierCap : GLOBAL_PER_PAYMENT_CAP
}

/** Format 6-decimal USDC bigint to a human-readable string like "5.00". */
function formatUsdc(amount: bigint): string {
  return formatUnits(amount, 6)
}

/** Returns true if a given amount (6-decimal bigint) is within tier + global limits. */
export function isWithinLimits(amount: bigint, tier: Tier): boolean {
  if (amount > GLOBAL_PER_PAYMENT_CAP) return false
  if (amount > TIER_LIMITS[tier].perPayment) return false
  return true
}

/**
 * Returns a human-readable reason why an amount fails the global payment cap,
 * or null if it passes.
 *
 * Tier parameter is accepted for forward-compatibility but is not used for
 * enforcement at launch — the global per-payment cap is the only active limit.
 */
export function limitViolation(amount: bigint, _tier: Tier): string | null {
  if (amount > GLOBAL_PER_PAYMENT_CAP) {
    return `Exceeds the maximum payment of ${GLOBAL_CAP_FORMATTED} USDC`
  }
  return null
}
