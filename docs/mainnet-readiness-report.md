# DA$H Arc Mainnet Readiness Report
Generated: 2026-10-29 | Dry-run: 2026-10-30 | Configuration review: 2026-10-31
Status: **NO-GO — 4 owner actions required before mainnet**

> This is a hackathon/MVP launch. Contracts have not been independently audited.
> Do not deploy without completing all NO-GO items below and your own independent review.

---

## Summary

| Evidence | Result |
|---|---|
| Unit + fuzz tests | 235/235 pass |
| Fork EIP-712 tests (live Arc Testnet Permit2) | 9/9 pass |
| Mainnet dry-run (chain 5042, no broadcast) | Success — 0.3448 USDC gas |
| USDC verified on Arc mainnet | symbol="USDC", decimals=6 |
| Permit2 verified on Arc mainnet | live, domain separator confirmed |
| delegatecall / selfdestruct in production contracts | None found |
| Proxy / upgradeability pattern | None found |
| Admin/operator user-fund drain path | None found |

Four blockers remain and require your action before any mainnet broadcast.

---

## 1. Current Testnet Deployments

Verified by live on-chain reads (2026-10-29). Arc Testnet, chain ID 5042002.

| Contract | Address | Key state |
|---|---|---|
| HandleRegistry | `0x34cae0957ec0cd2327e134f2008ee111e66ca081` | admin = platform deployer |
| KycRegistry | `0x3a480497c8d48c065dac5fdd46ea339aeb9a8bfd` | admin = platform deployer |
| PayRouter v2 | `0x37f2edadf59cf2027cf52f13ed2272a3cf69055b` | globalCap=25 USDC, feeBps=0, timeout=1800s |
| ScheduledPayouts | `0x95f13b64172e6df601fd6cec3f3c0b71d0e6f917` | globalCap=25 USDC |

Live reads:
- `PayRouter.globalPerPaymentCap()` → `25000000` (25 USDC) ✓
- `PayRouter.feeBps()` → `0` ✓
- `PayRouter.orderTimeoutSeconds()` → `1800` ✓
- `PayRouter.feeWallet()` → `0x5B12Ce46...` (platform deployer — testnet only) ✓
- `PayRouter.isBiller(0x5B12Ce46...)` → `true` ✓
- `PayRouter.hasRole(DEFAULT_ADMIN_ROLE, 0x5B12Ce46...)` → `true` ✓
- `ScheduledPayouts.globalPerPaymentCap()` → `25000000` ✓
- `ScheduledPayouts.hasRole(DEFAULT_ADMIN_ROLE, 0x5B12Ce46...)` → `true` ✓

---

## 2. Mainnet Dry-Run Results (2026-10-30)

Command run (no `--broadcast`):
```bash
forge script contracts/script/Deploy.s.sol \
  --rpc-url https://rpc.mainnet.arc.io \
  --via-ir
```

Output:
```
Script ran successfully.
Chain 5042

=== Dash deploy ===
Deployer (msg.sender): will hand off admin after setup
Admin (final):    0x1111... [placeholder — replace with real admin wallet]
Operator:         0x2222... [placeholder — replace with real operator wallet]
Verifier:         0x1111...
Pauser:           0x1111...
FeeWallet:        0x1111...
USDC:             0x3600000000000000000000000000000000000000
Permit2:          0x000000000022D473030F116dDEE9F6B43aC78BA3

HandleRegistry:   0x5b73C5498c1E3b4dbA84de0F1833c4a029d90519
KycRegistry:      0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496
PayRouter:        0x34A1D3fff3958843C43aD80F30b94c510645C316
ScheduledPayouts: 0x90193C961A926261B756D1E5bb255e67ff9498A1

NOTE: Deployer has zero roles on all contracts after this deploy.

Estimated gas price:              42.000000001 gwei
Estimated total gas used:         8,209,595
Estimated amount required:        0.344802990 USDC
```

All four contracts simulated. Deployer ends with zero roles (deployer != admin path confirmed). No reverts. VITE_* output produced.

Note: Predicted addresses above use placeholder keys. Real addresses are deterministic on the actual deployer nonce — record them from the broadcast output.

---

## 3. Role Wallet Requirements

### DEPLOY_ADMIN_ADDRESS — DEFAULT_ADMIN_ROLE
**Holds on:** HandleRegistry, KycRegistry, PayRouter, ScheduledPayouts

Powers:
- Grant/revoke any role on any contract
- Queue timelocked config changes (feeBps, feeWallet, globalCap, billers, orderTimeout)
- Execute config changes after 24-hour timelock

Security requirement: Hardware wallet or multisig. Highest-privilege key in the system.
**Must be separate from** `DEPLOY_OPERATOR_ADDRESS`.
**Can share with** `DEPLOY_VERIFIER_ADDRESS` and `DEPLOY_PAUSER_ADDRESS` at launch.

---

### DEPLOY_OPERATOR_ADDRESS — OPERATOR_ROLE
**Holds on:** PayRouter only

Powers:
- `fulfillOrder(orderId)` — release escrowed USDC to biller treasury (snapshot at order creation)
- `rejectOrder(orderId)` — return escrowed USDC to payer

Security requirement: Backend hot wallet (software key acceptable).
**Must be separate from** `DEPLOY_ADMIN_ADDRESS`.
**Can share with** `DEPLOY_BILLER_ADDRESS` (recommended at launch — same backend handles both).

---

### DEPLOY_VERIFIER_ADDRESS — VERIFIER_ROLE
**Holds on:** KycRegistry only

Powers: `setTier(address, tier, expiry)` — set KYC tier

Current usage: KYC tiers are **not enforced** on any payment path. Verifier role is retained for future governance only.
**Safe to set equal to `DEPLOY_ADMIN_ADDRESS` at launch.**

---

### DEPLOY_PAUSER_ADDRESS — PAUSER_ROLE
**Holds on:** PayRouter and ScheduledPayouts

Powers: `pause()` / `unpause()` — block new payment inflows. Refunds, reclaims, cancellations, and claims always remain live even when paused.

Security requirement: Quickly reachable in an emergency.
**Safe to set equal to `DEPLOY_ADMIN_ADDRESS` at launch.**

---

### DEPLOY_BILLER_ADDRESS and DEPLOY_BILLER_TREASURY

Not a role — registered in the PayRouter constructor as the initial biller.

- `DEPLOY_BILLER_ADDRESS`: address that calls `fulfillOrder`/`rejectOrder`. Default: `DEPLOY_OPERATOR_ADDRESS`.
- `DEPLOY_BILLER_TREASURY`: destination for fulfilled escrow payments (snapshotted at order creation — cannot be redirected after an order is placed). **Must be a dedicated cold wallet, never equal to admin or operator.**

---

### Minimum-viable mainnet address set

| Env var | Wallet | Recommended type |
|---|---|---|
| `DEPLOY_ADMIN_ADDRESS` | Admin | Hardware wallet or multisig |
| `DEPLOY_OPERATOR_ADDRESS` | Operator / biller fulfillment backend | Software hot key |
| `DEPLOY_VERIFIER_ADDRESS` | Set to admin at launch | Same as admin |
| `DEPLOY_PAUSER_ADDRESS` | Set to admin at launch | Same as admin |
| `DEPLOY_BILLER_TREASURY` | Treasury | Dedicated cold wallet |
| `DEPLOY_FEE_WALLET_ADDRESS` | Set to admin while feeBps=0 | Same as admin |

This gives two operationally distinct keys: a cold admin and a hot operator/biller. Expand to more keys as the operation scales.

---

## 4. Mainnet Configuration Review (contracts/script/Deploy.s.sol)

Reviewed: 2026-10-31. Arc mainnet chain ID: 5042.
USDC: `0x3600000000000000000000000000000000000000`
Permit2: `0x000000000022D473030F116dDEE9F6B43aC78BA3`

### Constructor parameter checks

| Parameter | Value in script | Expected | Result |
|---|---|---|---|
| `GLOBAL_CAP` | `25_000_000` | 25 USDC (6 dec) | PASS |
| `INITIAL_FEE_BPS` | `0` | 0% at launch | PASS |
| `MIN_BILL_TIER` | `0` | Permissionless escrow | PASS |
| `ORDER_TIMEOUT` | `1800` | 30 minutes | PASS |
| `ARC_USDC` | `0x3600...0000` | Arc canonical USDC | PASS |
| `CANONICAL_PERMIT2` | `0x0000...BA3` | Canonical Permit2 | PASS |
| `T0_PER_PAYMENT` | `5_000_000` | 5 USDC | PASS |
| `T0_DAILY` | `50_000_000` | 50 USDC | PASS |
| `T1_PER_PAYMENT` | `100_000_000` | 100 USDC | PASS |
| `T1_DAILY` | `20_000_000_000` | 20,000 USDC | PASS |
| `T2_PER_PAYMENT` | `20_000_000_000` | 20,000 USDC | PASS |
| `T2_DAILY` | `0` | Unlimited | PASS |
| `feeWallet` default | `DEPLOY_ADMIN_ADDRESS` | Not deployer | PASS |
| `billerAddr` default | `DEPLOY_OPERATOR_ADDRESS` | Not deployer | PASS |
| `billerTreasury` default | `DEPLOY_ADMIN_ADDRESS` | Not deployer | PASS |

### Role assignment checks

| Check | Result |
|---|---|
| Deployer deploys all 4 contracts with itself as initialAdmin | PASS — enables grantRole calls |
| VERIFIER_ROLE granted to `verifier` on KycRegistry | PASS |
| OPERATOR_ROLE granted to `operator` on PayRouter | PASS |
| PAUSER_ROLE granted to `pauser` on PayRouter | PASS |
| PAUSER_ROLE granted to `pauser` on ScheduledPayouts | PASS |
| DEFAULT_ADMIN_ROLE granted to `admin` on all 4 contracts | PASS |
| DEFAULT_ADMIN_ROLE renounced from deployer when deployer != admin | PASS |
| PAUSER_ROLE renounced from deployer when deployer != admin | PASS |
| Warning printed when deployer == admin | PASS — explicit console note |
| Reserved handles pre-registered ("dash", "admin", "support") | PASS |
| Zero-address guards on all required constructor args | PASS — all 4 contracts revert on address(0) |

### Security surface checks

| Check | Result |
|---|---|
| `delegatecall` in production contracts | None found |
| `selfdestruct` in production contracts | None found |
| Proxy / upgradeability pattern | None found — all contracts are non-upgradeable |
| Admin-callable user-fund drain path | None — admin controls config only (behind 24h timelock); cannot move escrowed USDC or scheduled deposits |
| Operator-callable user-fund drain path | None — operator can only `fulfillOrder` (to snapshotted treasury) or `rejectOrder` (back to payer); no arbitrary transfer |
| `ScheduledPayouts.withdraw()` | Pull-payment escape hatch for caller's own `pendingWithdrawals[msg.sender]` balance only — no admin access, no arbitrary target |
| `reclaimOrder` caller restriction | None (permissionless after timeout) — USDC always goes to `order.payer`, never to caller |
| Biller treasury snapshotted at order creation | PASS — `order.billerTreasury` set in `createOrder`, cannot be changed after |
| Config changes require 24h timelock | PASS — `queueConfigChange` + `executeConfigChange`, 86400s minimum delay |

**Critical mainnet requirement:** The deployer private key (`--private-key $PRIVATE_KEY`) MUST be different from `DEPLOY_ADMIN_ADDRESS`. When deployer == admin the renounce step is correctly skipped (testnet pattern), leaving the deployer as the permanent admin — unsafe for mainnet. Use a dedicated ephemeral hot key as deployer and a cold wallet / multisig as admin.

---

## 5. Permit2 and USDC on Arc Mainnet — Evidence

### USDC (`0x3600000000000000000000000000000000000000`)
- `symbol()` → `"USDC"` ✓ (live read 2026-10-29)
- `decimals()` → `6` ✓
- Source: FiatTokenProxy (Circle's canonical USDC), same address on both mainnet and testnet

### Permit2 (`0x000000000022D473030F116dDEE9F6B43aC78BA3`)
- `allowance(...)` call succeeded → contract live ✓ (live read 2026-10-29)
- Domain separator: `keccak256(abi.encode(EIP712Domain(string name,uint256 chainId,address verifyingContract), keccak256("Permit2"), 5042, 0x000...BA3))` = `0xa88a1b742ab6890402e6ee74f2359f3723ab547c6dc3b850249bdbffebe2b18f` ✓
- Witness selector: `0x137c29fe` (nested tuple, verified from bytecode) ✓

### Key EIP-712 findings from fork test campaign
- Permit2 domain type string includes `name = "Permit2"`: `EIP712Domain(string name,uint256 chainId,address verifyingContract)`
- `permitWitnessTransferFrom` uses nested-tuple ABI encoding — selector `0x137c29fe`, not `0xe9ef212b`
- Arc USDC `transfer`/`transferFrom` routes through native precompile `0x1800...` — cannot be simulated in Foundry fork tests. Real browser-wallet execution required for full transfer path verification.

---

## 6. Test Results — Evidence

### Unit + fuzz tests
```bash
forge test --via-ir
```
Result: **235 passed, 0 failed, 0 skipped** (2026-10-29)

| Suite | Tests |
|---|---|
| HandleRegistry | 30 (3 fuzz) |
| KycRegistry | 24 (2 fuzz, 256 runs each) |
| PayRouter.Send | 20 |
| PayRouter.Orders | 30 |
| PayRouter.Timelock | 20 |
| ScheduledPayouts (5 files) | all schedule types |
| Deploy (role invariants) | 23 |
| Permissionless (global cap) | 10 |

### Fork EIP-712 tests
```bash
forge test --match-contract ForkPermit2Test --fork-url https://rpc.testnet.arc.io --via-ir
```
Result: **9 passed, 0 failed** (2026-10-29)

1. Domain separator matches `name="Permit2"` formula ✓
2. Plain permit valid signature accepted by live Permit2 ✓
3. Nonce bitmap updated after use ✓
4. Replay reverts ✓
5. Wrong chain ID reverts ✓
6. Zero signature reverts ✓
7. Witness permit valid signature accepted ✓
8. Tampered witness reverts ✓
9. No admin/operator drain path ✓

---

## 7. Required .env Values for Mainnet Deploy

```bash
# Required — set real wallet addresses for all four before running the deploy script
DEPLOY_ADMIN_ADDRESS=        # multisig or hardware wallet (cold)
DEPLOY_OPERATOR_ADDRESS=     # backend hot wallet
DEPLOY_VERIFIER_ADDRESS=     # can equal DEPLOY_ADMIN_ADDRESS at launch
DEPLOY_PAUSER_ADDRESS=       # can equal DEPLOY_ADMIN_ADDRESS at launch

# Required — dedicated cold wallet, NOT equal to admin or operator
DEPLOY_BILLER_TREASURY=      # treasury for fulfilled escrow payments

# Optional — safe defaults listed in Section 3
# DEPLOY_FEE_WALLET_ADDRESS= defaults to DEPLOY_ADMIN_ADDRESS
# DEPLOY_BILLER_ADDRESS=     defaults to DEPLOY_OPERATOR_ADDRESS
# DEPLOY_USDC_ADDRESS=       defaults to 0x3600000000000000000000000000000000000000
# DEPLOY_PERMIT2_ADDRESS=    defaults to 0x000000000022D473030F116dDEE9F6B43aC78BA3
```

Do NOT set any of these to the platform deployer wallet `0x5B12Ce46C7194aD57d143bC22847224047b1Ef42`.
That address is testnet-only, shared across Arc Studio users, and not under your control.

---

## 8. Real-Wallet E2E Test Flows (B3)

Eight flows must be executed with a real browser wallet on Arc Testnet.
Arc USDC transfer routes through a native precompile that cannot be simulated in Foundry — this is the only way to verify the full execution path.

Full step-by-step instructions: `docs/testnet-e2e-checklist.md`

Minimum USDC required: ~15 USDC.
Get test USDC: "Get test USDC" button in the Arc Studio sidebar.

| Flow | What to record |
|---|---|
| A: Permit2 approval | Tx hash; confirm no repeat approval required |
| B: Direct USDC send | Tx hash; sender/recipient balances before and after |
| C: Escrow create | Tx hash; orderId from ORD_CREATED event |
| D: Escrow fulfill (operator) | Tx hash; treasury balance before and after |
| E: Escrow expiry + reclaim | Create tx + reclaim tx hash; payer balance restored |
| F: Pay-later deposit | Tx hash; scheduleId; sender balance before and after |
| G: Pay-later claim | Tx hash; recipient balance before and after |
| H: Streaming partial claim | Deposit tx + claim tx; amount claimed vs expected accrual |

Provide tx hashes and this report will be updated with on-chain evidence.

---

## 9. GitHub Push Status (B4)

Status: 10+ commits ahead of `origin/main`. Not yet pushed.

The sandbox has GitHub CLI (`gh`) installed but unauthenticated.

**Option A — Arc Studio GitHub integration (recommended)**
Open the Integrations menu in the workbench header, choose Connect GitHub, authorize, then say "push to GitHub".

**Option B — GitHub CLI in terminal**
```bash
gh auth login          # opens browser for OAuth
git push origin main
```

`.env` is in `.gitignore` and will NOT be pushed. No secrets will be exposed.

---

## 10. Final GO/NO-GO Checklist

### Automated / code-review items (no owner action required)

| # | Item | Status | Evidence |
|---|---|---|---|
| C1 | USDC at canonical address on Arc mainnet | **GO** | `symbol()="USDC"`, `decimals()=6` — live read 2026-10-29 |
| C2 | Permit2 at canonical address on Arc mainnet | **GO** | `allowance()` call succeeded — live read 2026-10-29 |
| C3 | Permit2 domain separator verified for mainnet (chain 5042) | **GO** | Computed `0xa88a1b74...` matches live chain |
| C4 | Permit2 witness selector verified (`0x137c29fe`) | **GO** | Fork test + ABI analysis |
| C5 | 235 unit/fuzz tests pass | **GO** | `forge test --via-ir`: 235/235 — 2026-10-29 |
| C6 | 9 fork EIP-712 tests pass vs live Permit2 | **GO** | `--fork-url testnet.arc.io`: 9/9 — 2026-10-29 |
| C7 | Mainnet dry-run succeeds (chain 5042) | **GO** | 0.3448 USDC gas, no revert — 2026-10-30 |
| C8 | `globalPerPaymentCap` = 25 USDC | **GO** | `GLOBAL_CAP = 25_000_000` in Deploy.s.sol |
| C9 | `feeBps` = 0 at launch | **GO** | `INITIAL_FEE_BPS = 0` |
| C10 | `minBillTier` = 0 (permissionless escrow) | **GO** | `MIN_BILL_TIER = 0` |
| C11 | `orderTimeoutSeconds` = 1800 | **GO** | `ORDER_TIMEOUT = 1800` |
| C12 | Biller treasury snapshotted at order creation | **GO** | `order.billerTreasury` immutable after `createOrder` |
| C13 | `feeWallet` defaults to admin, not deployer | **GO** | `vm.envOr("DEPLOY_FEE_WALLET_ADDRESS", admin)` |
| C14 | Deployer ends with zero roles when deployer != admin | **GO** | Renounce logic in Deploy.s.sol; 23 deploy tests pass |
| C15 | No admin/operator user-fund drain path | **GO** | Code review: `fulfillOrder` → snapshotted treasury; `rejectOrder` → payer; admin controls config only |
| C16 | No `delegatecall` in production contracts | **GO** | Full grep: no matches in PayRouter, ScheduledPayouts, HandleRegistry, KycRegistry |
| C17 | No `selfdestruct` in production contracts | **GO** | Full grep: no matches |
| C18 | No proxy / upgradeability pattern | **GO** | Full grep: no Proxy/UUPS/initialize matches |
| C19 | `ScheduledPayouts.withdraw()` scoped to caller only | **GO** | `pendingWithdrawals[msg.sender]` — no admin path |
| C20 | README updated: hackathon/MVP scope, no audit claim | **GO** | README.md updated 2026-10-30 |
| C21 | AUDIT.md: permissionless model documented | **GO** | AUDIT.md Section "Permissionless Model" |

### Owner actions (your wallets, your transactions)

| # | Item | Status | Action required |
|---|---|---|---|
| **B1** | Dedicated role wallets provided | **NO-GO** | Set `DEPLOY_ADMIN_ADDRESS`, `DEPLOY_OPERATOR_ADDRESS`, `DEPLOY_VERIFIER_ADDRESS`, `DEPLOY_PAUSER_ADDRESS` in `.env` |
| **B2** | Dedicated biller treasury provided | **NO-GO** | Set `DEPLOY_BILLER_TREASURY` to a cold wallet (not admin, not operator) |
| **B3** | Real-wallet E2E flows A–H completed on Arc Testnet | **NO-GO** | Run all 8 flows from `docs/testnet-e2e-checklist.md`; provide tx hashes |
| **B4** | 10+ commits pushed to GitHub | **NO-GO** | `gh auth login` then `git push origin main` (or use Integrations menu) |

**Overall verdict: NO-GO**

No mainnet transactions have been broadcast. Nothing will be without your explicit approval after all blockers are cleared.

---

## 11. Mainnet Deploy Command

> Warning: Transactions on mainnet involve real funds and, once submitted, are irreversible. Any code used for mainnet must be independently reviewed, tested, validated, deployed, and operated by you. You are solely responsible for any losses, errors, or other consequences. Before proceeding, complete testnet E2E (B3), supply all role wallets (B1, B2), push to GitHub (B4), and perform your own independent review.

This command is provided for reference. Do NOT run the `--broadcast` step without your explicit decision to proceed, after all blockers are cleared.

```bash
# Step 1: Set all role wallet addresses in .env (see Section 7)

# Step 2: Export your deployer key — a dedicated ephemeral hot key, DIFFERENT from admin
export PRIVATE_KEY=<your-deployer-hot-key>   # never commit; delete after deploy

# Step 3: Dry-run on mainnet (no broadcast) — confirm gas and address log
forge script contracts/script/Deploy.s.sol \
  --rpc-url https://rpc.mainnet.arc.io \
  --via-ir

# Step 4: Broadcast — ONLY after you have reviewed the dry-run and cleared all blockers
forge script contracts/script/Deploy.s.sol \
  --rpc-url https://rpc.mainnet.arc.io \
  --private-key $PRIVATE_KEY \
  --via-ir \
  --broadcast

# Step 5: Verify deployer holds zero roles after deploy
cast call <PAYROUTER_ADDRESS> \
  "hasRole(bytes32,address)(bool)" \
  0x0000000000000000000000000000000000000000000000000000000000000000 \
  $DEPLOYER_ADDRESS \
  --rpc-url https://rpc.mainnet.arc.io
# Expected: false

cast call <PAYROUTER_ADDRESS> \
  "hasRole(bytes32,address)(bool)" \
  $(cast keccak "OPERATOR_ROLE") \
  $DEPLOYER_ADDRESS \
  --rpc-url https://rpc.mainnet.arc.io
# Expected: false
```

After a successful broadcast:
1. Copy the printed `VITE_*` lines into `.env`
2. Update `AGENTS.md` with mainnet addresses and tx hashes
3. Restart the dev server: `bun run dev`
4. Connect a wallet on Arc mainnet (chain ID 5042) and confirm the app reads the correct contracts
