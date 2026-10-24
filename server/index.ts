/**
 * Dash bills backend — serves biller catalog.
 * Runs on port 3001; Vite proxies /api → here.
 *
 * POST /billers is not implemented — this is a read-only sandbox catalog.
 * All billers are marked sandbox:true.
 * "Arc apps" billers are clearly fictional demo entries with no real affiliation.
 */

import { serve } from 'bun'

// ---------------------------------------------------------------------------
// Biller catalog types
// ---------------------------------------------------------------------------

export type BillerCategory = 'Airtime' | 'Data' | 'Electricity' | 'Cable TV' | 'Arc apps'

export interface BillerField {
  name: string
  label: string
  placeholder: string
  type: 'text' | 'number' | 'tel'
  pattern?: string
  hint?: string
}

export interface Biller {
  id: string           // billerAddress on-chain (deterministic from slug)
  slug: string
  name: string
  category: BillerCategory
  sandbox: boolean
  demo?: boolean       // true = fictional demo biller in "Arc apps"
  requiredFields: BillerField[]
  minAmount: number    // USDC cents (6-decimal units)
  maxAmount: number
}

// ---------------------------------------------------------------------------
// Deterministic sandbox biller addresses
// All sandbox billers share one treasury — the same address with different IDs.
// These are deterministic low-value addresses used only as on-chain identifiers.
// ---------------------------------------------------------------------------

const addr = (n: number): string =>
  `0x${n.toString(16).padStart(40, '0')}`

// Shared sandbox treasury (placeholder — set VITE_SANDBOX_TREASURY in .env after deploy)
// In the frontend, treasury lookup comes from isBiller/billerTreasury on the contract.

const phoneField: BillerField = {
  name: 'phone',
  label: 'Phone number',
  placeholder: '080xxxxxxxx',
  type: 'tel',
  pattern: '^0[789][01]\\d{8}$',
  hint: 'Nigerian mobile number, 11 digits',
}

const meterField: BillerField = {
  name: 'meterNumber',
  label: 'Meter number',
  placeholder: 'e.g. 12345678901',
  type: 'text',
  pattern: '^\\d{11,13}$',
  hint: '11–13 digit prepaid meter number',
}

const smartcardField: BillerField = {
  name: 'smartcardNumber',
  label: 'Smartcard / IUC number',
  placeholder: 'e.g. 1234567890',
  type: 'text',
  pattern: '^\\d{10}$',
  hint: '10-digit number on your decoder',
}

const walletField: BillerField = {
  name: 'walletAddress',
  label: 'Destination wallet',
  placeholder: '0x...',
  type: 'text',
  pattern: '^0x[0-9a-fA-F]{40}$',
  hint: 'EVM wallet address to receive the item',
}

// ---------------------------------------------------------------------------
// Seeded catalog
// ---------------------------------------------------------------------------

const BILLERS: Biller[] = [
  // ── Airtime ──────────────────────────────────────────────────────────────
  {
    id: addr(0x1001),
    slug: 'mtn-airtime',
    name: 'MTN Airtime',
    category: 'Airtime',
    sandbox: true,
    requiredFields: [phoneField],
    minAmount: 500_000,
    maxAmount: 25_000_000,
  },
  {
    id: addr(0x1002),
    slug: 'airtel-airtime',
    name: 'Airtel Airtime',
    category: 'Airtime',
    sandbox: true,
    requiredFields: [phoneField],
    minAmount: 500_000,
    maxAmount: 25_000_000,
  },
  {
    id: addr(0x1003),
    slug: 'glo-airtime',
    name: 'Glo Airtime',
    category: 'Airtime',
    sandbox: true,
    requiredFields: [phoneField],
    minAmount: 500_000,
    maxAmount: 25_000_000,
  },
  {
    id: addr(0x1004),
    slug: '9mobile-airtime',
    name: '9mobile Airtime',
    category: 'Airtime',
    sandbox: true,
    requiredFields: [phoneField],
    minAmount: 500_000,
    maxAmount: 25_000_000,
  },

  // ── Data ─────────────────────────────────────────────────────────────────
  {
    id: addr(0x2001),
    slug: 'mtn-data',
    name: 'MTN Data Bundle',
    category: 'Data',
    sandbox: true,
    requiredFields: [phoneField],
    minAmount: 1_000_000,
    maxAmount: 25_000_000,
  },
  {
    id: addr(0x2002),
    slug: 'airtel-data',
    name: 'Airtel Data Bundle',
    category: 'Data',
    sandbox: true,
    requiredFields: [phoneField],
    minAmount: 1_000_000,
    maxAmount: 25_000_000,
  },
  {
    id: addr(0x2003),
    slug: 'glo-data',
    name: 'Glo Data Bundle',
    category: 'Data',
    sandbox: true,
    requiredFields: [phoneField],
    minAmount: 1_000_000,
    maxAmount: 25_000_000,
  },
  {
    id: addr(0x2004),
    slug: '9mobile-data',
    name: '9mobile Data Bundle',
    category: 'Data',
    sandbox: true,
    requiredFields: [phoneField],
    minAmount: 1_000_000,
    maxAmount: 25_000_000,
  },

  // ── Electricity ───────────────────────────────────────────────────────────
  {
    id: addr(0x3001),
    slug: 'ekedc',
    name: 'EKEDC (Eko Electric)',
    category: 'Electricity',
    sandbox: true,
    requiredFields: [meterField],
    minAmount: 2_000_000,
    maxAmount: 25_000_000,
  },
  {
    id: addr(0x3002),
    slug: 'ikedc',
    name: 'IKEDC (Ikeja Electric)',
    category: 'Electricity',
    sandbox: true,
    requiredFields: [meterField],
    minAmount: 2_000_000,
    maxAmount: 25_000_000,
  },
  {
    id: addr(0x3003),
    slug: 'aedc',
    name: 'AEDC (Abuja Electric)',
    category: 'Electricity',
    sandbox: true,
    requiredFields: [meterField],
    minAmount: 2_000_000,
    maxAmount: 25_000_000,
  },
  {
    id: addr(0x3004),
    slug: 'phedc',
    name: 'PHEDC (Port Harcourt Electric)',
    category: 'Electricity',
    sandbox: true,
    requiredFields: [meterField],
    minAmount: 2_000_000,
    maxAmount: 25_000_000,
  },
  {
    id: addr(0x3005),
    slug: 'kedco',
    name: 'KEDCO (Kano Electric)',
    category: 'Electricity',
    sandbox: true,
    requiredFields: [meterField],
    minAmount: 2_000_000,
    maxAmount: 25_000_000,
  },

  // ── Cable TV ─────────────────────────────────────────────────────────────
  {
    id: addr(0x4001),
    slug: 'dstv',
    name: 'DStv Subscription',
    category: 'Cable TV',
    sandbox: true,
    requiredFields: [smartcardField],
    minAmount: 3_000_000,
    maxAmount: 25_000_000,
  },
  {
    id: addr(0x4002),
    slug: 'gotv',
    name: 'GOtv Subscription',
    category: 'Cable TV',
    sandbox: true,
    requiredFields: [smartcardField],
    minAmount: 1_500_000,
    maxAmount: 25_000_000,
  },
  {
    id: addr(0x4003),
    slug: 'startimes',
    name: 'StarTimes Subscription',
    category: 'Cable TV',
    sandbox: true,
    requiredFields: [smartcardField],
    minAmount: 1_500_000,
    maxAmount: 25_000_000,
  },

  // ── Arc apps (fictional demo billers — no real affiliation) ──────────────
  {
    id: addr(0x5001),
    slug: 'demo-nft-shop',
    name: 'Demo NFT Shop',
    category: 'Arc apps',
    sandbox: true,
    demo: true,
    requiredFields: [walletField],
    minAmount: 1_000_000,
    maxAmount: 25_000_000,
  },
  {
    id: addr(0x5002),
    slug: 'demo-launchpad',
    name: 'Demo Launchpad Entry',
    category: 'Arc apps',
    sandbox: true,
    demo: true,
    requiredFields: [walletField],
    minAmount: 2_000_000,
    maxAmount: 25_000_000,
  },
  {
    id: addr(0x5003),
    slug: 'demo-game-credits',
    name: 'Demo Game Credits',
    category: 'Arc apps',
    sandbox: true,
    demo: true,
    requiredFields: [walletField],
    minAmount: 500_000,
    maxAmount: 25_000_000,
  },
]

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
}

serve({
  port: 3001,
  fetch(req) {
    const url = new URL(req.url)

    // Preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    // GET /billers
    if (req.method === 'GET' && url.pathname === '/billers') {
      const category = url.searchParams.get('category')
      const q = url.searchParams.get('q')?.toLowerCase()

      let result = BILLERS
      if (category) result = result.filter(b => b.category === category)
      if (q) result = result.filter(b => b.name.toLowerCase().includes(q) || b.category.toLowerCase().includes(q))

      return new Response(JSON.stringify(result), { headers: CORS_HEADERS })
    }

    // GET /billers/:id
    if (req.method === 'GET' && url.pathname.startsWith('/billers/')) {
      const id = url.pathname.slice('/billers/'.length)
      const biller = BILLERS.find(b => b.id === id || b.slug === id)
      if (!biller) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: CORS_HEADERS })
      return new Response(JSON.stringify(biller), { headers: CORS_HEADERS })
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: CORS_HEADERS })
  },
})

console.log('Bills API running on http://localhost:3001')
