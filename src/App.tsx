/**
 * App — router, layout shell, Web3Provider wrapper.
 */

import { BrowserRouter, Routes, Route, NavLink, useLocation, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Home as HomeIcon, Activity, Zap, User, QrCode } from 'lucide-react'
import { Home } from './pages/Home'
import { Send } from './pages/Send'
import { Request } from './pages/Request'
import { Scan } from './pages/Scan'
import { Bills } from './pages/Bills'
import { OrderStatusPage } from './pages/OrderStatusPage'
import { Settings } from './pages/Settings'
import { Profile } from './pages/Profile'

const fadeUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.18, ease: [0.25, 0.1, 0.25, 1.0] },
}

// Four corner tabs — Send and Request live on Home, not in the nav
const tabItems = [
  { to: '/',        icon: HomeIcon, label: 'Home',     exact: true },
  { to: '/activity', icon: Activity,  label: 'Activity', exact: false },
  null, // center slot — occupied by raised Scan button
  { to: '/bills',   icon: Zap,      label: 'Bills',    exact: false },
  { to: '/profile', icon: User,     label: 'Profile',  exact: false },
]

function BottomNav() {
  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 inset-x-0 z-40"
      style={{
        background: 'rgba(245,247,251,0.92)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderTop: '1px solid rgba(27,31,75,0.09)',
      }}
    >
      {/* Tab row — 5-column grid: 2 tabs | center button | 2 tabs */}
      <div
        className="grid grid-cols-5 items-end mx-auto max-w-md"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 12px)',
          paddingTop: 6,
          paddingLeft: 8,
          paddingRight: 8,
        }}
      >
        {tabItems.map((item, i) => {
          // Center slot — raised saffron Scan FAB
          if (item === null) {
            return (
              <div key="scan-fab" className="flex flex-col items-center">
                {/* Lift the button above the bar */}
                <Link
                  to="/scan"
                  aria-label="Scan QR code"
                  className="flex items-center justify-center rounded-full shadow-lg transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron"
                  style={{
                    width: 56,
                    height: 56,
                    background: '#F2A900',
                    boxShadow: '0 4px 18px rgba(242,169,0,0.45), 0 1px 4px rgba(0,0,0,0.12)',
                    marginBottom: 8,
                    marginTop: -20,
                  }}
                >
                  <QrCode className="size-6" style={{ color: '#0E1030' }} strokeWidth={2.2} />
                </Link>
                <span className="text-[10px] font-semibold" style={{ color: 'var(--muted)', marginBottom: 4 }}>
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
              className="flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-all min-w-[44px] min-h-[44px] justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron"
              style={({ isActive }) => ({
                color: isActive ? 'var(--ink)' : 'var(--subtle)',
              })}
            >
              {({ isActive }) => (
                <>
                  <span
                    className="flex items-center justify-center size-7 rounded-xl transition-all"
                    style={{
                      background: isActive ? 'var(--saffron-muted)' : 'transparent',
                    }}
                  >
                    <item.icon className="size-[18px]" strokeWidth={isActive ? 2.4 : 1.8} />
                  </span>
                  <span
                    className="text-[10px] font-semibold"
                    style={{ color: isActive ? 'var(--ink)' : 'var(--subtle)', letterSpacing: '0.01em' }}
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

function AppShell() {
  const location = useLocation()

  return (
    <div className="relative min-h-dvh" style={{ background: 'var(--bg)' }}>
      {/* Subtle background accent blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div style={{
          position: 'absolute', top: '6%', right: '10%',
          width: 240, height: 240, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(242,169,0,0.10) 0%, transparent 70%)',
          filter: 'blur(48px)',
        }} />
        <div style={{
          position: 'absolute', bottom: '20%', left: '5%',
          width: 200, height: 200, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(27,31,75,0.06) 0%, transparent 70%)',
          filter: 'blur(48px)',
        }} />
      </div>

      {/* Scrollable content — bottom padding clears the nav bar */}
      <div className="relative z-10 mx-auto max-w-md px-4 pt-5" style={{ paddingBottom: 88 }}>
        <main>
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname} {...fadeUp}>
              <Routes location={location}>
                <Route path="/"              element={<Home />} />
                <Route path="/send"          element={<Send />} />
                <Route path="/pay"           element={<Send />} />
                <Route path="/request"       element={<Request />} />
                <Route path="/scan"          element={<Scan />} />
                <Route path="/activity"      element={<ActivityPlaceholder />} />
                <Route path="/bills"         element={<Bills />} />
                <Route path="/orders/:orderId" element={<OrderStatusPage />} />
                <Route path="/settings"      element={<Settings />} />
                <Route path="/profile"       element={<Profile />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <BottomNav />
    </div>
  )
}

/** Stub route until Activity page is built */
function ActivityPlaceholder() {
  return (
    <div className="pt-10 text-center space-y-2">
      <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Activity</p>
      <p className="text-xs" style={{ color: 'var(--muted)' }}>Coming soon — your transaction history will appear here.</p>
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
