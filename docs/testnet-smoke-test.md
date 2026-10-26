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

## Effective spending limits at testnet launch

| Tier | Per-payment | Daily (PayRouter) | Deposit cap (ScheduledPayouts) |
|------|-------------|-------------------|-------------------------------|
| 0 (unverified) | 5 USDC | 50 USDC | 5 USDC per deposit |
| 1 (verified)   | 100 USDC | 20,000 USDC | 100 USDC per deposit |
| 2              | 20,000 USDC | unlimited | 20,000 USDC per deposit |
| **Global cap (all tiers)** | **25 USDC** | — | **25 USDC** |

The 25 USDC global cap overrides the per-tier caps at testnet launch, making the effective
maximum per transaction 25 USDC regardless of tier. The cap is raised via a timelocked
admin action (`CHANGE_GLOBAL_PER_PAYMENT_CAP`) once confirmed live.

ScheduledPayouts enforces per-deposit caps but does **not** enforce a daily accumulator.
This is a documented limitation — see `docs/security-review.md` D-04.

---

## Prerequisites

- Foundry installed: `curl -L https://foundry.paradigm.xyz | bash && foundryup`
- Four funded Arc testnet wallets (or the same wallet for all roles — fine for testnet):
  - **Admin** — will hold `DEFAULT_ADMIN_ROLE` on all contracts
  - **Operator** — will hold `OPERATOR_ROLE` on PayRouter (can fulfill/reject bill orders)
  - **Verifier** — will hold `VERIFIER_ROLE` on KycRegistry (can set KYC tiers)
  - **Pauser** — will hold `PAUSER_ROLE` on PayRouter and ScheduledPayouts
  - **Deployer** — the wallet that signs the deploy transactions (can be the same as any of the above on testnet; must be distinct on mainnet)
  - **FeeWallet** — receives protocol fees on fulfilled bill orders (set at deploy time via `DEPLOY_FEE_WALLET_ADDRESS`)
- A **separate user wallet** with testnet USDC (use "Get test USDC" in the Arc Studio sidebar)
- MetaMask or Rabby configured for Arc Testnet (chain ID 5042002, RPC `https://rpc.testnet.arc.io`)

---

## Step 1 — Set environment variables

Create a `.env.deploy` file (do NOT commit it — it contains private keys):

```bash
# Required: role wallets
export DEPLOY_ADMIN_ADDRESS=<admin-wallet-address>
export DEPLOY_OPERATOR_ADDRESS=<operator-wallet-address>
export DEPLOY_VERIFIER_ADDRESS=<verifier-wallet-address>
export DEPLOY_PAUSER_ADDRESS=<pauser-wallet-address>

# Optional: defaults shown in comments
# export DEPLOY_FEE_WALLET_ADDRESS=<fee-wallet>     # default: DEPLOY_ADMIN_ADDRESS
# export DEPLOY_BILLER_ADDRESS=<biller>             # default: DEPLOY_OPERATOR_ADDRESS
# export DEPLOY_BILLER_TREASURY=<treasury>          # default: DEPLOY_ADMIN_ADDRESS

# For testnet you may reuse one wallet for all role addresses:
# export DEPLOY_ADMIN_ADDRESS=<your-wallet>
# export DEPLOY_OPERATOR_ADDRESS=<your-wallet>
# export DEPLOY_VERIFIER_ADDRESS=<your-wallet>
# export DEPLOY_PAUSER_ADDRESS=<your-wallet>

# Deployer key — use a keystore or hardware wallet on mainnet; env var is acceptable on testnet.
# NEVER commit this file.
export PRIVATE_KEY=<deployer-private-key>
```

Source it: `source .env.deploy`

**Signing alternatives to env-var private keys (more secure):**
- Foundry keystore: `--account <keystore-name>` (use `cast wallet import` to set up)
- Ledger: `--ledger`
- Trezor: `--trezor`
Replace `--private-key $PRIVATE_KEY` in forge commands below with the appropriate flag.

---

## Step 2 — Verify Permit2 and USDC bytecode

Before deploying, confirm both contracts are live on Arc testnet:

```bash
# Permit2 — should print a long hex string (not bare "0x")
cast code 0x000000000022D473030F116dDEE9F6B43aC78BA3 \
  --rpc-url https://rpc.testnet.arc.io | head -c 30

# USDC proxy — should print bytecode (not bare "0x")
cast code 0x3600000000000000000000000000000000000000 \
  --rpc-url https://rpc.testnet.arc.io | head -c 30
```

If either prints only `0x`, stop and contact the Arc team.

---

## Step 3 — Dry-run (no broadcast)

```bash
forge script contracts/script/Deploy.s.sol \
  --rpc-url https://rpc.testnet.arc.io
```

This compiles and simulates the full script without broadcasting any transactions. Verify:
- All four contract addresses are printed
- `VITE_*` lines appear at the end
- No revert messages
- The `FeeWallet:` line shows your intended fee wallet address
- If deployer == admin: "WARNING: deployer == admin. Admin role will NOT be renounced" is logged
- If deployer != admin: "Deployer has zero roles on all contracts after this deploy" is logged

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

**Note on feeWallet:** The fee wallet is set explicitly at deploy time via `DEPLOY_FEE_WALLET_ADDRESS`
(defaulting to `DEPLOY_ADMIN_ADDRESS` if not set). It is **not** the deployer wallet — the
deployer wallet never receives fees. The fee wallet can be updated post-deploy via the 24-hour
timelock if needed (see Step 4a below). At launch, `feeBps = 0`, so no fees are charged until
the admin explicitly raises the fee via a timelocked change.

---

## Step 4a — (Optional) Update fee wallet via timelock

If you need to change the fee wallet after deploy, the admin must queue the change and wait
24 hours before executing it. This is the only mechanism — there is no shortcut and the
24-hour delay cannot be reduced without deploying new contracts.

```bash
# As admin: queue the feeWallet change (24h timelock)
cast send $PAY_ROUTER_ADDRESS \
  "queueConfigChange(bytes32,bytes)" \
  $(cast keccak "feeWallet") \
  $(cast abi-encode "address" $NEW_FEE_WALLET) \
  --private-key $ADMIN_PRIVATE_KEY \
  --rpc-url https://rpc.testnet.arc.io

# After 24 hours: execute the change
cast send $PAY_ROUTER_ADDRESS \
  "executeConfigChange(bytes32)" \
  $(cast keccak "feeWallet") \
  --private-key $ADMIN_PRIVATE_KEY \
  --rpc-url https://rpc.testnet.arc.io
```

Verify on-chain:
```bash
cast call $PAY_ROUTER_ADDRESS \
  "feeWallet()(address)" \
  --rpc-url https://rpc.testnet.arc.io
# Should print the new fee wallet address
```

---

## Step 5 — Verify role assignments

```bash
PAY_ROUTER=$VITE_PAY_ROUTER_ADDRESS
KYC_REGISTRY=$VITE_KYC_REGISTRY_ADDRESS

# DEFAULT_ADMIN_ROLE bytes32 value is 0x000...000 (32 zero bytes)
ADMIN_ROLE=0x0000000000000000000000000000000000000000000000000000000000000000
# OPERATOR_ROLE = keccak256("OPERATOR_ROLE")
OPERATOR_ROLE=$(cast keccak "OPERATOR_ROLE")
# VERIFIER_ROLE = keccak256("VERIFIER_ROLE")
VERIFIER_ROLE=$(cast keccak "VERIFIER_ROLE")
# PAUSER_ROLE = keccak256("PAUSER_ROLE")
PAUSER_ROLE=$(cast keccak "PAUSER_ROLE")

# 1. Admin has DEFAULT_ADMIN_ROLE on PayRouter
cast call $PAY_ROUTER "hasRole(bytes32,address)(bool)" \
  $ADMIN_ROLE $DEPLOY_ADMIN_ADDRESS \
  --rpc-url https://rpc.testnet.arc.io
# Expected: true

# 2. Deployer does NOT have DEFAULT_ADMIN_ROLE (when deployer != admin)
cast call $PAY_ROUTER "hasRole(bytes32,address)(bool)" \
  $ADMIN_ROLE $DEPLOYER_ADDRESS \
  --rpc-url https://rpc.testnet.arc.io
# Expected: false

# 3. Operator has OPERATOR_ROLE on PayRouter
cast call $PAY_ROUTER "hasRole(bytes32,address)(bool)" \
  $OPERATOR_ROLE $DEPLOY_OPERATOR_ADDRESS \
  --rpc-url https://rpc.testnet.arc.io
# Expected: true

# 4. Verifier has VERIFIER_ROLE on KycRegistry
cast call $KYC_REGISTRY "hasRole(bytes32,address)(bool)" \
  $VERIFIER_ROLE $DEPLOY_VERIFIER_ADDRESS \
  --rpc-url https://rpc.testnet.arc.io
# Expected: true

# 5. Confirm feeWallet
cast call $PAY_ROUTER "feeWallet()(address)" \
  --rpc-url https://rpc.testnet.arc.io
# Expected: your DEPLOY_FEE_WALLET_ADDRESS (or DEPLOY_ADMIN_ADDRESS if not overridden)
```

---

## Step 6 — Get USDC and approve Permit2

The user wallet needs testnet USDC and a one-time Permit2 max-approval.

**Get testnet USDC:** Use "Get test USDC" in the Arc Studio sidebar.

**Approve Permit2 (in the app):** Profile screen → "Approve Permit2" button.

Or via `cast`:
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
2. From **Home**, tap the **Send** button.
3. Enter a recipient address or a registered handle.
4. Enter `1` USDC (within the 25 USDC global cap).
5. Sign the Permit2 typed-data signature in MetaMask/Rabby.
   - The wallet prompts for a typed-data signature (no gas at this step).
   - Domain must show `chainId: 5042002` and `verifyingContract: 0x000000000022D473030F116dDEE9F6B43aC78BA3`.
   - There must be **NO** `name` field in the domain. If one appears, that is a bug.
6. Confirm the transaction.

**Expected:** Transaction visible on the explorer. Recipient balance +1 USDC.

---

## Step 8 — Smoke-test: Register a handle

**In the app (Profile screen):**

1. Navigate to **Profile** (bottom nav).
2. Enter a handle (e.g. `alice`) and tap **Claim handle**.
3. Confirm the transaction.

Then re-run the Send test sending to `alice` by handle.

---

## Step 9 — Smoke-test: Bill Order

**Set KYC Tier 1 first (required for bill orders):**

```bash
# As verifier: set Tier 1 for the user wallet, expiry far in future
cast send $VITE_KYC_REGISTRY_ADDRESS \
  "setTier(address,uint8,uint64)" \
  $USER_WALLET_ADDRESS 1 9999999999 \
  --private-key $VERIFIER_PRIVATE_KEY \
  --rpc-url https://rpc.testnet.arc.io
```

Verify the tier was set:
```bash
cast call $VITE_KYC_REGISTRY_ADDRESS \
  "effectiveTier(address)(uint8)" $USER_WALLET_ADDRESS \
  --rpc-url https://rpc.testnet.arc.io
# Expected: 1
```

**In the app (Bills):**

1. Navigate to **Bills** (bottom nav, fourth tab).
2. Select the **Airtime** category.
3. Choose **MTN Airtime** or **Airtel Airtime** (both marked "Sandbox" — safe for testnet).
4. Enter a phone number and an amount (e.g. `1` USDC — must be ≤ 25 USDC global cap).
5. Sign the Permit2 witness request. The wallet should show `BillOrderWitness` fields: `orderId`, `billerId`, `accountHash`, `ref`.
6. The order enters **Pending** state — USDC moves to the PayRouter contract.

**Option A — Fulfill the order (as operator):**

Get the `orderId` from the `OrderCreated` event in the transaction receipt on the explorer, then:

```bash
cast send $VITE_PAY_ROUTER_ADDRESS \
  "fulfillOrder(bytes32)" $ORDER_ID \
  --private-key $OPERATOR_PRIVATE_KEY \
  --rpc-url https://rpc.testnet.arc.io
```

Verify that USDC moved from PayRouter to the biller treasury.

**Option B — Reclaim after 30-minute timeout:**

After 30 minutes (1800 seconds), anyone can call `reclaimOrder`:

```bash
# reclaimOrder is permissionless — any caller works
cast send $VITE_PAY_ROUTER_ADDRESS \
  "reclaimOrder(bytes32)" $ORDER_ID \
  --private-key $USER_PRIVATE_KEY \
  --rpc-url https://rpc.testnet.arc.io
```

Verify that USDC returned to the user wallet.

---

## Step 10 — Smoke-test: Scheduled Payout (Pay Later) + Claim

**In the app (Schedules → New Schedule):**

1. Navigate to **Schedules** (bottom nav, rightmost tab).
2. Tap **New Schedule**.
3. Choose **Pay Later** type.
4. Set:
   - Recipient: any funded testnet address
   - Amount: 1 USDC
   - Due date: 2 minutes from now (for quick testing)
5. Sign the Permit2 witness request — wallet shows `ScheduleWitness` fields.
6. Confirm. USDC moves to the ScheduledPayouts contract.

**Claim after due date:**

```bash
# After 2 minutes. claim() is permissionless — USDC always goes to the recorded recipient.
SCHEDULE_ID=<scheduleId-from-ScheduleCreated-event>
cast send $VITE_SCHEDULED_PAYOUTS_ADDRESS \
  "claim(bytes32)" $SCHEDULE_ID \
  --private-key $ANY_PRIVATE_KEY \
  --rpc-url https://rpc.testnet.arc.io
```

Verify on the explorer that USDC moved to the recipient address.

---

## Step 11 — Record results

Update `AGENTS.md`:
- All four contract addresses
- Permit2 bytecode confirmed: yes
- USDC bytecode confirmed: yes
- Smoke tests run: send ✅, createOrder ✅, fulfillOrder ✅, reclaimOrder ✅, deposit ✅, claim ✅

These results satisfy **Mainnet Gate 1** from `docs/security-review.md`.

---

## E2E Testnet Demo (six flows)

### Prerequisites
- Contracts deployed (Step 4 complete), addresses in `.env`
- User wallet has Permit2 approved (Step 6 complete)
- User wallet has Tier 1 KYC set (Step 9 prerequisite)
- Two funded testnet wallets (sender + recipient, ≥ 5 USDC each)

### Flow 1 — Send 1 USDC by address

1. Connect sender wallet.
2. Home → **Send** → enter recipient address, 1 USDC.
3. Sign Permit2 signature. Confirm transaction.
4. Check: explorer shows transfer. Recipient balance +1 USDC.

### Flow 2 — Send 1 USDC by handle

1. Claim handle `alice` from **Profile**.
2. From a second wallet, Home → Send → enter `alice`, 1 USDC.
3. Sign + confirm. Verify `alice` wallet balance increases.

### Flow 3 — Bill Escrow + Fulfill

1. Bills → **Airtime** → **MTN Airtime** (or Airtel Airtime — any sandbox Airtime biller).
2. Enter phone number, 1 USDC. Sign Permit2 witness (BillOrderWitness fields visible).
3. Verify order Pending on-chain (USDC in PayRouter).
4. From operator wallet: `cast send ... "fulfillOrder(bytes32)" $ORDER_ID`.
5. Verify USDC in biller treasury.

### Flow 4 — Bill Escrow + Reclaim after 30 minutes

1. Repeat Flow 3 steps 1–3 (create a new order).
2. Wait 30 minutes.
3. From any wallet: `cast send ... "reclaimOrder(bytes32)" $ORDER_ID`.
4. Verify USDC returned to payer.

### Flow 5 — Scheduled Payout (Pay Later) + Claim

1. Schedules → **New Schedule** → **Pay Later**.
2. Recipient: second wallet. Amount: 1 USDC. Due: 2 minutes from now.
3. Sign Permit2 witness (ScheduleWitness fields visible). Confirm. USDC in ScheduledPayouts.
4. After 2 minutes: `cast send ... "claim(bytes32)" $SCHEDULE_ID`.
5. Verify USDC in recipient wallet.

### Flow 6 — Verify Permit2 domain (no `name` field)

During any of Flows 1–5, inspect the Permit2 typed-data prompt in MetaMask/Rabby.
Confirm:
- `domain.chainId` = `5042002`
- `domain.verifyingContract` = `0x000000000022D473030F116dDEE9F6B43aC78BA3`
- No `name` field present in the domain

If a `name` field appears, the frontend is using a non-canonical domain (bug F-07).

---

## Testnet Checklist

| Gate | Status |
|------|--------|
| Permit2 deployed at canonical address | Confirmed (bytecode present) |
| USDC proxy at `0x3600...0000` | Confirmed (bytecode present) |
| All 4 contracts deployed, addresses in .env | Do before smoke-test |
| Deployer has no admin role after deploy (when deployer != admin) | Verified by Deploy.t.sol tests |
| admin==deployer case: admin role is retained (not dropped) | Verified by Deploy.t.sol tests |
| feeWallet set to explicit param, not deployer | Verified by Deploy.t.sol tests |
| `forge test --via-ir`: all passed | See current results |
| Lint/typecheck: 0 errors | See current results |
| Send smoke-test with real wallet | Run Step 7 |
| createOrder + fulfillOrder smoke-test | Run Step 9 Option A |
| createOrder + reclaimOrder smoke-test | Run Step 9 Option B |
| deposit + claim smoke-test | Run Step 10 |
| Admin wallet changed to multisig | Required before mainnet |
| Daily accounting decision (D-04) | Deferred to mainnet design |
