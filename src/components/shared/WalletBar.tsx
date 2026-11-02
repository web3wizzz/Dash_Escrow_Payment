/**
 * WalletBar — top bar with brand name, USDC balance, and direct MetaMask connect button.
 * Uses wagmi useConnect/useDisconnect directly — no ConnectKit, no WalletConnect QR.
 * Never shows native balance. Always reads the 6-decimal ERC-20 USDC balance.
 */

import { useAccount, useConnect, useDisconnect, useReadContract } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { erc20Abi, formatUnits, type Address } from 'viem'
import { getUsdc } from '../../onchain-facts'
import { TARGET_CHAIN_ID, DISPLAY_NETWORK_NAME } from '../../config'
import { BRAND } from '../../../config/brand'
import { formatAddress } from '../../onchain-patterns-utils'
import { useState } from 'react'
import { ChevronDown, LogOut, Copy, Check } from 'lucide-react'

const usdcFact = getUsdc(TARGET_CHAIN_ID)
const USDC_ADDRESS = (usdcFact?.address ?? '0x3600000000000000000000000000000000000000') as Address
const USDC_DECIMALS = usdcFact?.decimals ?? 6

export function WalletBar() {
  const { address, isConnected } = useAccount()
  const { connect, isPending: isConnecting, error: connectError } = useConnect()
  const { disconnect } = useDisconnect()
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const { data: balanceRaw } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
    chainId: TARGET_CHAIN_ID,
  })

  const formatted = balanceRaw !== undefined
    ? parseFloat(formatUnits(balanceRaw, USDC_DECIMALS)).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : null

  const handleConnect = () => {
    connect({ connector: injected({ target: 'metaMask' }), chainId: TARGET_CHAIN_ID })
  }

  const handleCopy = () => {
    if (!address) return
    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <header className="flex items-center justify-between gap-3">
      <span
        className="display text-lg font-bold tracking-tight"
        style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
      >
        {BRAND.name}
      </span>

      <div className="flex items-center gap-2.5">
        {isConnected && formatted !== null && (
          <div className="flex items-center gap-1">
            <span
              className="display text-sm font-bold tabular-nums"
              style={{ color: 'var(--ink)' }}
            >
              {formatted}
            </span>
            <span className="text-xs" style={{ color: 'var(--subtle)' }}>
              USDC
            </span>
          </div>
        )}

        {isConnected && address ? (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--ink)',
                minHeight: 34,
              }}
            >
              <span className="size-1.5 rounded-full flex-shrink-0" style={{ background: '#1A7F4E' }} />
              <span className="mono">{formatAddress(address)}</span>
              <ChevronDown className="size-3" style={{ color: 'var(--subtle)' }} />
            </button>

            {menuOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
                {/* Menu */}
                <div
                  className="absolute right-0 top-full mt-1 z-50 rounded-xl overflow-hidden"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    boxShadow: '0 8px 24px rgba(14,16,48,0.12)',
                    minWidth: 180,
                  }}
                >
                  <div
                    className="px-3 py-2 text-[11px] font-semibold uppercase"
                    style={{ color: 'var(--subtle)', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)' }}
                  >
                    {DISPLAY_NETWORK_NAME}
                  </div>
                  <button
                    onClick={() => { handleCopy(); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-slate-50/60"
                    style={{ color: 'var(--ink)' }}
                  >
                    {copied ? <Check className="size-3.5" style={{ color: 'var(--success)' }} /> : <Copy className="size-3.5" style={{ color: 'var(--subtle)' }} />}
                    {copied ? 'Copied!' : 'Copy address'}
                  </button>
                  <div style={{ height: 1, background: 'var(--border)' }} />
                  <button
                    onClick={() => { disconnect(); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-slate-50/60"
                    style={{ color: 'var(--danger)' }}
                  >
                    <LogOut className="size-3.5" />
                    Disconnect
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
            style={{
              background: 'var(--saffron)',
              color: '#0A0B1E',
              minHeight: 34,
              border: 'none',
              cursor: isConnecting ? 'wait' : 'pointer',
            }}
          >
            {isConnecting ? 'Connecting…' : 'Connect Wallet'}
          </button>
        )}

        {connectError && (
          <span className="text-xs" style={{ color: 'var(--danger)' }}>
            {connectError.message.includes('rejected') ? 'Rejected' : 'Not installed'}
          </span>
        )}
      </div>
    </header>
  )
}
