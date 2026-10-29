/**
 * ScheduleForm — dynamic fields per schedule type, amount, revocable toggle,
 * Permit2 sign + deposit flow.
 * Payroll renders a multi-recipient row list; all other types are single-recipient.
 */

import { useState } from 'react'
import { useAccount, useSignTypedData } from 'wagmi'
import { type Address, type Hex, parseUnits, isAddress } from 'viem'
import { Lock, Plus, Trash2, Loader2, Info } from 'lucide-react'
import { ScheduleType, type ScheduleTypeValue } from '../../lib/schedules'
import { ScheduleTypeSelect } from './ScheduleTypeSelect'
import { TxStatus } from '../shared/TxStatus'
import { useDeposit } from '../../hooks/useScheduledPayouts'

interface ScheduleFormProps {
  /** Called with the new scheduleId(s) after successful deposit */
  onSuccess?: (ids: Hex[]) => void
}

interface RecipientRow {
  address: string
  amount: string
}

const USDC_DECIMALS = 6

function parseDateToSec(dateStr: string): bigint {
  if (!dateStr) return 0n
  return BigInt(Math.floor(new Date(dateStr).getTime() / 1000))
}

function nowPlusDays(days: number): string {
  const d = new Date(Date.now() + days * 86400_000)
  return d.toISOString().slice(0, 16)
}

export function ScheduleForm({ onSuccess }: ScheduleFormProps) {
  const { address, isConnected } = useAccount()
  const { signTypedDataAsync } = useSignTypedData()
  const { deposit, hash, isPending, isConfirming, isSuccess, isError, error, reset } = useDeposit()

  const [scheduleType, setScheduleType] = useState<ScheduleTypeValue>(ScheduleType.PayLater)
  const [revocable, setRevocable] = useState(true)

  // Single-recipient fields
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [endDate, setEndDate] = useState(nowPlusDays(7))
  const [startDate, setStartDate] = useState('')
  const [cliffDate, setCliffDate] = useState('')
  const [period, setPeriod] = useState('7') // days
  const [periodAmount, setPeriodAmount] = useState('')

  // Payroll — multi-recipient
  const [payrollRows, setPayrollRows] = useState<RecipientRow[]>([{ address: '', amount: '' }])
  const [payrollPeriod, setPayrollPeriod] = useState('30') // days

  const isPayroll = scheduleType === ScheduleType.Payroll

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  const recipientValid = isPayroll
    ? payrollRows.every(r => isAddress(r.address) && parseFloat(r.amount) > 0)
    : isAddress(recipient)

  const amountBig = (() => {
    try { return amount ? parseUnits(amount, USDC_DECIMALS) : 0n } catch { return 0n }
  })()

  const ready = isConnected && recipientValid && (isPayroll ? true : amountBig > 0n)

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleSubmit = async () => {
    if (!address) return
    const now = BigInt(Math.floor(Date.now() / 1000))

    try {
      if (isPayroll) {
        const ids: Hex[] = []
        for (const row of payrollRows) {
          const rowAmount = parseUnits(row.amount, USDC_DECIMALS)
          const periodSec = BigInt(parseInt(payrollPeriod) * 86400)
          const id = await deposit({
            recipient: row.address as Address,
            scheduleType: ScheduleType.Payroll,
            revocable,
            totalAmount: rowAmount,
            startTime: now,
            endTime: now + periodSec * 52n, // ~1 year of periods
            cliffEnd: 0n,
            period: periodSec,
            periodAmount: rowAmount, // full amount per period (single disbursement) — adjust UX as needed
            signTypedDataAsync: signTypedDataAsync as unknown as (args: object) => Promise<Hex>,
          })
          ids.push(id)
        }
        onSuccess?.(ids)
        return
      }

      const endSec = parseDateToSec(endDate)
      const startSec = startDate ? parseDateToSec(startDate) : now
      const cliffSec = cliffDate ? parseDateToSec(cliffDate) : startSec
      const periodSec = BigInt(parseInt(period) * 86400)
      const periodAmountBig = periodAmount ? parseUnits(periodAmount, USDC_DECIMALS) : amountBig

      const id = await deposit({
        recipient: recipient as Address,
        scheduleType,
        revocable,
        totalAmount: amountBig,
        startTime: scheduleType === ScheduleType.PayLater ? 0n : startSec,
        endTime: endSec,
        cliffEnd: scheduleType === ScheduleType.Vesting ? cliffSec : 0n,
        period: (scheduleType === ScheduleType.Allowance) ? periodSec : 0n,
        periodAmount: (scheduleType === ScheduleType.Allowance) ? periodAmountBig : 0n,
        signTypedDataAsync: signTypedDataAsync as unknown as (args: object) => Promise<Hex>,
      })
      onSuccess?.([id])
    } catch {
      // error surfaced by TxStatus
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-5">
      <ScheduleTypeSelect value={scheduleType} onChange={setScheduleType} />

      {/* Recipient(s) */}
      {isPayroll ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)', letterSpacing: '0.06em' }}>
            Recipients
          </p>
          {payrollRows.map((row, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="field-input flex-1"
                placeholder="0x… address"
                value={row.address}
                onChange={e => setPayrollRows(rows => rows.map((r, j) => j === i ? { ...r, address: e.target.value } : r))}
              />
              <input
                inputMode="decimal"
                className="field-input tabular-nums"
                style={{ width: '6rem' }}
                placeholder="USDC"
                value={row.amount}
                onChange={e => setPayrollRows(rows => rows.map((r, j) => j === i ? { ...r, amount: e.target.value.replace(/[^0-9.]/g, '') } : r))}
              />
              {payrollRows.length > 1 && (
                <button
                  onClick={() => setPayrollRows(rows => rows.filter((_, j) => j !== i))}
                  className="flex items-center justify-center rounded-xl transition-colors active:scale-95"
                  style={{ width: 44, height: 44, background: 'var(--danger-muted)', flexShrink: 0 }}
                >
                  <Trash2 className="size-4" style={{ color: 'var(--danger)' }} />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => setPayrollRows(r => [...r, { address: '', amount: '' }])}
            className="flex items-center gap-1.5 text-xs font-bold min-h-[44px] px-3 rounded-2xl transition-all active:scale-95"
            style={{ color: '#9A6E00', background: 'var(--gold-muted)', border: '1px solid rgba(243,181,28,0.25)' }}
          >
            <Plus className="size-3.5" /> Add recipient
          </button>
          <label className="flex items-center gap-3 text-xs" style={{ color: 'var(--ink)' }}>
            <span className="font-semibold" style={{ color: 'var(--muted)' }}>Payroll period (days)</span>
            <input
              type="number"
              min={1}
              value={payrollPeriod}
              onChange={e => setPayrollPeriod(e.target.value)}
              className="field-input tabular-nums"
              style={{ width: '5rem' }}
            />
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          <Field label="Recipient address">
            <input className="field-input" placeholder="0x…" value={recipient} onChange={e => setRecipient(e.target.value)} />
          </Field>
          <Field label="Total amount (USDC)">
            <input inputMode="decimal" className="field-input tabular-nums" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} />
          </Field>
          {scheduleType !== ScheduleType.PayLater && (
            <Field label="Start date">
              <input type="datetime-local" className="field-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </Field>
          )}
          <Field label={scheduleType === ScheduleType.PayLater ? 'Unlock date' : 'End date'}>
            <input type="datetime-local" className="field-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </Field>
          {scheduleType === ScheduleType.Vesting && (
            <Field label="Cliff date">
              <input type="datetime-local" className="field-input" value={cliffDate} onChange={e => setCliffDate(e.target.value)} />
            </Field>
          )}
          {scheduleType === ScheduleType.Allowance && (
            <>
              <Field label="Period (days)">
                <input type="number" min={1} className="field-input" value={period} onChange={e => setPeriod(e.target.value)} />
              </Field>
              <Field label="Amount per period (USDC)">
                <input inputMode="decimal" className="field-input tabular-nums" placeholder="0.00" value={periodAmount} onChange={e => setPeriodAmount(e.target.value.replace(/[^0-9.]/g, ''))} />
              </Field>
            </>
          )}
        </div>
      )}

      {/* Revocable toggle */}
      <div
        className="flex items-start gap-3 rounded-2xl px-4 py-3.5"
        style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
      >
        <Info className="size-4 mt-0.5 shrink-0" style={{ color: 'var(--muted)' }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Revocable</p>
            <button
              type="button"
              role="switch"
              aria-checked={revocable}
              onClick={() => setRevocable(v => !v)}
              className="relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none"
              style={{ background: revocable ? '#F2A900' : 'rgba(27,31,75,0.18)' }}
            >
              <span className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform mt-0.5" style={{ transform: revocable ? 'translateX(22px)' : 'translateX(2px)' }} />
            </button>
          </div>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
            {revocable
              ? 'You can cancel this schedule. Unlocked funds go to the recipient; the rest returns to you.'
              : 'This schedule cannot be cancelled by anyone. Funds are locked until fully unlocked.'}
          </p>
        </div>
      </div>

      <TxStatus isPending={isPending} isConfirming={isConfirming} isSuccess={isSuccess} isError={isError} error={error} hash={hash} successMessage="Schedule created." onDismiss={reset} />

      <button
        onClick={() => { void handleSubmit() }}
        disabled={!ready || isPending || isConfirming}
        className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
        style={{
          background: ready && !isPending && !isConfirming ? '#F3B51C' : 'var(--surface-muted)',
          color: ready && !isPending && !isConfirming ? '#0A0F1E' : 'var(--muted)',
          boxShadow: ready && !isPending && !isConfirming ? '0 2px 12px rgba(243,181,28,0.35)' : 'none',
          minHeight: 54,
          transition: 'all 0.2s ease',
        }}
      >
        {isPending
          ? <><Loader2 className="size-4 animate-spin" />Confirm in wallet…</>
          : isConfirming
          ? <><Loader2 className="size-4 animate-spin" />Confirming on Arc…</>
          : <><Lock className="size-4" />Create schedule</>
        }
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label
        className="text-[11px] font-bold uppercase block"
        style={{ color: 'var(--muted)', letterSpacing: '0.09em' }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}


