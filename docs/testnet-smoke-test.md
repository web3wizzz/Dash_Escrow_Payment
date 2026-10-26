# Testnet Deployment & Smoke-Test Guide

**Target:** Arc Testnet (chain ID 5042002)
**RPC:** `https://rpc.testnet.arc.io`
**Explorer:** `https://explorer.testnet.arc.io`
**Permit2:** `0x000000000022D473030F116dDEE9F6B43aC78BA3` — bytecode confirmed on Arc testnet
**USDC:** `0x3600000000000000000000000000000000000000` — proxy confirmed on Arc testnet

**Note on USDC decimals:** Arc's USDC ERC-20 interface uses **6 decimals** for all
application-level transfers, approvals, and Permit2 calls. The native (gas) view uses 18
decimals. Dash contracts use only the ERC-20 interface. All amounts in this guide are in
6-decimal units (1 USDC = 1,000,000).

---

## Prerequisites

- Foundry installed: `curl -L https://foundry.paradigm.xyz | bash && foundryup`
- Four funded Arc testnet wallets (or the same wallet for all roles — fine for testnet):
  - **Admin** — will hold DEFAULT_ADMIN_ROLE on all contracts
  - **Operator** — will hold OPERATOR_ROLE on PayRouter (can fulfill/reject bill orders)
  - **Verifier** — will hold VERIFIER_ROLE on KycRegistry (can set KYC tiers)
  - **Pauser** — will hold PAUSER_ROLE on PayRouter and ScheduledPayouts
  - **Deployer** — the wallet that signs the deploy transactions (can be the same as any of the above on testnet, but should be distinct on mainnet)
- A **separate user wallet** with testnet USDC (get from Arc Studio sidebar "Get test USDC")
- MetaMask or Rabby configured with Arc Testnet (chain ID 5042002, RPC `https://rpc.testnet.arc.io`)

---

## Step 1 — Set environment variables

Create a `.env.deploy` file (do NOT commit it):

```bash
export DEPLOY_ADMIN_ADDRESS=<admin-wallet>
export DEPLOY_OPERATOR_ADDRESS=<operator-wallet>
export DEPLOY_VERIFIER_ADDRESS=<verifier-wallet>
export DEPLOY_PAUSER_ADDRESS=<pauser-wallet>
# For testnet you may reuse one wallet for all four roles:
# export DEPLOY_ADMIN_ADDRESS=<your-wallet>
# export DEPLOY_OPERATOR_ADDRESS=<your-wallet>
# export DEPLOY_VERIFIER_ADDRESS=<your-wallet>
# export DEPLOY_PAUSER_ADDRESS=<your-wallet>
export PRIVATE_KEY=<deployer-private-key>   # NEVER commit
```

Source it: `source .env.deploy`

---

## Step 2 — Verify Permit2 and USDC bytecode

Before deploying, confirm both contracts are live on Arc testnet:

```bash
# Permit2 — should print a long hex bytecode (not 0x)
cast code 0x000000000022D473030F116dDEE9F6B43aC78BA3 \
  --rpc-url https://rpc.testnet.arc.io | head -c 20

# USDC proxy — should print bytecode (not 0x)
cast code 0x3600000000000000000000000000000000000000 \
  --rpc-url https://rpc.testnet.arc.io | head -c 20
```

If either prints `0x`, stop and contact the Arc team.

---

## Step 3 — Dry-run (no broadcast)

```bash
forge script contracts/script/Deploy.s.sol \
  --rpc-url https://rpc.testnet.arc.io
```

This compiles and simulates without broadcasting. Verify:
- All four contract addresses printed
- `VITE_*` lines printed at the end
- No revert messages
- "Deployer (msg.sender): will hand off admin after setup" logged
- Post-deploy note about feeWallet timelock printed

---

## Step 4 — Deploy to Arc Testnet

```bash
forge script contracts/script/Deploy.s.sol \
  --rpc-url https://rpc.testnet.arc.io \
  --private-key $PRIVATE_KEY \
  --broadcast
```

Copy the four `VITE_*` lines from the output into `.env`:

```
VITE_HANDLE_REGISTRY_ADDRESS=0x...
VITE_KYC_REGISTRY_ADDRESS=0x...
VITE_PAY_ROUTER_ADDRESS=0x...
VITE_SCHEDULED_PAYOUTS_ADDRESS=0x...
VITE_FEE_WALLET_ADDRESS=0x...
```

Restart the Vite dev server: `bun run dev`

Paste the addresses into `AGENTS.md` under **Deployed contracts**.

**Post-deploy: queue feeWallet change via timelock (as admin, after 24h on mainnet):**

```bash
# On testnet you can skip the 24h wait by using a lower TIMELOCK_DELAY or accepting
# that feeWallet == deployer wallet initially. On mainnet, queue immediately:
cast send $PAY_ROUTER_ADDRESS \
  "queueConfigChange(bytes32,bytes)" \
  $(cast keccak "feeWallet") \
  $(cast abi-encode "(address)" $DEPLOY_ADMIN_ADDRESS) \
  --private-key $ADMIN_PRIVATE_KEY \
  --rpc-url https://rpc.testnet.arc.io
```

---

## Step 5 — Verify role assignments

```bash
PAY_ROUTER=$VITE_PAY_ROUTER_ADDRESS
KYC_REGISTRY=$VITE_KYC_REGISTRY_ADDRESS

# Check admin has DEFAULT_ADMIN_ROLE on PayRouter
cast call $PAY_ROUTER \
  "hasRole(bytes32,address)(bool)" \
  0x0000000000000000000000000000000000000000000000000000000000000000 \
  $DEPLOY_ADMIN_ADDRESS \
  --rpc-url https://rpc.testnet.arc.io
# Expected: true

# Check deployer does NOT have DEFAULT_ADMIN_ROLE (after renounce)
cast call $PAY_ROUTER \
  "hasRole(bytes32,address)(bool)" \
  0x0000000000000000000000000000000000000000000000000000000000000000 \
  $DEPLOYER_ADDRESS \
  --rpc-url https://rpc.testnet.arc.io
# Expected: false  (deployer renounced during deploy)

# Check operator has OPERATOR_ROLE
cast call $PAY_ROUTER \
  "hasRole(bytes32,address)(bool)" \
  $(cast keccak "OPERATOR_ROLE") \
  $DEPLOY_OPERATOR_ADDRESS \
  --rpc-url https://rpc.testnet.arc.io
# Note: OPERATOR_ROLE = keccak256("OPERATOR_ROLE") not the string itself
```

---

## Step 6 — Get USDC approval for Permit2

The user wallet (the wallet used for smoke tests) needs a one-time Permit2 max-approval.
Do this in the app's Profile screen ("Approve Permit2" button), or via `cast`:

```bash
cast send 0x3600000000000000000000000000000000000000 \
  "approve(address,uint256)" \
  0x000000000022D473030F116dDEE9F6B43aC78BA3 \
  115792089237316195423570985008687907853269984665640564039457584007913129639935 \
  --private-key $USER_PRIVATE_KEY \
  --rpc-url https://rpc.testnet.arc.io
```

---

## Step 7 — Smoke-test: Send USDC

**In the app (Home → Send):**

1. Connect your testnet user wallet.
2. Tap **Home** → **Send** button.
3. Enter a recipient address (or a registered handle).
4. Enter `1` USDC.
5. Sign the Permit2 signature in MetaMask/Rabby.
   - The wallet should prompt for a typed-data signature (no gas fee prompt at this step).
   - The domain should show `chainId: 5042002` and `verifyingContract: 0x000...0022...`.
   - There must be NO `name` field in the domain — if one appears, that is a bug.
6. Confirm the transaction.

**Expected result:** Transaction on the explorer, recipient balance +1 USDC.

---

## Step 8 — Smoke-test: Register a handle

**In the app (Profile screen):**

1. Navigate to **Profile**.
2. Enter a handle (e.g. `alice`) and tap **Claim handle**.
3. Confirm the transaction.

Then re-run the Send test using the handle instead of an address.

---

## Step 9 — Smoke-test: Create Bill Order and Reclaim

**Set KYC tier first (Tier 1 required for bill orders):**

```bash
# Use the verifier wallet to set Tier 1 on the user wallet
cast send $KYC_REGISTRY \
  "setTier(address,uint8,uint64)" \
  $USER_WALLET_ADDRESS 1 9999999999 \
  --private-key $VERIFIER_PRIVATE_KEY \
  --rpc-url https://rpc.testnet.arc.io
```

**In the app (Bills screen):**

1. Navigate to **Bills**.
2. Select the **Airtime** category.
3. Choose a sandbox airtime provider (e.g. **MTN Airtime** or **Airtel Airtime** — all marked "Sandbox").
4. Enter a phone number and an amount (minimum 1 USDC, must be ≤ 25 USDC global cap).
5. Sign the Permit2 witness request in the wallet.
   - The wallet should show `BillOrderWitness` fields: `orderId`, `billerId`, `accountHash`, `ref`.
6. The order enters **Pending** state — USDC moves to the PayRouter contract.

**Option A — Fulfill the order (as operator):**

```bash
# Get orderId from the OrderCreated event in the tx receipt
ORDER_ID=<orderId-from-explorer>
cast send $PAY_ROUTER_ADDRESS \
  "fulfillOrder(bytes32)" $ORDER_ID \
  --private-key $OPERATOR_PRIVATE_KEY \
  --rpc-url https://rpc.testnet.arc.io
```

Verify on the explorer that USDC moved from PayRouter to the biller treasury.

**Option B — Reclaim after timeout (30 minutes):**

```bash
# Wait 30 minutes, then anyone can call reclaimOrder
cast send $PAY_ROUTER_ADDRESS \
  "reclaimOrder(bytes32)" $ORDER_ID \
  --rpc-url https://rpc.testnet.arc.io \
  --private-key $USER_PRIVATE_KEY
```

Verify USDC returned to the user wallet.

---

## Step 10 — Smoke-test: Scheduled Payout (Pay Later) and Claim

**In the app (Schedules → New Schedule):**

1. Navigate to **Schedules** (bottom nav, rightmost tab).
2. Tap **New Schedule**.
3. Choose **Pay Later** type.
4. Set:
   - Recipient: any funded testnet address
   - Amount: 1 USDC
   - Due date: 2 minutes from now (for quick testing)
5. Sign the Permit2 witness request — wallet should show `ScheduleWitness` fields.
6. Confirm. USDC moves to the ScheduledPayouts contract.

**Claim after due date:**

```bash
# After 2 minutes
SCHEDULE_ID=<scheduleId-from-ScheduleCreated-event>
cast send $SCHEDULED_PAYOUTS_ADDRESS \
  "claim(bytes32)" $SCHEDULE_ID \
  --private-key $ANY_PRIVATE_KEY \
  --rpc-url https://rpc.testnet.arc.io
```

Verify on the explorer that USDC moved to the recipient address.
`claim` is permissionless: anyone may call it, but the USDC always goes to the recorded recipient.

---

## Step 11 — Record results

Update `AGENTS.md`:
- All four contract addresses
- Permit2 bytecode confirmed: yes
- USDC bytecode confirmed: yes
- Smoke tests: send ✅, createOrder ✅, reclaimOrder ✅, deposit ✅, claim ✅

These results satisfy **Mainnet Gate 1** from `docs/security-review.md`.

---

## Testnet Checklist

| Gate | Status |
|------|--------|
| Permit2 deployed at canonical address | Confirmed (bytecode present) |
| USDC proxy at `0x3600...0000` | Confirmed (bytecode present) |
| All 4 contracts deployed, addresses in .env | Do before smoke-test |
| Deployer has no admin role after deploy | Verified by Deploy.t.sol tests |
| `forge test --via-ir`: all passed | See CI results |
| Lint/typecheck: 0 errors | See CI results |
| `send` smoke-test with real wallet | Run Step 7 |
| `createOrder` + `reclaimOrder` smoke-test | Run Step 9 |
| `deposit` + `claim` smoke-test | Run Step 10 |
| Admin wallet changed to multisig | Required before mainnet |
| T-05: EIP-712 smoke-test passed | Satisfied by Steps 7–10 |

---

## E2E Testnet Demo (all four flows)

### Prerequisites
- Four wallets funded with testnet USDC (≥ 10 USDC each)
- Contracts deployed (Step 4 complete)
- User wallet has Permit2 approved (Step 6 complete)
- User wallet has Tier 1 KYC set (Step 9 prerequisite)

### Flow 1 — Send USDC by handle
1. Claim handle `alice` on Profile.
2. From a second wallet, send 1 USDC to handle `alice` via Home → Send.
3. Verify `alice` wallet balance increases.

### Flow 2 — Bill Escrow + Reclaim (no operator)
1. From `alice`, open Bills → Airtime → MTN Airtime.
2. Create a 1 USDC order. Sign Permit2 witness.
3. Verify order in Pending state on-chain (USDC in PayRouter).
4. Wait 30 minutes. Call `reclaimOrder` from any wallet.
5. Verify USDC returned to `alice`.

### Flow 3 — Bill Escrow + Fulfill (with operator)
1. Repeat Flow 2 steps 1–3.
2. Before 30 minutes, call `fulfillOrder` from the operator wallet.
3. Verify USDC in biller treasury.

### Flow 4 — Scheduled Payout (Pay Later) + Claim
1. From `alice`, open Schedules → New → Pay Later.
2. Set recipient to a second wallet, amount 1 USDC, due date 2 minutes out.
3. Sign Permit2 witness. Confirm. USDC in ScheduledPayouts.
4. Wait 2 minutes. Call `claim` from any wallet.
5. Verify USDC in recipient wallet.
