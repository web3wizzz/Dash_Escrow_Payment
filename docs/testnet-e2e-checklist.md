# DA$H Testnet E2E Checklist
Generated: 2026-10-30  
Chain: **Arc Testnet (chain ID 5042002)**  
Explorer base: `https://explorer.testnet.arc.io`

This is the required real-wallet end-to-end validation before mainnet.
Arc USDC transfer routes through a native precompile (`0x1800...`) that cannot be
simulated in Foundry fork tests. A real browser wallet is the only way to confirm
the full transfer execution path.

Testnet USDC: use the "Get test USDC" button in the Arc Studio sidebar.
Minimum USDC needed for all tests: ~15 USDC (to cover amounts + gas).

---

## How to record each test

For every flow, fill in:
- **Wallet**: your connected wallet address (0x...)
- **Tx hash**: from your wallet or the Arc Studio Tracing panel
- **Contract**: contract address called
- **Expected**: what should happen onchain
- **Explorer link**: `https://explorer.testnet.arc.io/tx/<TX_HASH>`
- **Result**: PASS / FAIL

Provide the tx hashes and this guide will be updated with on-chain confirmation.

---

## Test A: Permit2 Max-Approval

**Purpose:** Confirm the one-time USDC max-approval to Permit2 succeeds on Arc.

**Steps:**
1. Connect your wallet (any browser wallet) in the DA$H app.
2. Attempt to send any amount of USDC. If Permit2 is not yet approved, the app will show the Permit2 approval notice.
3. Approve Permit2 (`0x000000000022D473030F116dDEE9F6B43aC78BA3`) for `type(uint256).max` USDC.

**Expected:**
- `USDC.approve(0x000...BA3, 2^256-1)` tx confirmed.
- Subsequent sends do NOT require another approval.

**Record:**
```
Wallet:      
Tx hash:     
Explorer:    https://explorer.testnet.arc.io/tx/
Result:      PASS / FAIL
Notes:       
```

---

## Test B: Direct USDC Send

**Purpose:** Confirm `PayRouter.send()` with a Permit2 EIP-712 signature works end-to-end.

**Contract:** `0x37f2edadf59cf2027cf52f13ed2272a3cf69055b` (PayRouter v2, Arc Testnet)

**Steps:**
1. On the Send screen, enter a recipient address (can be a second wallet you control, or any valid address).
2. Enter amount: `1` USDC.
3. Click **Review**, then **Confirm & Send**.
4. Sign the Permit2 EIP-712 message in your wallet (not a raw transaction — it's a `eth_signTypedData_v4` signature).
5. Confirm the transaction that follows (the `send()` call).

**Expected:**
- Sender balance decreases by 1 USDC.
- Recipient balance increases by 1 USDC.
- `Sent(from, to, 1000000)` event emitted.
- No fee (feeBps = 0).

**Record:**
```
Wallet (sender):     
Wallet (recipient):  
Amount:              1 USDC
Tx hash:             
Explorer:            https://explorer.testnet.arc.io/tx/
Sender balance before:  
Sender balance after:   
Recipient balance before:  
Recipient balance after:   
Result:              PASS / FAIL
Notes:               
```

---

## Test C: Escrow Create (Bill Order)

**Purpose:** Confirm `PayRouter.createOrder()` with Permit2 witness transfer works.

**Contract:** `0x37f2edadf59cf2027cf52f13ed2272a3cf69055b` (PayRouter v2, Arc Testnet)

**Steps:**
1. Navigate to Payments → Escrow.
2. Select a biller from the catalog (the sandbox biller is pre-registered).
3. Enter amount: `2` USDC.
4. Submit the escrow order.
5. Sign the Permit2 EIP-712 witness message in your wallet (the `eth_signTypedData_v4` message will include the `BillOrderWitness` type).
6. Confirm the `createOrder()` transaction.

**Expected:**
- Payer balance decreases by 2 USDC.
- 2 USDC held in PayRouter contract.
- `OrderCreated(orderId, payer, billerId, ...)` event emitted.
- Order status: Pending.

**Record:**
```
Wallet:          
Amount:          2 USDC
Tx hash:         
orderId (from event or UI):  
Explorer:        https://explorer.testnet.arc.io/tx/
Payer balance before:  
Payer balance after:   
Result:          PASS / FAIL
Notes:           
```

---

## Test D: Escrow Fulfill (Operator releases funds)

**Purpose:** Confirm the operator can call `fulfillOrder()` and funds reach the treasury.

**Contract:** `0x37f2edadf59cf2027cf52f13ed2272a3cf69055b` (PayRouter v2, Arc Testnet)  
**Caller required:** OPERATOR_ROLE holder. On testnet, the operator is the platform deployer `0x5B12Ce46...`.  
**Note:** This step requires the platform operator to act on the order. On testnet, the sandbox backend (server/index.ts) calls `fulfillOrder` via the operator hot key. If the sandbox backend is not running, skip to Test E (reclaim).

**Steps:**
1. After Test C, note the orderId.
2. The sandbox backend polls for pending orders and calls `fulfillOrder(orderId)`.
   - If self-testing: cast call `fulfillOrder(bytes32)` from the operator wallet.
3. Observe the order status change to Fulfilled in the app.

**Expected:**
- Treasury receives 2 USDC (feeBps=0, so full amount).
- `OrderFulfilled(orderId, treasury, 2000000, 0)` event.
- Order status: Fulfilled.

**Record:**
```
orderId:         
Operator wallet: 0x5B12Ce46... (testnet platform deployer)
Tx hash:         
Explorer:        https://explorer.testnet.arc.io/tx/
Treasury balance before:  
Treasury balance after:   
Result:          PASS / FAIL
Notes:           
```

---

## Test E: Escrow Expiry + Reclaim

**Purpose:** Confirm payer can reclaim after the 30-minute timeout.

**Contract:** `0x37f2edadf59cf2027cf52f13ed2272a3cf69055b` (PayRouter v2, Arc Testnet)

**Steps:**
1. Create a new 2 USDC escrow order (repeat Test C steps with a new order).
2. Wait 30 minutes (1800 seconds) without the operator fulfilling.
3. On the Order Status screen, click **Reclaim** (or call `reclaimOrder(orderId)` directly).

**Expected:**
- Payer balance increases by 2 USDC (full refund, no fee).
- `OrderReclaimed(orderId, payer, 2000000)` event.
- Order status: Reclaimed.

**Note:** You can use `cast call "orderTimeoutSeconds()(uint32)" --rpc-url https://rpc.testnet.arc.io <PAYROUTER>` to confirm the 1800s timeout is live.

**Record:**
```
Wallet (payer):  
Amount:          2 USDC
Create tx hash:  
Reclaim tx hash: 
Explorer (reclaim): https://explorer.testnet.arc.io/tx/
Payer balance before reclaim:  
Payer balance after reclaim:   
Time waited (minutes):         
Result:          PASS / FAIL
Notes:           
```

---

## Test F: Pay-Later Scheduled Payout (Create)

**Purpose:** Confirm `ScheduledPayouts.deposit()` with Permit2 witness works for a pay-later schedule.

**Contract:** `0x95f13b64172e6df601fd6cec3f3c0b71d0e6f917` (ScheduledPayouts, Arc Testnet)

**Steps:**
1. Navigate to Schedules → New Schedule.
2. Select **Pay Later** type.
3. Set recipient to a second wallet you control.
4. Amount: `3` USDC.
5. Unlock date: 2 minutes from now (for quick testing).
6. Submit.
7. Sign the Permit2 EIP-712 witness message (includes `ScheduleWitness` type).
8. Confirm the `deposit()` transaction.

**Expected:**
- Sender balance decreases by 3 USDC.
- 3 USDC held in ScheduledPayouts contract.
- `ScheduleCreated(scheduleId, sender, recipient, PayLater, 3000000)` event.

**Record:**
```
Wallet (sender):     
Wallet (recipient):  
Amount:              3 USDC
Unlock date set:     
Tx hash:             
scheduleId (from event or UI):  
Explorer:            https://explorer.testnet.arc.io/tx/
Sender balance before:  
Sender balance after:   
Result:              PASS / FAIL
Notes:               
```

---

## Test G: Scheduled Payout Claim

**Purpose:** Confirm `ScheduledPayouts.claim()` releases funds to recipient after unlock.

**Contract:** `0x95f13b64172e6df601fd6cec3f3c0b71d0e6f917` (ScheduledPayouts, Arc Testnet)

**Steps:**
1. Wait until the unlock date from Test F has passed (≥ 2 minutes).
2. In the Schedules list, find the schedule from Test F.
3. Click **Claim now** (or call `claim(scheduleId)` directly — anyone can call it, funds always go to recipient).

**Expected:**
- Recipient balance increases by 3 USDC.
- `Claimed(scheduleId, recipient, 3000000, 3000000)` event.
- Schedule: 100% claimed.

**Record:**
```
Caller wallet:   
Recipient wallet:  
Amount claimed:  3 USDC
scheduleId:      
Tx hash:         
Explorer:        https://explorer.testnet.arc.io/tx/
Recipient balance before:  
Recipient balance after:   
Result:          PASS / FAIL
Notes:           
```

---

## Test H: Streaming Payout + Partial Claim

**Purpose:** Confirm streaming schedule accrues per-second and partial claims work.

**Contract:** `0x95f13b64172e6df601fd6cec3f3c0b71d0e6f917` (ScheduledPayouts, Arc Testnet)

**Steps:**
1. Create a new schedule with type **Streaming**.
2. Recipient: second wallet you control.
3. Amount: `5` USDC. Start: now. End: 5 minutes from now.
4. Sign and confirm the `deposit()` transaction.
5. Wait 1–2 minutes. The StreamTicker in the UI should show accruing USDC.
6. Click **Claim** for the partial accrued amount.

**Expected:**
- After deposit: sender balance decreases by 5 USDC.
- After 1 minute of 5-minute stream: ~1 USDC claimable.
- After claim: recipient receives the accrued amount (within rounding).
- `Claimed(scheduleId, recipient, partialAmount, totalClaimed)` event.
- Remaining USDC still in contract for future claims.

**Record:**
```
Wallet (sender):     
Wallet (recipient):  
Total amount:        5 USDC
Stream duration:     5 min
Deposit tx hash:     
scheduleId:          
Time waited before claim (minutes):  
Amount claimed:      
Claim tx hash:       
Explorer (claim):    https://explorer.testnet.arc.io/tx/
Recipient balance before claim:  
Recipient balance after claim:   
Result:              PASS / FAIL
Notes:               
```

---

## Summary Checklist

Once all tests are run, fill in this table and paste the result back for on-chain verification:

| Test | Wallet | Tx Hash | Result |
|---|---|---|---|
| A: Permit2 approval | | | |
| B: Direct send | | | |
| C: Escrow create | | | |
| D: Escrow fulfill | | | |
| E: Escrow reclaim | | | |
| F: Pay-later deposit | | | |
| G: Pay-later claim | | | |
| H: Streaming partial claim | | | |

All 8 PASS → B3 is cleared → mainnet deploy can proceed (after B1, B2 also cleared).
