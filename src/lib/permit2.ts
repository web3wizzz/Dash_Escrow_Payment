/**
 * Permit2 SignatureTransfer helpers for DA$H payment flows.
 *
 * All payment actions use Permit2 SignatureTransfer:
 * - exact amount
 * - single-use nonce
 * - deadline
 *
 * The one-time USDC.approve(Permit2, amount) allowance is separate from the
 * Permit2 EIP-712 signature.
 *
 * IMPORTANT:
 * Arc's deployed canonical Permit2 uses the EIP-712 domain:
 *
 * EIP712Domain(string name,uint256 chainId,address verifyingContract)
 *
 * where:
 *   name = "Permit2"
 *
 * Do not remove the name field from permit2Domain().
 */

import {
  type PublicClient,
  type Address,
  type Hex,
  encodeAbiParameters,
  keccak256,
  encodePacked,
  parseAbiParameters,
} from 'viem'

import {
  PERMIT2_ADDRESS as PERMIT2_ADDR,
  USDC_ADDRESS,
} from '../../config/brand'

/**
 * Canonical Permit2 deployment.
 */
export const PERMIT2_ADDRESS: Address = PERMIT2_ADDR

// ---------------------------------------------------------------------------
// Types mirroring Solidity Permit2 structs
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
// Bill-order witness
// ---------------------------------------------------------------------------

/**
 * Full Permit2 witness type string passed to permitWitnessTransferFrom().
 *
 * Permit2 requires the custom witness type followed by TokenPermissions.
 */
export const BILL_ORDER_WITNESS_TYPE_STRING_WITH_TOKEN_PERMISSIONS =
  'BillOrderWitness(bytes32 orderId,address billerId,bytes32 accountHash,bytes32 ref) TokenPermissions(address token,uint256 amount)'

/**
 * Witness-only definition used when constructing the EIP-712 types object.
 */
export const BILL_ORDER_WITNESS_TYPE_STRING =
  'BillOrderWitness(bytes32 orderId,address billerId,bytes32 accountHash,bytes32 ref)'

/**
 * Solidity equivalent:
 *
 * keccak256(
 *   "BillOrderWitness(bytes32 orderId,address billerId,bytes32 accountHash,bytes32 ref)"
 * )
 */
export const BILL_ORDER_WITNESS_TYPEHASH = keccak256(
  encodePacked(
    ['string'],
    [BILL_ORDER_WITNESS_TYPE_STRING],
  ),
)

/**
 * Mirrors:
 *
 * keccak256(
 *   abi.encode(
 *     BILL_ORDER_WITNESS_TYPEHASH,
 *     orderId,
 *     billerId,
 *     accountHash,
 *     ref
 *   )
 * )
 */
export function computeBillOrderWitness(
  orderId: Hex,
  billerId: Address,
  accountHash: Hex,
  ref: Hex,
): Hex {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters(
        'bytes32, bytes32, address, bytes32, bytes32',
      ),
      [
        BILL_ORDER_WITNESS_TYPEHASH,
        orderId,
        billerId,
        accountHash,
        ref,
      ],
    ),
  )
}

// ---------------------------------------------------------------------------
// Permit2 nonce generation
// ---------------------------------------------------------------------------

/**
 * Permit2 unordered nonces are application-managed.
 *
 * Generate a random 256-bit nonce for each authorization.
 */
export function generateNonce(): bigint {
  const bytes = new Uint8Array(32)

  crypto.getRandomValues(bytes)

  const hex = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')

  return BigInt(`0x${hex}`)
}

/**
 * Returns a unix timestamp N seconds in the future.
 *
 * Default: 20 minutes.
 */
export function makeDeadline(
  offsetSeconds = 1200,
): bigint {
  return BigInt(
    Math.floor(Date.now() / 1000) + offsetSeconds,
  )
}

// ---------------------------------------------------------------------------
// Permit2 EIP-712 domain
// ---------------------------------------------------------------------------

/**
 * IMPORTANT:
 *
 * The canonical Permit2 deployed on Arc uses:
 *
 * EIP712Domain(
 *   string name,
 *   uint256 chainId,
 *   address verifyingContract
 * )
 *
 * name = "Permit2"
 *
 * Arc Testnet:
 * chainId = 5042002
 *
 * Arc Mainnet:
 * chainId = 5042
 *
 * No version field should be added.
 */
export function permit2Domain(
  chainId: number,
) {
  return {
    name: 'Permit2',
    chainId,
    verifyingContract: PERMIT2_ADDRESS,
  } as const
}

// ---------------------------------------------------------------------------
// Typed-data structures
// ---------------------------------------------------------------------------

const TOKEN_PERMISSIONS_TYPE = {
  TokenPermissions: [
    {
      name: 'token',
      type: 'address',
    },
    {
      name: 'amount',
      type: 'uint256',
    },
  ],
} as const

/**
 * Standard Permit2 SignatureTransfer typed data.
 *
 * PermitTransferFrom(
 *   TokenPermissions permitted,
 *   address spender,
 *   uint256 nonce,
 *   uint256 deadline
 * )
 */
export const PERMIT_TRANSFER_FROM_TYPES = {
  ...TOKEN_PERMISSIONS_TYPE,

  PermitTransferFrom: [
    {
      name: 'permitted',
      type: 'TokenPermissions',
    },
    {
      name: 'spender',
      type: 'address',
    },
    {
      name: 'nonce',
      type: 'uint256',
    },
    {
      name: 'deadline',
      type: 'uint256',
    },
  ],
} as const

/**
 * Typed-data structure for Permit2 witness transfers.
 */
export function permitWitnessTransferFromTypes(
  witnessTypeString: string,
) {
  const witnessFields = witnessTypeString
    .replace('BillOrderWitness(', '')
    .replace(')', '')
    .split(',')
    .map((field) => {
      const parts = field.trim().split(/\s+/)

      if (parts.length !== 2) {
        throw new Error(
          `Invalid witness field: ${field}`,
        )
      }

      const [type, name] = parts

      return {
        name,
        type,
      }
    })

  return {
    ...TOKEN_PERMISSIONS_TYPE,

    PermitWitnessTransferFrom: [
      {
        name: 'permitted',
        type: 'TokenPermissions',
      },
      {
        name: 'spender',
        type: 'address',
      },
      {
        name: 'nonce',
        type: 'uint256',
      },
      {
        name: 'deadline',
        type: 'uint256',
      },
      {
        name: 'witness',
        type: 'BillOrderWitness',
      },
    ],

    BillOrderWitness: witnessFields,
  } as const
}

// ---------------------------------------------------------------------------
// Build permits
// ---------------------------------------------------------------------------

/**
 * Build Permit2 authorization for:
 *
 * - PayRouter.send()
 * - PayRouter.sendToHandle()
 * - PayRouter.requestPay()
 */
export function buildSendPermit(
  amount: bigint,
  _spender: Address,
): {
  permit: PermitTransferFrom
  nonce: bigint
  deadline: bigint
} {
  if (amount <= 0n) {
    throw new Error(
      'Permit amount must be greater than zero',
    )
  }

  const nonce = generateNonce()
  const deadline = makeDeadline()

  const permit: PermitTransferFrom = {
    permitted: {
      token: USDC_ADDRESS,
      amount,
    },
    nonce,
    deadline,
  }

  return {
    permit,
    nonce,
    deadline,
  }
}

/**
 * Build Permit2 authorization for createOrder().
 *
 * The witness is NOT stored inside PermitTransferFrom.
 *
 * PayRouter computes/passes the witness separately to:
 *
 * permitWitnessTransferFrom(...)
 */
export function buildOrderPermit(
  amount: bigint,
  _spender: Address,
  _witness: Hex,
): {
  permit: PermitTransferFrom
  nonce: bigint
  deadline: bigint
} {
  if (amount <= 0n) {
    throw new Error(
      'Permit amount must be greater than zero',
    )
  }

  const nonce = generateNonce()
  const deadline = makeDeadline()

  const permit: PermitTransferFrom = {
    permitted: {
      token: USDC_ADDRESS,
      amount,
    },
    nonce,
    deadline,
  }

  return {
    permit,
    nonce,
    deadline,
  }
}

// ---------------------------------------------------------------------------
// USDC allowance for Permit2
// ---------------------------------------------------------------------------

const MAX_UINT256 =
  2n ** 256n - 1n

const ERC20_ALLOWANCE_ABI = [
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',

    inputs: [
      {
        name: 'owner',
        type: 'address',
      },
      {
        name: 'spender',
        type: 'address',
      },
    ],

    outputs: [
      {
        name: '',
        type: 'uint256',
      },
    ],
  },
] as const

/**
 * Read the current USDC allowance granted to Permit2.
 */
export async function getPermit2Allowance(
  publicClient: PublicClient,
  owner: Address,
): Promise<bigint> {
  const allowance =
    await publicClient.readContract({
      address: USDC_ADDRESS,

      abi: ERC20_ALLOWANCE_ABI,

      functionName: 'allowance',

      args: [
        owner,
        PERMIT2_ADDRESS,
      ],
    })

  return allowance
}

/**
 * Returns true when the current Permit2 allowance is sufficient.
 *
 * Unlike the previous implementation, this DOES NOT require an unlimited
 * uint256-max approval.
 *
 * Example:
 *
 * allowance = 5 USDC
 * payment   = 1 USDC
 *
 * result = true
 */
export async function hasPermit2Approval(
  publicClient: PublicClient,
  owner: Address,
  requiredAmount: bigint = 1n,
): Promise<boolean> {
  if (requiredAmount <= 0n) {
    return false
  }

  const allowance =
    await getPermit2Allowance(
      publicClient,
      owner,
    )

  return allowance >= requiredAmount
}

// ---------------------------------------------------------------------------
// Approval ABI
// ---------------------------------------------------------------------------

const APPROVE_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',

    inputs: [
      {
        name: 'spender',
        type: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
      },
    ],

    outputs: [
      {
        name: '',
        type: 'bool',
      },
    ],
  },
] as const

/**
 * Existing maximum-allowance approval call.
 *
 * This remains available for users who explicitly choose an unlimited
 * Permit2 allowance.
 */
export const APPROVE_PERMIT2_MAX_CALLDATA = {
  address: USDC_ADDRESS as Address,

  abi: APPROVE_ABI,

  functionName: 'approve' as const,

  args: [
    PERMIT2_ADDRESS,
    MAX_UINT256,
  ] as const,
}

/**
 * Build an exact/custom Permit2 allowance.
 *
 * Prefer this when DA$H wants to approve only the amount required rather
 * than requesting unlimited approval.
 */
export function buildPermit2ApprovalCall(
  amount: bigint,
) {
  if (amount <= 0n) {
    throw new Error(
      'Approval amount must be greater than zero',
    )
  }

  return {
    address: USDC_ADDRESS as Address,

    abi: APPROVE_ABI,

    functionName: 'approve' as const,

    args: [
      PERMIT2_ADDRESS,
      amount,
    ] as const,
  }
}

/**
 * Revoke Permit2's USDC allowance.
 */
export const REVOKE_PERMIT2_CALLDATA = {
  address: USDC_ADDRESS as Address,

  abi: APPROVE_ABI,

  functionName: 'approve' as const,

  args: [
    PERMIT2_ADDRESS,
    0n,
  ] as const,
}
