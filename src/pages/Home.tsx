/**
 * Home — balance overview, quick actions, bill orders, limits, and activity.
 */

import { BalanceHero } from '../components/home/BalanceHero'
import {
  QuickActions,
  ProtectedPayments,
  LimitsCard,
  RecentActivity,
  SandboxBadge,
} from '../components/home/HomeCards'
import { BRAND } from '../../config/brand'

export function Home() {
  return (
    <div className="space-y-4 pb-2">
      {/* App bar */}
      <div className="flex items-center justify-between pt-1 pb-2">
        <span
          className="display text-xl font-bold"
          style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
        >
          {BRAND.name}
        </span>
        <SandboxBadge />
      </div>

      {/* Balance hero card (connected or connect-CTA) */}
      <BalanceHero />

      {/* Quick-action circles + bill shortcuts */}
      <QuickActions />

      {/* Protected bill payments */}
      <ProtectedPayments />

      {/* KYC tier + spend limits */}
      <LimitsCard />

      {/* Transaction history */}
      <RecentActivity />
    </div>
  )
}
