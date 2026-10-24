/**
 * Salted hash utilities for bill account details.
 *
 * No PII is ever sent on-chain. Bill account details (meter numbers, phone numbers, etc.)
 * stay in the backend only. The chain stores only a salted hash of the account reference.
 *
 * The salt is derived per-wallet so the same account number hashes differently
 * for different payers, preventing correlation attacks.
 */

import { keccak256, encodePacked, type Address, type Hex } from 'viem'

/**
 * Computes a salted hash of a bill account reference.
 *
 * @param accountDetail - The raw account detail (e.g. meter number, phone number). Never sent on-chain.
 * @param payer - The payer wallet address. Used as part of the salt to prevent cross-payer correlation.
 * @param billerId - The biller address. Scopes the hash to a specific biller.
 * @returns A bytes32 hex string suitable for passing to createOrder as accountHash.
 */
export function hashAccountDetail(
  accountDetail: string,
  payer: Address,
  billerId: Address,
): Hex {
  // Salt = keccak256(payer ++ billerId ++ "dash.accounthash.v1")
  // Using a domain string prevents hash collisions with other app-level hashes
  const salt = keccak256(
    encodePacked(
      ['address', 'address', 'string'],
      [payer, billerId, 'dash.accounthash.v1'],
    ),
  )
  return keccak256(
    encodePacked(
      ['bytes32', 'string'],
      [salt, accountDetail],
    ),
  )
}

/**
 * Computes an opaque reference hash for a bill order.
 * Used as the `ref` field in createOrder — gives the backend a stable per-order reference
 * without putting any order metadata on-chain.
 *
 * @param payer - The payer wallet address.
 * @param billerId - The biller address.
 * @param accountHash - The already-hashed account detail.
 * @param nonce - A random or sequential nonce to make refs unique across orders.
 */
export function hashOrderRef(
  payer: Address,
  billerId: Address,
  accountHash: Hex,
  nonce: bigint,
): Hex {
  return keccak256(
    encodePacked(
      ['address', 'address', 'bytes32', 'uint256'],
      [payer, billerId, accountHash, nonce],
    ),
  )
}
