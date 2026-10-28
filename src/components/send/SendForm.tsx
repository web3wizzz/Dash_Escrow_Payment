/**
 * SendForm — send USDC by @handle or 0x address.
 * Permit2 SignatureTransfer. Tier limit enforcement. Clear progression UX.
 */

import { useState } from 'react'
import { useAccount, useReadContract, useSignTypedData } from 'wagmi'
import { erc20Abi, formatUnits, isAddress, type Address, type Hex } from 'viem'
import { Loader2, ArrowUpRight, AlertCircle, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { getUsdc } from '../../onchain-facts'
import { TARGET_CHAIN_ID } from '../../config'
import { useSend, useSendToHandle } from '../../hooks/usePayRouter'
import { parseAmount } from '../../onchain-money'
import { limitViolation } from '../../lib/tiers'
import { TxStatus } from '../shared/TxStatus'
import { ChainGuard } from '../shared/ChainGuard'

const usdcFact = getUsdc(TARGET_CHAIN_ID)
const USDC_ADDRESS = (usdcFact?.address ?? '0x3600000000000000000000000000000000000000') as Address
const USDC_DECIMALS = usdcFact?.decimals ?? 6

function isHandle(value: string): boolean {
  const cleaned = value.startsWith('@') ? value.slice(1) : value
  return /^[a-z][a-z0-9_]{2,19}$/.test(cleaned)
}

interface SendFormProps {
  prefillRecipient?: string
  prefillAmount?: string
  prefillMemo?: string
  requestId?: Hex
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

  const violation = parsedAmount ? limitViolation(parsedAmount.raw, 0) : null
  const balanceFormatted = balanceRaw !== undefined ? formatUnits(balanceRaw, USDC_DECIMALS) : null
  const balanceDisplay = balanceFormatted ? parseFloat(balanceFormatted).toFixed(2) : null

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

  const quickAmounts = ['1', '5', '10', '25']

  return (
    <ChainGuard>
      <div className="space-y-3">
        {prefillMemo && (
          <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--gold-muted)', border: '1px solid rgba(243,181,28,0.25)' }}>
            <p className="text-xs font-semibold" style={{ color: '#9A6E00' }}>{prefillMemo}</p>
          </div>
        )}

        {/* Card */}
        <div
          className="rounded-3xl overflow-hidden"
          style={{
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 20px rgba(16,25,52,0.06)',
          }}
        >
          {/* Recipient field */}
          <div className="px-4 pt-5 pb-3">
            <label className="block text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)', letterSpacing: '0.09em' }}>
              To
            </label>
            <div
              className="flex items-center gap-2 rounded-2xl px-4 py-3 field-base"
            >
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="@handle or 0x address"
                disabled={!!prefillRecipient}
                autoCapitalize="none"
                spellCheck={false}
                className="flex-1 bg-transparent text-sm font-semibold outline-none placeholder:font-normal disabled:opacity-50"
                style={{ color: 'var(--ink)' }}
              />
              {recipient.length > 0 && (
                <AnimatePresence initial={false}>
                  <motion.span
                    key={recipientValid ? 'valid' : 'invalid'}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {recipientValid
                      ? <CheckCircle2 className="size-4" style={{ color: 'var(--success)' }} />
                      : <AlertCircle className="size-4" style={{ color: 'var(--subtle)' }} />
                    }
                  </motion.span>
                </AnimatePresence>
              )}
            </div>
            {recipientIsHandle && (
              <p className="mt-1.5 text-[11px] font-medium" style={{ color: 'var(--success-text)' }}>
                @{cleanRecipient}
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="mx-4 h-px" style={{ background: 'var(--border)' }} />

          {/* Amount field */}
          <div className="px-4 pt-3 pb-4">
            <label className="block text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)', letterSpacing: '0.09em' }}>
              Amount
            </label>
            <div className="field-base rounded-2xl px-4 py-3">
              <div className="flex items-baseline gap-2">
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.]/g, '')
                    if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v)
                  }}
                  placeholder="0.00"
                  disabled={!!prefillAmount}
                  className="display flex-1 bg-transparent text-4xl font-bold tabular-nums outline-none placeholder:text-slate-300 disabled:opacity-50"
                  style={{ color: 'var(--ink)', letterSpacing: '-0.03em', minWidth: 0 }}
                />
                <span className="text-base font-bold pb-1 flex-shrink-0" style={{ color: 'var(--muted)' }}>USDC</span>
              </div>

              {balanceDisplay && (
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px]" style={{ color: 'var(--subtle)' }}>
                    Balance: {balanceDisplay} USDC
                  </span>
                  <button
                    onClick={() => balanceFormatted && setAmount(parseFloat(balanceFormatted).toFixed(6))}
                    className="text-[11px] font-bold rounded-full px-2.5 py-0.5 transition-all active:scale-95"
                    style={{ background: 'var(--gold-muted)', color: '#9A6E00' }}
                  >
                    Max
                  </button>
                </div>
              )}
            </div>

            {/* Quick amounts */}
            {!prefillAmount && (
              <div className="flex gap-2 mt-2.5">
                {quickAmounts.map((q) => (
                  <button
                    key={q}
                    onClick={() => setAmount(q)}
                    className="flex-1 rounded-xl py-1.5 text-xs font-bold transition-all active:scale-95"
                    style={{
                      background: amount === q ? 'var(--gold-muted-mid)' : 'var(--surface-muted)',
                      color: amount === q ? '#9A6E00' : 'var(--muted)',
                      border: amount === q ? '1px solid rgba(243,181,28,0.35)' : '1px solid transparent',
                    }}
                  >
                    ${q}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Violation warning */}
          <AnimatePresence>
            {violation && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mx-4 mb-3 rounded-2xl px-3 py-2.5 flex items-start gap-2"
                  style={{ background: 'var(--danger-muted)', border: '1px solid rgba(192,51,74,0.18)' }}>
                  <AlertCircle className="size-3.5 mt-0.5 flex-shrink-0" style={{ color: 'var(--danger)' }} />
                  <p className="text-xs font-medium" style={{ color: 'var(--danger)' }}>{violation}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* TX status */}
          <div className="px-4 pb-1">
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
          </div>

          {/* Send button */}
          <div className="px-4 pb-5">
            <button
              onClick={() => { void handleSend() }}
              disabled={!ready || isPending || isConfirming}
              className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
              style={{
                background: ready && !isPending && !isConfirming ? '#F3B51C' : 'var(--surface-muted)',
                color: ready && !isPending && !isConfirming ? '#0A0F1E' : 'var(--muted)',
                boxShadow: ready && !isPending && !isConfirming ? '0 2px 12px rgba(243,181,28,0.35)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {isPending
                ? <><Loader2 className="size-4 animate-spin" />Confirm in wallet…</>
                : isConfirming
                ? <><Loader2 className="size-4 animate-spin" />Confirming on Arc…</>
                : isSuccess
                ? <><CheckCircle2 className="size-4" />Sent!</>
                : <><ArrowUpRight className="size-4" strokeWidth={2.5} />Send USDC</>
              }
            </button>
          </div>
        </div>
      </div>
    </ChainGuard>
  )
}
