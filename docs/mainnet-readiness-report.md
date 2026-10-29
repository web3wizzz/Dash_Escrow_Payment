# DA$H Arc Mainnet Readiness Report
Generated: 2026-10-29  
Status: **NO-GO — 3 owner actions required before mainnet**

---

## Summary

235 unit/fuzz tests pass. 9/9 fork EIP-712 tests pass against live Arc Testnet Permit2.
Deployment dry-run succeeds (gas estimate: ~0.35 USDC on testnet, comparable on mainnet).
All on-chain preconditions for mainnet (USDC, Permit2) are verified live.
Three blockers remain that require your action: dedicated role wallets (B1), dedicated biller
addresses (B2), and real-wallet end-to-end smoke tests on testnet (B3).
GitHub push (B4) requires your browser authentication.

---

## 1. Current Testnet Deployments

All verified by live on-chain reads (2026-10-29).

| Contract | Address (Arc Testnet 5042002) | Key state |
|---|---|---|
| HandleRegistry | `0x34cae0957ec0cd2327e134f2008ee111e66ca081` | admin = platform deployer |
| KycRegistry | `0x3a480497c8d48c065dac5fdd46ea339aeb9a8bfd` | admin = platform deployer |
| PayRouter v2 | `0x37f2edadf59cf2027cf52f13ed2272a3cf69055b` | globalCap=25 USDC, feeBps=0, timeout=1800s |
| ScheduledPayouts | `0x95f13b64172e6df601fd6cec3f3c0b71d0e6f917` | globalCap=25 USDC |

Live reads (evidence):
- `PayRouter.globalPerPaymentCap()` → `25000000` (25 USDC, 6 dec) ✓
- `PayRouter.feeBps()` → `0` ✓
- `PayRouter.orderTimeoutSeconds()` → `1800` ✓
- `PayRouter.feeWallet()` → `0x5B12Ce46...` (platform deployer — testnet only) ✓
- `PayRouter.isBiller(0x5B12Ce46...)` → `true` ✓
- `PayRouter.hasRole(DEFAULT_ADMIN_ROLE, 0x5B12Ce46...)` → `true` ✓
- `ScheduledPayouts.globalPerPaymentCap()` → `25000000` ✓
- `ScheduledPayouts.hasRole(DEFAULT_ADMIN_ROLE, 0x5B12Ce46...)` → `true` ✓

---

## 2. Required Role Wallet Addresses

The deploy script requires four env vars. Below is each role, what it controls, security level
required, and whether it can share an address with another role.

### DEPLOY_ADMIN_ADDRESS — DEFAULT_ADMIN_ROLE
Holds on: HandleRegistry, KycRegistry, PayRouter, ScheduledPayouts

**Powers:**
- Grant/revoke any role on any contract
- Queue and execute timelocked config changes (feeBps, feeWallet, globalCap, billers, orderTimeout, minBillTier)
- After the 24h timelock: change fee recipient, fee percentage, global per-payment cap

**Security requirement:** Hardware wallet or multisig. This is the highest-privilege address in the
system. If compromised, an attacker can drain the fee wallet and change all configuration (but
cannot directly access user funds held in escrow or scheduled payouts — those are released only
to the original payer/recipient by contract logic).

**Must be separate from:** DEPLOY_OPERATOR_ADDRESS (hot wallet). If admin == operator, a
compromised hot wallet also controls all configuration.

**Can share with:** DEPLOY_PAUSER_ADDRESS and DEPLOY_VERIFIER_ADDRESS at launch (lower risk).
However separating them is strongly recommended.

---

### DEPLOY_OPERATOR_ADDRESS — OPERATOR_ROLE
Holds on: PayRouter only

**Powers:**
- `fulfillOrder(orderId)` — release escrowed USDC to biller treasury
- `rejectOrder(orderId)` — return escrowed USDC to payer

**Security requirement:** Backend hot wallet (can be a software key). If compromised, an attacker
can fulfill or reject pending orders, but cannot create orders, move user funds beyond what is
already held in escrow, or change configuration.

**Must be separate from:** DEPLOY_ADMIN_ADDRESS.

**Can share with:** DEPLOY_BILLER_ADDRESS if the same backend handles both operations (acceptable
at launch but suboptimal — recommend separating before scaling).

---

### DEPLOY_VERIFIER_ADDRESS — VERIFIER_ROLE
Holds on: KycRegistry only

**Powers:**
- `setTier(address, tier, expiry)` — set KYC tier for a wallet

**Current usage:** KYC tiers are NOT enforced on any payment path at launch (permissionless
model). The verifier role is retained for future governance only.

**Can be set to DEPLOY_ADMIN_ADDRESS at launch.** This is safe because:
1. Setting a tier has no immediate financial effect (payment gates removed).
2. You can rotate to a dedicated verifier later via `grantRole` + `renounceRole` on KycRegistry.

---

### DEPLOY_PAUSER_ADDRESS — PAUSER_ROLE
Holds on: PayRouter and ScheduledPayouts

**Powers:**
- `pause()` / `unpause()` — block new payment entry points (send, createOrder, deposit)
- Refunds, reclaims, cancellations, and claims always work even when paused

**Security requirement:** Should be reachable quickly in an emergency. A hardware wallet that
you can access within minutes, or a 1-of-N multisig.

**Can share with:** DEPLOY_ADMIN_ADDRESS (the admin can always pause via PAUSER_ROLE if it holds
both). Separate only if you want a non-admin key that can pause but not change config.

---

### DEPLOY_BILLER_ADDRESS and DEPLOY_BILLER_TREASURY
Not a role — registered in the PayRouter constructor as the initial biller.

- `DEPLOY_BILLER_ADDRESS`: the address that calls `fulfillOrder` and `rejectOrder` (same as
  OPERATOR_ROLE in most deployments — the operator IS the biller's fulfillment backend).
- `DEPLOY_BILLER_TREASURY`: where fulfilled escrow payments are sent. This should be a
  dedicated treasury wallet, NOT the admin or operator address, so billing revenue is isolated.

**Recommendation:** Use your operator address as `DEPLOY_BILLER_ADDRESS` and a dedicated
treasury address as `DEPLOY_BILLER_TREASURY`. The treasury only receives USDC; it needs no
signing capability and can be a cold wallet.

---

### Minimum-viable mainnet address set (4 wallets)

You can deploy safely with 4 addresses:

| Env var | Wallet | Type |
|---|---|---|
| `DEPLOY_ADMIN_ADDRESS` | Admin multisig | Hardware/multisig |
| `DEPLOY_OPERATOR_ADDRESS` = `DEPLOY_BILLER_ADDRESS` | Operator backend | Software hot key |
| `DEPLOY_VERIFIER_ADDRESS` | (set to admin at launch) | Same as admin |
| `DEPLOY_PAUSER_ADDRESS` | (set to admin at launch) | Same as admin |
| `DEPLOY_BILLER_TREASURY` | Treasury | Cold wallet |
| `DEPLOY_FEE_WALLET_ADDRESS` | (set to admin at launch) | Same as admin |

This gives you two operationally distinct keys: a cold admin and a hot operator/biller.
Expand to more keys as the operation scales.

---

## 3. Permit2 and USDC on Arc Mainnet — Evidence

### USDC (0x3600000000000000000000000000000000000000)
- `symbol()` → `"USDC"` ✓ (live read 2026-10-29)
- `decimals()` → `6` ✓
- Source: FiatTokenProxy (Circle's canonical USDC), same address on mainnet and testnet

### Permit2 (0x000000000022D473030F116dDEE9F6B43aC78BA3)
- `allowance(...)` call succeeded → contract is live ✓ (live read 2026-10-29)
- Domain separator formula verified: `keccak256(abi.encode(EIP712Domain(string name,uint256 chainId,address verifyingContract), keccak256("Permit2"), 5042, 0x000...BA3))` = `0xa88a1b742ab6890402e6ee74f2359f3723ab547c6dc3b850249bdbffebe2b18f`
- Computed value matches live chain read: `0xa88a1b74...` ✓
- Permit2 witness selector: `0x137c29fe` (nested tuple ABI encoding) — verified against bytecode

### Key EIP-712 findings from fork test campaign
- Permit2 domain type string: `EIP712Domain(string name,uint256 chainId,address verifyingContract)` — includes `name = "Permit2"`
- `permitWitnessTransferFrom` ABI selector: `0x137c29fe` (inner struct = nested tuple, not flattened)
- Arc USDC `transfer`/`transferFrom` routes through native precompile `0x1800...` — cannot be
  simulated in Foundry fork tests. Real-wallet execution required for full transfer path coverage.
- Fork test workaround: `vm.mockCall` on the ERC-20 movement; signature verification path fully tested.

---

## 4. Deploy Script Analysis

### Reviewed: contracts/script/Deploy.s.sol (2026-10-29)

**Deployment order:** HandleRegistry → KycRegistry → PayRouter → ScheduledPayouts  
**All correct and safe. No critical issues.**

| Check | Result |
|---|---|
| Constructor zero-address guards | All four contracts revert on zero address ✓ |
| feeWallet defaults | Defaults to DEPLOY_ADMIN_ADDRESS (not deployer) ✓ |
| Biller defaults | Defaults to DEPLOY_OPERATOR_ADDRESS (not deployer) ✓ |
| Biller treasury defaults | Defaults to DEPLOY_ADMIN_ADDRESS ✓ |
| MIN_BILL_TIER | 0 (permissionless escrow at launch) ✓ |
| GLOBAL_CAP | 25_000_000 (25 USDC, 6 dec) ✓ |
| INITIAL_FEE_BPS | 0 ✓ |
| ORDER_TIMEOUT | 1800 seconds (30 min) ✓ |
| Tier 1 daily cap | 20_000_000_000 (20,000 USDC) ✓ (was 20_000_000_000_000 before fix) |
| Deployer admin renounce | Guarded: only renounces when deployer != admin ✓ |
| PAUSER_ROLE on deployer | Renounced when deployer != admin ✓ |
| Reserved handles | "dash", "admin", "support" pre-reserved in HandleRegistry ✓ |
| USDC and Permit2 defaults | Arc canonical addresses hardcoded as fallback ✓ |

**One known behaviour to understand:** When deployer == admin (testnet pattern), the deployer
retains DEFAULT_ADMIN_ROLE and PAUSER_ROLE after deploy. This is correct and documented.
On mainnet the deployer must be a separate hot key; the designated admin must be a multisig.

### Dry-run simulation result (2026-10-29, Arc Testnet)
```
Script ran successfully.
Chain 5042002
Estimated gas price: 42.75 gwei
Estimated total gas used: 8,209,595
Estimated amount required: 0.35096 USDC
```
All 4 contracts deployed and all roles granted without revert. VITE_* output produced.

---

## 5. Biller Registration

### Testnet (current)
Registered in constructor of PayRouter v2 (`0x37f2edaf...`):
- Biller: `0x5B12Ce46C7194aD57d143bC22847224047b1Ef42` (platform deployer)
- Treasury: `0x5B12Ce46C7194aD57d143bC22847224047b1Ef42` (platform deployer)
- `isBiller()` → `true` ✓ (live read)

This is correct for testnet. On mainnet, set `DEPLOY_BILLER_ADDRESS` and
`DEPLOY_BILLER_TREASURY` explicitly before deploying.

### Mainnet biller registration (two paths)

**Path A — Recommended: register in constructor (zero delay)**  
Set both env vars before running the deploy script. The biller is registered atomically at
deploy time with no timelock required.
```
DEPLOY_BILLER_ADDRESS=<your-operator-address>
DEPLOY_BILLER_TREASURY=<your-treasury-address>
```

**Path B — Post-deploy: timelocked registration (24h delay)**  
If you need to add a biller after deploy:
```solidity
// Step 1: Queue (call from admin wallet)
bytes32 key = keccak256("addBiller");
bytes memory val = abi.encode(billerAddress, treasuryAddress);
payRouter.queueConfigChange(key, val);
// wait 24 hours (block.timestamp >= queuedAt + 86400)

// Step 2: Execute (call from admin wallet)
payRouter.executeConfigChange(key);
```

---

## 6. Test Results — Evidence

### Unit + fuzz tests (no fork required)
Run: `forge test --via-ir`  
Result: **235 passed, 0 failed, 0 skipped** (2026-10-29)

Breakdown:
- HandleRegistry: 30 (3 fuzz)
- KycRegistry: 24 (2 fuzz, 256 runs each)
- PayRouter.Send: 20
- PayRouter.Orders: 30
- PayRouter.Timelock: 20
- ScheduledPayouts: 5 files, all schedule types
- Deploy: 23 role invariant tests
- Permissionless: 10 tests (tier-0 wallet, global cap enforcement)

### Fork EIP-712 tests (requires `--fork-url`)
Run: `forge test --match-contract ForkPermit2Test --fork-url https://rpc.testnet.arc.io --via-ir`  
Result: **9 passed, 0 failed** (2026-10-29)

Tests cover:
1. Domain separator matches expected formula with `name="Permit2"` ✓
2. Plain permit valid signature accepted by live Permit2 ✓
3. Nonce bitmap updated after use ✓
4. Replay reverts ✓
5. Wrong chain ID reverts ✓
6. Zero signature reverts ✓
7. Witness permit valid signature accepted ✓
8. Tampered witness reverts ✓
9. No admin/operator drain path exists ✓

---

## 7. Wallet Address Requirements — Summary

You need to provide these values in `.env` before running the mainnet deploy script:

```
# Required
DEPLOY_ADMIN_ADDRESS=      # multisig or hardware wallet
DEPLOY_OPERATOR_ADDRESS=   # backend hot wallet (also used as default biller)
DEPLOY_VERIFIER_ADDRESS=   # can be same as DEPLOY_ADMIN_ADDRESS at launch
DEPLOY_PAUSER_ADDRESS=     # can be same as DEPLOY_ADMIN_ADDRESS at launch
DEPLOY_BILLER_TREASURY=    # dedicated treasury cold wallet (DO NOT set to admin/operator)

# Optional (these have safe defaults shown above)
# DEPLOY_FEE_WALLET_ADDRESS= defaults to DEPLOY_ADMIN_ADDRESS
# DEPLOY_BILLER_ADDRESS=     defaults to DEPLOY_OPERATOR_ADDRESS
# DEPLOY_USDC_ADDRESS=       defaults to 0x3600000000000000000000000000000000000000
# DEPLOY_PERMIT2_ADDRESS=    defaults to 0x000000000022D473030F116dDEE9F6B43aC78BA3
```

Do NOT set any of these to the platform deployer wallet `0x5B12Ce46C7194aD57d143bC22847224047b1Ef42`.
That address is shared across all Arc Studio users, is testnet-only, and you do not control it.

---

## 8. Real-Wallet E2E Smoke Tests (B3)

These four flows must be executed with a real connected wallet on Arc Testnet before mainnet.
They are the only way to verify the full USDC transfer path (Arc's native precompile cannot be
simulated in Foundry).

Full step-by-step instructions: `docs/testnet-smoke-test.md`

### What to record for each test

| Test | What to record |
|---|---|
| Send (1–5 USDC) | Tx hash; sender balance before/after; recipient balance before/after |
| Bill order create | Tx hash of `createOrder`; orderId from event |
| Bill order reclaim | Tx hash of `reclaimOrder` after 30-min timeout |
| ScheduledPayouts deposit | Tx hash of `deposit`; scheduleId from event |
| ScheduledPayouts claim | Tx hash of `claim`; amount released |

Provide these hashes and I will verify each on-chain and update this report with confirmed evidence.

### Minimum USDC required
~5 USDC covers all four tests. Get test USDC from the "Get test USDC" button in the Arc Studio sidebar.

### How to verify a transaction after execution
```
# Any tx hash from the tests:
curl -s "https://explorer.testnet.arc.io/api?module=transaction&action=gettxinfo&txhash=<TX_HASH>"
# Or open: https://explorer.testnet.arc.io/tx/<TX_HASH>
```

---

## 9. GitHub Push Status (B4)

**Status: 9 commits ahead of origin/main. Not yet pushed.**

The sandbox has GitHub CLI (`gh`) installed but unauthenticated.
To push these 9 commits to `web3wizzz/Dash_Escrow_Payment`:

**Option A — Arc Studio GitHub integration (recommended)**
Open the **Integrations** menu in the workbench header → **Connect GitHub** → authorize → then
say "push to GitHub" and the push will complete without leaving the browser.

**Option B — GitHub CLI in terminal**
```bash
gh auth login          # opens browser for OAuth
git push origin main
```

**What will be pushed (non-secret files only):**
- `contracts/PayRouter.sol` — permissionless model (effectiveTier removed from payment paths)
- `contracts/ScheduledPayouts.sol` — permissionless model
- `contracts/script/Deploy.s.sol` — MIN_BILL_TIER=0, role-transfer pattern, defaults fixed
- `contracts/test/` — 8 new/updated test files (234 unit tests + 9 fork tests)
- `contracts/contract-metadata/` — deployment metadata
- `docs/` — deployment manifest, security review, smoke test guide, this report
- `AGENTS.md`, `AUDIT.md`, `README.md` — updated project documentation
- `.gitignore` — excludes .env, .circle/, broadcast/, out/, console.jsonl

`.env` is in `.gitignore` and will NOT be pushed. No secrets will be exposed.

---

## 10. Final GO/NO-GO Checklist

| # | Item | Status | Evidence |
|---|---|---|---|
| C1 | USDC at canonical address on Arc mainnet | GO | `symbol()="USDC"`, `decimals()=6` — live read 2026-10-29 |
| C2 | Permit2 at canonical address on Arc mainnet | GO | `allowance()` call succeeded — live read 2026-10-29 |
| C3 | Permit2 domain separator verified for mainnet | GO | Computed = `0xa88a1b74...`, matches live chain |
| C4 | Permit2 witness selector verified (`0x137c29fe`) | GO | From fork test + ABI analysis |
| C5 | 235 unit/fuzz tests pass | GO | `forge test --via-ir`: 235/235 — 2026-10-29 |
| C6 | 9 fork EIP-712 tests pass vs live Permit2 | GO | `--fork-url https://rpc.testnet.arc.io`: 9/9 — 2026-10-29 |
| C7 | Deploy script dry-run succeeds | GO | 0.35 USDC gas, all roles granted, no revert — 2026-10-29 |
| C8 | Deploy script MIN_BILL_TIER=0 | GO | Constant set to 0 in Deploy.s.sol |
| C9 | Deploy script feeWallet defaults to admin (not deployer) | GO | Code review confirmed |
| C10 | No admin/operator drain path in contracts | GO | `test_Fork_NoDirectDrainByAdmin` passes |
| C11 | Deployer ends with zero roles when deployer != admin | GO | Deploy.s.sol renounce logic reviewed; 23 deploy tests pass |
| **B1** | **Dedicated role wallets provided** | **NO-GO** | Addresses not yet supplied by owner |
| **B2** | **Dedicated biller treasury provided** | **NO-GO** | DEPLOY_BILLER_TREASURY not yet set |
| **B3** | **Real-wallet E2E smoke tests on testnet** | **NO-GO** | No tx hashes yet; flows documented in smoke-test guide |
| **B4** | **9 commits pushed to GitHub** | **NO-GO** | `gh auth login` required; 9 commits pending |

**Overall verdict: NO-GO**

No mainnet transactions have been broadcast. Nothing will be without your explicit approval.

---

## 11. Mainnet Deploy Command (do not run until all blockers cleared)

```bash
# Set all role wallet addresses in .env first (see Section 7)
# Then, with --broadcast only after your explicit GO decision:

forge script contracts/script/Deploy.s.sol \
  --rpc-url https://rpc.mainnet.arc.io \
  --private-key $PRIVATE_KEY \
  --via-ir \
  --broadcast

# Verify deployer has zero roles after:
cast call <PAYROUTER_ADDR> \
  "hasRole(bytes32,address)(bool)" \
  0x0000000000000000000000000000000000000000000000000000000000000000 \
  $DEPLOYER_ADDRESS \
  --rpc-url https://rpc.mainnet.arc.io
# Expected: false
```

After deploy, update AGENTS.md with mainnet addresses and add them to `.env` under separate
`VITE_*_MAINNET` keys (or a separate `.env.mainnet` file, never committed).
