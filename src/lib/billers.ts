/**
 * Biller catalog — types and fetch helpers.
 * The backend serves GET /api/billers (proxied by Vite to localhost:3001).
 */

import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'

// ---------------------------------------------------------------------------
// Types (mirrors server/index.ts)
// ---------------------------------------------------------------------------

export type BillerCategory = 'Airtime' | 'Data' | 'Electricity' | 'Cable TV' | 'Arc apps'

export const BILLER_CATEGORIES: BillerCategory[] = [
  'Airtime', 'Data', 'Electricity', 'Cable TV', 'Arc apps',
]

export interface BillerField {
  name: string
  label: string
  placeholder: string
  type: 'text' | 'number' | 'tel'
  pattern?: string
  hint?: string
}

export interface Biller {
  id: Address          // on-chain billerAddress
  slug: string
  name: string
  category: BillerCategory
  sandbox: boolean
  demo?: boolean
  requiredFields: BillerField[]
  minAmount: number    // 6-decimal USDC units
  maxAmount: number
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

async function fetchBillers(category?: BillerCategory, q?: string): Promise<Biller[]> {
  const params = new URLSearchParams()
  if (category) params.set('category', category)
  if (q) params.set('q', q)
  const url = `/api/billers${params.size ? `?${params.toString()}` : ''}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load billers (${res.status})`)
  return res.json() as Promise<Biller[]>
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBillers(category?: BillerCategory, q?: string) {
  return useQuery({
    queryKey: ['billers', category ?? 'all', q ?? ''],
    queryFn: () => fetchBillers(category, q),
    staleTime: 5 * 60_000,
  })
}

// ---------------------------------------------------------------------------
// Local storage — recents and favorites
// ---------------------------------------------------------------------------

const RECENTS_KEY = 'dash_bill_recents'
const FAVS_KEY    = 'dash_bill_favs'
const MAX_RECENTS = 6

export function getRecentBillerIds(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]') as string[] }
  catch { return [] }
}

export function recordRecentBiller(id: string) {
  const prev = getRecentBillerIds().filter(x => x !== id)
  localStorage.setItem(RECENTS_KEY, JSON.stringify([id, ...prev].slice(0, MAX_RECENTS)))
}

export function getFavoriteBillerIds(): string[] {
  try { return JSON.parse(localStorage.getItem(FAVS_KEY) ?? '[]') as string[] }
  catch { return [] }
}

export function toggleFavoriteBiller(id: string) {
  const prev = getFavoriteBillerIds()
  const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  localStorage.setItem(FAVS_KEY, JSON.stringify(next))
}

export function isFavorite(id: string): boolean {
  return getFavoriteBillerIds().includes(id)
}
