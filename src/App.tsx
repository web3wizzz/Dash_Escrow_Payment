/**
 * App — router, layout shell, welcome screen, and bottom nav.
 */

import { BrowserRouter, Routes, Route, NavLink, useLocation, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount } from 'wagmi'
import { Home as HomeIcon, CreditCard, User, CalendarClock } from 'lucide-react'
import { DashWordmark, DashIcon } from './components/shared/DashLogo'
import { Home } from './pages/Home'
import { Send } from './pages/Send'
import { Request } from './pages/Request'
import { Scan } from './pages/Scan'
import { Bills } from './pages/Bills'
import { Payments } from './pages/Payments'
import { OrderStatusPage } from './pages/OrderStatusPage'
import { Settings } from './pages/Settings'
import { Profile } from './pages/Profile'
import { Schedules } from './pages/Schedules'
import { ScheduleCreate } from './pages/ScheduleCreate'
import { ScheduleDetail } from './pages/ScheduleDetail'
import { WelcomeScreen } from './components/shared/WelcomeScreen'

const pageVariants = {
  initial:    { opacity: 0, y: 8 },
  animate:    { opacity: 1, y: 0 },
  exit:       { opacity: 0, y: -5 },
  transition: { duration: 0.18, ease: [0.25, 0.1, 0.25, 1.0] as [number,number,number,number] },
}

// ─── Bottom navigation ───────────────────────────────────────────────────────

const tabItems = [
  { to: '/',          icon: HomeIcon,      label: 'Home',      exact: true },
  { to: '/schedules', icon: CalendarClock, label: 'Schedules', exact: false },
  null, // center FAB slot
  { to: '/payments',  icon: CreditCard,    label: 'Payments',  exact: false },
  { to: '/profile',   icon: User,          label: 'Profile',   exact: false },
]

function BottomNav() {
  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 inset-x-0 z-40"
      style={{
        background: 'rgba(246,248,252,0.90)',
        backdropFilter: 'blur(24px) saturate(200%)',
        WebkitBackdropFilter: 'blur(24px) saturate(200%)',
        borderTop: '1px solid rgba(16,25,52,0.08)',
      }}
    >
      <div
        className="grid grid-cols-5 items-end mx-auto max-w-md"
        style={{
          paddingBottom: 'max(env(safe-area-inset-bottom, 8px), 8px)',
          paddingTop: 4,
          paddingLeft: 4,
          paddingRight: 4,
        }}
      >
        {tabItems.map((item, _i) => {
          if (item === null) {
            return (
              <div key="scan-fab" className="flex flex-col items-center pb-1">
                <Link
                  to="/scan"
                  aria-label="Scan QR code"
                  className="transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded-2xl"
                  style={{
                    marginTop: -22,
                    marginBottom: 2,
                    filter: 'drop-shadow(0 4px 12px rgba(243,181,28,0.50))',
                  }}
                >
                  <DashIcon size={52} dark />
                </Link>
                <span className="text-[10px] font-semibold" style={{ color: 'var(--muted)' }}>
                  Scan
                </span>
              </div>
            )
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className="flex flex-col items-center gap-0.5 py-2 rounded-2xl transition-all min-w-[44px] min-h-[44px] justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              style={({ isActive }) => ({ color: isActive ? 'var(--navy)' : 'var(--subtle)' })}
            >
              {({ isActive }) => (
                <>
                  <motion.span
                    className="flex items-center justify-center size-7 rounded-xl"
                    animate={{
                      background: isActive ? 'rgba(243,181,28,0.16)' : 'transparent',
                      scale: isActive ? 1.08 : 1,
                    }}
                    transition={{ duration: 0.15 }}
                  >
                    <item.icon
                      className="size-[18px]"
                      strokeWidth={isActive ? 2.4 : 1.8}
                    />
                  </motion.span>
                  <span
                    className="text-[10px] font-semibold"
                    style={{
                      color: isActive ? 'var(--navy)' : 'var(--subtle)',
                      letterSpacing: '0.01em',
                    }}
                  >
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}

// ─── App shell ───────────────────────────────────────────────────────────────

function AppShell() {
  const location = useLocation()
  const { isConnected } = useAccount()

  // Show welcome screen when disconnected
  if (!isConnected) {
    return <WelcomeScreen />
  }

  return (
    <div className="relative" style={{ background: 'var(--bg)', minHeight: '100dvh' }}>
      {/* Top brand strip */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between mx-auto max-w-md px-5"
        style={{
          height: 52,
          background: 'rgba(246,248,252,0.88)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: '1px solid rgba(16,25,52,0.06)',
        }}
      >
        <DashWordmark direction="A" height={22} light />
        {/* Right side: connect button placeholder (ConnectKit injects into main) */}
        <div style={{ width: 22 }} />
      </header>

      {/* Scrollable content — clears bottom nav */}
      <div
        className="relative z-10 mx-auto max-w-md px-4 pt-2"
        style={{ paddingBottom: 'calc(80px + max(env(safe-area-inset-bottom, 0px), 0px))' }}
      >
        <main>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={location.pathname} {...pageVariants}>
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
      </div>

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
