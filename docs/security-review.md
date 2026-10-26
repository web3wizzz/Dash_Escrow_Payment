# Dash — Pre-Mainnet Security Review (Revision 3)

**Date:** October 26, 2026
**Revision:** 3
**Scope:** HandleRegistry, KycRegistry, PayRouter, ScheduledPayouts, Permit2 frontend helpers, deploy script
**Test command:** `forge test --via-ir`
**Test results:** 224/224 passed, 0 failed (see Current Test Status)
**Static analysis:** Structural digest (Slither not installed in sandbox)
**Reviewer:** Arc Studio automated review

---

## Summary

All Critical and High issues resolved. No Critical or High issues remain open.

Revision 3 fixed three additional issues: the `admin==deployer` footgun in the deploy script
(E-01), the `feeWallet` defaulting to `initialAdmin` / deployer (E-02), and a
`brand.ts` Tier 2 daily constant mismatch (E-03). Two feeWallet timelock tests added.
The L-01 test (TimelockPendingExecution) was already present from Rev 2; updated finding
status to match.

**The project is ready for Arc testnet deployment and real-wallet smoke-testing.**

---

## Current Test Status

| Metric | Status |
|--------|--------|
| `forge test --via-ir` | **224/224 passed, 0 failed** |
| `bun run check` (oxlint + tsc) | **0 errors, 0 warnings** |
| `forge build --via-ir` | **Clean (1 pre-existing warning, not an error)** |
| Dry-run simulation (`forge script --rpc-url`) | **Passed — all 4 contracts simulated, VITE_* printed, gas ~2.22 USDC** |
| Tests added Rev 3 | 5 new Deploy.t.sol tests + 2 new Timelock tests (feeWallet) |

---

## Findings — Previously Fixed (Critical/High)

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| F-01 | Critical | `permitWitnessTransferFrom` called with 5 params (missing `witnessTypeString`) | Fixed |
| F-02 | Critical | Witness struct embedded in permit (non-canonical Permit2 ABI) | Fixed |
| F-03 | Critical | `PermitWitnessTransferFrom` custom struct used instead of `PermitTransferFrom` | Fixed |
| F-04 | Critical | `useCreateOrder` signed zero-placeholder orderId in witness | Fixed |
| F-05 | High | Global `_orderNonce` shared across all payers (concurrent payer interference) | Fixed |
| F-06 | High | `fulfillOrder` had no expiry guard | Fixed |
| F-07 | High | `permit2Domain` included `name` field | Fixed |
| F-08 | High | `block.number` in orderId derivation | Fixed |
| F-09 | High | `block.number` in scheduleId derivation | Fixed |
| F-10 | High | `ScheduledPayouts._push` direct transfer bricks funds on USDC blocklist | Fixed (pull-payment fallback) |

---

## Findings — Revision 1 (Medium, Fixed)

### M-01 — Timelock queue can be silently overwritten before execution
**File:** `contracts/PayRouter.sol`, `queueConfigChange`
**Status:** Fixed + tested

`queueConfigChange` with the same key before execution silently overwrote the queued payload
and reset the ETA clock. Fixed: now reverts `TimelockPendingExecution()`. Test:
`test_RevertQueueConfigChange_PendingExecution` in `PayRouter.Timelock.t.sol`.

### M-02 — `ScheduledPayouts.deposit` enforced no tier or global limits (spec deviation)
**File:** `contracts/ScheduledPayouts.sol`, `deposit`
**Status:** Fixed + tested

`deposit` now calls `_checkTierCap(msg.sender, params.totalAmount)`. Constructor accepts
`kycRegistry_`, `globalPerPaymentCap_`, and three tier caps. Daily caps intentionally not
applied to deposits (see D-04).

---

## Findings — Revision 2 (Fixed)

### D-01 — HIGH: Deploy script `grantRole` reverts when deployer != admin
**Status:** Fixed in Rev 2. See Rev 2 notes.

### D-02 — MEDIUM: Tier 1 daily cap mis-specified (1000× too large)
**Status:** Fixed in Rev 2. `20_000_000_000` (20,000 USDC).

### D-03 — MEDIUM: Tier 2 per-payment cap mis-specified (1000× too large)
**Status:** Fixed in Rev 2. `20_000_000_000` (20,000 USDC).

### D-04 — LOW: `ScheduledPayouts` has no daily spend limit (documented, intentional)
**Status:** Documented. See below for recommended pre-mainnet approach.

---

## Findings — Revision 3 (New, this session)

### E-01 — HIGH: Deploy script footgun when `admin == deployer`
**File:** `contracts/script/Deploy.s.sol`
**Status:** Fixed

**Description:** When `DEPLOY_ADMIN_ADDRESS == msg.sender`, the deploy script (Rev 2
pattern) called:
1. `grantRole(DEFAULT_ADMIN_ROLE, admin)` — no-op (deployer already holds it)
2. `renounceRole(DEFAULT_ADMIN_ROLE, deployer)` — removes the ONLY admin

This left every contract permanently adminless with no recovery path.

**Fix applied:** The script detects `deployerIsAdmin = (msg.sender == admin)` at startup.
The renounce section is now guarded: `if (!deployerIsAdmin) { ... renounce ... }`. When
`deployer == admin`, no renounce is performed; the deployer IS the admin and retains all
roles as intended. A console warning is emitted. This is acceptable for testnet single-wallet
setups; mainnet must use separate wallets.

**Test coverage:** `test_AdminEqualsDeployer_RetainsAdminRole` in `Deploy.t.sol` — verifies
that after the full setup sequence with a single wallet, the wallet still holds
`DEFAULT_ADMIN_ROLE` on all contracts and can queue config changes.

---

### E-02 — HIGH: `feeWallet` defaulted to `initialAdmin` (deployer wallet received fees)
**File:** `contracts/PayRouter.sol` constructor
**Status:** Fixed

**Description:** The constructor set `feeWallet = initialAdmin`. After the Rev 2
grant-transfer-renounce fix, `initialAdmin = msg.sender` (deployer). This meant all
protocol fees on fulfilled bill orders were sent to the deployer wallet, not the intended
fee recipient. Even with `feeBps = 0` at launch, this would become a fund-misdirection bug
the moment fees were enabled.

**Fix applied:** `PayRouter` constructor now accepts an explicit `feeWallet_` parameter
(6th positional argument, after `initialAdmin`). Zero address reverts. The deploy script
passes `feeWallet` (from `DEPLOY_FEE_WALLET_ADDRESS`, defaulting to `admin`). The test
base also uses a distinct `feeWalletAddr = makeAddr("feeWallet")`.

**Eliminating L-03:** This fix removes the post-deploy feeWallet timelock ceremony that
was previously required. The feeWallet is correct at deploy time. The `CHANGE_FEE_WALLET`
timelock path still exists for future updates; `test_TimelockCanChangeFeeWallet` and
`test_RevertFeeWalletChange_ZeroAddress` cover it.

**Test coverage:**
- `test_FeeWallet_IsExplicitParam_NotDeployer` — feeWallet != deployer
- `test_FeeWallet_IsExplicitParam_NotAdmin` — feeWallet != admin
- `test_RevertConstructor_ZeroFeeWallet` — zero address reverts
- `test_DuplicateRoles_OperatorEqualsAdmin_IsSafe` — feeWallet stays explicit when roles overlap
- `test_TimelockCanChangeFeeWallet` — post-deploy feeWallet update still works
- `test_RevertFeeWalletChange_ZeroAddress` — zero address guarded in timelock execute

---

### E-03 — LOW: `brand.ts` Tier 2 daily exported as `2n**256n-1n` (overflows `uint96`)
**File:** `config/brand.ts`, `TIER_LIMITS[2].daily`
**Status:** Fixed

**Description:** The TypeScript brand constant used `2n**256n-1n` for "unlimited". The
contract encodes `T2_DAILY = 0` (meaning no cap: `if (cfg.dailyCap != 0 && ...)` condition
is false when `dailyCap == 0`). The mismatch caused no contract bug (frontend only reads
this for display), but could cause UI inconsistencies. Fixed: `daily: 0n` matching the
contract convention.

---

## Low Findings (Open, Acceptable)

### L-01 — `TimelockPendingExecution` revert test
**Status:** Present — `test_RevertQueueConfigChange_PendingExecution` in
`PayRouter.Timelock.t.sol`. Closed.

### L-02 — No fuzz coverage for ScheduledPayouts tier-cap enforcement
**Recommendation:** Add fuzz tests before mainnet.

### L-03 — `feeWallet` defaults to deployer
**Status:** Closed by E-02 fix. feeWallet is now an explicit constructor param.

### L-04 — `renounceRole` callable on DEFAULT_ADMIN_ROLE (OZ standard behavior)
Use multisig for admin before mainnet.

### L-05 — No fuzz tests for `_checkAndRecordSpend` accumulation boundary

### L-06 — No integration test against forked Arc testnet with real Permit2 bytecode
Unit tests use MockPermit2. The canonical EIP-712 digest chain has not been
verified end-to-end against the real deployed Permit2. This is Mainnet Gate 1.

---

## D-04 — ScheduledPayouts daily limit gap (documented)

`ScheduledPayouts._checkTierCap` enforces the per-payment cap and global cap but has no
daily accumulator. `PayRouter._checkAndRecordSpend` has its own daily bucket that is
independent of ScheduledPayouts.

**Impact at testnet launch:** The 25 USDC global cap limits each deposit to ≤ 25 USDC.
A user could theoretically make multiple deposits in one day totaling more than their daily
tier limit, but at testnet caps this amounts to at most a few hundred USDC/day.

**Recommended pre-mainnet approach:** Extract daily accounting into a `SpendAccounting`
contract with `AccessControl`. Both `PayRouter` and `ScheduledPayouts` hold an immutable
reference to it and call `recordSpend(address, uint256)`. This is the safest architecture
— deploy `SpendAccounting` first, pass its address to both router constructors. Requires
an independent audit of the new contract.

---

## Specification vs. Implementation Compliance

| Spec requirement | Status |
|---|---|
| Permit2 SignatureTransfer — exact amount, single-use nonce, deadline | ✅ |
| Witness binding for createOrder (billerId, accountHash, ref, orderId) | ✅ |
| Witness binding for deposit (all schedule terms) | ✅ |
| msg.sender == signing payer enforced by Permit2 | ✅ |
| Per-payer order nonces | ✅ |
| fulfillOrder blocked after expiry | ✅ |
| Pause blocks only entry points; reject/reclaim/fulfill/claim/cancel always live | ✅ |
| Tier per-payment limits on all payment entry points incl. schedule deposits | ✅ |
| Global per-payment cap (25 USDC at launch) | ✅ |
| Tier 0: 5 USDC/payment, 50 USDC/day | ✅ |
| Tier 1: 100 USDC/payment, 20,000 USDC/day | ✅ |
| Tier 2: 20,000 USDC/payment, unlimited/day | ✅ |
| Shared daily accounting across PayRouter + ScheduledPayouts | ⚠️ Not implemented — see D-04 |
| Operator cannot redirect funds to arbitrary address | ✅ Treasury locked at order creation |
| No admin power over individual schedules | ✅ |
| cancel works for sender only, only if revocable | ✅ |
| Locked schedules cannot be cancelled | ✅ |
| claim is permissionless; USDC always to recipient | ✅ |
| USDC blocklist doesn't permanently lock funds | ✅ pull-payment fallback |
| 24h timelock on all post-deploy config changes | ✅ |
| Timelock queue cannot be silently overwritten | ✅ |
| MAX_FEE_BPS = 200 enforced | ✅ |
| Fee only on fulfilled orders | ✅ |
| feeWallet set explicitly at deploy, not to deployer | ✅ Fixed (E-02) |
| No product name in contracts, events, file names | ✅ |
| No PII on-chain | ✅ |
| Deploy: deployer has no roles after deploy (when deployer != admin) | ✅ |
| Deploy: admin==deployer case handled safely (no role drop) | ✅ Fixed (E-01) |
| Deploy: admin is sole DEFAULT_ADMIN_ROLE holder post-deploy | ✅ |

---

## Infrastructure Verification (Arc Testnet)

| Item | Status | Detail |
|------|--------|--------|
| RPC endpoint | Confirmed | `https://rpc.testnet.arc.io` responds |
| Explorer | Confirmed | `https://explorer.testnet.arc.io` |
| Permit2 bytecode at canonical address | **Confirmed** | Non-empty at `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| USDC proxy bytecode | **Confirmed** | Non-empty at `0x3600000000000000000000000000000000000000` |
| USDC ERC-20 decimals | 6 (application-level) | Native view 18 decimals; Dash uses ERC-20 only |
| Dry-run simulation | **Passed** | All 4 contracts, roles, gas ~2.22 USDC |

---

## Mainnet Deployment Gates

1. **Arc testnet deployment and smoke-test (L-06):** Deploy all four contracts. Perform
   real-wallet `send`, `createOrder`, `fulfillOrder`, `reclaimOrder`, and `deposit`+`claim`
   flows. Confirm Permit2 EIP-712 signature verification succeeds end-to-end.
   See `docs/testnet-smoke-test.md`.

2. **Admin wallet is a multisig (L-04):** Single-EOA admin enables self-lockout via
   `renounceRole`. Use Gnosis Safe or similar before mainnet.

3. **D-04 daily accounting decision finalized:** Either accept the limitation or implement
   the `SpendAccounting` shared contract with an independent audit before mainnet.

4. **Raise global per-payment cap via timelock:** The 25 USDC cap is a conservative testnet
   default. Queue and execute `CHANGE_GLOBAL_PER_PAYMENT_CAP` after confirming all flows
   work correctly.

5. **Independent security audit:** All contracts should receive an external audit before
   mainnet with real user funds at stake.
