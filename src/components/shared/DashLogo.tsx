/**
 * DashLogo — brand asset components.
 *
 * DashLogoMark : the uploaded logo icon (public/dash-logo.svg).
 *   Use in: app header, WelcomeScreen hero, splash state.
 *   Do NOT use in the Scan navigation button.
 *
 * DashWordmark  : text-only wordmark rendered with Bricolage Grotesque.
 *   Kept for contexts where text-only branding is preferred.
 *
 * Legacy DashIcon export is preserved (maps to DashLogoMark)
 * so existing import sites continue to compile.
 */

// ─── Logo mark — uses the uploaded SVG asset ──────────────────────────────

interface LogoMarkProps {
  /** Height in px — width scales from the square viewBox */
  size?: number
  className?: string
}

export function DashLogoMark({ size = 32, className = '' }: LogoMarkProps) {
  return (
    <img
      src="/dash-logo.svg"
      alt="DA$H"
      width={size}
      height={size}
      className={className}
      draggable={false}
      style={{ display: 'block', flexShrink: 0 }}
    />
  )
}

// Legacy alias — keeps existing callers compiling without changes
export const DashIcon = DashLogoMark

// ─── Text wordmark — Bricolage Grotesque ─────────────────────────────────

interface WordmarkProps {
  /** px height of the rendered text block */
  height?: number
  /** light = dark ink (on white/canvas); dark = white ink (on navy) */
  light?: boolean
  className?: string
}

export function DashWordmark({ height = 24, light = true, className = '' }: WordmarkProps) {
  const color = light ? 'var(--ink)' : '#FFFFFF'
  const fontSize = Math.round(height * 0.95)

  return (
    <span
      className={`select-none ${className}`}
      style={{
        fontFamily: '"Bricolage Grotesque", sans-serif',
        fontWeight: 700,
        fontSize,
        letterSpacing: '-0.04em',
        color,
        lineHeight: 1,
        display: 'inline-block',
      }}
    >
      DA$H
    </span>
  )
}
