/**
 * Webhook event schema and relay service design notes.
 *
 * PHASE 1 (current): On-chain events only. Merchants index PayRouter events directly.
 * PHASE 2 (roadmap): An off-chain relay server listens to events and POSTs to merchant URLs.
 *
 * This file defines the canonical event shape for both phases so the backend schema
 * is stable and matches what the contract emits.
 */

// ---------------------------------------------------------------------------
// On-chain event types (matches PayRouter.sol events)
// ---------------------------------------------------------------------------

export type PaymentEventType =
  | 'Sent'
  | 'SentToHandle'
  | 'RequestPaid'
  | 'OrderCreated'
  | 'OrderFulfilled'
  | 'OrderRejected'
  | 'OrderReclaimed'

export interface SentEvent {
  type: 'Sent'
  from: string
  to: string
  amount: string // 6-decimal USDC, as a decimal string
  blockNumber: bigint
  txHash: string
}

export interface SentToHandleEvent {
  type: 'SentToHandle'
  from: string
  to: string
  handle: string
  amount: string
  blockNumber: bigint
  txHash: string
}

export interface RequestPaidEvent {
  type: 'RequestPaid'
  payer: string
  recipient: string
  requestId: string // bytes32 hex
  amount: string
  blockNumber: bigint
  txHash: string
}

export interface OrderCreatedEvent {
  type: 'OrderCreated'
  orderId: string // bytes32 hex
  payer: string
  billerId: string
  accountHash: string // bytes32 hex — no PII
  ref: string // bytes32 hex — no PII
  amount: string
  blockNumber: bigint
  txHash: string
}

export interface OrderFulfilledEvent {
  type: 'OrderFulfilled'
  orderId: string
  billerTreasury: string
  net: string
  fee: string
  blockNumber: bigint
  txHash: string
}

export interface OrderRejectedEvent {
  type: 'OrderRejected'
  orderId: string
  payer: string
  amount: string
  blockNumber: bigint
  txHash: string
}

export interface OrderReclaimedEvent {
  type: 'OrderReclaimed'
  orderId: string
  payer: string
  amount: string
  blockNumber: bigint
  txHash: string
}

export type PaymentEvent =
  | SentEvent
  | SentToHandleEvent
  | RequestPaidEvent
  | OrderCreatedEvent
  | OrderFulfilledEvent
  | OrderRejectedEvent
  | OrderReclaimedEvent

// ---------------------------------------------------------------------------
// Phase 2 relay service design notes (not yet implemented)
// ---------------------------------------------------------------------------

/**
 * PHASE 2 RELAY SERVICE DESIGN
 *
 * The relay server:
 * 1. Connects to the Arc RPC and subscribes to PayRouter events via eth_getLogs (polling).
 * 2. Maintains a cursor (last-processed block number) in a persistent store.
 * 3. For each event, constructs a webhook payload (shape: PaymentEvent above).
 * 4. POSTs to merchant-registered webhook URLs with an HMAC-SHA256 signature header.
 * 5. Retries with exponential backoff on failure.
 *
 * Webhook request shape:
 *   POST <merchantWebhookUrl>
 *   Headers:
 *     Content-Type: application/json
 *     X-Signature: sha256=<hmac-hex>   // HMAC of raw body with merchant's secret key
 *     X-Timestamp: <unix-ms>
 *   Body: PaymentEvent (JSON)
 *
 * Security:
 * - Merchant secret keys are stored encrypted server-side; never logged.
 * - Replay protection: merchant should reject events with X-Timestamp > 5 min old.
 * - Idempotency: include txHash + logIndex as deduplication key.
 *
 * API responses label verification as "Sandbox" until the relay service is in production.
 */
