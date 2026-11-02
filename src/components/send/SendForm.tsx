/**
 * SendForm — three-step flow:
 *   1. Entry  : recipient + amount input
 *   2. Review : confirmation screen showing full details before signing
 *   3. Receipt: DashReceipt after confirmation
 *
 * Logic (Permit2 SignatureTransfer) is unchanged.
 */

import { useState } from 'react'
import { useAccount, useReadContract, useSignTypedData } from 'wagmi'
import { erc20Abi, formatUnits, isAddress, type Address, type Hex } from 'viem'
import { Loader2, ArrowUpRight, AlertCircle, CheckCircle2, ChevronLeft, ArrowRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { getUsdc } from '../../onchain-facts'
import { TARGET_CHAIN_ID, DISPLAY_NETWORK_NAME } from '../../config'
import { useSend, useSendToHandle } from '../../hooks/usePayRouter'
import { parseAmount } from '../../onchain-money'
import { limitViolation } from '../../lib/tiers'
import { TxStatus } from '../shared/TxStatus'
import { DashReceipt } from '../shared/DashReceipt'
import { ChainGuard } from '../shared/ChainGuard'

const usdcFact = getUsdc(TARGET_CHAIN_ID)
const USDC_ADDRESS = (usdcFact?.address ?? '0x3600000000000000000000000000000000000000') as Address
const USDC_DECIMALS = usdcFact?.decimals ?? 6
const NETWORK_LABEL = DISPLAY_NETWORK_NAME
const GLOBAL_CAP = '25.00'

function isHandle(value: string): boolean {
  const cleaned = value.startsWith('@') ? value.slice(1) : value
  return /^[a-z][a-z0-9_]{2,19}$/.test(cleaned)
}

type Step = 'entry' | 'review' | 'receipt'

interface SendFormProps {
  prefillRecipient?: string
  prefillAmount?: string
  prefillMemo?: string
  requestId?: Hex
  onSuccess?: () => void
}

const slide = {
  entry:   { initial: { opacity: 0, x: -20 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -20 } },
  forward: { initial: { opacity: 0, x:  20 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x:  20 } },
}

export function SendForm({ prefillRecipient, prefillAmount, prefillMemo, requestId: _requestId, onSuccess }: SendFormProps) {
  const { address, isConnected } = useAccount()
  const { signTypedDataAsync } = useSignTypedData()

  const [step, setStep]           = useState<Step>('entry')
  const [confirmedAt]             = useState<number>(() => performance.timeOrigin + performance.now())
  const [recipient, setRecipient] = useState(prefillRecipient ?? '')
  const [amount, setAmount]       = useState(prefillAmount ?? '')

  const { data: balanceRaw } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
    chainId: TARGET_CHAIN_ID,
  })

  const sendHook         = useSend()
  const sendToHandleHook = useSendToHandle()

  const cleanRecipient   = recipient.startsWith('@') ? recipient.slice(1) : recipient
  const recipientIsHandle  = isHandle(cleanRecipient)
  const recipientIsAddress = isAddress(cleanRecipient)
  const recipientValid     = recipientIsHandle || recipientIsAddress

  const parsedAmount = (() => {
    try { return amount ? parseAmount(TARGET_CHAIN_ID, amount) : null }
    catch { return null }
  })()

  const violation        = parsedAmount ? limitViolation(parsedAmount.raw, 0) : null
  const balanceFormatted = balanceRaw !== undefined ? formatUnits(balanceRaw, USDC_DECIMALS) : null
  const balanceDisplay   = balanceFormatted ? parseFloat(balanceFormatted).toFixed(2) : null
  const ready            = isConnected && recipientValid && !!parsedAmount && !violation

  const isPending    = sendHook.isPending    || sendToHandleHook.isPending
  const isConfirming = sendHook.isConfirming || sendToHandleHook.isConfirming
  const isSuccess    = sendHook.isSuccess    || sendToHandleHook.isSuccess
  const isError      = sendHook.isError      || sendToHandleHook.isError
  const error        = sendHook.error        ?? sendToHandleHook.error
  const hash         = sendHook.hash         ?? sendToHandleHook.hash

  const handleSend = async () => {
    if (!parsedAmount) return
    try {
      if (recipientIsHandle) {
        await sendToHandleHook.sendToHandle(cleanRecipient, parsedAmount.raw, signTypedDataAsync as unknown as (args: object) => Promise<Hex>)
      } else {
        await sendHook.send(cleanRecipient as Address, parsedAmount.raw, signTypedDataAsync as unknown as (args: object) => Promise<Hex>)
      }
      onSuccess?.()
    } catch { /* surfaced by TxStatus */ }
  }

  /* Derive receipt step: once confirmed on the review step, show receipt */
  const effectiveStep: Step =
    step === 'review' && isSuccess && !!hash ? 'receipt' : step

  const reset = () => {
    sendHook.reset()
    sendToHandleHook.reset()
    setStep('entry')
  }

  const quickAmounts = ['1', '5', '10', '25']

  /* ── Receipt state ── */
  if (effectiveStep === 'receipt' && isSuccess && hash) {
    return (
      <DashReceipt
        data={{
          amount: parseFloat(amount).toFixed(2),
          recipient: cleanRecipient,
          txType: 'Sent',
          hash,
          timestamp: confirmedAt,
        }}
        onDismiss={reset}
      />
    )
  }

  return (
    <ChainGuard>
      <AnimatePresence mode="wait" initial={false}>

        {/* ── Step 1: Entry ── */}
        {effectiveStep === 'entry' && (
          <motion.div key="entry" {...slide.entry} transition={{ duration: 0.18 }} className="space-y-3">

            {prefillMemo && (
              <div
                className="rounded-xl px-4 py-3"
                style={{ background: 'rgba(242,169,0,0.08)', border: '1px solid rgba(242,169,0,0.22)' }}
              >
                <p className="text-xs font-semibold" style={{ color: '#9A6E00' }}>{prefillMemo}</p>
              </div>
            )}

            <div
              className="overflow-hidden"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}
            >
              {/* Recipient */}
              <div className="px-4 pt-5 pb-4">
                <label className="block text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'var(--subtle)', letterSpacing: '0.10em' }}>
                  To
                </label>
                <div className="flex items-center gap-2 rounded-xl px-3.5 py-3 field-base">
                  <input
                    type="text"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="@handle or 0x address"
                    disabled={!!prefillRecipient}
                    autoCapitalize="none"
                    spellCheck={false}
                    className="flex-1 bg-transparent text-sm font-semibold outline-none placeholder:font-normal placeholder:opacity-40 disabled:opacity-50"
                    style={{ color: 'var(--ink)' }}
                  />
                  <AnimatePresence initial={false}>
                    {recipient.length > 0 && (
                      <motion.span
                        key={recipientValid ? 'v' : 'i'}
                        initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                        transition={{ duration: 0.14 }}
                      >
                        {recipientValid
                          ? <CheckCircle2 className="size-4" style={{ color: 'var(--success)' }} />
                          : <AlertCircle className="size-4" style={{ color: 'var(--subtle)' }} />
                        }
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                {recipientIsHandle && (
                  <p className="mt-1.5 text-[11px] font-medium" style={{ color: 'var(--success-text)' }}>
                    Sending to @{cleanRecipient}
                  </p>
                )}
              </div>

              <div className="mx-4 h-px" style={{ background: 'var(--border)' }} />

              {/* Amount */}
              <div className="px-4 pt-4 pb-5">
                <label className="block text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'var(--subtle)', letterSpacing: '0.10em' }}>
                  Amount
                </label>
                <div className="field-base rounded-xl px-3.5 py-3">
                  <div className="flex items-baseline gap-2.5">
                    <input
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9.]/g, '')
                        if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v)
                      }}
                      placeholder="0.00"
                      disabled={!!prefillAmount}
                      className="display flex-1 bg-transparent font-bold tabular-nums outline-none placeholder:opacity-20 disabled:opacity-50"
                      style={{
                        color: 'var(--ink)',
                        fontSize: 'clamp(2rem, 10vw, 2.8rem)',
                        letterSpacing: '-0.04em',
                        minWidth: 0,
                      }}
                    />
                    <span className="text-base font-bold pb-1 shrink-0" style={{ color: 'var(--muted)' }}>USDC</span>
                  </div>
                  {balanceDisplay && (
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px]" style={{ color: 'var(--subtle)' }}>
                        Balance {balanceDisplay} USDC
                      </span>
                      <button
                        onClick={() => balanceFormatted && setAmount(parseFloat(balanceFormatted).toFixed(6))}
                        className="text-[11px] font-bold rounded-full px-2.5 py-0.5 transition-all active:scale-95"
                        style={{ background: 'rgba(242,169,0,0.12)', color: '#9A6E00' }}
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
                        className="flex-1 rounded-lg py-1.5 text-xs font-bold transition-all active:scale-95"
                        style={{
                          background: amount === q ? 'rgba(242,169,0,0.15)' : 'var(--surface-muted)',
                          color: amount === q ? '#9A6E00' : 'var(--muted)',
                          border: amount === q ? '1px solid rgba(242,169,0,0.30)' : '1px solid transparent',
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
                    <div className="mx-4 mb-3 rounded-xl px-3 py-2.5 flex items-start gap-2"
                      style={{ background: 'var(--danger-muted)', border: '1px solid rgba(192,51,74,0.18)' }}>
                      <AlertCircle className="size-3.5 mt-0.5 shrink-0" style={{ color: 'var(--danger)' }} />
                      <p className="text-xs font-medium" style={{ color: 'var(--danger)' }}>{violation}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Review button */}
              <div className="px-4 pb-5">
                <button
                  onClick={() => setStep('review')}
                  disabled={!ready}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
                  style={{
                    background: ready ? 'var(--ink)' : 'var(--surface-muted)',
                    color: ready ? '#fff' : 'var(--muted)',
                    boxShadow: ready ? '0 2px 12px rgba(14,16,48,0.18)' : 'none',
                  }}
                >
                  Review
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Step 2: Review ── */}
        {effectiveStep === 'review' && (
          <motion.div key="review" {...slide.forward} transition={{ duration: 0.18 }} className="space-y-3">

            {/* Back */}
            <button
              onClick={() => setStep('entry')}
              className="flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-70 active:opacity-50 -ml-1"
              style={{ color: 'var(--muted)' }}
            >
              <ChevronLeft className="size-4" />
              Back
            </button>

            {/* Review card */}
            <div
              className="overflow-hidden"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}
            >
              {/* Amount hero */}
              <div
                className="px-5 py-7 text-center"
                style={{ background: 'var(--canvas)' }}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--subtle)', letterSpacing: '0.10em' }}>
                  Sending
                </p>
                <div className="flex items-baseline justify-center gap-2">
                  <span
                    className="display font-bold tabular-nums"
                    style={{ fontSize: '2.4rem', color: 'var(--ink)', letterSpacing: '-0.04em' }}
                  >
                    {parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                  </span>
                  <span className="text-base font-bold pb-1" style={{ color: 'var(--muted)' }}>USDC</span>
                </div>
              </div>

              {/* Detail rows */}
              {[
                { label: 'To',       value: cleanRecipient.startsWith('0x') ? `${cleanRecipient.slice(0,8)}…${cleanRecipient.slice(-6)}` : `@${cleanRecipient}` },
                { label: 'Network',  value: NETWORK_LABEL },
                { label: 'Fee',      value: '0 USDC' },
                { label: 'Limit',    value: `≤ ${GLOBAL_CAP} USDC per tx` },
                { label: 'Method',   value: 'Permit2 signature' },
              ].map(({ label, value }, i, arr) => (
                <div key={label}>
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <span className="text-sm" style={{ color: 'var(--muted)' }}>{label}</span>
                    <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{value}</span>
                  </div>
                  {i < arr.length - 1 && <div className="mx-4 h-px" style={{ background: 'var(--border)' }} />}
                </div>
              ))}
            </div>

            {/* TX status */}
            <TxStatus
              isPending={isPending} isConfirming={isConfirming}
              isSuccess={isSuccess} isError={isError}
              error={error} hash={hash}
              successMessage="Sent successfully"
              onDismiss={reset}
            />

            {/* Confirm button */}
            {!isSuccess && (
              <button
                onClick={() => { void handleSend() }}
                disabled={isPending || isConfirming}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-4 text-sm font-bold transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
                style={{
                  background: isPending || isConfirming ? 'var(--surface-muted)' : 'var(--saffron)',
                  color: isPending || isConfirming ? 'var(--muted)' : '#0A0F1E',
                  boxShadow: isPending || isConfirming ? 'none' : '0 2px 12px rgba(242,169,0,0.32)',
                }}
              >
                {isPending
                  ? <><Loader2 className="size-4 animate-spin" />Confirm in wallet…</>
                  : isConfirming
                  ? <><Loader2 className="size-4 animate-spin" />Confirming on Arc…</>
                  : <><ArrowUpRight className="size-4" strokeWidth={2.5} />Confirm & send</>
                }
              </button>
            )}

            {isSuccess && hash && (
              <button
                onClick={() => setStep('receipt')}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-4 text-sm font-bold"
                style={{ background: 'var(--success)', color: '#fff' }}
              >
                <CheckCircle2 className="size-4" />
                View receipt
              </button>
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </ChainGuard>
  )
}
