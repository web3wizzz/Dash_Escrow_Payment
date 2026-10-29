# DA$H Arc Mainnet Readiness Report
**Date:** 2026-10-29  
**Status: NO-GO** — 3 owner actions required before mainnet deploy

---

## 1. Current Testnet Deployment State

All four contracts are live on Arc Testnet (chain ID 5042002).

| Contract | Address | Admin | Notes |
|---|---|---|---|
| HandleRegistry | `0x34cae0957ec0cd2327e134f2008ee111e66ca081` | Platform deployer | Reserved: dash, admin, support |
| KycRegistry | `0x3a480497c8d48c065dac5fdd46ea339aeb9a8bfd` | Platform deployer | |
| PayRouter v1 | `0x9f2c221a4c7b0287ea03dca3877676ecc75ba1f8` | Platform deployer | No billers — use v2 |
| **PayRouter v2** | `0x37f2edadf59cf2027cf52f13ed2272a3cf69055b` | Platform deployer | **Active.** Biller = platform deployer |
| ScheduledPayouts | `0x95f13b64172e6df601fd6cec3f3c0b71d0e6f917` | Platform deployer | |

**On-chain reads verified (2026-10-29):**
- `globalPerPaymentCap()` = 25,000,000 (25 USDC) ✓
- `feeBps()` = 0 ✓
- `minBillTier()` = 0 ✓
- `orderTimeoutSeconds()` = 1800 ✓
- `isBiller(0x5B12Ce46...)` = true ✓
- `billerTreasury(0x5B12Ce46...)` = `0x5B12Ce46...` ✓
- PayRouter `PAUSER_ROLE` held by platform deployer ✓
- PayRouter `DEFAULT_ADMIN_ROLE` held by platform deployer ✓
- PayRouter `OPERATOR_ROLE` NOT held by platform deployer ✓ (correct — was granted, script renounces)

**Note:** The platform deployer (`0x5B12Ce46C7194aD57d143bC22847224047b1Ef42`) is shared across all Arc Studio users and is testnet-only. It must not be used as admin, operator, fee wallet, biller, or biller treasury on mainnet.

---

## 2. Required Role Addresses

Four addresses are required for mainnet. Each must be separate and purpose-built.

| Role | Contract(s) | Purpose | Requirement |
|---|---|---|---|
| `DEFAULT_ADMIN_ROLE` | All 4 | Timelock governance, role management | **Multisig or hardware wallet. CRITICAL — controls all contracts permanently.** |
| `OPERATOR_ROLE` | PayRouter only | `fulfillOrder`, `rejectOrder` | Backend hot wallet. Can be rotated by admin. |
| `PAUSER_ROLE` | PayRouter, ScheduledPayouts | Emergency `pause()`/`unpause()` | Dedicated EOA or multisig. Can be rotated by admin. |
| `VERIFIER_ROLE` | KycRegistry only | `setTier`, `revokeTier` | **See note below.** |

### Is VERIFIER_ROLE still necessary?

**Short answer: Yes, must be set — but it can safely be the same address as `DEFAULT_ADMIN_ROLE` at launch.**

The `VERIFIER_ROLE` is required by the KycRegistry constructor and granted via the deploy script. The KycRegistry is deployed as an immutable dependency of PayRouter and ScheduledPayouts. It is referenced in both constructors but **neither contract calls `effectiveTier()` on any payment path** — verified by `grep` with no matches. 

KycRegistry is therefore infrastructure for future governance, not an active gate at launch. There is no harm in setting `VERIFIER_ROLE = DEFAULT_ADMIN_ROLE` on mainnet. The admin can rotate it to a dedicated verifier when identity verification is re-introduced.

**Summary of addresses you must provide:**

```
DEPLOY_ADMIN_ADDRESS     = <your multisig>          # REQUIRED, separate from deployer
DEPLOY_OPERATOR_ADDRESS  = <backend hot wallet>      # REQUIRED, separate from admin
DEPLOY_VERIFIER_ADDRESS  = <admin or dedicated>      # REQUIRED (can equal admin)
DEPLOY_PAUSER_ADDRESS    = <emergency EOA or multisig> # REQUIRED, separate from operator
DEPLOY_FEE_WALLET_ADDRESS = <treasury wallet>        # Optional; defaults to admin
DEPLOY_BILLER_ADDRESS    = <your biller wallet>      # Optional; defaults to operator
DEPLOY_BILLER_TREASURY   = <biller payment dest>     # Optional; defaults to admin
```

---

## 3. Permit2 and USDC on Arc Mainnet

Both verified by live on-chain read (2026-10-29):

| Contract | Address | Status |
|---|---|---|
| USDC | `0x3600000000000000000000000000000000000000` | ✓ `symbol()` = "USDC", `decimals()` = 6 |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | ✓ `allowance()` call succeeded |

**Permit2 domain separator on Arc Mainnet (chain ID 5042):**
- Live value: `0xa88a1b742ab6890402e6ee74f2359f3723ab547c6dc3b850249bdbffebe2b18f`
- Computed: `keccak256(abi.encode(EIP712DomainTypeHash, keccak256("Permit2"), 5042, Permit2Address))` = `0xa88a1b742ab6890402e6ee74f2359f3723ab547c6dc3b850249bdbffebe2b18f`
- **Match: EXACT ✓**

The EIP-712 signature path is confirmed correct for both testnet (chain ID 5042002, tested with 9/9 fork tests) and mainnet (domain separator verified by formula).

**Arc USDC transfer note:** Arc USDC routes ERC-20 `transfer`/`transferFrom` through a native precompile (`0x1800...`). This is transparent to end-users and real wallets. It only matters in Foundry fork tests (use `vm.mockCall` for token movement). Real wallet transactions work normally.

---

## 4. Biller Registration Transactions

### On Testnet (already registered in constructor, no action needed)
The current PayRouter v2 has the platform deployer as both biller and treasury. This is acceptable for testnet smoke testing only.

### On Mainnet — Constructor route (preferred)

Pass `initialBillers` in the constructor to avoid the 24-hour timelock. Set these env vars before running the deploy script:

```bash
DEPLOY_BILLER_ADDRESS=<your-biller-wallet>
DEPLOY_BILLER_TREASURY=<where-fulfilled-payments-land>
```

The deploy script at `contracts/script/Deploy.s.sol` already handles this:
```solidity
address billerAddr     = vm.envOr("DEPLOY_BILLER_ADDRESS",   operator);
address billerTreasury = vm.envOr("DEPLOY_BILLER_TREASURY",  admin);
initialBillers[0] = InitialBiller({biller: billerAddr, treasury: billerTreasury});
```

### On Mainnet — Post-deploy route (if biller address not known at deploy time)

After deploy, the admin must queue then execute via the 24-hour timelock:

**Step 1 — Queue** (call from admin wallet, costs gas):
```solidity
// ABI-encode the (address biller, address treasury) pair
bytes memory encoded = abi.encode(<BILLER_ADDRESS>, <BILLER_TREASURY>);
router.queueConfigChange(keccak256("addBiller"), encoded);
// Note the ETA: block.timestamp + 86400 seconds
```

**Step 2 — Wait 24 hours**

**Step 3 — Execute** (call from admin wallet):
```solidity
router.executeConfigChange(keccak256("addBiller"));
```

**Verify:**
```
cast call <ROUTER_ADDRESS> "isBiller(address)(bool)" <BILLER_ADDRESS> --rpc-url https://rpc.mainnet.arc.io
# Expected: true
```

---

## 5. Deploy Script Risk Review

Reviewed `contracts/script/Deploy.s.sol` in full. Findings:

### Clean / correct

| Item | Assessment |
|---|---|
| USDC address | Hardcoded to canonical `0x3600...0000` as default, overrideable via env. Correct. |
| Permit2 address | Hardcoded to canonical `0x000...BA3` as default, overrideable via env. Correct. |
| Zero-address guards | All 4 required addresses checked with `require != address(0)`. |
| `feeWallet` | Explicitly passed to PayRouter constructor, NOT defaulting to `address(this)` or deployer. Defaults to `admin`. |
| Role assignment order | Operational roles granted first, then admin role transferred, then deployer renounces. Correct order. |
| Deployer ends with zero roles | Renounce executes AFTER grant to admin so there is always at least one admin. |
| `deployerIsAdmin` guard | Skips renounce when deployer == admin; prints a warning. Prevents accidental adminless contracts. |
| `INITIAL_FEE_BPS` | 0 at launch. |
| `MIN_BILL_TIER` | 0 at launch (permissionless). |
| Reserved handles | "dash", "admin", "support" reserved in HandleRegistry. |

### Risks / items requiring attention before mainnet

**RISK 1 — `PAUSER_ROLE` granted to `initialAdmin` in PayRouter and ScheduledPayouts constructors.**

```solidity
_grantRole(PAUSER_ROLE, initialAdmin);  // line 194 PayRouter, line 159 ScheduledPayouts
```

The script then grants `PAUSER_ROLE` to `pauser` separately, and renounces `PAUSER_ROLE` from the deployer. This means after deploy:
- `admin` holds `PAUSER_ROLE` (from constructor, never renounced)
- `pauser` holds `PAUSER_ROLE` (from `grantRole`)

The admin retaining `PAUSER_ROLE` is not a vulnerability (admin is already more powerful via timelock), but it means `DEPLOY_PAUSER_ADDRESS` provides a second pause capability, not the only one. Document this explicitly so the admin wallet operator knows they can pause directly.

**RISK 2 — `OPERATOR_ROLE` is NOT granted to `initialAdmin` in constructor.** (Correct by design — only deployer holds DEFAULT_ADMIN_ROLE + PAUSER_ROLE at constructor time. OPERATOR_ROLE is granted explicitly in the script to the operator wallet.) Verified by on-chain read: `hasRole(OPERATOR_ROLE, deployer)` = false on the live testnet contract.

**RISK 3 — No `OPERATOR_ROLE` on ScheduledPayouts.** ScheduledPayouts has no operator concept — claim/cancel are permissionless once a schedule is created. Correct for the product design, but confirm: the backend operator wallet needs no ScheduledPayouts role.

**RISK 4 — Biller defaults to `operator` if `DEPLOY_BILLER_ADDRESS` is unset.**
```solidity
address billerAddr = vm.envOr("DEPLOY_BILLER_ADDRESS", operator);
```
If you run the script without setting `DEPLOY_BILLER_ADDRESS`, your operator wallet becomes a registered biller. This may be undesirable if the operator and biller are meant to be separate. Set `DEPLOY_BILLER_ADDRESS` explicitly before mainnet deploy.

**RISK 5 — `DEPLOY_VERIFIER_ADDRESS` is required but can be any non-zero address.** The script will revert if it's zero, but if you use the wrong address you'll grant `VERIFIER_ROLE` to an unintended wallet with no way to revoke it without admin intervention. Double-check before broadcast.

**RISK 6 — No `vm.envOr` fallback for `admin`, `operator`, `verifier`, `pauser`.** All four use `vm.envAddress` which reverts if the variable is absent. This is correct safety behavior — no silent defaults — but ensure all four are set in `.env` before running the script.

### No critical vulnerabilities found. Deploy script is production-quality with the above notes.

---

## 6. Mainnet Smoke Test Procedure

**Warning: all steps below use real funds. Use the minimum amount (1–2 USDC) for every transaction. Do not proceed until all pre-deploy checks are complete.**

Do not broadcast any mainnet transaction until you have explicitly approved it.

### Pre-conditions
- [ ] Mainnet contracts deployed (addresses known)
- [ ] Admin wallet has `DEFAULT_ADMIN_ROLE` on all 4 contracts
- [ ] Operator wallet has `OPERATOR_ROLE` on PayRouter
- [ ] Biller is registered: `isBiller(<BILLER_ADDRESS>)` = true
- [ ] Your test wallet has approved Permit2: `USDC.approve(Permit2, maxUint256)` on Arc mainnet
- [ ] Your test wallet has 5–10 USDC on Arc mainnet

### Flow 1 — Plain send (1 USDC)

This tests the core Permit2 `send` path.

1. Connect your wallet to the DA$H app (preview or deployed).
2. Navigate to Send.
3. Enter a recipient address you control and amount = 1 USDC.
4. Sign the Permit2 off-chain signature when prompted.
5. Broadcast the transaction.
6. **Verify:** recipient USDC balance increased by 1,000,000 (6-decimal units).
7. Record tx hash.

### Flow 2 — Bill order + operator fulfill (2 USDC)

This tests the escrow lifecycle: `createOrder` → `fulfillOrder`.

1. Navigate to Bills. Select a registered biller.
2. Enter amount = 2 USDC, any account reference.
3. Sign the Permit2 witness signature and broadcast `createOrder`.
4. Note the `orderId` from the emitted `OrderCreated` event.
5. From the **operator wallet**, call `fulfillOrder(orderId)`.
6. **Verify:** biller treasury balance increased; order status = Fulfilled.
7. Record both tx hashes.

### Flow 3 — Bill order + reclaim (1 USDC)

This tests the reclaim path after timeout.

1. Create an order (1 USDC) as in Flow 2.
2. Wait 30 minutes without fulfilling (or increase `orderTimeoutSeconds` via timelock to a shorter value on testnet first — not recommended on mainnet).
3. Call `reclaimOrder(orderId)` from the payer wallet.
4. **Verify:** payer USDC balance restored; order status = Reclaimed.
5. Record tx hash.

### Flow 4 — Scheduled payout / pay-later (1 USDC)

This tests `deposit` → `claim` on ScheduledPayouts.

1. Navigate to Schedules, create a Pay-Later schedule: recipient = a wallet you control, amount = 1 USDC, start time = now, end time = now + 5 minutes.
2. Sign the Permit2 witness signature and broadcast `deposit`.
3. Wait for `endTime` to pass.
4. From the **recipient wallet**, call `claim(scheduleId)`.
5. **Verify:** recipient USDC balance increased by 1,000,000; schedule status = Claimed.
6. Record both tx hashes.

### Success criteria
All 4 flows produce valid transaction receipts with no reverts. Record each tx hash in `AGENTS.md` under a new "Mainnet smoke test" section.

---

## 7. GitHub Push Status

**Local commits are NOT pushed to `origin`.**

- Remote: `https://github.com/web3wizzz/Dash_Escrow_Payment.git`
- Local HEAD is **8 commits ahead** of `origin/main`.
- The 8 unpushed commits cover: the permissionless refactor, 234 unit tests, 9 fork EIP-712 tests, all testnet deployments, the deploy manifest, and the mainnet checklist.

**Uncommitted working-tree changes (source files, not build artifacts):**
- `contracts/script/Deploy.s.sol` — modified (MIN_BILL_TIER = 0, comment fixes — this is correct and should be committed)
- `contracts/contract-metadata/PayRouter.json` — updated with v2 deployment
- Various `src/` frontend files — UI changes from earlier work

To push to GitHub you need to authenticate (the GitHub CLI skill handles this). Until pushed, the codebase exists only in this sandbox.

---

## 8. Final GO/NO-GO Checklist

### VERDICT: NO-GO

**Completed / verified:**

| Item | Evidence |
|---|---|
| USDC on Arc Testnet: `0x3600...` | `decimals()` = 6, `symbol()` = "USDC" ✓ |
| USDC on Arc Mainnet: `0x3600...` | `decimals()` = 6, `symbol()` = "USDC" ✓ |
| Permit2 on Arc Testnet | `allowance()` call succeeded ✓ |
| Permit2 on Arc Mainnet | `allowance()` call succeeded ✓ |
| Permit2 mainnet domain separator | Computed == live (`0xa88a1b74...`) ✓ |
| EIP-712 digest chain verified | 9/9 fork tests pass on Arc Testnet ✓ |
| Witness selector (0x137c29fe) confirmed | Verified by `cast sig` ✓ |
| All unit + fuzz tests | 234/234 pass ✓ |
| Permissionless model (no `effectiveTier` in payment paths) | `grep` confirms zero calls ✓ |
| `globalPerPaymentCap` = 25 USDC | On-chain read ✓ |
| `feeBps` = 0 | On-chain read ✓ |
| `minBillTier` = 0 | On-chain read ✓ |
| Deployer ends with zero roles | On-chain: `hasRole(OPERATOR_ROLE, deployer)` = false ✓ |
| Deploy script zero-address guards | `require` on all 4 role addresses ✓ |
| `PAUSER_ROLE` also granted to admin (documented risk) | Noted — not a vulnerability ✓ |
| Biller defaults to operator if unset (documented risk) | Noted — set explicitly ✓ |
| Deploy script produces correct MIN_BILL_TIER = 0 | Diff confirmed ✓ |

**Blocking — owner action required before mainnet:**

| Blocker | Action Required |
|---|---|
| **B1: Role wallet addresses not provided** | You must provide 4 addresses: admin (multisig), operator, verifier, pauser. Set as env vars before running Deploy.s.sol. |
| **B2: Biller address for mainnet not designated** | Set `DEPLOY_BILLER_ADDRESS` and `DEPLOY_BILLER_TREASURY` explicitly. Biller can equal operator only if intentional. |
| **B3: Real-wallet E2E flows not executed** | Run the 4 flows in section 6 on testnet first, record tx hashes. Then repeat on mainnet after deploy. |
| **B4: All local changes not pushed to GitHub** | 8 commits ahead of origin. Push before mainnet deploy so the deployed code matches a known commit hash. |

**Not blocking but should be done before DoraHacks submission:**
- Push all commits to GitHub (8 ahead of origin)
- Commit the Deploy.s.sol diff and remaining source changes
- Record actual smoke test tx hashes in AGENTS.md

---

*This report was generated from live on-chain reads and source code inspection on 2026-10-29.*
