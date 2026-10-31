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
import { TARGET_CHAIN_ID }                          from '../config'

const IS_TESTNET = TARGET_CHAIN_ID !== 5042

export function Home() {
  return (
    <div className="space-y-5 pb-2">
      {/* Environment indicator — right-aligned, no page title below it */}
      {IS_TESTNET && (
        <div className="flex justify-end">
          <SandboxBadge />
        </div>
      )}

      <BalanceHero />

      <QuickActions />

      <ProtectedPayments />

      <LimitsCard />

      <RecentActivity />
    </div>
  )
}
