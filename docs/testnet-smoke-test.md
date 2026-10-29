# DA$H Arc Testnet Smoke Test Guide

Covers the four live flows needed for B3 evidence before mainnet consideration.
All contracts are deployed on Arc Testnet (chain ID 5042002).

---

## Prerequisites

- A browser wallet (MetaMask or any wagmi-compatible wallet) configured for Arc Testnet
  - RPC: `https://rpc.testnet.arc.io`
  - Chain ID: `5042002`
  - Currency symbol: `USDC`
- Arc Testnet USDC — use the **"Get test USDC"** button in the Arc Studio sidebar
- The app running at `localhost:5173` (or the deployed preview URL)

---

## Contract Addresses (Arc Testnet)

| Contract | Address |
|---|---|
| HandleRegistry | `0x34cae0957ec0cd2327e134f2008ee111e66ca081` |
| KycRegistry | `0x3a480497c8d48c065dac5fdd46ea339aeb9a8bfd` |
| PayRouter | `0x37f2edadf59cf2027cf52f13ed2272a3cf69055b` |
| ScheduledPayouts | `0x95f13b64172e6df601fd6cec3f3c0b71d0e6f917` |
| USDC | `0x3600000000000000000000000000000000000000` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |

Explorer: https://explorer.testnet.arc.io

---

## Test 1 — USDC Send (wallet-to-wallet via Permit2)

**Verifies:** `PayRouter.send`, EIP-712 Permit2 signature, real USDC transfer

Steps:
1. Connect wallet in the app
2. Navigate to **Send**
3. Enter a recipient address and amount ≤ 25 USDC
4. If prompted, approve Permit2 (`USDC.approve(Permit2, max)`) — one-time
5. Sign the Permit2 typed-data message
6. Confirm the transaction

Expected:
- Tx confirmed on-chain; check Explorer
- Recipient balance increases by the sent amount
- Sender balance decreases by the same amount (USDC is gas here)

---

## Test 2 — Bill Order Lifecycle (escrow create → operator fulfill)

**Verifies:** `PayRouter.createOrder`, `fulfillOrder`, escrow hold, fee distribution

Steps:
1. Navigate to **Bills**
2. Select a biller (the testnet biller is the platform deployer — `0x5B12Ce46C7194aD57d143bC22847224047b1Ef42`)
3. Enter an amount ≤ 25 USDC and a reference string
4. Sign the Permit2 witness transfer (typed-data with `BillOrderWitness`)
5. Confirm the transaction — USDC is held in the contract

Fulfill (requires OPERATOR_ROLE — testnet operator = platform deployer):
- The operator calls `fulfillOrder(orderId)` — USDC is released to biller treasury

Reclaim (if not fulfilled within 30 min):
- Navigate back to the order, click **Reclaim** after timeout
- USDC returns to the payer

---

## Test 3 — Scheduled Payout: Pay Later

**Verifies:** `ScheduledPayouts.deposit`, `claim`, Permit2 SignatureTransfer with ScheduleWitness

Steps:
1. Navigate to **Schedule** → **Pay Later**
2. Enter a recipient, amount ≤ 25 USDC, and a future end time
3. Sign the Permit2 typed-data message
4. USDC is locked in ScheduledPayouts

Claim (after `endTime`):
1. Navigate to the schedule detail
2. Click **Claim** — USDC is released to recipient

---

## Test 4 — Scheduled Payout: Streaming

**Verifies:** per-second streaming, `claimableNow()`, partial claim

Steps:
1. Navigate to **Schedule** → **Stream**
2. Enter recipient, total amount, start/end time (short window for testing)
3. Sign and deposit
4. Wait a few seconds; navigate to the schedule detail
5. `claimableNow` shows accrued amount — click **Claim**
6. Observe partial transfer; total claimed matches elapsed fraction

---

## Pass Criteria

| Test | Pass condition |
|---|---|
| Send | Tx on-chain; balances updated correctly |
| Bill order | USDC held → released on fulfillment; or returned on reclaim |
| Pay later | USDC locked → claimable only after endTime |
| Streaming | Per-second accumulation correct; partial claim works |

---

## Known Testnet Limitations

- The registered biller address is the shared platform deployer wallet — in production each biller must be a dedicated address with a separate treasury
- The admin/operator/pauser roles are all held by the same platform deployer — production requires separate dedicated wallets
- USDC `transfer`/`transferFrom` is routed through Arc's native precompile `0x1800...` and cannot be simulated in Foundry fork tests; real-wallet execution is the only way to test the full transfer path on Arc
