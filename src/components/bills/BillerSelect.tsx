/**
 * BillerSelect — sandboxed biller list. Labeled "Sandbox" per spec.
 * In production, the biller list comes from on-chain isBiller mappings + a backend registry.
 */

import { type Address } from 'viem'

export interface Biller {
  id: Address
  name: string
  category: 'airtime' | 'data' | 'electricity' | 'water' | 'tv'
  description: string
  minAmount: bigint  // 6-decimal USDC
  maxAmount: bigint
}

// ---------------------------------------------------------------------------
// Sandbox biller list — replace with live data post-deploy
// ---------------------------------------------------------------------------

export const SANDBOX_BILLERS: Biller[] = [
  {
    id: (import.meta.env.VITE_PAY_ROUTER_ADDRESS ?? '0x0000000000000000000000000000000000000001') as Address,
    name: 'AirTel Mobile (Sandbox)',
    category: 'airtime',
    description: 'Top up any AirTel number.',
    minAmount: 500_000n,   // 0.50 USDC
    maxAmount: 25_000_000n, // 25 USDC
  },
  {
    id: (import.meta.env.VITE_PAY_ROUTER_ADDRESS ?? '0x0000000000000000000000000000000000000002') as Address,
    name: 'DataCo Internet (Sandbox)',
    category: 'data',
    description: 'Buy data bundles.',
    minAmount: 1_000_000n,
    maxAmount: 25_000_000n,
  },
  {
    id: (import.meta.env.VITE_PAY_ROUTER_ADDRESS ?? '0x0000000000000000000000000000000000000003') as Address,
    name: 'National Grid Power (Sandbox)',
    category: 'electricity',
    description: 'Pay your electricity bill.',
    minAmount: 2_000_000n,
    maxAmount: 25_000_000n,
  },
]

const CATEGORY_EMOJI: Record<Biller['category'], string> = {
  airtime: '📱',
  data: '📶',
  electricity: '⚡',
  water: '💧',
  tv: '📺',
}

// We use emoji here intentionally as category decorators, not branding
interface BillerSelectProps {
  selected: Biller | null
  onSelect: (biller: Biller) => void
}

export function BillerSelect({ selected, onSelect }: BillerSelectProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)', letterSpacing: '0.06em' }}>
          Billers
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
          style={{
            background: 'rgba(255, 180, 0, 0.12)',
            color: '#b45309',
            letterSpacing: '0.06em',
          }}
        >
          Sandbox
        </span>
      </div>

      {SANDBOX_BILLERS.map((biller) => (
        <button
          key={biller.id}
          onClick={() => onSelect(biller)}
          className="w-full text-left rounded-2xl p-3.5 transition-all"
          style={{
            background: selected?.id === biller.id
              ? 'rgba(16,97,166,0.10)'
              : 'rgba(255,255,255,0.46)',
            border: selected?.id === biller.id
              ? '1.5px solid rgba(16,97,166,0.30)'
              : '1px solid rgba(255,255,255,0.56)',
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl" role="img" aria-label={biller.category}>
              {CATEGORY_EMOJI[biller.category]}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                {biller.name}
              </p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                {biller.description}
              </p>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
