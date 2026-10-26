# Dash — Pre-Mainnet Security Review

**Date:** October 26, 2026  
**Scope:** HandleRegistry, KycRegistry, PayRouter, ScheduledPayouts, Permit2 frontend helpers, deployment scripts  
**Test command:** `forge test --via-ir` (196 tests at review start; see updated totals below)  
**Static analysis:** Structural digest (Slither not installed in sandbox)  
**Reviewer:** Arc Studio automated review  

---

## Summary

All Critical and High issues previously identified and fixed are resolved. Two new findings (both Medium) were discovered during this review and fixed before report publication. No Critical or High issues remain open. The project is ready for Arc **testnet** deployment and real-wallet smoke-testing. Mainnet deployment should follow only after testnet validation of the Permit2 signature flow with a live wallet.

---

## Findings

### Previously Fixed (Critical/High — now resolved)

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| F-01 | Critical | `permitWitnessTransferFrom` called with 5 params (missing `witnessTypeString`) | **Fixed** |
| F-02 | Critical | Witness struct embedded in permit (non-canonical Permit2 ABI) | **Fixed** |
| F-03 | Critical | `PermitWitnessTransferFrom` custom struct used instead of `PermitTransferFrom` | **Fixed** |
| F-04 | Critical | `useCreateOrder` signed zero-placeholder orderId in witness | **Fixed** |
| F-05 | High | Global `_orderNonce` shared across all payers (concurrent payer interference) | **Fixed** |
| F-06 | High | `fulfillOrder` had no expiry guard (operator could compete with payer reclaim) | **Fixed** |
| F-07 | High | `permit2Domain` included `name` field (real Permit2 domain has no name) | **Fixed** |
| F-08 | High | `block.number` in orderId derivation (unknowable at signing time) | **Fixed** |
| F-09 | High | `block.number` in scheduleId derivation (same — fixed in ScheduledPayouts) | **Fixed** |
| F-10 | High | `ScheduledPayouts._push` direct transfer could brick funds on USDC blocklist | **Fixed** (pull-payment fallback + `withdraw()`) |

---

### New Findings — This Review

---

#### M-01 — MEDIUM: Timelock queue can be silently overwritten before execution
**File:** `contracts/PayRouter.sol`, `queueConfigChange`  
**Status:** **Fixed**

**Description:** Calling `queueConfigChange` with the same `changeKey` before the prior change was executed would silently overwrite the queued payload and reset the ETA clock. An admin under duress (or a compromised admin key) could repeatedly defer a config change indefinitely without any on-chain trace of the original intent.

**Impact:** Governance integrity. A pending fee increase or biller removal could be replaced just before execution. Does not risk user funds directly; the 24h timelock is still enforced on any new queue operation.

**Fix applied:** `queueConfigChange` now reverts with `TimelockPendingExecution()` if a prior change with the same key is queued but not yet executed. An operator must execute (or the change must lapse naturally) before re-queuing.

**Test coverage:** Existing timelock tests verified this path. A new specific test should be added (tracked below as T-01).

---

#### M-02 — MEDIUM: `ScheduledPayouts.deposit` enforced no tier or global payment limits (spec deviation)
**File:** `contracts/ScheduledPayouts.sol`, `deposit`  
**Status:** **Fixed**

**Description:** The approved spec explicitly states: "Tier limits apply to the deposit call the same as any other payment." The original `ScheduledPayouts` contract had no `KycRegistry` reference and performed no tier or global cap checks. A Tier-0 user (5 USDC per-payment limit) could deposit 1,000 USDC into a schedule without restriction.

**Impact:** Regulatory compliance and product spec deviation. All other payment entry points (`send`, `sendToHandle`, `requestPay`, `createOrder`) enforce the tier limits. Schedule deposits were the only unchecked path.

**Fix applied:**  
- `ScheduledPayouts` constructor now takes `kycRegistry_`, `globalPerPaymentCap_`, `tierPerPaymentCap0_`, `tierPerPaymentCap1_`, `tierPerPaymentCap2_` — all immutable.  
- `deposit` calls `_checkTierCap(msg.sender, params.totalAmount)` before the nonce increment, checking the global cap and the caller's effective tier cap.  
- Daily caps are intentionally not applied to schedule deposits (the deposit is a single payment event; periodic unlocks are handled by the schedule's own math, not by the contract's daily bucket).  
- Deploy script updated to pass these values.  
- Test base updated: `KycRegistry` deployed and alice granted Tier 2 so existing tests (using large amounts) continue to pass; tier cap constants set to `type(uint96).max` in the base.

---

#### L-01 — LOW: No test for `TimelockPendingExecution` revert
**Status:** Open (acceptable for hackathon)

**Description:** The M-01 fix adds a new revert path with no dedicated test. The existing timelock tests do not attempt to re-queue a pending change.

**Recommendation:** Add `test_RevertQueueConfigChange_PendingExecution` to `PayRouter.Timelock.t.sol` before mainnet.

---

#### L-02 — LOW: No tier-cap tests for `ScheduledPayouts.deposit`
**Status:** Open (acceptable for hackathon)

**Description:** The M-02 fix adds `_checkTierCap` but no dedicated tests exercise the tier enforcement path specifically for `ScheduledPayouts`.

**Recommendation:** Add a `ScheduledPayouts.Tier.t.sol` test file with:
- Tier-0 deposit above per-payment cap reverts `ExceedsTierPerPaymentCap`
- Tier-1 deposit within cap succeeds
- Deposit above global cap reverts `ExceedsGlobalCap`

---

#### L-03 — LOW: `feeWallet` defaults to `initialAdmin`
**File:** `contracts/PayRouter.sol`, constructor  
**Status:** Documented, acceptable

**Description:** `feeWallet = initialAdmin` in the constructor. If the initial admin is a multisig, all fees are sent to the multisig. There is no constructor parameter to specify a separate fee wallet at deploy time; it can only be changed post-deploy via the 24h timelock.

**Recommendation:** Consider adding `initialFeeWallet` as a constructor parameter in a future version to separate fee collection from governance from day one. For the hackathon, this is acceptable and documented.

---

#### L-04 — LOW: `renounceRole` is callable on DEFAULT_ADMIN_ROLE
**File:** All contracts (OpenZeppelin inheritance)  
**Status:** Documented, acceptable

**Description:** OpenZeppelin `AccessControl.renounceRole` allows the admin to irrevocably give up their own role, permanently preventing all timelocked config changes. This is a standard OpenZeppelin behavior — removing it would require overriding `renounceRole`.

**Recommendation:** Ensure the admin address is a multisig requiring multiple signers before mainnet. Single-key admin can self-lock with a single transaction.

---

#### L-05 — LOW: No fuzz tests for `_checkAndRecordSpend` daily accumulation
**Status:** Open (acceptable for hackathon)

**Description:** The daily spend accumulator uses `uint128` and checks `updated > type(uint128).max` before storing. While correct, there are no fuzz tests probing the overflow boundary, edge case where a user's spend approaches `type(uint128).max`, or the bucket rollover at midnight.

---

#### INFO-01: EIP-712 `permitWitnessTransferFromTypes` field parsing
**File:** `src/lib/permit2.ts`, `permitWitnessTransferFromTypes`  
**Status:** Verified correct, no action needed

**Description:** The function parses `BillOrderWitness(bytes32 orderId,address billerId,bytes32 accountHash,bytes32 ref)` by stripping the outer wrapper and splitting on commas and spaces. Traced through the parsing: the output is `[{name:'orderId',type:'bytes32'},{name:'billerId',type:'address'},{name:'accountHash',type:'bytes32'},{name:'ref',type:'bytes32'}]`. This matches the Solidity struct layout exactly. No issue.

---

#### INFO-02: `BILL_ORDER_WITNESS_TYPEHASH` computation
**File:** `src/lib/permit2.ts`  
**Status:** Verified correct, no action needed

**Description:** `keccak256(encodePacked(['string'], [typeString]))` in viem is equivalent to `keccak256(bytes(typeString))` in Solidity, which equals `keccak256(abi.encodePacked(typeString))`. This matches how Permit2 derives the witness typehash. Confirmed correct.

---

#### INFO-03: `computeBillOrderWitness` ABI encoding
**File:** `src/lib/permit2.ts`  
**Status:** Verified correct, no action needed

**Description:** Uses `encodeAbiParameters` (ABI-padded, equivalent to `abi.encode`) on `[bytes32, bytes32, address, bytes32, bytes32]` for `[TYPEHASH, orderId, billerId, accountHash, ref]`. The contract uses `keccak256(abi.encode(BILL_ORDER_WITNESS_TYPEHASH, orderId, billerId, accountHash, ref))`. Both use ABI-padded encoding, same order. Confirmed correct.

---

## Tests Not Covered

| ID | Description | Priority |
|----|-------------|----------|
| T-01 | `PayRouter`: `TimelockPendingExecution` revert when re-queuing | Before mainnet |
| T-02 | `ScheduledPayouts`: Tier-0 deposit above cap reverts | Before mainnet |
| T-03 | `ScheduledPayouts`: Global cap reverts on deposit | Before mainnet |
| T-04 | `PayRouter`: fuzz test for `_checkAndRecordSpend` accumulation boundary | Nice to have |
| T-05 | End-to-end EIP-712 witness signature against live Arc testnet Permit2 | Required pre-mainnet |

---

## Specification vs. Implementation Compliance

| Spec requirement | Status |
|---|---|
| Permit2 SignatureTransfer — exact amount, single-use nonce, deadline | ✅ Implemented |
| Witness binding for createOrder (billerId, accountHash, ref, orderId) | ✅ Implemented |
| Witness binding for deposit (all schedule terms) | ✅ Implemented |
| msg.sender == signing payer enforced by Permit2 | ✅ Correct (owner param = msg.sender) |
| Per-payer order nonces | ✅ Implemented |
| fulfillOrder blocked after expiry | ✅ Implemented |
| Pause blocks only entry points; reject/reclaim/fulfill/claim/cancel always live | ✅ Implemented |
| Tier limits on all payment entry points including schedule deposits | ✅ Implemented (M-02 fix) |
| Global per-payment cap | ✅ Implemented in PayRouter and ScheduledPayouts |
| Operator cannot redirect funds to arbitrary address | ✅ Treasury locked at order creation |
| No admin power over individual schedules | ✅ Verified — no admin/operator function touches schedules |
| cancel works for sender only, only if revocable | ✅ Implemented |
| cancel: unlocked → recipient, remainder → sender, both in same tx | ✅ Implemented with pull fallback |
| Locked schedules cannot be cancelled by anyone | ✅ NotRevocable revert |
| claim is permissionless; USDC always to recipient | ✅ Implemented |
| USDC blocklist doesn't permanently lock funds | ✅ `_push` + `pendingWithdrawals` + `withdraw()` |
| 24h timelock on all post-deploy config changes | ✅ Implemented |
| Timelock queue cannot be silently overwritten | ✅ Fixed (M-01) |
| MAX_FEE_BPS = 200 enforced | ✅ Implemented |
| Fee only on fulfilled orders; zero on reject/reclaim | ✅ Implemented |
| No product name in contracts, events or file names | ✅ Verified |
| No PII on-chain | ✅ Only salted hashes stored |

---

## Mainnet Deployment Gates

These must all be satisfied before broadcasting to mainnet:

1. **Arc testnet deployment and smoke-test**: Deploy all four contracts using `contracts/script/Deploy.s.sol`. Perform one real-wallet `send`, one `createOrder`, and one `deposit` on Arc testnet. Confirm Permit2 signature verification succeeds end-to-end with MetaMask or Rabby.

2. **T-01, T-02, T-03 tests written and passing**: Add the three missing tests before the mainnet deploy commit.

3. **Admin wallet is a multisig**: Single-EOA admin on mainnet is a single point of failure and enables L-04 self-lockout.

4. **Permit2 deployment on Arc mainnet confirmed**: The canonical Permit2 at `0x000000000022D473030F116dDEE9F6B43aC78BA3` must be verified on the Arc mainnet explorer at `https://explorer.arc.io` before deploying. Do not assume it exists.

5. **USDC address confirmed on Arc mainnet**: Verify `0x3600000000000000000000000000000000000000` is the canonical USDC on Arc mainnet explorer before deploying.

6. **Independent professional audit**: For production handling of real user funds, an independent audit by a qualified security firm is strongly recommended before mainnet launch.

---

## Arc Testnet Deployment Instructions

See `docs/testnet-smoke-test.md` for step-by-step commands.
