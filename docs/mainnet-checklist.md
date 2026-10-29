# DA$H Mainnet Readiness Checklist

Last updated: 2026-10-29
Status: **NO-GO** (2 blockers remain; 2 cleared)

---

## Summary

| # | Blocker | Status |
|---|---|---|
| 1 | Dedicated role wallets | OPEN |
| 2 | Permit2 EIP-712 digest chain verified | CLEARED |
| 3 | Billers registered | OPEN (testnet-only biller) |
| 4 | Real-wallet E2E evidence | OPEN |

---

## Cleared Blockers

### Blocker 2 — Permit2 EIP-712 (CLEARED 2026-10-29)

9 fork tests run against canonical Permit2 bytecode on Arc Testnet via `--fork-url`:

```
forge test --match-contract ForkPermit2Test \
           --fork-url https://rpc.testnet.arc.io \
           --via-ir
```

Results: **9/9 PASS**

Findings recorded in `AGENTS.md`:
- Domain separator includes `name="Permit2"` field
- Witness selector `0x137c29fe` (nested tuple ABI)
- Arc USDC precompile limitation documented (mock required in fork, real wallets work)

---

## Open Blockers

### Blocker 1 — Dedicated Role Wallets (REQUIRED before mainnet)

On testnet all roles are held by the shared platform deployer (`0x5B12Ce46C7194aD57d143bC22847224047b1Ef42`).
On mainnet each role must be a separate, dedicated wallet:

| Role | Purpose | Requirement |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | Governance: queue/execute timelock changes | Hardware wallet or multisig |
| `OPERATOR_ROLE` | Fulfill and reject bill orders | Dedicated hot wallet, backend-controlled |
| `PAUSER_ROLE` | Emergency pause of payment entry points | Separate key from admin |
| Fee wallet | Receives protocol fees | Can be a multisig or treasury contract |

Action required:
1. Generate or designate 4 separate addresses
2. Add them to `.env` as `DEPLOY_ADMIN_ADDRESS`, `DEPLOY_OPERATOR_ADDRESS`, `DEPLOY_PAUSER_ADDRESS`, `DEPLOY_FEE_WALLET_ADDRESS`
3. Redeploy on testnet with these addresses and verify role assignments
4. Confirm the deployer ends with zero roles (the `admin == deployer` guard skips the renounce step — on mainnet they must be different)

### Blocker 3 — Registered Billers (REQUIRED before createOrder is usable on mainnet)

The testnet PayRouter has the platform deployer as both biller and treasury. On mainnet:
- Each participating merchant/biller must be registered with a real treasury address
- Registration goes through the 24-hour timelock (`queueConfigChange` → wait → `executeChange`)
- The `addBiller` key must be queued at least 24 hours before the first `createOrder` call

Action required:
1. Identify biller address(es) and treasury address(es)
2. Queue `addBiller` change after mainnet deploy
3. Wait 24 hours; execute the change
4. Verify `isBiller(billerAddr) == true` on-chain

### Blocker 4 — Real-Wallet E2E Evidence (REQUIRED before mainnet)

Permit2 on Arc uses a native precompile for token movement that cannot be tested in Foundry fork mode.
A real connected wallet must execute all four flows against the live testnet contracts:

See `docs/testnet-smoke-test.md` for step-by-step instructions.

| Flow | Evidence needed |
|---|---|
| Send (plain Permit2) | Tx hash; balances updated |
| Bill order → fulfill → release | 3 tx hashes; no funds stuck |
| Bill order → timeout → reclaim | 2 tx hashes; funds returned |
| Scheduled payout deposit + claim | 2 tx hashes; correct amount released after unlock |

---

## Pre-Mainnet Gates (all must pass before deploy)

- [ ] Dedicated role wallets provisioned and confirmed
- [ ] Testnet redeployment with real role addresses; deployer ends with zero roles
- [ ] Billers registered on testnet; 24h timelock verified working
- [ ] All 4 real-wallet E2E flows completed with tx hashes recorded
- [ ] `forge test --via-ir`: 234/234 pass
- [ ] `forge test --match-contract ForkPermit2Test --fork-url https://rpc.testnet.arc.io --via-ir`: 9/9 pass
- [ ] Independent security review of all 4 contracts
- [ ] Mainnet RPC, chain ID (5042), and USDC address triple-checked in `.env`
- [ ] No private keys, secrets, or API keys committed to git
- [ ] Mainnet deploy uses `--signer private-key` with deployer key in env var (never a flag)

---

## Estimated Time to GO

From today (all role wallets available): **1–2 days**
- Day 0: provision role wallets, redeploy testnet with real addresses, verify zero-role deployer
- Day 0: complete real-wallet E2E (4 flows, ~2 hours)
- Day 1+: queue `addBiller` change, wait 24 hours, execute
- Day 2: confirm all gates pass, then deploy to mainnet

Without role wallets or without an independent audit: **indefinite NO-GO**.

---

## Mainnet Deploy Command (when all gates pass)

```bash
# Set env vars first (never as flags):
# DEPLOYER_PRIVATE_KEY=<your-key>
# DEPLOY_ADMIN_ADDRESS=<multisig>
# DEPLOY_OPERATOR_ADDRESS=<operator-hot-wallet>
# DEPLOY_PAUSER_ADDRESS=<pauser-wallet>
# DEPLOY_FEE_WALLET_ADDRESS=<treasury>
# DEPLOY_USDC_ADDRESS=0x3600000000000000000000000000000000000000
# DEPLOY_PERMIT2_ADDRESS=0x000000000022D473030F116dDEE9F6B43aC78BA3
# DEPLOY_BILLER_ADDRESS=<biller>        (or leave empty and add via timelock)
# DEPLOY_BILLER_TREASURY=<treasury>

forge script contracts/script/Deploy.s.sol \
  --rpc-url https://rpc.mainnet.arc.io \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  --chain-id 5042

# Verify deployer ends with zero roles (check explorer or cast call hasRole)
```

Warning: Transactions on mainnet involve real funds and are irreversible. Deploy and operate from your own wallet. Arc Studio does not deploy to mainnet.
