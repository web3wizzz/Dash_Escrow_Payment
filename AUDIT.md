# Security Notes

This file documents known intentional exceptions to the app's default security posture, design decisions that reviewers should evaluate explicitly, and the rationale for each.

---

## Exception 1: One-time unlimited USDC approval to Permit2

### What
The app requests `USDC.approve(permit2Address, type(uint256).max)` from the user's wallet exactly once on first use, before any payment action.

### Why this is a known exception
The project's default policy is exact-amount approvals only. An unlimited approval is a meaningful trust assumption and is documented here as an intentional, justified exception.

### Why it is safe
1. **The approved contract is Permit2 itself**, not the app's PayRouter contract. Permit2 (`0x000000000022D473030F116dDEE9F6B43aC78BA3`) is a widely deployed, independently audited Uniswap Labs contract present on hundreds of EVM chains including Arc.
   - Audit: https://github.com/Uniswap/permit2/tree/main/audits
   - Source: https://github.com/Uniswap/permit2

2. **Every downstream transfer is still exact-amount and single-use.** After the one-time approval, every payment action (send, sendToHandle, requestPay, createOrder) uses `Permit2.permitTransferFrom` or `Permit2.permitWitnessTransferFrom`, which enforce:
   - Exact amount matching the signed permit.
   - Single-use nonce: the nonce is invalidated after use and cannot be replayed.
   - Deadline: the signature expires at a caller-specified time.
   - Owner binding: only the signing wallet can have its tokens moved.

3. **PayRouter holds no approval at all.** No `USDC.approve(payRouterAddress, ...)` is ever requested. Permit2 pulls tokens on PayRouter's behalf, but only for the exact amount and within the constraints above.

4. **The approval can be revoked at any time.** The Profile screen has a Revoke approval button that calls `USDC.approve(permit2Address, 0)`, resetting the allowance to zero. After revocation, payment actions will require a new Permit2 approval before they work again.

### Risk if Permit2 is compromised
If Permit2 itself were compromised or contained a critical vulnerability, an attacker could attempt to drain the unlimited USDC allowance. This risk is accepted on the basis of Permit2's audit history, broad deployment, and the absence of any demonstrated vulnerability since its mainnet launch in 2022. The user is informed of this trust assumption in the UI before the approval is requested.

### UI disclosure
The approval prompt explains:
- What is being approved (Permit2, not the app).
- That this is a one-time setup enabling faster payments.
- That the approval can be revoked from Profile settings.
- The inherent trust assumption.

---

## Exception 2: `block.timestamp` in daily spend windows

### What
`PayRouter` uses `block.timestamp / 1 days` as the daily spend bucket index.

### Why
This is the only practical on-chain mechanism for rolling daily limits. No off-chain oracle or block-number-derived time is more reliable on Arc.

### Known limitation
On Arc, block timestamps can repeat (two blocks may share the same timestamp). The spec explicitly states: "Block timestamps can repeat. Order by block number." The daily window uses timestamp buckets as required by the spec; within a single timestamp value, both transactions land in the same bucket and their combined spend is checked against the daily cap. This is correct behavior — a payer cannot bypass the daily cap by submitting multiple transactions in rapid succession.

---

## Exception 3: Timelock applies only to post-deploy config changes

### What
All initial configuration values (tier limits, globalPerPaymentCap, minBillTier, orderTimeoutSeconds, feeBps, first biller) are set in the PayRouter constructor and take effect immediately. The 24-hour timelock applies only to changes made after deployment.

### Why
Initial configuration is set by the deployer at deployment time, which is itself a privileged action subject to the deployer's own key management. There is no live system to protect against at construction time. Requiring a timelock before a contract can be used would make deployment impractical.

---

## Exception 4: `fulfillOrder` is not paused

### What
When the contract is paused, `fulfillOrder` (called by the operator) still executes. `rejectOrder` and `reclaimOrder` also remain live when paused.

### Why
Pause is intended only to block NEW payment inflows (send, sendToHandle, requestPay, createOrder). Funds already in escrow belong to users and must always have a path out. Blocking fulfillment would trap user funds in the contract, violating the "no role can freeze user funds" rule.

---

## Contract Deployment Order

Deploy in this strict order — later contracts take earlier ones as constructor args:

1. `HandleRegistry` — no dependencies.
2. `KycRegistry` — no dependencies.
3. `PayRouter` — takes `HandleRegistry` and `KycRegistry` addresses as constructor args.

---

## Roles and Key Management

| Role | Holder | Powers | Cannot |
|---|---|---|---|
| `DEFAULT_ADMIN_ROLE` | Multisig / hardware wallet | Grant/revoke roles; queue and execute timelocked config changes | Move user funds; register handles; set KYC tiers |
| `OPERATOR_ROLE` | Backend hot wallet (single EOA) | Fulfill bill orders to treasury locked at creation; reject orders back to payer | Any other state change |
| `VERIFIER_ROLE` | Separate wallet | Set/revoke KYC tiers in KycRegistry | Touch payments |
| `PAUSER_ROLE` | Third address | Pause/unpause new payment functions | Affect in-flight orders |

Roles can be rotated: if the operator or verifier key leaks, `DEFAULT_ADMIN_ROLE` revokes the compromised role and grants it to a new address.
