/**
 * Dash UI primitives — reusable building blocks.
 * All visual-only; no onchain logic here.
 */

import { motion } from 'framer-motion'

// ─── Motion presets ──────────────────────────────────────────────────────────

export const springs = {
  snappy: { type: 'spring', stiffness: 420, damping: 32 } as const,
  gentle: { type: 'spring', stiffness: 300, damping: 26 } as const,
  sheet:  { type: 'spring', stiffness: 400, damping: 36 } as const,
}

export const fadeUp = {
  initial:    { opacity: 0, y: 10 },
  animate:    { opacity: 1, y: 0 },
  exit:       { opacity: 0, y: -6 },
  transition: { duration: 0.20, ease: [0.25, 0.1, 0.25, 1.0] as [number, number, number, number] },
}

export const fadeIn = {
  initial:    { opacity: 0 },
  animate:    { opacity: 1 },
  exit:       { opacity: 0 },
  transition: { duration: 0.16 },
}

export function stagger(i: number) {
  return {
    initial:    { opacity: 0, y: 8 },
    animate:    { opacity: 1, y: 0 },
    transition: { duration: 0.20, delay: i * 0.055, ease: [0.25, 0.1, 0.25, 1.0] as [number, number, number, number] },
  }
}

// ─── Card ────────────────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode
  className?: string
  variant?: 'glass' | 'flat' | 'navy'
  style?: React.CSSProperties
  onClick?: () => void
}

export function Card({ children, className = '', variant = 'glass', style, onClick }: CardProps) {
  const base = 'rounded-2xl'
  const variantClass =
    variant === 'navy'
      ? ''
      : variant === 'flat'
      ? 'flat-card'
      : 'glass-card'

  const navyStyle: React.CSSProperties =
    variant === 'navy'
      ? {
          background: 'linear-gradient(145deg, #141F40 0%, #0C1428 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 8px 32px rgba(8,15,34,0.45)',
        }
      : {}

  return (
    <div
      className={`${base} ${variantClass} ${className}`}
      style={{ ...navyStyle, ...style }}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

// ─── Animated card ───────────────────────────────────────────────────────────

interface AnimCardProps extends CardProps {
  delay?: number
}

export function AnimCard({ delay = 0, ...props }: AnimCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.20, delay, ease: [0.25, 0.1, 0.25, 1.0] }}
    >
      <Card {...props} />
    </motion.div>
  )
}

// ─── Section label ───────────────────────────────────────────────────────────

export function SectionLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={`text-[11px] font-bold uppercase tracking-widest ${className}`}
      style={{ color: 'var(--muted)', letterSpacing: '0.09em' }}
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
      {right && <div className="flex items-center gap-2 mt-0.5">{right}</div>}
    </div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden />
}

// ─── Badge ───────────────────────────────────────────────────────────────────

type BadgeVariant = 'sandbox' | 'success' | 'warning' | 'danger' | 'muted' | 'gold'

const badgeStyles: Record<BadgeVariant, React.CSSProperties> = {
  sandbox: { background: 'rgba(243,181,28,0.15)', color: '#A07210', border: '1px solid rgba(243,181,28,0.30)' },
  success: { background: 'rgba(24,165,139,0.12)', color: 'var(--success-text)', border: '1px solid rgba(24,165,139,0.25)' },
  warning: { background: 'rgba(217,119,6,0.10)',  color: 'var(--warning)',       border: '1px solid rgba(217,119,6,0.22)' },
  danger:  { background: 'var(--danger-muted)',    color: 'var(--danger)',        border: '1px solid rgba(192,51,74,0.18)' },
  muted:   { background: 'var(--surface-muted)',   color: 'var(--muted)',         border: '1px solid var(--border)' },
  gold:    { background: 'var(--gold)',             color: '#080F22',             border: 'none' },
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
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${className}`}
      style={{ letterSpacing: '0.08em', ...badgeStyles[variant] }}
    >
      {children}
    </span>
  )
}

// ─── Divider ─────────────────────────────────────────────────────────────────

export function Divider({ className = '' }: { className?: string }) {
  return <div className={`h-px ${className}`} style={{ background: 'var(--border)' }} />
}

// ─── Row item (for lists) ─────────────────────────────────────────────────────

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
      className="flex items-center gap-3 w-full text-left min-h-[52px]"
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
        className="flex size-14 items-center justify-center rounded-2xl"
        style={{ background: 'var(--surface-muted)', color: 'var(--subtle)' }}
      >
        {icon}
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{title}</p>
        {body && <p className="text-xs max-w-[220px] mx-auto" style={{ color: 'var(--muted)' }}>{body}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

// ─── Status pill ──────────────────────────────────────────────────────────────

export function StatusPill({ status }: { status: 'pending' | 'success' | 'error' | 'warning' }) {
  const map: Record<string, { label: string; style: React.CSSProperties }> = {
    pending: { label: 'Pending',   style: { background: 'rgba(217,119,6,0.10)', color: 'var(--warning)' } },
    success: { label: 'Confirmed', style: { background: 'var(--success-muted)', color: 'var(--success-text)' } },
    error:   { label: 'Failed',    style: { background: 'var(--danger-muted)', color: 'var(--danger)' } },
    warning: { label: 'Expiring',  style: { background: 'rgba(217,119,6,0.10)', color: 'var(--warning)' } },
  }
  const { label, style } = map[status]
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={style}
    >
      {label}
    </span>
  )
}
