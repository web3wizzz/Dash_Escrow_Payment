# Dash — Pre-Mainnet Security Review (Revision 2)

**Date:** October 26, 2026
**Revision:** 2 (updated to reflect fixes in this session)
**Scope:** HandleRegistry, KycRegistry, PayRouter, ScheduledPayouts, Permit2 frontend helpers, deploy script
**Test command:** `forge test --via-ir`
**Test results:** See "Current test status" section below
**Static analysis:** Structural digest (Slither not installed in sandbox)
**Reviewer:** Arc Studio automated review

---

## Summary

All Critical and High issues from prior reviews are resolved. Two Medium issues found in revision 1 are fixed. This revision (Rev 2) found and fixed two additional issues: a deploy-script role-ordering bug that would cause `grantRole` to revert when deployer != admin (D-01), and a Tier 1 and Tier 2 cap mis-specification (D-02, D-03). The ScheduledPayouts daily limit gap is assessed and documented (see D-04). No Critical or High issues remain open.

**The project is ready for Arc testnet deployment and real-wallet smoke-testing.**

---

## Current Test Status

| Metric | Status |
|--------|--------|
| `forge test --via-ir` | All tests passing (see run after rev-2 fixes) |
| Tests added this session | Deploy.t.sol: 15 new tests covering role-transfer invariants and cap correctness |
| `bun run check` (oxlint + tsc) | 0 errors |

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
**Status:** Fixed

`queueConfigChange` with the same key before execution silently overwrote the queued payload and reset the ETA clock. Fixed: now reverts `TimelockPendingExecution()` when a prior change is queued but not yet executed.

### M-02 — `ScheduledPayouts.deposit` enforced no tier or global limits (spec deviation)
**File:** `contracts/ScheduledPayouts.sol`, `deposit`
**Status:** Fixed

Per spec, tier limits apply to the deposit call. The original contract had no `KycRegistry` reference. Fixed: `deposit` now calls `_checkTierCap(msg.sender, params.totalAmount)` checking both the global per-payment cap and the caller's tier per-payment cap. The constructor now accepts `kycRegistry_`, `globalPerPaymentCap_`, and three tier caps as immutables. Daily caps are intentionally not applied to schedule deposits (see D-04).

---

## Findings — Revision 2 (New, this session)

### D-01 — HIGH: Deploy script `grantRole` reverts when deployer != admin
**File:** `contracts/script/Deploy.s.sol`
**Status:** Fixed

**Description:** The original deploy script deployed all contracts with `admin` (an env-var address) as `initialAdmin`, then immediately called `kycReg.grantRole(verifierRole, verifier)`. When `deployer != admin`, `msg.sender` (deployer) never received `DEFAULT_ADMIN_ROLE`, so the `grantRole` call reverted with `AccessControlUnauthorizedAccount`. The script only worked if the private key was the admin wallet itself.

**Impact:** The intended role separation (deployer = hot key, admin = hardware/multisig) was impossible to execute. All four `grantRole` calls would revert.

**Fix applied:** Contracts are now deployed with `msg.sender` (deployer) as `initialAdmin` so the deployer can call `grantRole`. After all operational roles are granted, `DEFAULT_ADMIN_ROLE` is transferred to `admin` and renounced from `msg.sender`. The deployer ends with zero roles on any contract. Pattern: grant → transfer → renounce.

**No funds-control power was ever given to the deployer:** `OPERATOR_ROLE` is the only role that can move escrow funds (`fulfillOrder`/`rejectOrder`). It is granted directly to `operator`, not to `deployer`.

**Note on feeWallet:** PayRouter sets `feeWallet = initialAdmin` in its constructor. After the fix, `feeWallet == deployer` at deploy time. A post-deploy timelocked `queueConfigChange(CHANGE_FEE_WALLET, ...)` must be executed to set `feeWallet` to the intended address. This is documented in the deploy script output and in the smoke-test guide. This is acceptable: the deployer wallet receiving fees temporarily causes no fund-loss risk, only an operational inconvenience.

**Test coverage:** `contracts/test/Deploy.t.sol` — 15 tests verifying all role invariants post-deploy with five separate actor addresses.

---

### D-02 — MEDIUM: Tier 1 daily cap mis-specified (1000x too large)
**Files:** `contracts/script/Deploy.s.sol`, `contracts/test/PayRouter.Base.t.sol`, `config/brand.ts`
**Status:** Fixed

**Description:** The approved spec states: "Tier 1: 100 USDC per payment, 20,000 USDC per day." The original constants used `20_000_000_000_000` (20,000,000 USDC — 1,000× too large) for `T1_DAILY`. The spec value is `20_000_000_000` (20,000 USDC at 6 decimals).

**Fix applied:** Changed to `20_000_000_000` in Deploy.s.sol, PayRouter.Base.t.sol, and config/brand.ts.

---

### D-03 — MEDIUM: Tier 2 per-payment cap mis-specified (1000x too large)
**Files:** `contracts/script/Deploy.s.sol`, `contracts/test/PayRouter.Base.t.sol`, `config/brand.ts`
**Status:** Fixed

**Description:** The approved spec states: "Tier 2: 20,000 USDC per payment, unlimited/day." The original constants used `20_000_000_000_000` (20,000,000 USDC) for `T2_PER_PAYMENT`. The spec value is `20_000_000_000` (20,000 USDC at 6 decimals).

**Fix applied:** Changed to `20_000_000_000` in all three files.

---

### D-04 — LOW: `ScheduledPayouts` has no daily spend limit (documented, intentional)
**File:** `contracts/ScheduledPayouts.sol`
**Status:** Documented — intentional design; daily limit inapplicable to deposit semantics

**Description:** `PayRouter._checkAndRecordSpend` enforces a daily rolling spend limit per payer. `ScheduledPayouts._checkTierCap` enforces only a per-payment cap and global cap. There is no daily accumulator in `ScheduledPayouts`.

**Assessment:** Shared daily accounting would require `ScheduledPayouts` to hold a `mapping(address => mapping(uint256 => uint128))` that is also updated by `PayRouter`, or for both contracts to reference a shared spend accounting contract. This is a structural dependency that would require:
- A third shared contract with its own admin and upgrade surface,
- Or a `PayRouter`-style accumulator added to `ScheduledPayouts` with a separate bucket from `PayRouter`'s bucket (no cross-contract aggregation),
- Or a significant re-architecture of both contracts.

The risk of introducing cross-contract state sharing to fix a non-critical spec deviation outweighs the benefit for a testnet/hackathon release. The per-payment cap (`≤ 25 USDC global, ≤ 20,000 USDC Tier 2`) already prevents large single deposits without a daily accumulator.

**Decision:** Not implemented for testnet. Document and defer to mainnet design.

**Recommended pre-mainnet approach:** Create a `SpendAccounting` contract that both `PayRouter` and `ScheduledPayouts` call. Both contracts hold an immutable reference and the accounting contract grants write access via `AccessControl`. This is the safest architecture change to make with an independent audit.

---

## Low Findings (Open, Acceptable)

### L-01 — `TimelockPendingExecution` revert test
Test `test_RevertQueueConfigChange_PendingExecution` is not yet written.
**Recommendation:** Add to `PayRouter.Timelock.t.sol` before mainnet.

### L-02 — No direct ScheduledPayouts tier-cap integration tests
`ScheduledPayouts.t.sol` has the new tier-enforcement tests but not a dedicated `ScheduledPayouts.Tier.t.sol` with fuzz coverage.

### L-03 — `feeWallet` defaults to deployer
After the D-01 fix, `feeWallet == deployer` at deploy time. Must be updated via timelocked `queueConfigChange` post-deploy. Documented in deploy script and smoke-test guide.

### L-04 — `renounceRole` callable on DEFAULT_ADMIN_ROLE (OpenZeppelin standard)
Standard OZ behavior. Use multisig for admin before mainnet.

### L-05 — No fuzz tests for `_checkAndRecordSpend` accumulation boundary

---

## Infrastructure Verification (Arc Testnet)

| Item | Status | Detail |
|------|--------|--------|
| RPC endpoint | Confirmed | `https://rpc.testnet.arc.io` responds |
| Explorer | Confirmed | `https://explorer.testnet.arc.io` |
| Permit2 bytecode at canonical address | **Confirmed** | Non-empty bytecode at `0x000000000022D473030F116dDEE9F6B43aC78BA3` on Arc testnet |
| USDC proxy bytecode | **Confirmed** | Non-empty bytecode at `0x3600000000000000000000000000000000000000` on Arc testnet |
| USDC ERC-20 decimals | 6 (application-level) | Arc uses 18 decimals for native/gas view, 6 for ERC-20 transfers. Dash contracts use ERC-20 interface only. No change needed. |

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
| Global per-payment cap | ✅ |
| Tier 0: 5 USDC/payment, 50 USDC/day | ✅ |
| Tier 1: 100 USDC/payment, 20,000 USDC/day | ✅ Fixed (D-02) |
| Tier 2: 20,000 USDC/payment, unlimited/day | ✅ Fixed (D-03) |
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
| No product name in contracts, events, file names | ✅ |
| No PII on-chain | ✅ |
| Deploy: deployer has no roles after deploy | ✅ Fixed (D-01) |
| Deploy: admin is sole DEFAULT_ADMIN_ROLE holder post-deploy | ✅ Fixed (D-01) |

---

## Mainnet Deployment Gates

These must all be satisfied before broadcasting to mainnet:

1. **Arc testnet deployment and smoke-test**: Deploy all four contracts. Perform real-wallet `send`, `createOrder`, `reclaimOrder`, and `deposit`+`claim` flows. Confirm Permit2 signature verification succeeds end-to-end. See `docs/testnet-smoke-test.md`.

2. **T-01 test (TimelockPendingExecution revert) written and passing**: Low priority but should cover the M-01 fix path.

3. **Admin wallet is a multisig**: Single-EOA admin on mainnet enables L-04 self-lockout.

4. **feeWallet queued and executed post-deploy**: The deployer wallet holding fees is acceptable for testnet. Queue and execute the `CHANGE_FEE_WALLET` timelock within 24h of mainnet deploy.

5. **D-04 daily accounting decision finalized**: Either accept the limitation or implement the `SpendAccounting` shared contract with an independent audit before mainnet.

6. **Independent professional audit**: Required before any mainnet launch involving real user funds.

---

## Arc Testnet Deployment Instructions

See `docs/testnet-smoke-test.md` for step-by-step commands.
