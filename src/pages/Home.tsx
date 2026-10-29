/**
 * Home — balance overview, quick actions, protected payments, limits, activity.
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
      <div className="flex items-center justify-between pt-1 pb-1">
        <span
          className="display text-xl font-bold"
          style={{ color: 'var(--ink)', letterSpacing: '-0.04em' }}
        >
          {BRAND.name}
        </span>
        <SandboxBadge />
      </div>

      {/* Balance hero — navy card with live USDC balance */}
      <BalanceHero />

      {/* Quick-action circles */}
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
