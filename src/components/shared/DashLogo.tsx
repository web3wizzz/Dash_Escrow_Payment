/**
 * DashLogo — DA$H brand identity system.
 *
 * Three custom SVG wordmark directions:
 *   A — Geometric Slash   : angular $, razor-vertical, slight italic axis on the stroke
 *   B — Rounded Momentum  : soft terminals, flowing $, letters lean 1.5° forward
 *   C — Condensed Precision: tall condensed, double-bar $, maximum fintech authority
 *
 * Standalone icon: the custom $ glyph from Direction A, in a rounded-square container.
 * Used as: nav brand mark, wallet-connect avatar, favicon placeholder.
 */

// ─── Color tokens ────────────────────────────────────────────────────────────

const NAVY  = '#101934'  // letter fill — light bg
const WHITE = '#FFFFFF'  // letter fill — dark bg
const GOLD  = '#F3B51C'  // $ fill — always

// ─────────────────────────────────────────────────────────────────────────────
// DIRECTION A — Geometric Slash
// Clean geometric sans. The $ is an angular S with a single vertical stroke
// that extends 10% above cap-height and 10% below baseline, expressing
// forward movement. Stroke weight 68 units on a 560-wide canvas.
// ─────────────────────────────────────────────────────────────────────────────

function WordmarkA({
  light = true,
  height = 40,
}: {
  light?: boolean
  height?: number
}) {
  // Viewbox: 560 × 120  (proportional)
  const fg = light ? NAVY : WHITE
  const aspect = 560 / 120
  const width = height * aspect

  return (
    <svg
      viewBox="0 0 560 120"
      width={width}
      height={height}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="DA$H"
      role="img"
    >
      {/* ── D ─────────────────────────────────────────────────────── */}
      {/*
          D: vertical stem + right bowl. Stem: 10→78 x, 14→106 y.
          Bowl: a D-curve that spans the full height with a 42px radius at mid.
          Inner cutout creates the characteristic counter.
      */}
      <path
        d="
          M 14 14
          L 14 106
          L 54 106
          C 104 106 128 82 128 60
          C 128 38 104 14 54 14
          Z
          M 42 32
          L 52 32
          C 88 32 104 44 104 60
          C 104 76 88 88 52 88
          L 42 88
          Z
        "
        fill={fg}
        fillRule="evenodd"
      />

      {/* ── A ─────────────────────────────────────────────────────── */}
      {/*
          A: two angled stems meeting at apex (159, 14). Crossbar at y=68.
          Left leg: 130→62 x range. Right leg: 190→258 x range.
          Stem width 22px. Crossbar 18px tall.
      */}
      <path
        d="
          M 159 14
          L 130 106
          L 152 106
          L 166 68
          L 192 68
          L 206 106
          L 229 106
          L 199 14
          Z
          M 172 52
          L 180 28
          L 188 52
          Z
        "
        fill={fg}
        fillRule="evenodd"
      />

      {/* ── $ ─────────────────────────────────────────────────────── */}
      {/*
          CUSTOM DOLLAR SIGN — Geometric Slash direction.
          S-curve upper bowl: opens left, spans y14→y58 with 34px radius.
          S-curve lower bowl: opens right, spans y62→y106 with 34px radius.
          A single 16px-wide vertical bar descends from y=4 to y=116,
          slightly wider than the S stroke (68px). The bar punches through
          both bowls, leaving visual negative space as the characteristic
          dollar-sign reading.

          Optical center: x=305 (midpoint of 248→362 span).
      */}
      {/* Upper bowl of S */}
      <path
        d="
          M 352 34
          C 352 22 342 14 322 14
          C 296 14 278 24 278 44
          C 278 56 285 64 300 70
          L 330 80
          C 340 84 346 90 346 98
          C 346 108 336 116 318 116
          C 298 116 286 106 282 94
          L 263 102
          C 268 118 288 130 318 130
          C 348 130 366 116 366 96
          C 366 82 358 73 341 66
          L 312 56
          C 301 52 296 46 296 37
          C 296 27 306 20 320 20
          C 336 20 346 28 348 40
          Z
        "
        fill={GOLD}
      />
      {/* Vertical bar — extends above cap-height (y=4) and below baseline (y=116) */}
      <rect x="307" y="4" width="14" height="112" rx="4" fill={GOLD} />

      {/* ── H ─────────────────────────────────────────────────────── */}
      {/*
          H: two vertical stems + horizontal crossbar.
          Left stem: x 388→410. Right stem: x 518→540. Crossbar: y 56→74.
      */}
      <path
        d="
          M 388 14
          L 388 106
          L 410 106
          L 410 74
          L 518 74
          L 518 106
          L 540 106
          L 540 14
          L 518 14
          L 518 56
          L 410 56
          L 410 14
          Z
        "
        fill={fg}
      />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DIRECTION B — Rounded Momentum
// Soft rounded terminals. The S-form of $ uses true circular arcs for the
// bowls, giving a friendly-premium feel. Letters are optically spaced for
// natural reading rhythm. The whole wordmark is on a 1.5° shear to express
// forward motion — applied via a subtle transform.
// ─────────────────────────────────────────────────────────────────────────────

function WordmarkB({
  light = true,
  height = 40,
}: {
  light?: boolean
  height?: number
}) {
  const fg = light ? NAVY : WHITE
  const aspect = 570 / 120
  const width = height * aspect

  return (
    <svg
      viewBox="0 0 570 124"
      width={width}
      height={height}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="DA$H"
      role="img"
    >
      {/* Slight forward shear on the whole wordmark */}
      <g transform="skewX(-1.5)">
        {/* ── D — rounded bowl ──────────────────────────────────── */}
        <path
          d="
            M 16 16 Q 16 8 24 8
            L 56 8
            C 106 8 132 32 132 62
            C 132 92 106 116 56 116
            L 24 116 Q 16 116 16 108
            Z
            M 40 30 L 54 30
            C 90 30 108 44 108 62
            C 108 80 90 94 54 94
            L 40 94 Z
          "
          fill={fg}
          fillRule="evenodd"
        />

        {/* ── A — rounded apex ──────────────────────────────────── */}
        <path
          d="
            M 161 8 Q 166 2 171 8
            L 204 116 L 182 116 L 168 76
            L 154 76 L 140 116 L 118 116
            Z
            M 161 56 L 171 28 L 181 56 Z
          "
          fill={fg}
          fillRule="evenodd"
        />

        {/* ── $ — Rounded Momentum: full circular arcs ─────────── */}
        {/* Upper arc — opens left */}
        <path
          d="
            M 350 42
            C 350 28 340 18 320 18
            C 296 18 278 30 278 50
            C 278 64 287 72 304 79
            L 332 89
            C 342 93 348 100 348 110
            C 348 120 336 130 316 130
            C 294 130 280 118 276 104
            L 256 112
            C 262 130 284 144 316 144
            C 348 144 368 128 368 108
            C 368 92 358 82 340 74
            L 312 64
            C 300 60 296 53 296 44
            C 296 34 306 26 320 26
            C 336 26 346 36 348 48
            Z
          "
          fill={GOLD}
        />
        <rect x="305" y="4" width="16" height="116" rx="8" fill={GOLD} />

        {/* ── H — rounded crossbar ──────────────────────────────── */}
        <path
          d="
            M 392 8 Q 392 8 400 8
            L 400 8 L 400 62 L 510 62
            L 510 8 L 518 8 Q 526 8 526 16
            L 526 108 Q 526 116 518 116
            L 510 116 L 510 78 L 400 78
            L 400 116 L 392 116 Q 384 116 384 108
            L 384 16 Q 384 8 392 8 Z
          "
          fill={fg}
        />
      </g>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DIRECTION C — Condensed Precision
// Tall, tight condensed letterforms. The $ uses a double thin vertical bar
// (two 6px bars separated by 10px gap), creating a distinctly fintech-grade
// currency mark. High contrast between stroke weight and negative space.
// The condensed proportions feel authoritative at banner scale.
// ─────────────────────────────────────────────────────────────────────────────

function WordmarkC({
  light = true,
  height = 40,
}: {
  light?: boolean
  height?: number
}) {
  const fg = light ? NAVY : WHITE
  const aspect = 480 / 120
  const width = height * aspect

  return (
    <svg
      viewBox="0 0 480 120"
      width={width}
      height={height}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="DA$H"
      role="img"
    >
      {/* ── D — condensed, tall ───────────────────────────────────── */}
      <path
        d="
          M 8 10 L 8 110
          L 46 110
          C 90 110 112 88 112 60
          C 112 32 90 10 46 10 Z
          M 26 26 L 44 26
          C 76 26 92 40 92 60
          C 92 80 76 94 44 94
          L 26 94 Z
        "
        fill={fg}
        fillRule="evenodd"
      />

      {/* ── A — condensed, sharp ──────────────────────────────────── */}
      <path
        d="
          M 136 10 L 118 110 L 136 110
          L 148 66 L 170 66 L 182 110 L 200 110
          L 182 10 Z
          M 151 52 L 159 22 L 167 52 Z
        "
        fill={fg}
        fillRule="evenodd"
      />

      {/* ── $ — Condensed Precision: double-bar dollar sign ──────── */}
      {/*
          The S body is a tight condensed S-curve.
          The vertical element is TWO thin bars (6px each, 10px apart)
          producing an unmistakably premium currency reading.
      */}
      <path
        d="
          M 302 36
          C 302 24 294 16 278 16
          C 258 16 244 26 244 44
          C 244 56 251 63 264 69
          L 290 79
          C 298 83 304 89 304 99
          C 304 109 294 118 276 118
          C 258 118 246 108 242 96
          L 226 104
          C 231 120 249 130 276 130
          C 306 130 322 116 322 97
          C 322 83 314 73 299 66
          L 273 56
          C 264 52 260 46 260 38
          C 260 28 268 22 280 22
          C 294 22 302 30 303 42
          Z
        "
        fill={GOLD}
      />
      {/* Double vertical bar */}
      <rect x="260" y="4" width="6" height="112" rx="3" fill={GOLD} />
      <rect x="272" y="4" width="6" height="112" rx="3" fill={GOLD} />

      {/* ── H — condensed, tight ──────────────────────────────────── */}
      <path
        d="
          M 342 10 L 342 110 L 360 110 L 360 72 L 454 72
          L 454 110 L 472 110 L 472 10 L 454 10
          L 454 56 L 360 56 L 360 10 Z
        "
        fill={fg}
      />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STANDALONE ICON — custom $ glyph from Direction A
// Rendered inside a rounded-square container.
// Works at all sizes from 16px favicon to 128px avatar.
// ─────────────────────────────────────────────────────────────────────────────

function DashIcon({
  size = 40,
  dark = true,
}: {
  size?: number
  dark?: boolean
}) {
  const bg = dark ? NAVY : GOLD
  const mark = dark ? GOLD : NAVY

  return (
    <svg
      viewBox="0 0 80 80"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="DA$H"
      role="img"
    >
      {/* Rounded square background */}
      <rect width="80" height="80" rx="20" fill={bg} />

      {/*
          Custom $ from Direction A, scaled and centered in 80×80 container.
          Original S-body spans ~88px wide (248→336) on a 560-wide canvas.
          Scale factor ≈ 0.47, translate to center at (40,40).
          We redraw at a clean scale for the 80×80 icon.
      */}

      {/* Upper bowl of S */}
      <path
        d="
          M 54 22
          C 54 15 48 10 38 10
          C 25 10 16 16 16 28
          C 16 36 21 41 30 45
          L 46 51
          C 52 53 55 57 55 63
          C 55 70 49 76 38 76
          C 27 76 20 70 17 62
          L 8 66
          C 11 77 24 84 38 84
          C 56 84 64 76 64 62
          C 64 53 58 47 47 43
          L 32 37
          C 25 34 22 30 22 24
          C 22 17 29 12 38 12
          C 48 12 54 18 55 26
          Z
        "
        fill={mark}
      />
      {/* Vertical bar — extends above and below the icon's content area */}
      <rect x="36" y="4" width="8" height="72" rx="3" fill={mark} />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

export type LogoDirection = 'A' | 'B' | 'C'

interface WordmarkProps {
  /** Which direction variant to render */
  direction?: LogoDirection
  /** Height in px — width scales proportionally */
  height?: number
  /** Light variant: letters in navy (for light backgrounds).
   *  Dark variant: letters in white (for dark/navy backgrounds).
   *  The gold $ is always gold regardless. */
  light?: boolean
  className?: string
}

/**
 * DA$H wordmark — choose direction A (default), B, or C.
 *
 * @example
 * <DashWordmark height={32} light={false} />         // white on dark, Direction A
 * <DashWordmark direction="C" height={48} light />   // navy on light, Direction C
 */
export function DashWordmark({
  direction = 'A',
  height = 36,
  light = false,
  className,
}: WordmarkProps) {
  const props = { light, height }
  return (
    <span className={className} aria-label="DA$H" style={{ display: 'inline-flex', lineHeight: 0 }}>
      {direction === 'A' && <WordmarkA {...props} />}
      {direction === 'B' && <WordmarkB {...props} />}
      {direction === 'C' && <WordmarkC {...props} />}
    </span>
  )
}

/**
 * DA$H standalone icon — the custom $ glyph in a rounded-square container.
 * Use as nav mark, avatar, favicon placeholder.
 *
 * @example
 * <DashIcon size={40} dark />      // gold $ on navy bg
 * <DashIcon size={40} dark={false} /> // navy $ on gold bg
 */
export { DashIcon }
