/**
 * WelcomeScreen — shown when wallet is not connected.
 * Premium onboarding with product positioning and clear connect CTA.
 */

import { motion } from 'framer-motion'
import { ConnectKitButton } from 'connectkit'
import { ArrowUpRight, Shield, Zap, CalendarClock } from 'lucide-react'
import { TARGET_CHAIN_ID } from '../../config'
import { DashWordmark, DashIcon } from './DashLogo'

const NETWORK_LABEL = TARGET_CHAIN_ID === 5042 ? 'Arc Mainnet' : 'Arc Testnet'

const features = [
  {
    icon: ArrowUpRight,
    title: 'Send & Request',
    body: 'Pay anyone by @handle or address. Share a payment link in seconds.',
  },
  {
    icon: Zap,
    title: 'Escrow & Invoicing',
    body: 'On-chain escrow for services and freelance work. Funds release only on fulfillment.',
  },
  {
    icon: CalendarClock,
    title: 'Scheduled Payouts',
    body: 'Allowances, vesting, payroll, and live per-second streams.',
  },
  {
    icon: Shield,
    title: 'Non-custodial',
    body: 'Your keys, your USDC. Every payment is individually signed.',
  },
]

export function WelcomeScreen() {
  return (
    <div className="flex flex-col min-h-dvh" style={{ background: 'var(--bg)' }}>
      {/* Top: Brand hero */}
      <div
        className="relative overflow-hidden flex flex-col items-center justify-center px-6 pt-16 pb-14 text-center"
        style={{
          background: 'linear-gradient(160deg, #0D1628 0%, #141F40 55%, #0A1020 100%)',
        }}
      >
        {/* Subtle glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 70% 55% at 50% 70%, rgba(243,181,28,0.14) 0%, transparent 70%)',
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: [0.25, 0.1, 0.25, 1.0] }}
          className="relative z-10 flex flex-col items-center gap-5"
        >
          {/* Icon mark */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.42, ease: [0.34, 1.2, 0.64, 1] }}
            style={{
              filter: 'drop-shadow(0 0 28px rgba(243,181,28,0.38))',
            }}
          >
            <DashIcon size={72} dark />
          </motion.div>

          <div className="space-y-3">
            {/* Wordmark */}
            <div className="flex justify-center">
              <DashWordmark direction="A" height={38} light={false} />
            </div>
            <p
              className="text-base font-medium max-w-[260px] mx-auto leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.60)' }}
            >
              The premium USDC payment platform on Arc
            </p>
          </div>

          {/* Arc indicator */}
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <span
              className="size-1.5 rounded-full"
              style={{ background: '#18A58B' }}
            />
            <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {NETWORK_LABEL} · USDC
            </span>
          </div>
        </motion.div>
      </div>

      {/* Bottom: Connect + features */}
      <div className="flex-1 flex flex-col px-5 pt-8 pb-10 max-w-md mx-auto w-full">
        {/* Connect CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.30, delay: 0.12, ease: [0.25, 0.1, 0.25, 1.0] }}
          className="mb-8"
        >
          <ConnectKitButton.Custom>
            {({ show }) => (
              <button
                onClick={show}
                className="w-full py-4 text-base font-bold btn-gold-large"
                style={{
                  background: '#F3B51C',
                  color: '#080F22',
                  borderRadius: '16px',
                  boxShadow: '0 4px 20px rgba(243,181,28,0.40), 0 1px 0 rgba(255,255,255,0.25) inset',
                  transition: 'transform 0.1s ease, box-shadow 0.15s ease',
                  minHeight: 56,
                }}
                onMouseEnter={(e) => { (e.currentTarget).style.boxShadow = '0 6px 28px rgba(243,181,28,0.55), 0 1px 0 rgba(255,255,255,0.25) inset' }}
                onMouseLeave={(e) => { (e.currentTarget).style.boxShadow = '0 4px 20px rgba(243,181,28,0.40), 0 1px 0 rgba(255,255,255,0.25) inset' }}
              >
                Connect Wallet
              </button>
            )}
          </ConnectKitButton.Custom>

          <p className="mt-3 text-center text-xs" style={{ color: 'var(--muted)' }}>
            Non-custodial · Your keys remain yours
          </p>
        </motion.div>

        {/* Feature tiles */}
        <div className="grid grid-cols-2 gap-3">
          {features.map(({ icon: Icon, title, body }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: 0.18 + i * 0.06, ease: [0.25, 0.1, 0.25, 1.0] }}
              className="rounded-2xl p-4"
              style={{
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border)',
                boxShadow: '0 2px 8px rgba(16,25,52,0.04)',
              }}
            >
              <span
                className="flex size-8 items-center justify-center rounded-xl mb-3"
                style={{ background: 'var(--gold-muted)' }}
              >
                <Icon className="size-4" style={{ color: '#A07210' }} strokeWidth={2} />
              </span>
              <p className="text-xs font-bold mb-1" style={{ color: 'var(--ink)' }}>{title}</p>
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>{body}</p>
            </motion.div>
          ))}
        </div>

        {/* Sandbox notice */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.24, delay: 0.48 }}
          className="mt-6 text-center text-[11px] leading-relaxed"
          style={{ color: 'var(--subtle)' }}
        >
          Billers and KYC are sandboxed. No real-world services are connected.
        </motion.p>
      </div>
    </div>
  )
}
