/**
 * App — router, layout shell, navigation.
 *
 * Mobile  (< 768px) : bottom tab bar, full-bleed content
 * Desktop (≥ 768px) : left nav rail (64px) + central workspace (max-w-lg) + optional right panel
 *
 * Bottom nav / rail items: Home | Schedules | Scan | Payments | Profile
 * Scan uses QrCode icon (Lucide) — never the logo.
 * Logo appears only in the app header and welcome screen.
 */

import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount } from 'wagmi'
import {
  Home as HomeIcon,
  CalendarClock,
  QrCode,
  CreditCard,
  User,
} from 'lucide-react'
import { DashLogoMark } from './components/shared/DashLogo'
import { Home }            from './pages/Home'
import { Send }            from './pages/Send'
import { Request }         from './pages/Request'
import { Scan }            from './pages/Scan'
import { Bills }           from './pages/Bills'
import { Payments }        from './pages/Payments'
import { OrderStatusPage } from './pages/OrderStatusPage'
import { Settings }        from './pages/Settings'
import { Profile }         from './pages/Profile'
import { Schedules }       from './pages/Schedules'
import { ScheduleCreate }  from './pages/ScheduleCreate'
import { ScheduleDetail }  from './pages/ScheduleDetail'
import { WelcomeScreen }   from './components/shared/WelcomeScreen'

// ─── Page transition ────────────────────────────────────────────────────────
// Pure crossfade — 150 ms, no y movement.
// y-movement on both enter and exit creates double-travel; a simple fade is
// faster to perceive and never competes with the content arriving on screen.
const PAGE_TRANSITION = {
  initial:    { opacity: 0 },
  animate:    { opacity: 1 },
  exit:       { opacity: 0 },
  transition: { duration: 0.15, ease: 'easeInOut' as const },
}

// ─── Nav items ───────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { to: '/',          icon: HomeIcon,      label: 'Home',     exact: true,  accent: false },
  { to: '/schedules', icon: CalendarClock, label: 'Schedule', exact: false, accent: false },
  { to: '/scan',      icon: QrCode,        label: 'Scan',     exact: false, accent: true  },
  { to: '/payments',  icon: CreditCard,    label: 'Payments', exact: false, accent: false },
  { to: '/profile',   icon: User,          label: 'Profile',  exact: false, accent: false },
]

// ─── Bottom nav (mobile) ─────────────────────────────────────────────────────

function BottomNav() {
  return (
    <nav
      aria-label="Main navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-40"
      style={{
        background: 'rgba(246,247,251,0.96)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderTop: '1px solid rgba(14,16,48,0.07)',
      }}
    >
      <div
        className="grid grid-cols-5 mx-auto"
        style={{
          maxWidth: 480,
          paddingBottom: 'max(env(safe-area-inset-bottom, 8px), 8px)',
          paddingTop: 4,
        }}
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            aria-label={item.label}
            className="flex flex-col items-center gap-[3px] py-2 rounded-xl
                       min-h-[44px] justify-center
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2A900]
                       focus-visible:ring-offset-1 focus-visible:ring-offset-[#F6F7FB]"
          >
            {({ isActive }) => (
              <>
                <motion.span
                  className="relative flex items-center justify-center"
                  style={{ width: 32, height: 26 }}
                  animate={{ scale: isActive ? 1.08 : 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 32, mass: 0.7 }}
                >
                  {/* Active dot */}
                  <AnimatePresence>
                    {isActive && (
                      <motion.span
                        layoutId="nav-dot"
                        className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                        style={{ background: 'var(--saffron)' }}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                      />
                    )}
                  </AnimatePresence>

                  {item.accent ? (
                    <span
                      className="flex items-center justify-center rounded-xl transition-colors"
                      style={{
                        width: 30, height: 26,
                        background: isActive ? 'rgba(242,169,0,0.13)' : 'rgba(14,16,48,0.04)',
                      }}
                    >
                      <item.icon
                        className="size-[16px]"
                        strokeWidth={isActive ? 2.2 : 1.7}
                        style={{ color: isActive ? 'var(--saffron)' : 'var(--subtle)' }}
                      />
                    </span>
                  ) : (
                    <item.icon
                      className="size-[17px]"
                      strokeWidth={isActive ? 2.2 : 1.7}
                      style={{ color: isActive ? 'var(--ink)' : 'var(--subtle)' }}
                    />
                  )}
                </motion.span>

                <span
                  style={{
                    fontFamily: '"Figtree", sans-serif',
                    fontSize: 10,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? 'var(--ink)' : 'var(--subtle)',
                    letterSpacing: '0.01em',
                    lineHeight: 1,
                  }}
                >
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

// ─── Left nav rail (desktop ≥768px) ─────────────────────────────────────────

function DesktopRail() {
  return (
    <nav
      aria-label="Main navigation"
      className="hidden md:flex flex-col items-center gap-1 fixed left-0 top-0 bottom-0 z-40 w-16 py-5"
      style={{
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Logo */}
      <div className="mb-6 mt-1">
        <DashLogoMark size={28} />
      </div>

      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.exact}
          aria-label={item.label}
          className="relative flex flex-col items-center justify-center gap-1 rounded-xl
                     w-12 h-12 transition-colors
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2A900]"
        >
          {({ isActive }) => (
            <>
              {/* Active indicator bar */}
              <AnimatePresence>
                {isActive && (
                  <motion.span
                    layoutId="rail-indicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full"
                    style={{ height: 24, background: 'var(--saffron)' }}
                    initial={{ opacity: 0, scaleY: 0.4 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    exit={{ opacity: 0, scaleY: 0.4 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                  />
                )}
              </AnimatePresence>

              <span
                className="flex items-center justify-center rounded-xl transition-colors"
                style={{
                  width: 36, height: 36,
                  background: isActive
                    ? item.accent ? 'rgba(242,169,0,0.12)' : 'rgba(14,16,48,0.06)'
                    : 'transparent',
                }}
              >
                <item.icon
                  className="size-[18px]"
                  strokeWidth={isActive ? 2.2 : 1.7}
                  style={{
                    color: isActive
                      ? item.accent ? 'var(--saffron)' : 'var(--ink)'
                      : 'var(--subtle)',
                  }}
                />
              </span>

              <span
                style={{
                  fontFamily: '"Figtree", sans-serif',
                  fontSize: 9,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? 'var(--ink)' : 'var(--subtle)',
                  letterSpacing: '0.01em',
                  lineHeight: 1,
                }}
              >
                {item.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

// ─── Mobile header (logo, top of screen) ────────────────────────────────────

function MobileHeader() {
  return (
    <header
      aria-label="App header"
      className="md:hidden sticky top-0 z-30 flex items-center px-5"
      style={{
        height: 48,
        background: 'rgba(246,247,251,0.95)',
        backdropFilter: 'blur(18px) saturate(170%)',
        WebkitBackdropFilter: 'blur(18px) saturate(170%)',
        borderBottom: '1px solid rgba(14,16,48,0.05)',
      }}
    >
      <DashLogoMark size={26} />
    </header>
  )
}

// ─── App shell ────────────────────────────────────────────────────────────────

function AppShell() {
  const location = useLocation()
  const { isConnected } = useAccount()

  if (!isConnected) return <WelcomeScreen />

  return (
    <div
      className="min-h-dvh"
      style={{ background: 'var(--bg)' }}
    >
      {/* Desktop rail */}
      <DesktopRail />

      {/* Mobile header */}
      <MobileHeader />

      {/*
        Content area:
        - Mobile: full width, px-5, clears bottom nav
        - Desktop: offset by rail (64px), centred workspace up to max-w-lg
      */}
      <div
        className="
          md:ml-16
          flex flex-col md:flex-row
          md:justify-center
          min-h-dvh
        "
      >
        {/* Primary workspace */}
        <main
          className="
            flex-1
            px-5 pt-4
            pb-[calc(80px+env(safe-area-inset-bottom,0px))]
            md:pb-10
            w-full
            md:max-w-[560px]
          "
          id="main-content"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={location.pathname} {...PAGE_TRANSITION}>
              <Routes location={location}>
                <Route path="/"                        element={<Home />} />
                <Route path="/send"                    element={<Send />} />
                <Route path="/pay"                     element={<Send />} />
                <Route path="/request"                 element={<Request />} />
                <Route path="/scan"                    element={<Scan />} />
                <Route path="/payments"                element={<Payments />} />
                <Route path="/bills"                   element={<Bills />} />
                <Route path="/orders/:orderId"         element={<OrderStatusPage />} />
                <Route path="/schedules"               element={<Schedules />} />
                <Route path="/schedules/new"           element={<ScheduleCreate />} />
                <Route path="/schedules/:scheduleId"   element={<ScheduleDetail />} />
                <Route path="/settings"                element={<Settings />} />
                <Route path="/profile"                 element={<Profile />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Desktop contextual panel — placeholder for future right panel */}
        <aside
          className="hidden xl:block w-[280px] shrink-0 pt-8 pr-6"
          aria-label="Contextual information"
        >
          {/* Right panel content rendered per-page via portal or context in future */}
        </aside>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
