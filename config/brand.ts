/**
 * Brand configuration — the ONLY place the product name appears.
 * Never import this into contract source, events, or file names.
 * All contract and event names use neutral identifiers (HandleRegistry, KycRegistry, PayRouter).
 */

export const BRAND = {
  name: 'Dash',
  tagline: 'Send and receive USDC instantly',
  networkName: 'Arc',
  domain: 'dash.app',
  /** URI scheme for deep links: dash://pay?to=alice&amount=5 */
  uriScheme: 'dash',
  twitter: '@dash_app',
  github: 'dash-app',
} as const;

// ---------------------------------------------------------------------------
// On-chain constants (mirrors contract constructor args — keep in sync)
// ---------------------------------------------------------------------------

/** Canonical Permit2 address — same on all EVM chains */
export const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3' as const;

/** USDC ERC-20 on Arc (mainnet and testnet share this address) */
export const USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as const;

// Tier limits in 6-decimal USDC units
export const TIER_LIMITS = {
  0: { perPayment: 5_000_000n,          daily: 50_000_000n },
  1: { perPayment: 100_000_000n,        daily: 20_000_000_000n },    // 20,000 USDC/day
  2: { perPayment: 20_000_000_000n,     daily: 0n }, // 20,000 USDC/payment, unlimited (0 = no cap, matches contract)
} as const;

/** Global ceiling applied on top of tier limits: 25 USDC */
export const GLOBAL_PER_PAYMENT_CAP = 25_000_000n;

/**
 * Minimum KYC tier required to create an escrow order.
 * Set to 0 (permissionless) at launch — any wallet may create an order.
 * Can be raised via the 24-hour admin timelock without a contract redeployment.
 */
export const MIN_BILL_TIER = 0;

/** Seconds before a payer can reclaim an unfulfilled bill order */
export const ORDER_TIMEOUT_SECONDS = 1800; // 30 minutes

/** Default fee on fulfilled bill orders in basis points (0 = no fee at launch) */
export const DEFAULT_FEE_BPS = 0;

/** Maximum platform fee enforced in contract code */
export const MAX_FEE_BPS = 200;

// ---------------------------------------------------------------------------
// ScheduledPayouts constants (mirrors ScheduledPayouts.sol — keep in sync)
// ---------------------------------------------------------------------------

/**
 * Witness typehash for ScheduledPayouts.deposit.
 * Mirrors SCHEDULE_WITNESS_TYPEHASH in ScheduledPayouts.sol exactly.
 * Used by the frontend to compute the witness before signing.
 */
export const SCHEDULE_DEPOSIT_WITNESS_TYPEHASH =
  'ScheduleWitness(bytes32 scheduleId,address recipient,uint8 scheduleType,bool revocable,uint64 startTime,uint64 endTime,uint64 cliffEnd,uint64 period,uint128 periodAmount,uint128 totalAmount)' as const;
