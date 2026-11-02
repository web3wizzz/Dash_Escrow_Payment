/**
 * WelcomeScreen — shown when wallet is not connected.
 *
 * Hero: DA$H logo mark on deep indigo, one-line descriptor.
 * CTA: single saffron "Connect Wallet" button.
 * Feature list: four restrained rows with Lucide icons.
 */

import { motion, useReducedMotion } from 'framer-motion'
import { useConnect } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { ArrowUpRight, Shield, Zap, CalendarClock } from 'lucide-react'
import { TARGET_CHAIN_ID, DISPLAY_NETWORK_NAME } from '../../config'
import { DashLogoMark } from './DashLogo'

const FEATURES = [
  {
    icon: ArrowUpRight,
    title: 'Send & Request',
    body: 'Pay any address or share a payment link instantly.',
  },
  {
    icon: Zap,
    title: 'Escrow',
    body: 'Funds held on-chain until service delivery is confirmed.',
  },
  {
    icon: CalendarClock,
    title: 'Scheduled Payouts',
    body: 'Allowances, vesting, payroll, and per-second streams.',
  },
  {
    icon: Shield,
    title: 'Non-custodial',
    body: 'Your keys remain yours. Every payment is individually signed.',
  },
]

export function WelcomeScreen() {
  const reduced = useReducedMotion()
  const { connect, isPending: isConnecting } = useConnect()

  const handleConnect = () => {
    connect({ connector: injected({ target: 'metaMask' }), chainId: TARGET_CHAIN_ID })
  }

  return (
    <div
      className="flex flex-col min-h-dvh"
      style={{ background: 'var(--bg)', fontFamily: '"Figtree",sans-serif' }}
    >
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div
        className="relative flex flex-col items-center justify-center px-6 pt-20 pb-16 text-center"
        style={{
          background: 'linear-gradient(165deg, #1B1F4B 0%, #0E1030 60%, #080A1C 100%)',
        }}
      >
        {/* Single restrained saffron glow behind the logo */}
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            bottom: -30, left: '50%', transform: 'translateX(-50%)',
            width: 280, height: 140,
            background: 'radial-gradient(ellipse, rgba(242,169,0,0.16) 0%, transparent 70%)',
            filter: 'blur(16px)',
          }}
        />

        <motion.div
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1.0] }}
          className="relative z-10 flex flex-col items-center gap-6"
        >
          {/* Logo — spring overshoot kept, but capped at 280ms */}
          <motion.div
            initial={reduced ? false : { scale: 0.90, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28, mass: 0.8 }}
          >
            <DashLogoMark size={72} />
          </motion.div>

          {/* Wordmark */}
          <div className="space-y-2.5">
            <h1
              style={{
                fontFamily: '"Bricolage Grotesque",sans-serif',
                fontWeight: 700,
                fontSize: '2rem',
                letterSpacing: '-0.04em',
                color: '#FFFFFF',
                lineHeight: 1,
              }}
            >
              DA$H
            </h1>
            <p
              style={{
                fontSize: 15,
                fontWeight: 400,
                color: 'rgba(255,255,255,0.52)',
                maxWidth: 240,
                lineHeight: 1.5,
              }}
            >
              USDC payments on Arc
            </p>
          </div>

          {/* Network pill */}
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)',
            }}
          >
            <span className="size-1.5 rounded-full" style={{ background: '#1A7F4E' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.46)', letterSpacing: '0.04em' }}>
              {DISPLAY_NETWORK_NAME} · USDC
            </span>
          </div>
        </motion.div>
      </div>

      {/* ── Connect + features ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col px-5 pt-7 pb-10 max-w-md mx-auto w-full">

        {/* Connect CTA */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.20, delay: reduced ? 0 : 0.08, ease: [0.25, 0.1, 0.25, 1.0] }}
          className="mb-7"
        >
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full"
            style={{
              background: 'var(--saffron)',
              color: '#0A0B1E',
              fontFamily: '"Figtree",sans-serif',
              fontWeight: 700,
              fontSize: 15,
              borderRadius: 14,
              minHeight: 54,
              border: 'none',
              cursor: isConnecting ? 'wait' : 'pointer',
              opacity: isConnecting ? 0.7 : 1,
              transition: 'background 0.14s ease, transform 0.10s ease, opacity 0.14s ease',
            }}
            onMouseEnter={(e) => { if (!isConnecting) e.currentTarget.style.background = 'var(--saffron-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--saffron)' }}
            onMouseDown={(e) => { if (!isConnecting) e.currentTarget.style.transform = 'scale(0.97)' }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          >
            {isConnecting ? 'Connecting…' : 'Connect Wallet'}
          </button>

          <p style={{ marginTop: 10, textAlign: 'center', fontSize: 12, color: 'var(--subtle)', fontFamily: '"Figtree",sans-serif' }}>
            Non-custodial · Your keys remain yours
          </p>
        </motion.div>

        {/* Feature rows */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {FEATURES.map(({ icon: Icon, title, body }, i) => (
            <motion.div
              key={title}
              initial={reduced ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: reduced ? 0 : 0.10 + i * 0.045, ease: [0.25, 0.1, 0.25, 1.0] }}
            >
              {i > 0 && <div style={{ height: 1, background: 'var(--border)', marginLeft: 54 }} />}
              <div className="flex items-center gap-3 px-4 py-3.5">
                <span
                  className="flex items-center justify-center rounded-lg flex-shrink-0"
                  style={{ width: 36, height: 36, background: 'var(--surface-muted)' }}
                >
                  <Icon className="size-4" style={{ color: 'var(--muted)' }} strokeWidth={1.8} />
                </span>
                <div>
                  <p style={{ fontFamily: '"Figtree",sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                    {title}
                  </p>
                  <p style={{ fontFamily: '"Figtree",sans-serif', fontSize: 12, color: 'var(--muted)', marginTop: 1, lineHeight: 1.4 }}>
                    {body}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Sandbox notice */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.22, delay: 0.50 }}
          style={{ marginTop: 18, textAlign: 'center', fontSize: 11, color: 'var(--subtle)', fontFamily: '"Figtree",sans-serif', lineHeight: 1.5 }}
        >
          Billers and KYC are sandboxed. No real-world services are connected.
        </motion.p>
      </div>
    </div>
  )
}
