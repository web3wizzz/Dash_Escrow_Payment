/**
 * Permit2 SignatureTransfer helpers for Dash payment flows.
 *
 * All payment actions use Permit2 SignatureTransfer (exact amount, single-use nonce, deadline).
 * The one-time USDC.approve(Permit2, max) is documented in AUDIT.md as a known exception.
 *
 * Witness variant is used for createOrder only — the signature also covers billerId, accountHash, ref.
 */

import { type PublicClient, type Address, type Hex, encodeAbiParameters, keccak256, encodePacked, parseAbiParameters } from 'viem'
import { PERMIT2_ADDRESS as PERMIT2_ADDR, USDC_ADDRESS } from '../../config/brand'

/** Re-export so callers can import PERMIT2_ADDRESS from this module. */
export const PERMIT2_ADDRESS: Address = PERMIT2_ADDR

// ---------------------------------------------------------------------------
// Types mirroring the Solidity structs in PayRouter.sol
// ---------------------------------------------------------------------------

export interface TokenPermissions {
  token: Address
  amount: bigint
}

export interface PermitTransferFrom {
  permitted: TokenPermissions
  nonce: bigint
  deadline: bigint
}

export interface PermitWitnessTransferFrom {
  permitted: TokenPermissions
  nonce: bigint
  deadline: bigint
  witness: Hex
}

export interface SignatureTransferDetails {
  to: Address
  requestedAmount: bigint
}

// ---------------------------------------------------------------------------
// Bill order witness type
// ---------------------------------------------------------------------------

/** Matches BILL_ORDER_WITNESS_TYPEHASH in PayRouter.sol */
export const BILL_ORDER_WITNESS_TYPE_STRING =
  'BillOrderWitness(bytes32 orderId,address billerId,bytes32 accountHash,bytes32 ref)'

export const BILL_ORDER_WITNESS_TYPEHASH = keccak256(
  encodePacked(['string'], [BILL_ORDER_WITNESS_TYPE_STRING]),
)

export function computeBillOrderWitness(
  orderId: Hex,
  billerId: Address,
  accountHash: Hex,
  ref: Hex,
): Hex {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters('bytes32, bytes32, address, bytes32, bytes32'),
      [BILL_ORDER_WITNESS_TYPEHASH, orderId, billerId, accountHash, ref],
    ),
  )
}

// ---------------------------------------------------------------------------
// Nonce generation (random, single-use)
// ---------------------------------------------------------------------------

/** Generates a random 256-bit nonce. Permit2 nonces are application-managed. */
export function generateNonce(): bigint {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return BigInt('0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(''))
}

/** Returns a deadline N seconds from now (default 20 minutes). */
export function makeDeadline(offsetSeconds = 1200): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + offsetSeconds)
}

// ---------------------------------------------------------------------------
// EIP-712 domain for Permit2
// ---------------------------------------------------------------------------

/** Permit2 domain — Permit2 uses a chain-specific domain with no name/version. */
export function permit2Domain(chainId: number) {
  return {
    name: 'Permit2',
    chainId,
    verifyingContract: PERMIT2_ADDRESS,
  } as const
}

// ---------------------------------------------------------------------------
// Typed data structures for viem signTypedData
// ---------------------------------------------------------------------------

const TOKEN_PERMISSIONS_TYPE = {
  TokenPermissions: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
} as const

export const PERMIT_TRANSFER_FROM_TYPES = {
  ...TOKEN_PERMISSIONS_TYPE,
  PermitTransferFrom: [
    { name: 'permitted', type: 'TokenPermissions' },
    { name: 'spender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const

/** Types for the witness variant used in createOrder */
export function permitWitnessTransferFromTypes(witnessTypeString: string) {
  return {
    ...TOKEN_PERMISSIONS_TYPE,
    PermitWitnessTransferFrom: [
      { name: 'permitted', type: 'TokenPermissions' },
      { name: 'spender', type: 'address' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'witness', type: 'BillOrderWitness' },
    ],
    BillOrderWitness: witnessTypeString
      .replace('BillOrderWitness(', '')
      .replace(')', '')
      .split(',')
      .map((field) => {
        const [type, name] = field.trim().split(' ')
        return { name, type }
      }),
  } as const
}

// ---------------------------------------------------------------------------
// Build permit structs ready for signing
// ---------------------------------------------------------------------------

/** Build a PermitTransferFrom for a direct send/requestPay. */
export function buildSendPermit(amount: bigint, _spender: Address): {
  permit: PermitTransferFrom
  nonce: bigint
  deadline: bigint
} {
  const nonce = generateNonce()
  const deadline = makeDeadline()
  return {
    permit: {
      permitted: { token: USDC_ADDRESS, amount },
      nonce,
      deadline,
    },
    nonce,
    deadline,
  }
}

/** Build a PermitWitnessTransferFrom for a bill order. Witness is computed by the caller. */
export function buildOrderPermit(amount: bigint, spender: Address, witness: Hex): {
  permit: PermitWitnessTransferFrom
  nonce: bigint
  deadline: bigint
} {
  const nonce = generateNonce()
  const deadline = makeDeadline()
  return {
    permit: {
      permitted: { token: USDC_ADDRESS, amount },
      nonce,
      deadline,
      witness,
    },
    nonce,
    deadline,
  }
}

// ---------------------------------------------------------------------------
// Check and request Permit2 approval
// ---------------------------------------------------------------------------

/** The USDC allowance value that signifies "already approved Permit2 to max" */
const MAX_UINT256 = 2n ** 256n - 1n

/**
 * Returns true if the Permit2 contract already has a max USDC allowance from owner.
 * Callers should use this to decide whether to prompt for the one-time approval.
 */
export async function hasPermit2Approval(
  publicClient: PublicClient,
  owner: Address,
): Promise<boolean> {
  const erc20Abi = [
    {
      name: 'allowance',
      type: 'function',
      stateMutability: 'view',
      inputs: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
      ],
      outputs: [{ name: '', type: 'uint256' }],
    },
  ] as const
  const allowance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner, PERMIT2_ADDRESS],
  })
  // Consider "approved" if allowance >= 2^255 (commonly set at max)
  return (allowance) >= MAX_UINT256 / 2n
}

/** ABI for ERC-20 approve */
const APPROVE_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

/** Encode calldata for USDC.approve(Permit2, max) — the one-time Permit2 setup. */
export const APPROVE_PERMIT2_MAX_CALLDATA = {
  address: USDC_ADDRESS as Address,
  abi: APPROVE_ABI,
  functionName: 'approve' as const,
  args: [PERMIT2_ADDRESS, MAX_UINT256] as const,
}

/** Encode calldata for USDC.approve(Permit2, 0) — used by the Revoke button on Profile. */
export const REVOKE_PERMIT2_CALLDATA = {
  address: USDC_ADDRESS as Address,
  abi: APPROVE_ABI,
  functionName: 'approve' as const,
  args: [PERMIT2_ADDRESS, 0n] as const,
}
