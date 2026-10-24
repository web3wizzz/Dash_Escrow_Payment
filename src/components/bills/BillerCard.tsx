/**
 * BillerCard — single biller row with name, category, sandbox badge, favorite toggle.
 */

import { Heart, Zap, Phone, Wifi, Tv2, Cpu } from 'lucide-react'
import type { Biller, BillerCategory } from '../../lib/billers'
import { isFavorite, toggleFavoriteBiller } from '../../lib/billers'
import { useState } from 'react'

const CATEGORY_ICON: Record<BillerCategory, React.FC<{ className?: string; style?: React.CSSProperties }>> = {
  'Airtime':     Phone,
  'Data':        Wifi,
  'Electricity': Zap,
  'Cable TV':    Tv2,
  'Arc apps':    Cpu,
}

const CATEGORY_COLOR: Record<BillerCategory, string> = {
  'Airtime':     'rgba(242,169,0,0.15)',
  'Data':        'rgba(14,16,48,0.10)',
  'Electricity': 'rgba(242,169,0,0.15)',
  'Cable TV':    'rgba(27,31,75,0.08)',
  'Arc apps':    'rgba(14,16,48,0.10)',
}

const CATEGORY_ICON_COLOR: Record<BillerCategory, string> = {
  'Airtime':     '#b37800',
  'Data':        'var(--ink)',
  'Electricity': '#b37800',
  'Cable TV':    'var(--ink)',
  'Arc apps':    'var(--ink)',
}

interface BillerCardProps {
  biller: Biller
  selected?: boolean
  onSelect: (biller: Biller) => void
  onFavoriteChange?: () => void
}

export function BillerCard({ biller, selected, onSelect, onFavoriteChange }: BillerCardProps) {
  const [fav, setFav] = useState(() => isFavorite(biller.id))
  const Icon = CATEGORY_ICON[biller.category]

  const handleFav = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleFavoriteBiller(biller.id)
    setFav(f => !f)
    onFavoriteChange?.()
  }

  return (
    <button
      onClick={() => onSelect(biller)}
      className="w-full text-left rounded-2xl p-3.5 transition-all active:scale-[0.98] min-h-[56px]"
      style={{
        background: selected ? 'rgba(27,31,75,0.07)' : 'rgba(255,255,255,0.72)',
        border: selected
          ? '1.5px solid rgba(27,31,75,0.25)'
          : '1px solid rgba(27,31,75,0.08)',
        boxShadow: selected ? 'none' : '0 1px 4px rgba(27,31,75,0.04)',
      }}
    >
      <div className="flex items-center gap-3">
        {/* Category icon */}
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: CATEGORY_COLOR[biller.category] }}
        >
          <Icon className="size-4.5" style={{ color: CATEGORY_ICON_COLOR[biller.category] }} />
        </div>

        {/* Name + badges */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>
              {biller.name}
            </span>
            {biller.sandbox && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide shrink-0"
                style={{
                  background: 'rgba(242,169,0,0.14)',
                  color: '#b37800',
                  letterSpacing: '0.06em',
                }}
              >
                {biller.demo ? 'Demo' : 'Sandbox'}
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            {biller.category}
          </p>
        </div>

        {/* Favorite button */}
        <button
          onClick={handleFav}
          aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}
          className="shrink-0 flex size-8 items-center justify-center rounded-xl transition-all"
          style={{
            background: fav ? 'rgba(242,169,0,0.14)' : 'transparent',
            color: fav ? '#b37800' : 'var(--subtle)',
          }}
        >
          <Heart className="size-4" fill={fav ? 'currentColor' : 'none'} />
        </button>
      </div>
    </button>
  )
}
