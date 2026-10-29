/**
 * BillerCatalog — category chips, search bar, recents row, favorites section,
 * full list with loading/error/empty states.
 */

import { useState, useCallback } from 'react'
import { Search, Star, Clock, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  useBillers,
  BILLER_CATEGORIES,
  getRecentBillerIds,
  getFavoriteBillerIds,
  type Biller,
  type BillerCategory,
} from '../../lib/billers'
import { BillerCard } from './BillerCard'

interface BillerCatalogProps {
  selected: Biller | null
  onSelect: (biller: Biller) => void
}

const chipBase: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 12,
  borderRadius: 999,
  padding: '6px 14px',
  border: '1px solid var(--border)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'all 0.15s',
  minHeight: 36,
  letterSpacing: '0.01em',
}

function CategoryChips({
  active,
  onChange,
}: {
  active: BillerCategory | null
  onChange: (c: BillerCategory | null) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      <button
        style={{
          ...chipBase,
          background: active === null ? 'var(--navy)' : 'var(--surface-elevated)',
          color: active === null ? '#fff' : 'var(--ink-2)',
          borderColor: active === null ? 'var(--navy)' : 'var(--border)',
        }}
        onClick={() => onChange(null)}
      >
        All
      </button>
      {BILLER_CATEGORIES.map(cat => (
        <button
          key={cat}
          style={{
            ...chipBase,
            background: active === cat ? '#F3B51C' : 'var(--surface-elevated)',
            color: active === cat ? '#0A0F1E' : 'var(--ink-2)',
            borderColor: active === cat ? '#F3B51C' : 'var(--border)',
          }}
          onClick={() => onChange(cat === active ? null : cat)}
        >
          {cat}
        </button>
      ))}
    </div>
  )
}

function SkeletonRow() {
  return (
    <div className="rounded-2xl p-3.5 flex items-center gap-3 animate-pulse" style={{ background: 'rgba(27,31,75,0.04)' }}>
      <div className="size-10 rounded-xl shrink-0" style={{ background: 'rgba(27,31,75,0.07)' }} />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-32 rounded-full" style={{ background: 'rgba(27,31,75,0.07)' }} />
        <div className="h-2.5 w-20 rounded-full" style={{ background: 'rgba(27,31,75,0.05)' }} />
      </div>
    </div>
  )
}

export function BillerCatalog({ selected, onSelect }: BillerCatalogProps) {
  const [category, setCategory] = useState<BillerCategory | null>(null)
  const [query, setQuery] = useState('')
  const [favTick, setFavTick] = useState(0) // force re-read localStorage

  // Debounced query — 250ms is fine for a tiny local search
  const [debouncedQ, setDebouncedQ] = useState('')
  const handleQueryChange = (v: string) => {
    setQuery(v)
    clearTimeout((handleQueryChange as { _t?: ReturnType<typeof setTimeout> })._t)
    ;(handleQueryChange as { _t?: ReturnType<typeof setTimeout> })._t = setTimeout(() => setDebouncedQ(v), 250)
  }

  const { data: billers, isLoading, isError } = useBillers(
    category ?? undefined,
    debouncedQ || undefined,
  )

  const onFavChange = useCallback(() => setFavTick(t => t + 1), [])

  // Recents + favorites derived from full list when available
  const recentIds = getRecentBillerIds()
  const favIds = getFavoriteBillerIds()

  // Only show recents/favorites when no search query and no category filter
  const showShortcuts = !debouncedQ && !category

  const recentBillers = showShortcuts && billers
    ? billers.filter(b => recentIds.includes(b.id)).sort((a, b) => recentIds.indexOf(a.id) - recentIds.indexOf(b.id))
    : []

  const favBillers = showShortcuts && billers && favTick >= 0
    ? billers.filter(b => favIds.includes(b.id))
    : []

  return (
    <div className="space-y-4">
      {/* Search */}
      <div
        className="flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5"
        style={{
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border)',
          boxShadow: '0 1px 4px rgba(16,25,52,0.04)',
        }}
      >
        <Search className="size-4 shrink-0" style={{ color: 'var(--subtle)' }} />
        <input
          type="search"
          value={query}
          onChange={e => handleQueryChange(e.target.value)}
          placeholder="Search billers…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:opacity-50"
          style={{ color: 'var(--ink)' }}
        />
        {query && (
          <button onClick={() => { setQuery(''); setDebouncedQ('') }} className="shrink-0">
            <X className="size-4" style={{ color: 'var(--subtle)' }} />
          </button>
        )}
      </div>

      {/* Category chips */}
      <CategoryChips active={category} onChange={setCategory} />

      {/* Recents */}
      <AnimatePresence>
        {recentBillers.length > 0 && (
          <motion.div
            key="recents"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="space-y-2"
          >
            <div className="flex items-center gap-1.5">
              <Clock className="size-3.5" style={{ color: 'var(--subtle)' }} />
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)', letterSpacing: '0.06em' }}>
                Recent
              </span>
            </div>
            {recentBillers.map(b => (
              <BillerCard
                key={b.id}
                biller={b}
                selected={selected?.id === b.id}
                onSelect={onSelect}
                onFavoriteChange={onFavChange}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Favorites */}
      <AnimatePresence>
        {favBillers.length > 0 && (
          <motion.div
            key={`favs-${favTick}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="space-y-2"
          >
            <div className="flex items-center gap-1.5">
              <Star className="size-3.5" style={{ color: '#b37800' }} />
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)', letterSpacing: '0.06em' }}>
                Favorites
              </span>
            </div>
            {favBillers.map(b => (
              <BillerCard
                key={b.id}
                biller={b}
                selected={selected?.id === b.id}
                onSelect={onSelect}
                onFavoriteChange={onFavChange}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* All billers */}
      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)', letterSpacing: '0.06em' }}>
          {category ?? 'All billers'}
        </span>

        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        )}

        {isError && (
          <div
            className="rounded-2xl p-4 text-sm text-center"
            style={{ background: 'rgba(186,43,76,0.07)', color: 'var(--danger)' }}
          >
            Could not load billers. Make sure the backend is running.
          </div>
        )}

        {!isLoading && !isError && billers?.length === 0 && (
          <div
            className="rounded-2xl p-6 text-center space-y-1"
            style={{ background: 'rgba(27,31,75,0.04)' }}
          >
            <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>No billers found</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {debouncedQ ? `No results for "${debouncedQ}"` : 'No billers in this category yet.'}
            </p>
          </div>
        )}

        {!isLoading && billers && billers.length > 0 && (
          <AnimatePresence mode="popLayout">
            {billers.map((b, i) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, delay: Math.min(i * 0.03, 0.24) }}
              >
                <BillerCard
                  biller={b}
                  selected={selected?.id === b.id}
                  onSelect={onSelect}
                  onFavoriteChange={onFavChange}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
