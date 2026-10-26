/**
 * Hook for interacting with PayRouter.sol
 * Covers: send, sendToHandle, requestPay, createOrder, reclaimOrder
 */

import {
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
  useAccount,
} from 'wagmi'
import { type Address, type Hex, keccak256, encodePacked } from 'viem'
import { TARGET_CHAIN_ID } from '../config'
import {
  buildSendPermit,
  buildOrderPermit,
  computeBillOrderWitness,
  APPROVE_PERMIT2_MAX_CALLDATA,
  REVOKE_PERMIT2_CALLDATA,
  hasPermit2Approval,
  permit2Domain,
  PERMIT_TRANSFER_FROM_TYPES,
  permitWitnessTransferFromTypes,
  BILL_ORDER_WITNESS_TYPE_STRING,
  generateNonce,
} from '../lib/permit2'
// BILL_ORDER_WITNESS_TYPE_STRING is the witness-only definition (no TokenPermissions suffix).
// The frontend uses this for the EIP-712 types object passed to signTypedData.
// The contract passes the full string including TokenPermissions to Permit2 on-chain.
import { hashAccountDetail, hashOrderRef } from '../lib/hash'

const PAY_ROUTER_ADDRESS = (
  import.meta.env.VITE_PAY_ROUTER_ADDRESS ?? '0x0000000000000000000000000000000000000000'
) as Address

const PAY_ROUTER_ABI = [
  {
    name: 'send',
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
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'sendToHandle',
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
      { name: 'handle', type: 'string' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'requestPay',
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
      { name: 'requestId', type: 'bytes32' },
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'createOrder',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        // Canonical PermitTransferFrom — no witness field (witness passed separately by contract to Permit2)
        name: 'permit',
        type: 'tuple',
        components: [
          { name: 'permitted', type: 'tuple', components: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' }] },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      { name: 'sig', type: 'bytes' },
      { name: 'billerId', type: 'address' },
      { name: 'accountHash', type: 'bytes32' },
      { name: 'ref', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: 'orderId', type: 'bytes32' }],
  },
  {
    name: 'reclaimOrder',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'orderId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'orderNonceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'payer', type: 'address' }],
    outputs: [{ name: 'nonce', type: 'uint256' }],
  },
] as const

// ---------------------------------------------------------------------------
// Approve Permit2 (one-time setup)
// ---------------------------------------------------------------------------

export function useApprovePermit2() {
  const { writeContract, data: hash, isPending, isError, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const approve = () => {
    writeContract({ ...APPROVE_PERMIT2_MAX_CALLDATA, chainId: TARGET_CHAIN_ID })
  }

  return { approve, hash, isPending, isConfirming, isSuccess, isError, error, reset }
}

// ---------------------------------------------------------------------------
// Revoke Permit2 approval (Profile screen)
// ---------------------------------------------------------------------------

export function useRevokePermit2() {
  const { writeContract, data: hash, isPending, isError, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const revoke = () => {
    writeContract({ ...REVOKE_PERMIT2_CALLDATA, chainId: TARGET_CHAIN_ID })
  }

  return { revoke, hash, isPending, isConfirming, isSuccess, isError, error, reset }
}

// ---------------------------------------------------------------------------
// Check Permit2 approval status
// ---------------------------------------------------------------------------

export function usePermit2Status() {
  const { address } = useAccount()
  const publicClient = usePublicClient({ chainId: TARGET_CHAIN_ID })

  const check = async (): Promise<boolean> => {
    if (!address || !publicClient) return false
    return hasPermit2Approval(publicClient, address)
  }

  return { check }
}

// ---------------------------------------------------------------------------
// Send by address
// ---------------------------------------------------------------------------

export function useSend() {
  const { address } = useAccount()
  const { writeContractAsync, data: hash, isPending, isError, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const send = async (recipient: Address, amount: bigint, signTypedDataAsync: (args: object) => Promise<Hex>) => {
    if (!address) throw new Error('Wallet not connected')
    const { permit, nonce, deadline } = buildSendPermit(amount, PAY_ROUTER_ADDRESS)

    const sig = await signTypedDataAsync({
      domain: permit2Domain(TARGET_CHAIN_ID),
      types: PERMIT_TRANSFER_FROM_TYPES,
      primaryType: 'PermitTransferFrom',
      message: {
        permitted: permit.permitted,
        spender: PAY_ROUTER_ADDRESS,
        nonce,
        deadline,
      },
    })

    return writeContractAsync({
      address: PAY_ROUTER_ADDRESS,
      abi: PAY_ROUTER_ABI,
      functionName: 'send',
      args: [{ permitted: permit.permitted, nonce, deadline }, sig, recipient, amount],
      chainId: TARGET_CHAIN_ID,
    })
  }

  return { send, hash, isPending, isConfirming, isSuccess, isError, error, reset }
}

// ---------------------------------------------------------------------------
// Send to @handle
// ---------------------------------------------------------------------------

export function useSendToHandle() {
  const { address } = useAccount()
  const { writeContractAsync, data: hash, isPending, isError, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const sendToHandle = async (handle: string, amount: bigint, signTypedDataAsync: (args: object) => Promise<Hex>) => {
    if (!address) throw new Error('Wallet not connected')
    const { permit, nonce, deadline } = buildSendPermit(amount, PAY_ROUTER_ADDRESS)

    const sig = await signTypedDataAsync({
      domain: permit2Domain(TARGET_CHAIN_ID),
      types: PERMIT_TRANSFER_FROM_TYPES,
      primaryType: 'PermitTransferFrom',
      message: {
        permitted: permit.permitted,
        spender: PAY_ROUTER_ADDRESS,
        nonce,
        deadline,
      },
    })

    return writeContractAsync({
      address: PAY_ROUTER_ADDRESS,
      abi: PAY_ROUTER_ABI,
      functionName: 'sendToHandle',
      args: [{ permitted: permit.permitted, nonce, deadline }, sig, handle, amount],
      chainId: TARGET_CHAIN_ID,
    })
  }

  return { sendToHandle, hash, isPending, isConfirming, isSuccess, isError, error, reset }
}

// ---------------------------------------------------------------------------
// Pay a request
// ---------------------------------------------------------------------------

export function useRequestPay() {
  const { address } = useAccount()
  const { writeContractAsync, data: hash, isPending, isError, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const pay = async (requestId: Hex, recipient: Address, amount: bigint, signTypedDataAsync: (args: object) => Promise<Hex>) => {
    if (!address) throw new Error('Wallet not connected')
    const { permit, nonce, deadline } = buildSendPermit(amount, PAY_ROUTER_ADDRESS)

    const sig = await signTypedDataAsync({
      domain: permit2Domain(TARGET_CHAIN_ID),
      types: PERMIT_TRANSFER_FROM_TYPES,
      primaryType: 'PermitTransferFrom',
      message: {
        permitted: permit.permitted,
        spender: PAY_ROUTER_ADDRESS,
        nonce,
        deadline,
      },
    })

    return writeContractAsync({
      address: PAY_ROUTER_ADDRESS,
      abi: PAY_ROUTER_ABI,
      functionName: 'requestPay',
      args: [{ permitted: permit.permitted, nonce, deadline }, sig, requestId, recipient, amount],
      chainId: TARGET_CHAIN_ID,
    })
  }

  return { pay, hash, isPending, isConfirming, isSuccess, isError, error, reset }
}

// ---------------------------------------------------------------------------
// Create bill order (Permit2 witness variant)
// ---------------------------------------------------------------------------

export function useCreateOrder() {
  const { address } = useAccount()
  const publicClient = usePublicClient({ chainId: TARGET_CHAIN_ID })
  const { writeContractAsync, data: hash, isPending, isError, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const createOrder = async (params: {
    billerId: Address
    accountDetail: string // raw PII — hashed before leaving this function
    amount: bigint
    signTypedDataAsync: (args: object) => Promise<Hex>
  }) => {
    if (!address || !publicClient) throw new Error('Wallet not connected')
    const { billerId, accountDetail, amount, signTypedDataAsync } = params

    // Hash account detail — PII never leaves the browser unhashed
    const accountHash = hashAccountDetail(accountDetail, address, billerId)

    // A unique ref is derived client-side. It does NOT need to be pre-known by the contract;
    // it is just an opaque bytes32 committed to in the witness.
    const randomNonce = generateNonce()
    const ref = hashOrderRef(address, billerId, accountHash, randomNonce)

    // Read the per-payer order nonce from the contract.
    // orderId = keccak256(abi.encodePacked(msg.sender, billerId, accountHash, ref, _orderNonces[msg.sender]))
    // Per-payer nonces mean two users can sign simultaneously without interference.
    // The nonce is incremented on-chain after this tx — safe to read and sign immediately.
    const currentNonce = await publicClient.readContract({
      address: PAY_ROUTER_ADDRESS,
      abi: PAY_ROUTER_ABI,
      functionName: 'orderNonceOf',
      args: [address],
    })

    // Mirror the contract's orderId derivation exactly:
    // keccak256(abi.encodePacked(msg.sender, billerId, accountHash, ref, _orderNonces[msg.sender]))
    const orderId = keccak256(
      encodePacked(
        ['address', 'address', 'bytes32', 'bytes32', 'uint256'],
        [address, billerId, accountHash, ref, currentNonce],
      ),
    )

    // Compute the witness hash: keccak256(abi.encode(TYPEHASH, orderId, billerId, accountHash, ref))
    const witness = computeBillOrderWitness(orderId, billerId, accountHash, ref)

    // Build the Permit2 permit (canonical PermitTransferFrom — no witness field in struct).
    // The witness hash is passed as a separate arg to the contract, which forwards it to Permit2.
    const { permit, deadline } = buildOrderPermit(amount, PAY_ROUTER_ADDRESS, witness)
    const permit2Nonce = permit.nonce

    // Sign using the canonical Permit2 EIP-712 layout for witness transfers.
    // The message includes the witness object (not its hash) so the wallet can display it.
    // Permit2 computes the witness hash internally when verifying.
    const sig = await signTypedDataAsync({
      domain: permit2Domain(TARGET_CHAIN_ID),
      types: permitWitnessTransferFromTypes(BILL_ORDER_WITNESS_TYPE_STRING),
      primaryType: 'PermitWitnessTransferFrom',
      message: {
        permitted: permit.permitted,
        spender: PAY_ROUTER_ADDRESS,
        nonce: permit2Nonce,
        deadline,
        witness: { orderId, billerId, accountHash, ref },
      },
    })

    // Pass a plain PermitTransferFrom to the contract (no witness field).
    // The contract computes the witness hash from its args and passes it to Permit2 separately.
    return writeContractAsync({
      address: PAY_ROUTER_ADDRESS,
      abi: PAY_ROUTER_ABI,
      functionName: 'createOrder',
      args: [
        { permitted: permit.permitted, nonce: permit2Nonce, deadline },
        sig,
        billerId,
        accountHash,
        ref,
        amount,
      ],
      chainId: TARGET_CHAIN_ID,
    })
  }

  return { createOrder, hash, isPending, isConfirming, isSuccess, isError, error, reset }
}

// ---------------------------------------------------------------------------
// Reclaim order
// ---------------------------------------------------------------------------

export function useReclaimOrder() {
  const { writeContract, data: hash, isPending, isError, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const reclaim = (orderId: Hex) => {
    writeContract({
      address: PAY_ROUTER_ADDRESS,
      abi: PAY_ROUTER_ABI,
      functionName: 'reclaimOrder',
      args: [orderId],
      chainId: TARGET_CHAIN_ID,
    })
  }

  return { reclaim, hash, isPending, isConfirming, isSuccess, isError, error, reset }
}
