Reading the existing plan and key files before writing the new one. Good. Full picture confirmed. Now writing the updated plan.

Here is the complete plan with `ScheduledPayouts` added and all your answers locked in:

---

## Implementation Plan: Dash

### Summary
Dash is a non-custodial USDC spending app on Arc mainnet. Users send USDC by handle or address, request money via link/QR, scan QR to pay, pay bills (sandboxed), and create scheduled payouts — pay later, allowances, vesting with cliff, payroll to multiple recipients, and per-second streaming salaries. The platform holds funds only in two places under fixed on-chain rules: 30-minute bill order escrow (`PayRouter`) and scheduled payout deposits (`ScheduledPayouts`). No admin, operator, or any other role can move those funds outside those rules.

---

### Architecture

**Blockchain:** Arc mainnet (chain ID 5042). USDC ERC-20 at `0x3600000000000000000000000000000000000000`, 6 decimals. `maxFeePerGas >= 20 gwei` on every tx. No confirmation-depth logic. Block ordering by block number.

**Contracts (four, all immutable):**

- `HandleRegistry` — free self-registration of `@handles`. One per wallet, non-transferable, reserved list at deploy. No role can register, change, or remove a user's handle.
- `KycRegistry` — tier 0/1/2 per address with expiry, `VERIFIER_ROLE` write access only, no PII.
- `PayRouter` — direct sends, request-payment events, bill order escrow (30-min auto-refund). Tier limits, globalPerPaymentCap, daily windows. Fee only on fulfilled bill orders. Permit2 SignatureTransfer on all flows.
- `ScheduledPayouts` — all five schedule types in one contract. Sender deposits USDC once via Permit2, and the contract releases it to recipients over time under immutable per-schedule rules. Tier limits do not apply to schedule creation; they apply to the deposit call the same as any other payment. No roles have power over individual schedules.

**ScheduledPayouts design decisions (from your answers):**

All five types share one `Schedule` struct, differentiated by `ScheduleType` enum. Fields not used by a given type are zero.

| Type | Unlock rule |
|---|---|
| `PayLater` | 100% unlocks at a fixed future timestamp |
| `Allowance` | Fixed amount unlocks every `period` seconds, repeating until deposit exhausted |
| `Vesting` | Linear unlock after `cliffEnd` timestamp, over `duration` |
| `Payroll` | One `Schedule` per recipient; each is an `Allowance` on the same period |
| `Streaming` | Continuous per-second linear unlock from `startTime` to `endTime` |

**Cancellation:** Only the sender can cancel, and only if `revocable == true` at creation time (immutable per schedule). On cancel: all unlocked-but-unclaimed USDC goes to the recipient first; unvested remainder returns to the sender. Works while paused. No role can cancel any schedule. This is enforced in code with no admin escape hatch.

**Claim:** Anyone can call `claim(scheduleId)`. The unlocked USDC always transfers to the recipient address recorded at creation — never to the caller. No signature, no relay permissions, no keeper role. An optional backend keeper may call `claim` for opted-in recipients but has no privileged access; it simply pays the gas.

**Permit2 binding for deposit:** The deposit signature uses the witness variant, committing to `scheduleId`, `recipient`, `scheduleType`, `amount`, `startTime`, `endTime`, `cliff`, `period`, and `revocable`. Parameter mismatch reverts.

**Pause:** `whenNotPaused` on `deposit` only. `claim` and `cancel` always work while paused.

**Frontend:** React + Vite + TypeScript, wagmi + ConnectKit, Tailwind CSS, Framer Motion. Arc mainnet chain config.

**Wallet:** ConnectKit — fully non-custodial.

**Backend:** Bun HTTP server on port 3001, `GET /billers`. Proxied via Vite at `/api`.

---

### Files to Create / Modify

**Contracts**
1. `contracts/ScheduledPayouts.sol` — all five schedule types, deposit via Permit2 witness, `claim`, `cancel` (revocable only, sender only), `claimable()` view, events for each state change, ReentrancyGuard, Pausable, AccessControl (admin role only for pause; no operator power over schedules), SafeERC20, NatSpec on every external function.
2. `contracts/test/ScheduledPayouts.t.sol` — happy-path for all five types; cliff not-yet-reached reverts; revocable/locked cancel logic; third-party relay reverts; witness mismatch reverts; per-second streaming math; payroll multi-recipient; keeper-style claim-by-anyone.

**Config**
3. `config/brand.ts` — add `SCHEDULE_DEPOSIT_WITNESS_TYPEHASH` constant (keeps contract and frontend in sync).

**Lib**
4. `src/lib/schedules.ts` — schedule type constants, unlock math (`claimableAmount`), Permit2 witness helpers for deposit, human-readable schedule description formatter.

**Hooks**
5. `src/hooks/useScheduledPayouts.ts` — `useDeposit`, `useClaim`, `useCancel`, `useSchedule` (read), `useMySchedules` (enumerate sent/received from events).

**Components**
6. `src/components/schedules/ScheduleTypeSelect.tsx` — five type chips with short descriptions.
7. `src/components/schedules/ScheduleForm.tsx` — dynamic fields per type (cliff date, period, end date, recipient list for payroll), amount, revocable toggle, confirm + Permit2 sign flow.
8. `src/components/schedules/ScheduleCard.tsx` — compact card: type badge, recipient, total, claimed, claimable bar, claim/cancel buttons with live countdown (Streaming shows per-second ticker).
9. `src/components/schedules/StreamTicker.tsx` — real-time USDC/sec counter using `requestAnimationFrame`, `prefers-reduced-motion` fallback.

**Pages**
10. `src/pages/Schedules.tsx` — two tabs: Sent and Received. Lists `ScheduleCard` components. Empty states. Create button.
11. `src/pages/ScheduleDetail.tsx` — single schedule view with full timeline, claim/cancel, explorer link after tx.
12. `src/pages/ScheduleCreate.tsx` — hosts `ScheduleForm`, handles Payroll multi-recipient list.

**App wiring**
13. `src/App.tsx` — add `/schedules`, `/schedules/new`, `/schedules/:id` routes. Add Schedules tab to bottom nav if it fits; otherwise expose via Home quick actions.

**AUDIT.md update**
14. Add section for `ScheduledPayouts`: witness typehash binding rationale, why `claim` is permissionless-to-caller (funds always go to recipient), why `cancel` requires no timelock (payer's own deposit, no third-party funds at risk).

---

### Build Sequence

1. **Write `ScheduledPayouts.sol`** — contract only; inline Permit2 interface (same structs as PayRouter); all five types; deposit witness binding; `claim`; `cancel`; `claimable()` view; NatSpec; events; no admin power over individual schedules.
2. **Security review** — both auditors on `ScheduledPayouts.sol` at balanced severity (critical + high auto-fix). No other contracts touched.
3. **Write `contracts/test/ScheduledPayouts.t.sol`** — all schedule types, cancel branches, Permit2 binding tests.
4. **Run `forge build` + `forge test`** — must pass clean before frontend work starts.
5. **Update `config/brand.ts`** — add `SCHEDULE_DEPOSIT_WITNESS_TYPEHASH`.
6. **Write `src/lib/schedules.ts`** — type constants, unlock math, witness helpers, formatters.
7. **Write `src/hooks/useScheduledPayouts.ts`** — deposit, claim, cancel, read hooks.
8. **Write schedule components** — `ScheduleTypeSelect`, `ScheduleForm`, `ScheduleCard`, `StreamTicker`.
9. **Write schedule pages** — `ScheduleCreate`, `Schedules` (sent/received tabs), `ScheduleDetail`.
10. **Update `src/App.tsx`** — add routes and nav entry.
11. **Lint + typecheck pass** — zero errors.

---

### Done When

- [ ] `ScheduledPayouts` compiles clean; all five schedule types work end-to-end in tests.
- [ ] Deposit uses Permit2 witness variant; witness covers all schedule terms; mismatch reverts.
- [ ] `claim(id)` by any caller; USDC always to recipient; correct unlock math for all types.
- [ ] Streaming per-second math matches the on-chain formula in the frontend ticker.
- [ ] `cancel` only works when `revocable == true` and caller is the sender; locked schedules cannot be cancelled by anyone.
- [ ] On cancel: unlocked-but-unclaimed amount goes to recipient; remainder to sender.
- [ ] `cancel` and `claim` both work while contract is paused.
- [ ] Pause blocks only `deposit`.
- [ ] No role (admin, operator, any other) can cancel, modify, or redirect any schedule.
- [ ] Unit tests cover: all five type unlock formulas, cliff boundary, cancel-revocable, cancel-locked-reverts, third-address relay reverts, witness mismatch reverts, keeper-style claim by non-recipient.
- [ ] `forge build` and all tests pass on arc-forge.
- [ ] `src/lib/schedules.ts` unlock math matches contract formula exactly.
- [ ] `StreamTicker` degrades to a static number under `prefers-reduced-motion`.
- [ ] All schedule pages have empty, loading, and error states.
- [ ] No product name in `ScheduledPayouts.sol`, its events, or its test file names.
- [ ] `AUDIT.md` updated with `ScheduledPayouts` design rationale.
- [ ] Lint and typecheck clean, zero errors.

---

## Ready to build?

Approve this plan and I'll start with `ScheduledPayouts.sol`. Plan saved and updated. Here's a summary of what was locked in from your answers, and what comes next:

---

**Your answers encoded in the plan:**

**All five types** go in `ScheduledPayouts.sol` in one contract with one `Schedule` struct — `PayLater`, `Allowance`, `Vesting`, `Payroll`, `Streaming`. Payroll is implemented as one `Allowance` schedule per recipient on the same period, created in a single frontend call.

**Cancellation** — only the sender, only if `revocable == true` at creation (immutable on-chain). A locked schedule cannot be cancelled by anyone at all, including admin. On cancel: unlocked-but-unclaimed USDC goes to the recipient first, unvested remainder returns to sender, both in the same transaction. The cancel function is not blocked by pause.

**Claim** — fully permissionless caller, USDC always to the recorded recipient. Anyone (a keeper, a friend, the recipient themselves) can call `claim(scheduleId)` and the funds go to the recipient regardless of who sent the transaction. No signatures, no relay roles, no keeper permissions.

**Next step:** Approve this plan and I'll write `ScheduledPayouts.sol` first, then security review, then tests, then the full frontend. Switch to Build mode to proceed.
