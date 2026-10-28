# DA$H Mainnet Deployment Checklist

Last updated: 2026-10-28
Status: **NO-GO** — blockers listed in section 9.

---

## 1. Wallet Separation (REQUIRED before mainnet)

| Role | Requirement | Status |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | Hardware wallet or Gnosis Safe multisig (2-of-3 minimum). NOT the deployer EOA. | Not set up |
| `OPERATOR_ROLE` | Separate hot wallet used exclusively for `fulfillOrder` / `rejectOrder`. | Not set up |
| `PAUSER_ROLE` | Separate address (can share with team lead hardware wallet). | Not set up |
| `VERIFIER_ROLE` (KycRegistry) | Separate address for tier management (grant if KYC is used, else skip). | Not needed at launch |
| Deployer | One-shot EOA, ends with zero roles after deployment. | Not set up |
| Fee wallet | Cold wallet or treasury multisig — receives protocol fees. | Not set up |

**Action required:** Set up all wallets before deploying. Never reuse the same address across roles.

---

## 2. Gas Fee Estimates

Arc mainnet gas is paid in USDC. All estimates below are approximate.

| Transaction | Estimated gas | Estimated USDC cost |
|---|---|---|
| HandleRegistry deploy | ~800k gas | ~$0.08 |
| KycRegistry deploy | ~500k gas | ~$0.05 |
| PayRouter deploy (empty billers) | ~3.5M gas | ~$0.35 |
| ScheduledPayouts deploy | ~2.5M gas | ~$0.25 |
| Grant OPERATOR_ROLE | ~50k gas | ~$0.005 |
| Grant PAUSER_ROLE | ~50k gas | ~$0.005 |
| Transfer DEFAULT_ADMIN_ROLE | ~50k gas | ~$0.005 |
| Renounce deployer roles | ~50k gas x2 | ~$0.01 |
| **Total deployment budget** | — | **~$1.50** |

Load the deployer wallet with at least **5 USDC** on mainnet for margin.

---

## 3. Contract Verification

Arc Testnet and Arc Mainnet support source verification through the Arc Explorer.

Steps:
1. After deployment, go to `https://explorer.arc.io/address/<CONTRACT>`.
2. Click "Verify & Publish".
3. Provide: compiler version (0.8.28), optimization (true, 200 runs), via-IR (true), EVM version (cancun).
4. Paste the flattened source or provide the full source with remappings.
5. Confirm ABI matches the deployed bytecode.

**Command to flatten:**
```bash
forge flatten contracts/HandleRegistry.sol > /tmp/HandleRegistry.flat.sol
forge flatten contracts/KycRegistry.sol > /tmp/KycRegistry.flat.sol
forge flatten contracts/PayRouter.sol > /tmp/PayRouter.flat.sol
forge flatten contracts/ScheduledPayouts.sol > /tmp/ScheduledPayouts.flat.sol
```

---

## 4. Constructor Argument Verification

Before calling `forge create` or the deploy script, independently verify:

- [ ] `usdc_` == `0x3600000000000000000000000000000000000000` on mainnet (chain ID 5042)
  - Verify: `cast call 0x3600000000000000000000000000000000000000 "decimals()(uint8)" --rpc-url https://rpc.mainnet.arc.io`
  - Expected: `6`
- [ ] `permit2_` == `0x000000000022D473030F116dDEE9F6B43aC78BA3` on mainnet
  - Verify: `cast code 0x000000000022D473030F116dDEE9F6B43aC78BA3 --rpc-url https://rpc.mainnet.arc.io | head -c 20`
  - Expected: non-empty bytecode
- [ ] `initialAdmin` is a hardware wallet or multisig you control (NOT the deployer)
- [ ] `feeWallet_` is a separate treasury wallet you control
- [ ] `initialGlobalPerPaymentCap` = `25000000` (25 USDC, 6 decimals)
- [ ] `minBillTier_` = `0` (permissionless)
- [ ] `orderTimeoutSeconds_` = `1800` (30 minutes)
- [ ] `initialFeeBps` = `0` (zero fee at launch)
- [ ] `initialBillers` array is correct or empty (add via timelock after deploy)

---

## 5. USDC and Permit2 Code Checks

Verify both contracts exist and respond on Arc mainnet before deploying:

```bash
# USDC decimals
cast call 0x3600000000000000000000000000000000000000 \
  "decimals()(uint8)" --rpc-url https://rpc.mainnet.arc.io
# Expected: 6

# Permit2 bytecode exists
cast code 0x000000000022D473030F116dDEE9F6B43aC78BA3 \
  --rpc-url https://rpc.mainnet.arc.io | wc -c
# Expected: > 100 characters

# Permit2 domain separator (non-zero means live)
cast call 0x000000000022D473030F116dDEE9F6B43aC78BA3 \
  "DOMAIN_SEPARATOR()(bytes32)" --rpc-url https://rpc.mainnet.arc.io
```

---

## 6. Role Verification After Deployment

After each contract is deployed, verify roles before proceeding to the next:

```bash
# HandleRegistry
cast call $HANDLE_REGISTRY "hasRole(bytes32,address)(bool)" \
  0x0000000000000000000000000000000000000000000000000000000000000000 \
  $ADMIN_ADDRESS --rpc-url https://rpc.mainnet.arc.io
# Expected: true

# PayRouter — verify DEFAULT_ADMIN_ROLE on multisig
cast call $PAY_ROUTER "hasRole(bytes32,address)(bool)" \
  0x0000000000000000000000000000000000000000000000000000000000000000 \
  $ADMIN_ADDRESS --rpc-url https://rpc.mainnet.arc.io
# Expected: true

# PayRouter — verify deployer has NO remaining roles
cast call $PAY_ROUTER "hasRole(bytes32,address)(bool)" \
  0x0000000000000000000000000000000000000000000000000000000000000000 \
  $DEPLOYER_ADDRESS --rpc-url https://rpc.mainnet.arc.io
# Expected: false (after renounce)

# PayRouter OPERATOR_ROLE
cast call $PAY_ROUTER "hasRole(bytes32,address)(bool)" \
  $(cast keccak "OPERATOR_ROLE") $OPERATOR_ADDRESS --rpc-url https://rpc.mainnet.arc.io
# Expected: true (after grant)

# PayRouter PAUSER_ROLE
cast call $PAY_ROUTER "hasRole(bytes32,address)(bool)" \
  $(cast keccak "PAUSER_ROLE") $PAUSER_ADDRESS --rpc-url https://rpc.mainnet.arc.io
# Expected: true (after grant)
```

---

## 7. Post-Deployment Configuration

After deploying and verifying roles:

1. **Register billers:** `queueConfigChange(CHANGE_ADD_BILLER, abi.encode(billerAddress, treasuryAddress))`
   - Wait 24 hours.
   - Call `executeConfigChange(CHANGE_ADD_BILLER)`.
   - Verify: `isBiller[billerAddress] == true` and `billerTreasury[billerAddress] == treasuryAddress`.

2. **Verify fee wallet:** `feeWallet()` returns the intended treasury address.

3. **Verify globalPerPaymentCap:** `globalPerPaymentCap()` returns `25000000`.

4. **Test pause/unpause:**
   - `pause()` as PAUSER_ROLE.
   - Confirm `paused() == true`.
   - `unpause()` as PAUSER_ROLE.
   - Confirm `paused() == false`.

---

## 8. Small-Value Mainnet Payment Tests

After deployment and role setup, before any public launch:

1. Send 1 USDC from a test wallet to another using `send()`. Verify balances changed.
2. Create a bill order for 1 USDC with `createOrder()`. Verify order stored with status Pending.
3. Fulfill the order as operator with `fulfillOrder()`. Verify treasury received net amount.
4. Create a 2nd order and wait for `orderTimeoutSeconds` to elapse. Reclaim with `reclaimOrder()`. Verify payer refunded.
5. Deposit a 1 USDC PayLater schedule with `deposit()`. Wait for `endTime`. Claim with `claim()`. Verify recipient received 1 USDC.

All five transactions must succeed and match expected balances before opening to users.

---

## 9. Key Management

- **Never paste a private key into Arc Studio chat, code, or any file.**
- For mainnet deployment with a private key, set `DEPLOYER_PRIVATE_KEY` in `.env` locally (never commit).
- Use `bun run compass:deploy --signer private-key` or `forge create --private-key $DEPLOYER_PRIVATE_KEY`.
- After deployment, delete the private key from `.env` immediately and rotate the deployer wallet if it held real funds.
- Store the admin multisig seed phrase on hardware wallets (Ledger / Trezor) in a secure offline location.
- Store the recovery phrase for each role wallet separately.

---

## 10. Remaining Audit Risks

From `docs/security-review.md` (Rev 3, no Critical or High findings):

| ID | Severity | Description | Mitigated? |
|---|---|---|---|
| M-01 | Medium | Timelock can be overwritten before execution | Yes — `TimelockPendingExecution` guard added |
| M-02 | Medium | Daily spend uint128 overflow | Yes — explicit overflow check in `_checkAndRecordSpend` |
| M-03 | Medium | `feeWallet` address set to deployer by default | Mitigated: use a treasury address in mainnet constructor |
| L-01 | Low | `fulfillOrder` after expiry window (no grace) | Accepted — expiry check at fulfillment is intentional |
| L-02 | Low | `_push` fallback silent failure creates pending withdrawal | Accepted — `withdraw()` recovery path exists |
| I-01 | Info | `InsufficientTierForBillOrder` error retained as dead code | Accepted — comment documents reason |

**No critical or high-severity findings remain open.**

The primary pre-mainnet security gap is the absence of a real-wallet end-to-end EIP-712 digest test against the canonical Permit2 (all current tests use MockPermit2). This is listed as Blocker #2 below.

---

## 11. GO / NO-GO Decision

### Current status: **NO-GO**

### Blockers before mainnet:

**Blocker 1 — Role wallets not set up.**
`DEFAULT_ADMIN_ROLE`, `OPERATOR_ROLE`, `PAUSER_ROLE`, and the fee wallet must each be a separate, dedicated, non-deployer address before mainnet deployment. The testnet deployment uses the shared platform deployer for all roles, which is acceptable for testnet only.

**Blocker 2 — End-to-end Permit2 EIP-712 digest not verified against canonical contract.**
All 234 unit tests use `MockPermit2`. The real Permit2 computes the EIP-712 domain separator from `{chainId, verifyingContract}` only (no `name` field). The contracts pass the correct witness type string, but the full signature construction path from a real wallet has not been exercised against the live testnet contracts. A real-wallet test (e.g., via Foundry fork test with `--fork-url` pointing to Arc Testnet, or a live end-to-end integration test) must pass before mainnet.

**Blocker 3 — No registered billers on testnet.**
`createOrder` will always revert with `InvalidBiller` until at least one biller is registered. The 24-hour timelock means this must be done ≥24 hours before any escrow testing. For testnet: pass billers in the constructor instead (redeploy with `initialBillers` populated). For mainnet: include billers in constructor or queue immediately after deploy.

**Blocker 4 — Explorer transaction evidence incomplete.**
Steps 3–7 of the Phase 3 testnet plan (real-wallet USDC transfer, bill order lifecycle, scheduled payout claim) have not yet been executed. Each requires a real wallet connected to Arc Testnet with testnet USDC. Execute these manually using the app's UI or Foundry fork tests before declaring the testnet phase complete.

### Will be resolved by:

1. Wallet setup: handled externally before mainnet deployment.
2. Permit2 EIP-712: run `forge test --fork-url https://rpc.testnet.arc.io --match-contract PermissionlessTest -vvvv` once testnet USDC is available, or connect a wallet in the app and make a real payment.
3. Biller registration: redeploy testnet with `initialBillers` populated, or use timelock.
4. E2E test: use the live app with Arc Testnet USDC from the "Get test USDC" sidebar button.

### Conditions for GO:

- [ ] All four mainnet role wallets created and addresses confirmed
- [ ] E2E payment test passes on testnet (real wallet, real Permit2, live chain)
- [ ] Biller registered and order lifecycle verified on testnet
- [ ] Schedule deposit + claim verified on testnet
- [ ] Deployer ends with zero roles on mainnet
- [ ] `DEFAULT_ADMIN_ROLE` on mainnet confirmed on multisig
- [ ] Source verification submitted on Arc Explorer

**Estimated time to GO from today: 2–3 days** (wallet setup + 24h timelock for biller + E2E testing).
