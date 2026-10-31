/**
 * DA$H UI primitives — refined fintech components.
 * Visual only — no onchain logic.
 */

import { motion } from 'framer-motion'

// ─── Motion presets ──────────────────────────────────────────────────────────

// ─── Timing constants — all within 150–350 ms ────────────────────────────────
// State transitions: 150 ms. Content arrival: 180–220 ms. Sheets: spring.

export const springs = {
  snappy: { type: 'spring', stiffness: 500, damping: 38, mass: 0.8 } as const,
  gentle: { type: 'spring', stiffness: 320, damping: 32, mass: 0.9 } as const,
  sheet:  { type: 'spring', stiffness: 440, damping: 42, mass: 0.9 } as const,
  tab:    { type: 'spring', stiffness: 560, damping: 40, mass: 0.7 } as const,
}

export const fadeUp = {
  initial:    { opacity: 0, y: 6 },
  animate:    { opacity: 1, y: 0 },
  exit:       { opacity: 0 },
  transition: { duration: 0.18, ease: [0.25, 0.1, 0.25, 1.0] as [number,number,number,number] },
}

export const fadeIn = {
  initial:    { opacity: 0 },
  animate:    { opacity: 1 },
  exit:       { opacity: 0 },
  transition: { duration: 0.15 },
}

/**
 * stagger — use ONLY for initial list mount, not on re-renders.
 * Cap the delay so long lists don't produce > 350ms last-item delay.
 */
export function stagger(i: number) {
  const cappedDelay = Math.min(i * 0.055, 0.22)
  return {
    initial:    { opacity: 0, y: 6 },
    animate:    { opacity: 1, y: 0 },
    transition: {
      duration: 0.18,
      delay: cappedDelay,
      ease: [0.25, 0.1, 0.25, 1.0] as [number,number,number,number],
    },
  }
}

// ─── Card ────────────────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'glass' | 'flat' | 'navy' | 'muted'
  style?: React.CSSProperties
  onClick?: () => void
}

const cardVariantStyles: Record<string, React.CSSProperties> = {
  default: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    boxShadow: '0 2px 12px rgba(14,16,48,0.05)',
  },
  glass: {
    background: 'rgba(255,255,255,0.80)',
    backdropFilter: 'blur(28px) saturate(180%)',
    WebkitBackdropFilter: 'blur(28px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.70)',
    borderRadius: 20,
    boxShadow: '0 4px 20px rgba(14,16,48,0.06)',
  },
  flat: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    boxShadow: '0 1px 4px rgba(14,16,48,0.04)',
  },
  navy: {
    background: 'linear-gradient(150deg, #1B1F4B 0%, #0E1030 100%)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 24,
    boxShadow: '0 8px 32px rgba(8,10,30,0.40)',
  },
  muted: {
    background: 'var(--surface-muted)',
    border: '1px solid var(--border)',
    borderRadius: 16,
  },
}

export function Card({ children, className = '', variant = 'default', style, onClick }: CardProps) {
  return (
    <div
      className={className}
      style={{ ...cardVariantStyles[variant], ...style }}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

export function AnimCard({ delay = 0, ...props }: CardProps & { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay, ease: [0.25, 0.1, 0.25, 1.0] }}
    >
      <Card {...props} />
    </motion.div>
  )
}

// ─── Section label ───────────────────────────────────────────────────────────

export function SectionLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={`text-[10px] font-bold uppercase tracking-widest ${className}`}
      style={{ color: 'var(--muted)', letterSpacing: '0.10em' }}
    >
      {children}
    </p>
  )
}

// ─── Page header ─────────────────────────────────────────────────────────────

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string
  subtitle?: string
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between pt-1 pb-1">
      <div>
        <h1
          className="display text-2xl font-bold leading-tight"
          style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {right && <div className="flex items-center gap-2 mt-0.5 flex-shrink-0">{right}</div>}
    </div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden />
}

// ─── Badge ───────────────────────────────────────────────────────────────────

type BadgeVariant = 'sandbox' | 'success' | 'warning' | 'danger' | 'muted' | 'saffron' | 'navy'

const badgeStyles: Record<BadgeVariant, React.CSSProperties> = {
  sandbox: { background: 'rgba(242,169,0,0.12)', color: '#9A7000', border: '1px solid rgba(242,169,0,0.22)' },
  success: { background: 'rgba(26,127,78,0.10)',  color: 'var(--success-text)', border: '1px solid rgba(26,127,78,0.20)' },
  warning: { background: 'rgba(196,126,0,0.09)',  color: 'var(--warning)',       border: '1px solid rgba(196,126,0,0.20)' },
  danger:  { background: 'var(--danger-muted)',    color: 'var(--danger)',        border: '1px solid rgba(184,50,72,0.18)' },
  muted:   { background: 'var(--surface-muted)',   color: 'var(--muted)',         border: '1px solid var(--border)' },
  saffron: { background: 'var(--saffron)',          color: '#0E1030',             border: 'none' },
  navy:    { background: 'var(--ink)',              color: '#fff',                border: 'none' },
}

export function Badge({
  variant = 'muted',
  children,
  className = '',
}: {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${className}`}
      style={{ letterSpacing: '0.09em', ...badgeStyles[variant] }}
    >
      {children}
    </span>
  )
}

// ─── Divider ─────────────────────────────────────────────────────────────────

export function Divider({ className = '' }: { className?: string }) {
  return <div className={`h-px ${className}`} style={{ background: 'var(--border)' }} />
}

// ─── Row item ────────────────────────────────────────────────────────────────

export function RowItem({
  icon,
  label,
  sublabel,
  right,
  onClick,
}: {
  icon?: React.ReactNode
  label: React.ReactNode
  sublabel?: React.ReactNode
  right?: React.ReactNode
  onClick?: () => void
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      className="flex items-center gap-3 w-full text-left min-h-[52px] transition-colors"
      style={{ background: 'transparent' }}
      onClick={onClick}
    >
      {icon && (
        <span className="flex size-9 items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'var(--surface-muted)' }}>
          {icon}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>{label}</div>
        {sublabel && <div className="text-xs truncate mt-0.5" style={{ color: 'var(--muted)' }}>{sublabel}</div>}
      </div>
      {right && <div className="flex-shrink-0 text-right">{right}</div>}
    </Tag>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode
  title: string
  body?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-3">
      <span
        className="flex size-12 items-center justify-center rounded-2xl"
        style={{ background: 'var(--surface-muted)', color: 'var(--subtle)' }}
      >
        {icon}
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{title}</p>
        {body && <p className="text-xs max-w-[220px] mx-auto leading-relaxed" style={{ color: 'var(--muted)' }}>{body}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

// ─── Status pill ──────────────────────────────────────────────────────────────

export function StatusPill({ status }: { status: 'pending' | 'success' | 'error' | 'warning' }) {
  const map: Record<string, { label: string; style: React.CSSProperties }> = {
    pending: { label: 'Pending',   style: { background: 'rgba(196,126,0,0.09)', color: 'var(--warning)' } },
    success: { label: 'Confirmed', style: { background: 'var(--success-muted)', color: 'var(--success-text)' } },
    error:   { label: 'Failed',    style: { background: 'var(--danger-muted)',  color: 'var(--danger)' } },
    warning: { label: 'Expiring',  style: { background: 'rgba(196,126,0,0.09)', color: 'var(--warning)' } },
  }
  const { label, style } = map[status]
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={style}>
      {label}
    </span>
  )
}
