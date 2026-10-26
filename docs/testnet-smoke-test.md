# Testnet Deployment & Smoke-Test Guide

**Target:** Arc Testnet (chain ID 5042002)  
**RPC:** `https://rpc.testnet.arc.io`  
**Explorer:** `https://explorer.testnet.arc.io`  
**Permit2:** `0x000000000022D473030F116dDEE9F6B43aC78BA3` (canonical, deployed on Arc testnet)  
**USDC:** `0x3600000000000000000000000000000000000000` (Arc testnet)  

---

## Prerequisites

- Foundry installed: `curl -L https://foundry.paradigm.xyz | bash && foundryup`
- A funded Arc testnet wallet with native gas (USDC). Get test tokens from the Arc Studio sidebar ("Get test USDC").
- MetaMask or Rabby configured with Arc Testnet (chain ID 5042002).

---

## Step 1 — Set environment variables

Create a `.env.deploy` file (do NOT commit it):

```bash
export DEPLOY_ADMIN_ADDRESS=<your-wallet>
export DEPLOY_OPERATOR_ADDRESS=<your-wallet>   # OK to reuse for testnet
export DEPLOY_VERIFIER_ADDRESS=<your-wallet>   # OK to reuse for testnet
export DEPLOY_PAUSER_ADDRESS=<your-wallet>     # OK to reuse for testnet
export PRIVATE_KEY=<your-private-key>          # NEVER commit
```

Source it: `source .env.deploy`

---

## Step 2 — Dry-run (no broadcast)

```bash
forge script contracts/script/Deploy.s.sol \
  --rpc-url https://rpc.testnet.arc.io
```

This compiles and simulates without broadcasting. Check the output for:
- All four contract addresses printed
- `VITE_*` lines printed at the end
- No revert messages

---

## Step 3 — Deploy to Arc Testnet

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

Paste the contract addresses into `AGENTS.md` under **Deployed contracts**.

---

## Step 4 — Verify Permit2 exists on Arc Testnet

Before smoke-testing, confirm Permit2 is deployed:

```bash
cast code 0x000000000022D473030F116dDEE9F6B43aC78BA3 \
  --rpc-url https://rpc.testnet.arc.io
```

If the output is `0x`, Permit2 is NOT deployed on Arc testnet and all signature flows will revert. In that case, contact the Arc team or deploy a local fork for testing.

---

## Step 5 — Get USDC allowance for Permit2

In the app (or via `cast`), call:

```bash
cast send 0x3600000000000000000000000000000000000000 \
  "approve(address,uint256)" \
  0x000000000022D473030F116dDEE9F6B43aC78BA3 \
  115792089237316195423570985008687907853269984665640564039457584007913129639935 \
  --private-key $PRIVATE_KEY \
  --rpc-url https://rpc.testnet.arc.io
```

Verify the Profile screen shows "Permit2 approved".

---

## Step 6 — Smoke-test: Send USDC

In the app:

1. Connect your testnet wallet in the app.
2. Navigate to Home → Send.
3. Enter any funded address or handle (your own wallet for a self-send works).
4. Enter 1 USDC.
5. Sign the Permit2 request in MetaMask/Rabby.
6. Wait for confirmation — you should see the transaction on the explorer.

**What to verify:**
- MetaMask/Rabby prompt shows the Permit2 domain (no name, just chainId + verifyingContract).
- Transaction succeeds on the explorer.
- Recipient balance increases by exactly 1 USDC.

---

## Step 7 — Smoke-test: Create Bill Order

1. Navigate to Bills in the app.
2. Select "Demo NFT Shop" biller.
3. Enter an account number (any string).
4. Enter 5 USDC (requires Tier 1 — you'll need to set your own wallet's tier first).

**Set KYC tier (using cast as the verifier wallet):**

```bash
# Replace KYC_REGISTRY_ADDRESS with the deployed address
cast send $KYC_REGISTRY_ADDRESS \
  "setTier(address,uint8,uint64)" \
  $DEPLOY_ADMIN_ADDRESS 1 9999999999 \
  --private-key $PRIVATE_KEY \
  --rpc-url https://rpc.testnet.arc.io
```

5. Sign the Permit2 witness request — MetaMask should show the BillOrderWitness fields.
6. The order enters Pending state.
7. Verify on the explorer that the USDC moved to the PayRouter contract.

**Fulfill the order (as operator):**

```bash
# Get orderId from the OrderCreated event in the tx receipt
cast send $PAY_ROUTER_ADDRESS \
  "fulfillOrder(bytes32)" <orderId> \
  --private-key $PRIVATE_KEY \
  --rpc-url https://rpc.testnet.arc.io
```

Verify USDC moved to the biller treasury.

---

## Step 8 — Smoke-test: Schedule Deposit

1. Navigate to Schedules → New Schedule.
2. Choose "Pay Later" type.
3. Set recipient, amount 5 USDC, due date.
4. Sign the Permit2 witness request — wallet should show ScheduleWitness fields.
5. Confirm on the explorer.

**Claim after due date:**

```bash
# Wait until after the end time
cast send $SCHEDULED_PAYOUTS_ADDRESS \
  "claim(bytes32)" <scheduleId> \
  --private-key $PRIVATE_KEY \
  --rpc-url https://rpc.testnet.arc.io
```

Verify recipient received the USDC.

---

## Step 9 — Record results

Record in `AGENTS.md`:
- All four contract addresses
- Permit2 presence confirmed: yes/no
- Smoke tests: send ✅, createOrder ✅, deposit ✅

These results satisfy the **Mainnet Deployment Gate 1** from `docs/security-review.md`.

---

## Testnet Checklist

| Gate | Status |
|------|--------|
| Permit2 deployed at canonical address | Check |
| USDC at 0x3600...0000 | Check |
| All 4 contracts deployed, addresses in .env | Check |
| `forge test --via-ir`: 201 passed | ✅ |
| Lint/typecheck: 0 errors | ✅ |
| `send` smoke-test passes with real wallet | Check |
| `createOrder` smoke-test passes with real wallet | Check |
| `deposit` smoke-test passes with real wallet | Check |
| Admin wallet changed to multisig | Before mainnet |
| T-01, T-02, T-03 tests passing | ✅ (included in 201) |
