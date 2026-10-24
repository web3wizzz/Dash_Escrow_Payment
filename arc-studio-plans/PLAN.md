# Implementation Plan: Dash

## Summary
Dash is a non-custodial USDC spending app on Arc mainnet. Users send USDC by handle or address, request money via link/QR, scan QR to pay, pay bills (sandboxed), and create scheduled payouts — pay later, allowances, vesting with cliff, payroll to multiple recipients, and per-second streaming salaries. The platform holds funds only in two places under fixed on-chain rules: 30-minute bill order escrow (PayRouter) and scheduled payout deposits (ScheduledPayouts). No admin, operator, or any other role can move those funds outside those rules.

## Architecture

**Blockchain:** Arc mainnet (chain ID 5042). USDC ERC-20 at `0x3600000000000000000000000000000000000000`, 6 decimals. `maxFeePerGas >= 20 gwei` on every tx. No confirmation-depth logic. Block ordering by block number.

**Contracts (four, all immutable):**
- `HandleRegistry` — free self-registration of `@handles`. One handle per wallet, one wallet per handle. Lowercase letters/digits/underscore, 3–20 chars, must start with a letter. Non-transferable. Owner can release. Reserved handle list set at deploy. No role can register, change, reassign or remove a user's handle.
- `KycRegistry` — tier (0/1/2) per address with expiry. Written only by `VERIFIER_ROLE`. No PII on-chain. Expired tier counts as Tier 0.
- `PayRouter` — direct sends (wallet-to-wallet, zero fee, no escrow), request-payment events (on-chain record only, no escrow), bill order escrow (USDC held until `OPERATOR_ROLE` fulfills to the biller treasury recorded at order creation, or rejects back to payer, or payer reclaims after 30 min). Tier limits enforced here via `KycRegistry`. `globalPerPaymentCap` + daily windows. Fee up to `MAX_FEE_BPS = 200` on fulfilled bill orders only, default 0, timelocked. Pause blocks new sends/requests/orders only; refunds/rejections/cancellations always live.
- `ScheduledPayouts` — all five schedule types in one contract. Sender deposits USDC once via Permit2 witness variant and the contract releases it to recipients over time under immutable per-schedule rules. No role has any power over individual schedules.

**Constructor arguments (all initial config is live at deploy; 24-hour timelock applies only to later changes):**

`PayRouter` constructor args:
- `usdc` — USDC ERC-20 address (`0x3600000000000000000000000000000000000000`)
- `kycRegistry` — deployed `KycRegistry` address
- `handleRegistry` — deployed `HandleRegistry` address (for `sendToHandle` on-chain resolution)
- `permit2` — canonical Permit2 address (`0x000000000022D473030F116dDEE9F6B43aC78BA3`)
- Tier 0 per-payment cap: 5 USDC (5_000_000)
- Tier 0 daily cap: 50 USDC (50_000_000)
- Tier 1 per-payment cap: 100 USDC (100_000_000)
- Tier 1 daily cap: 20,000 USDC (20_000_000_000_000)
- Tier 2 per-payment cap: 20,000 USDC (20_000_000_000_000)
- Tier 2 daily cap: unlimited (`type(uint256).max`)
- `globalPerPaymentCap` — 25 USDC (25_000_000); hardcoded in deploy script and frontend config
- Minimum bill tier: 1 (Tier 1)
- Order timeout: 1800 seconds (30 min)
- Initial fee bps: 0
- First biller: address + treasury wallet (caller-supplied at deploy)

**Permit2 deployment:** Confirmed live at `0x000000000022D473030F116dDEE9F6B43aC78BA3` on both Arc mainnet (chain 5042) and Arc testnet (chain 5042002) per Arc Docs and the testnet block explorer (1.5 M+ transactions).

**Approval model per action (all use Permit2 `SignatureTransfer`):**

The UI performs a one-time `USDC.approve(Permit2, type(uint256).max)` on first use and explains it clearly. This approves Permit2's own canonical contract, not PayRouter. After that, every action uses a single-use signature with an exact amount and a caller-set deadline — no unlimited or persistent PayRouter allowance is ever requested. Documented in `AUDIT.md` as a known exception. A Revoke approval button appears on the Profile screen.

| Action | Binding | Flow |
|---|---|---|
| Send by address (`send`) | `msg.sender == permit.owner` enforced on-chain | Permit2 `SignatureTransfer` — exact amount, single-use nonce, deadline |
| Send by handle (`sendToHandle`) | `msg.sender == permit.owner` enforced on-chain | Same. `PayRouter` resolves handle → address via immutable `HandleRegistry` arg. |
| Pay a request link (`payRequest`) | `msg.sender == permit.owner` enforced on-chain | Same Permit2 `SignatureTransfer` — payer signs exact amount at time of payment |
| Bill order (`createOrder`) | Witness variant — signature also covers `billerId`, `accountHash`, and `ref` | Permit2 `SignatureTransfer` with witness — exact escrow amount, single-use nonce, deadline |

**Permit2 binding rules (security):**
- Every payment function enforces `msg.sender == permitTransferFrom.permitted.owner` (i.e. the signing payer must be the transaction sender). A relayed submission from a different address reverts.
- `createOrder` additionally uses the witness variant: the signature commits to `billerId`, `accountHash`, and `ref`. Any mismatch between signed and submitted parameters causes Permit2 to revert.
- Where both defenses apply (`createOrder`), both are applied.
- Tests must include: (a) a third address submitting a valid signature reverts; (b) any signed parameter changed on submission reverts.

**Roles (OpenZeppelin AccessControl):**
- `DEFAULT_ADMIN_ROLE` — multisig/hardware wallet. Grants/revokes roles, queues timelocked config changes. Cannot move user funds.
- `OPERATOR_ROLE` — backend hot wallet. Fulfills bill orders to the treasury recorded at order creation, or rejects back to payer. No other powers.
- `VERIFIER_ROLE` — separate wallet. Calls `KycRegistry.setTier` / `revoke` only.
- `PAUSER_ROLE` — third address. Pause/unpause new payments only.

**ScheduledPayouts design (locked from user answers):**

All five types share one `Schedule` struct, differentiated by `ScheduleType` enum. Fields not used by a type are zero.

| Type | Unlock rule |
|---|---|
| `PayLater` | 100% unlocks at a fixed future timestamp |
| `Allowance` | Fixed amount unlocks every `period` seconds, repeating until deposit exhausted |
| `Vesting` | Linear unlock after `cliffEnd`, over `duration` |
| `Payroll` | One Schedule per recipient; each is an Allowance on the same period |
| `Streaming` | Continuous per-second linear unlock from `startTime` to `endTime` |

Cancellation: only sender can cancel, only if `revocable == true` at creation (immutable). On cancel: unlocked-but-unclaimed USDC → recipient; unvested remainder → sender. Works while paused. No role can cancel any schedule.

Claim: anyone may call `claim(scheduleId)`; USDC always goes to the recipient address recorded at creation. No signature, no relay permissions needed.

Deposit: Permit2 witness variant; witness commits to all schedule terms. Parameter mismatch reverts.

Pause: `deposit` only. `claim` and `cancel` always work.

**Frontend:** React + Vite + TypeScript, wagmi + ConnectKit, Tailwind CSS. Arc mainnet chain config. ConnectKit for wallet connection. Permit2 `SignatureTransfer` for all payment actions.

**UI references:**
- Motion patterns and sheet behavior: 60fps.design
- Easing curves: easings.net
- Icons: Lucide; animated variants from lucide-animated.com (license-checked before use)
- Components: Arc UI (uiarc.dev) free tier only
- Constraints: no 3D, no shaders, no scroll-driven effects; all animations ≤ 1.2 s; `prefers-reduced-motion` fallback on every animated element

**Wallet:** ConnectKit (injected wallet, WalletConnect). No Circle-custodied wallets — fully non-custodial.

**Backend:** Bun HTTP server on port 3001, `GET /billers`. Proxied via Vite at `/api`.

## Files to Create / Modify

### Config
1. `config/brand.ts` — sole source of product name, tagline, domain, handles, URI scheme. Add `SCHEDULE_DEPOSIT_WITNESS_TYPEHASH` constant to keep contract and frontend in sync.

### Audit Notes
1a. `AUDIT.md` — documents the one-time `USDC.approve(Permit2, type(uint256).max)` as a known, intentional exception. Add section for `ScheduledPayouts`: witness typehash binding rationale, why `claim` is permissionless-to-caller (funds always go to recorded recipient), why `cancel` needs no timelock (payer's own deposit).

### Contracts (existing — complete)
2. `contracts/HandleRegistry.sol` — ✅ written and tested.
3. `contracts/KycRegistry.sol` — ✅ written and tested.
4. `contracts/PayRouter.sol` — ✅ written, tested. Constructor takes `InitialBiller[]` array.
5. `contracts/test/HandleRegistry.t.sol` — ✅ 30 tests passing.
6. `contracts/test/KycRegistry.t.sol` — ✅ 24 tests passing.
7. `contracts/test/PayRouter.*.t.sol` — ✅ 60 tests passing (Base, Send, Orders, Timelock).

### New Contract
8. `contracts/ScheduledPayouts.sol` — all five schedule types (`PayLater`, `Allowance`, `Vesting`, `Payroll`, `Streaming`); deposit via Permit2 witness; `claim(scheduleId)` permissionless-to-caller, always pays recipient; `cancel(scheduleId)` sender-only if `revocable`; `claimable(scheduleId)` view; ReentrancyGuard, Pausable (deposit only), AccessControl (admin for pause only); SafeERC20; NatSpec; events per state change; no role power over individual schedules.
9. `contracts/test/ScheduledPayouts.t.sol` — all five types; cliff boundary; cancel-revocable vs cancel-locked-reverts; third-address relay reverts; witness mismatch reverts; per-second streaming math; keeper-style claim by non-recipient.

### Backend (existing — complete)
10. `server/index.ts` — ✅ Bun HTTP server, `GET /billers`, 19 sandbox providers.

### Frontend Config (existing — complete)
11. `src/config.ts` — ✅ Arc mainnet + testnet wagmi config.
12. `src/lib/permit2.ts` — ✅ SignatureTransfer + witness helpers.
13. `src/lib/tiers.ts` — ✅ tier limit constants.
14. `src/lib/hash.ts` — ✅ salted-hash util.
15. `src/lib/billers.ts` — ✅ biller types, fetch hook.
16. `src/lib/share.ts` — ✅ share link helper.

### New Lib
17. `src/lib/schedules.ts` — schedule type constants, `claimableAmount()` unlock math (mirrors contract formula exactly for all five types), Permit2 witness helpers for deposit, human-readable schedule description formatter.

### Hooks (existing — complete)
18. `src/hooks/useHandleRegistry.ts` — ✅
19. `src/hooks/useKycTier.ts` — ✅
20. `src/hooks/usePayRouter.ts` — ✅
21. `src/hooks/useBillOrder.ts` — ✅

### New Hook
22. `src/hooks/useScheduledPayouts.ts` — `useDeposit`, `useClaim`, `useCancel`, `useSchedule` (read single), `useMySchedules` (enumerate sent/received from on-chain events).

### Components (existing — complete)
23. `src/components/shared/` — ✅ WalletBar, ChainGuard, TxStatus, BottomSheet, Permit2Notice.
24. `src/components/home/` — ✅ BalanceHero, HomeCards.
25. `src/components/send/` — ✅ SendForm.
26. `src/components/request/` — ✅ RequestForm.
27. `src/components/bills/` — ✅ BillerCard, BillerCatalog, BillOrderForm, OrderStatus.

### New Components
28. `src/components/schedules/ScheduleTypeSelect.tsx` — five type chips with one-line descriptions, Sandbox label where relevant.
29. `src/components/schedules/ScheduleForm.tsx` — dynamic fields per type (cliff date, period, end date, recipient list for Payroll), amount, revocable toggle, confirm + Permit2 sign flow.
30. `src/components/schedules/ScheduleCard.tsx` — type badge, recipient/sender, total, claimed, claimable progress bar, Claim and Cancel buttons, live countdown (Streaming shows per-second ticker).
31. `src/components/schedules/StreamTicker.tsx` — real-time USDC/sec counter via `requestAnimationFrame`, `prefers-reduced-motion` fallback to static number.

### Pages (existing — complete)
32. `src/pages/Home.tsx` — ✅ balance hero, quick actions, bill order tracker, limits card, activity.
33. `src/pages/Send.tsx`, `Request.tsx`, `Scan.tsx`, `Bills.tsx`, `OrderStatusPage.tsx`, `Settings.tsx`, `Profile.tsx` — ✅

### New Pages
34. `src/pages/Schedules.tsx` — two tabs: Sent and Received. `ScheduleCard` list per tab. Empty states. "New schedule" button.
35. `src/pages/ScheduleDetail.tsx` — single schedule; full timeline; Claim and Cancel buttons; explorer link after tx.
36. `src/pages/ScheduleCreate.tsx` — hosts `ScheduleForm`; Payroll type expands to multi-recipient list (add/remove rows).

### App wiring
37. `src/App.tsx` — add `/schedules`, `/schedules/new`, `/schedules/:id` routes. Add Schedules entry to bottom nav or Home quick-action row.

## Build Sequence

1. **Write `ScheduledPayouts.sol`** — inline Permit2 structs (same pattern as PayRouter); all five types; deposit witness binding; `claim`; `cancel`; `claimable()` view; NatSpec; events; no admin power over schedules.
2. **Security review** — both auditors on `ScheduledPayouts.sol` at balanced severity.
3. **Write `ScheduledPayouts.t.sol`** — all schedule types, cancel branches, relay/witness tests.
4. **`forge build` + `forge test`** — must pass clean.
5. **Update `config/brand.ts`** — add `SCHEDULE_DEPOSIT_WITNESS_TYPEHASH`.
6. **Write `src/lib/schedules.ts`** — type constants, unlock math, witness helpers, formatters.
7. **Write `src/hooks/useScheduledPayouts.ts`** — deposit, claim, cancel, read hooks.
8. **Write schedule components** — `ScheduleTypeSelect`, `ScheduleForm`, `ScheduleCard`, `StreamTicker`.
9. **Write schedule pages** — `ScheduleCreate`, `Schedules`, `ScheduleDetail`.
10. **Update `src/App.tsx`** — add routes and nav entry.
11. **Lint + typecheck pass** — zero errors.

## Done When

### Existing (complete)
- [x] `HandleRegistry` enforces format, reserved list, one-per-wallet; no admin path alters user handles.
- [x] `KycRegistry` stores tier + expiry; only `VERIFIER_ROLE` writes; expired tier → Tier 0.
- [x] `PayRouter` sends enforce tier limits and `globalPerPaymentCap`; daily windows reset correctly.
- [x] Bill order escrow: fulfill to locked treasury, reject to payer, reclaim after 30 min.
- [x] Pause blocks new sends/requests/orders; reject/reclaim always work.
- [x] Fee only on fulfilled bill orders; `MAX_FEE_BPS = 200` enforced; default 0.
- [x] All initial config live at deploy; post-deploy changes 24-hour timelocked.
- [x] 114 unit tests pass on arc-forge.
- [x] Permit2 confirmed live on both Arc mainnet and testnet.
- [x] `globalPerPaymentCap` = 25 USDC in deploy script and frontend config.
- [x] One-time `USDC.approve(Permit2, max)` explained in UI; no unlimited PayRouter approval.
- [x] All payment actions use Permit2 `SignatureTransfer` (exact amount, single-use nonce, deadline).
- [x] `msg.sender == permit.owner` enforced on all payment functions; third-party relay reverts.
- [x] `createOrder` witness variant; mismatch in `billerId`, `accountHash`, `ref` reverts.
- [x] `AUDIT.md` documents known Permit2 max-approval exception.
- [x] Profile Revoke button calls `USDC.approve(Permit2, 0)`.
- [x] `sendToHandle` resolves on-chain via immutable `HandleRegistry` arg.
- [x] USDC blocklist revert → clear failed-payment state in UI.
- [x] Sandbox label on all biller UI, KYC screens, API responses.
- [x] No PII on-chain; bill account details hashed before submission.
- [x] Product name only in `config/brand.ts`.
- [x] `PayRouter` constructor accepts `InitialBiller[]` array.
- [x] Bills screen: category chips, search, recents, favorites, Sandbox badge, escrow explainer.
- [x] Backend `GET /billers` seeded with Nigerian providers + 3 fictional Arc apps demo billers.
- [x] Home screen: balance hero (ink card), quick actions, saffron primary buttons, paper background.
- [x] Bottom nav: 4 tabs + raised saffron Scan FAB.

### New (ScheduledPayouts)
- [ ] `ScheduledPayouts` compiles clean; all five schedule types work end-to-end in tests.
- [ ] Deposit uses Permit2 witness variant; witness commits to all schedule terms; mismatch reverts.
- [ ] `claim(id)` callable by anyone; USDC always goes to recipient; correct unlock math for all five types.
- [ ] Streaming per-second math in frontend (`src/lib/schedules.ts`) matches contract formula exactly.
- [ ] `cancel` works only when `revocable == true` and `msg.sender == schedule.sender`; locked schedules revert for all callers including admin.
- [ ] On cancel: unlocked-but-unclaimed USDC → recipient; remainder → sender. Both transfers in one tx.
- [ ] `cancel` and `claim` both work while contract is paused; only `deposit` is blocked by pause.
- [ ] No role (admin, operator, any) can cancel, modify, or redirect any schedule.
- [ ] Unit tests: all five unlock formulas, cliff boundary, cancel-revocable, cancel-locked-reverts, third-address relay reverts, witness mismatch reverts, keeper-style claim by non-recipient.
- [ ] `forge build` and all tests pass on arc-forge.
- [ ] `StreamTicker` degrades to a static number under `prefers-reduced-motion`.
- [ ] All schedule pages have empty, loading, and error states.
- [ ] No product name in `ScheduledPayouts.sol`, its events, or test file names.
- [ ] `AUDIT.md` updated with `ScheduledPayouts` design rationale.
- [ ] Lint and typecheck clean, zero errors.
