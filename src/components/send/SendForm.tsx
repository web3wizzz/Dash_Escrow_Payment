/**
 * SendForm — send USDC by handle or address.
 * Uses Permit2 SignatureTransfer. Enforces tier limits client-side for UX.
 */

import { useState } from 'react'
import { useAccount, useReadContract, useSignTypedData } from 'wagmi'
import { erc20Abi, formatUnits, isAddress, type Address, type Hex } from 'viem'
import { Loader2 } from 'lucide-react'
import { getUsdc } from '../../onchain-facts'
import { TARGET_CHAIN_ID } from '../../config'
import { useSend, useSendToHandle } from '../../hooks/usePayRouter'
import { useMyKycTier } from '../../hooks/useKycTier'
import { parseAmount } from '../../onchain-money'
import { limitViolation } from '../../lib/tiers'
import { TxStatus } from '../shared/TxStatus'
import { ChainGuard } from '../shared/ChainGuard'

const usdcFact = getUsdc(TARGET_CHAIN_ID)
const USDC_ADDRESS = (usdcFact?.address ?? '0x3600000000000000000000000000000000000000') as Address
const USDC_DECIMALS = usdcFact?.decimals ?? 6

const glass = {
  card: {
    background: 'rgba(255,255,255,0.64)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.68)',
    boxShadow: '0 8px 32px rgba(18,45,69,0.08), inset 0 1px 0 rgba(255,255,255,0.55)',
  } as React.CSSProperties,
  inner: {
    background: 'rgba(255,255,255,0.46)',
    border: '1px solid rgba(255,255,255,0.56)',
  } as React.CSSProperties,
}

/** Returns true if the value looks like a @handle (starts with @ or is lowercase handle format) */
function isHandle(value: string): boolean {
  const cleaned = value.startsWith('@') ? value.slice(1) : value
  return /^[a-z][a-z0-9_]{2,19}$/.test(cleaned)
}

interface SendFormProps {
  prefillRecipient?: string
  prefillAmount?: string
  prefillMemo?: string
  requestId?: Hex // currently unused but reserved for on-chain requestPay routing
  onSuccess?: () => void
}

export function SendForm({ prefillRecipient, prefillAmount, prefillMemo, requestId: _requestId, onSuccess }: SendFormProps) {
  const { address, isConnected } = useAccount()
  const { signTypedDataAsync } = useSignTypedData()

  const [recipient, setRecipient] = useState(prefillRecipient ?? '')
  const [amount, setAmount] = useState(prefillAmount ?? '')

  const { data: balanceRaw } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
    chainId: TARGET_CHAIN_ID,
  })

  const { data: tierData } = useMyKycTier()
  const tier = tierData?.tier ?? 0

  const sendHook = useSend()
  const sendToHandleHook = useSendToHandle()

  const cleanRecipient = recipient.startsWith('@') ? recipient.slice(1) : recipient
  const recipientIsHandle = isHandle(cleanRecipient)
  const recipientIsAddress = isAddress(cleanRecipient)
  const recipientValid = recipientIsHandle || recipientIsAddress

  const parsedAmount = (() => {
    try { return amount ? parseAmount(TARGET_CHAIN_ID, amount) : null }
    catch { return null }
  })()

  const violation = parsedAmount ? limitViolation(parsedAmount.raw, tier) : null
  const balanceFormatted = balanceRaw !== undefined
    ? formatUnits(balanceRaw, USDC_DECIMALS)
    : null

  const ready = isConnected && recipientValid && !!parsedAmount && !violation

  const isPending = sendHook.isPending || sendToHandleHook.isPending
  const isConfirming = sendHook.isConfirming || sendToHandleHook.isConfirming
  const isSuccess = sendHook.isSuccess || sendToHandleHook.isSuccess
  const isError = sendHook.isError || sendToHandleHook.isError
  const error = sendHook.error ?? sendToHandleHook.error
  const hash = sendHook.hash ?? sendToHandleHook.hash

  const handleSend = async () => {
    if (!parsedAmount) return
    try {
      if (recipientIsHandle) {
        await sendToHandleHook.sendToHandle(cleanRecipient, parsedAmount.raw, signTypedDataAsync as unknown as (args: object) => Promise<Hex>)
      } else {
        await sendHook.send(cleanRecipient as Address, parsedAmount.raw, signTypedDataAsync as unknown as (args: object) => Promise<Hex>)
      }
      onSuccess?.()
    } catch {
      // errors surfaced by TxStatus
    }
  }

  const reset = () => {
    sendHook.reset()
    sendToHandleHook.reset()
  }

  return (
    <div className="space-y-3">
      <ChainGuard>
        <div className="rounded-2xl p-4 space-y-3" style={glass.card}>
          {prefillMemo && (
            <p className="text-xs font-medium px-1" style={{ color: 'var(--muted)' }}>
              {prefillMemo}
            </p>
          )}

          {/* Recipient */}
          <div className="rounded-2xl p-3.5 space-y-1" style={glass.inner}>
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)', letterSpacing: '0.06em' }}>
              To
            </label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="@handle or 0x address"
              disabled={!!prefillRecipient}
              className="w-full bg-transparent text-sm font-medium outline-none placeholder:opacity-40 disabled:opacity-60"
              style={{ color: 'var(--ink)' }}
            />
          </div>

          {/* Amount */}
          <div className="rounded-2xl p-3.5" style={glass.inner}>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9.]/g, '')
                if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v)
              }}
              placeholder="0.00"
              disabled={!!prefillAmount}
              className="display w-full bg-transparent text-4xl font-bold tabular-nums outline-none placeholder:text-slate-300 disabled:opacity-60"
              style={{ color: 'var(--ink)' }}
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--subtle)' }}>USDC</span>
              {balanceFormatted && (
                <button
                  onClick={() => setAmount(balanceFormatted)}
                  className="text-xs font-semibold"
                  style={{ color: 'var(--accent-hover)' }}
                >
                  Balance: {parseFloat(balanceFormatted).toFixed(2)} · Max
                </button>
              )}
            </div>
          </div>

          {violation && (
            <p className="text-xs px-1" style={{ color: 'var(--danger)' }}>{violation}</p>
          )}

          <TxStatus
            isPending={isPending}
            isConfirming={isConfirming}
            isSuccess={isSuccess}
            isError={isError}
            error={error}
            hash={hash}
            successMessage="Sent successfully"
            onDismiss={reset}
          />

          <button
            onClick={() => { void handleSend() }}
            disabled={!ready || isPending || isConfirming}
            className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--accent)' }}
          >
            {!isConnected ? 'Connect wallet' :
             isPending ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" />Confirm in wallet…</span> :
             isConfirming ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" />Confirming…</span> :
             'Send USDC'}
          </button>
        </div>
      </ChainGuard>
    </div>
  )
}
