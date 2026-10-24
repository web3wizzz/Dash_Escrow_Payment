/**
 * BillOrderForm — dynamic required fields, amount, create order flow.
 * PII (account/meter numbers) is hashed before leaving the browser.
 */

import { useState } from 'react'
import { useAccount, useSignTypedData } from 'wagmi'
import { type Hex, formatUnits } from 'viem'
import { Loader2, Lock, ShieldCheck, ArrowLeft } from 'lucide-react'
import { parseAmount } from '../../onchain-money'
import { useCreateOrder } from '../../hooks/usePayRouter'
import { useMyKycTier } from '../../hooks/useKycTier'
import { TxStatus } from '../shared/TxStatus'
import { type Biller, recordRecentBiller } from '../../lib/billers'

const TARGET_CHAIN_ID_local = 5042 // Arc mainnet

const surfaceInner: React.CSSProperties = {
  background: 'rgba(255,255,255,0.80)',
  border: '1px solid rgba(27,31,75,0.09)',
  boxShadow: '0 1px 3px rgba(27,31,75,0.04)',
}

interface BillOrderFormProps {
  biller: Biller
  onSuccess?: (orderId: string) => void
  onBack?: () => void
}

export function BillOrderForm({ biller, onSuccess, onBack }: BillOrderFormProps) {
  const { address, isConnected } = useAccount()
  const { signTypedDataAsync } = useSignTypedData()
  const { createOrder, hash, isPending, isConfirming, isSuccess, isError, error, reset } = useCreateOrder()
  const { data: tierData } = useMyKycTier()

  // Dynamic field values keyed by field name
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(biller.requiredFields.map(f => [f.name, '']))
  )
  const [amount, setAmount] = useState('')

  const tier = tierData?.tier ?? 0
  const canUseBills = tier >= 1

  const allFieldsFilled = biller.requiredFields.every(f => fieldValues[f.name]?.trim())

  const parsedAmount = (() => {
    try { return amount ? parseAmount(TARGET_CHAIN_ID_local, amount) : null }
    catch { return null }
  })()

  const minFormatted = formatUnits(BigInt(biller.minAmount), 6)
  const maxFormatted = formatUnits(BigInt(biller.maxAmount), 6)
  const amountValid = parsedAmount
    ? parsedAmount.raw >= BigInt(biller.minAmount) && parsedAmount.raw <= BigInt(biller.maxAmount)
    : false

  const ready = isConnected && canUseBills && allFieldsFilled && amountValid

  // Build the account detail string from all required fields (concatenated, hashed on-chain)
  const accountDetail = biller.requiredFields
    .map(f => `${f.name}:${fieldValues[f.name] ?? ''}`)
    .join('|')

  const handleCreate = async () => {
    if (!parsedAmount || !address) return
    try {
      await createOrder({
        billerId: biller.id,
        accountDetail: accountDetail.trim(),
        amount: parsedAmount.raw,
        signTypedDataAsync: signTypedDataAsync as unknown as (args: object) => Promise<Hex>,
      })
      recordRecentBiller(biller.id)
      onSuccess?.(hash ?? '')
    } catch {
      // errors surfaced by TxStatus
    }
  }

  if (!canUseBills) {
    return (
      <div
        className="rounded-2xl p-4 flex items-start gap-3"
        style={{
          background: 'rgba(242,169,0,0.07)',
          border: '1px solid rgba(242,169,0,0.20)',
        }}
      >
        <Lock className="size-4 mt-0.5 shrink-0" style={{ color: '#b37800' }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            Verification required
          </p>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
            Bill payments require Tier 1 (Verified) or higher. Complete identity verification in Settings to continue.
            <span className="ml-1 font-semibold">(Sandbox)</span>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Back to catalog */}
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium min-h-[44px] px-1"
          style={{ color: 'var(--muted)' }}
        >
          <ArrowLeft className="size-4" />
          Back to billers
        </button>
      )}

      {/* Selected biller summary */}
      <div
        className="rounded-2xl p-3.5 flex items-center gap-3"
        style={surfaceInner}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{biller.name}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{biller.category}</p>
        </div>
        {biller.sandbox && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shrink-0"
            style={{ background: 'rgba(242,169,0,0.14)', color: '#b37800', letterSpacing: '0.06em' }}
          >
            {biller.demo ? 'Demo' : 'Sandbox'}
          </span>
        )}
      </div>

      {/* Dynamic required fields */}
      {biller.requiredFields.map(field => (
        <div key={field.name} className="rounded-2xl px-3.5 py-3 space-y-1" style={surfaceInner}>
          <label
            htmlFor={`field-${field.name}`}
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'var(--muted)', letterSpacing: '0.06em' }}
          >
            {field.label}
          </label>
          <input
            id={`field-${field.name}`}
            type={field.type}
            inputMode={field.type === 'tel' ? 'tel' : field.type === 'number' ? 'numeric' : 'text'}
            value={fieldValues[field.name] ?? ''}
            onChange={e => setFieldValues(v => ({ ...v, [field.name]: e.target.value }))}
            placeholder={field.placeholder}
            pattern={field.pattern}
            className="w-full bg-transparent text-sm font-medium outline-none placeholder:opacity-40"
            style={{ color: 'var(--ink)' }}
          />
          {field.hint && (
            <p className="text-[10px] flex items-center gap-1" style={{ color: 'var(--subtle)' }}>
              <Lock className="size-2.5 shrink-0" />
              {field.hint} — hashed before submission, never stored on-chain.
            </p>
          )}
        </div>
      ))}

      {/* Amount */}
      <div className="rounded-2xl p-3.5" style={surfaceInner}>
        <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: 'var(--muted)', letterSpacing: '0.06em' }}>
          Amount (USDC)
        </label>
        <input
          inputMode="decimal"
          value={amount}
          onChange={e => {
            const v = e.target.value.replace(/[^0-9.]/g, '')
            if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v)
          }}
          placeholder="0.00"
          className="bricolage w-full bg-transparent text-4xl font-bold tabular-nums outline-none placeholder:opacity-30"
          style={{ color: 'var(--ink)' }}
        />
        <p className="mt-1 text-xs" style={{ color: 'var(--subtle)' }}>
          Min {minFormatted} · Max {maxFormatted} USDC
        </p>
      </div>

      {/* Escrow explainer */}
      <div
        className="rounded-2xl p-3.5 flex items-start gap-2.5"
        style={{ background: 'rgba(14,16,48,0.04)', border: '1px solid rgba(14,16,48,0.07)' }}
      >
        <ShieldCheck className="size-4 mt-0.5 shrink-0" style={{ color: 'var(--ink)' }} />
        <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          Your payment is held until the bill is fulfilled, and returned automatically after 30 minutes if it is not.
        </p>
      </div>

      <TxStatus
        isPending={isPending}
        isConfirming={isConfirming}
        isSuccess={isSuccess}
        isError={isError}
        error={error}
        hash={hash}
        successMessage="Bill order created. Processing…"
        onDismiss={reset}
      />

      <button
        onClick={() => { void handleCreate() }}
        disabled={!ready || isPending || isConfirming}
        className="w-full rounded-2xl py-3.5 text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: ready && !isPending && !isConfirming ? '#F2A900' : 'rgba(27,31,75,0.12)',
          color: ready && !isPending && !isConfirming ? '#1B1F4B' : 'var(--ink)',
        }}
      >
        {isPending
          ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" />Confirm in wallet…</span>
          : isConfirming
            ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" />Confirming…</span>
            : 'Pay bill'}
      </button>
    </div>
  )
}
