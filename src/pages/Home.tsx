/**
 * Home — balance overview, quick actions, secondary modules, activity.
 *
 * Layout rules:
 *  - No page title: the header carries the logo.
 *  - No duplicate Send/Request: those live inside BalanceHero.
 *  - space-y-5 (20px) between sections — consistent 4/8px grid.
 *  - SandboxBadge is the only element above the balance card.
 */

import { BalanceHero }                              from '../components/home/BalanceHero'
import { QuickActions, ProtectedPayments, LimitsCard, RecentActivity, SandboxBadge } from '../components/home/HomeCards'

export function Home() {
  return (
    <div className="space-y-5 pb-2">
      {/* Demo badge — right-aligned */}
      <div className="flex justify-end">
        <SandboxBadge />
      </div>

      <BalanceHero />

      <QuickActions />

      <ProtectedPayments />

      <LimitsCard />

      <RecentActivity />
    </div>
  )
}
