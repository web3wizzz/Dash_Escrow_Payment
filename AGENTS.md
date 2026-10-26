# Agent Notes — Dash USDC Spending App

## Project Overview
Non-custodial USDC spending app on Arc mainnet. Users send USDC by handle or address, request payment via link/QR, scan QR to pay, and pay bills via a sandboxed biller flow. All payment flows use Permit2 SignatureTransfer (exact amount, single-use nonce). Identity verification and billers are sandboxed/mock, clearly labeled in the UI.

## Deployed Contracts
None deployed yet. Contracts are built and all 224 tests pass. Ready for Arc testnet deployment.

Deploy order: HandleRegistry → KycRegistry → PayRouter → ScheduledPayouts.
Use `contracts/script/Deploy.s.sol` (reads env vars, grants all roles, prints VITE_* lines).
See `docs/testnet-smoke-test.md` for step-by-step instructions.

## Contract Addresses (fill in after deploy)
```
VITE_HANDLE_REGISTRY_ADDRESS=
VITE_KYC_REGISTRY_ADDRESS=
VITE_PAY_ROUTER_ADDRESS=
VITE_SCHEDULED_PAYOUTS_ADDRESS=
VITE_FEE_WALLET_ADDRESS=
```

## Chain
- Arc mainnet: chain ID 5042, RPC https://rpc.mainnet.arc.io, explorer https://explorer.arc.io
- Arc Testnet: chain ID 5042002, RPC https://rpc.testnet.arc.io

## Key Addresses (Arc mainnet and testnet)
- USDC ERC-20: `0x3600000000000000000000000000000000000000` (6 decimals)
- Permit2: `0x000000000022D473030F116dDEE9F6B43aC78BA3`

## Constructor Values (PayRouter)
From `config/brand.ts`:
- PERMIT2_ADDRESS: `0x000000000022D473030F116dDEE9F6B43aC78BA3`
- USDC_ADDRESS: `0x3600000000000000000000000000000000000000`
- TIER_LIMITS: Tier0={5_000_000, 50_000_000}, Tier1={100_000_000, 20_000_000_000}, Tier2={20_000_000_000, 0}
- GLOBAL_PER_PAYMENT_CAP: 25_000_000 (25 USDC)
- MIN_BILL_TIER: 1
- ORDER_TIMEOUT_SECONDS: 1800 (30 min)
- DEFAULT_FEE_BPS: 0
- MAX_FEE_BPS: 200

## Role Addresses (fill in before deploy)
```
initialAdmin=<MULTISIG_ADDRESS>      # DEFAULT_ADMIN_ROLE
OPERATOR_ROLE=<HOT_WALLET>           # grant after deploy
VERIFIER_ROLE=<SEPARATE_WALLET>      # grant after deploy
PAUSER_ROLE=<THIRD_ADDRESS>          # grant after deploy
```

## Security Notes
- See AUDIT.md for documented intentional design choices (Permit2 max-approval, block.timestamp, no-timelock-at-genesis).
- Security review Rev 3 completed: docs/security-review.md.
  - Fixed: M-01 (timelock overwrite), M-02 (ScheduledPayouts missing tier limits)
  - Fixed: D-01 (deploy script grantRole reverts when deployer != admin)
  - Fixed: D-02/D-03 (Tier 1 daily and Tier 2 per-payment caps were 1000× too large)
  - Fixed: E-01 (admin==deployer footgun — renounce now guarded, contracts stay adminless-proof)
  - Fixed: E-02 (feeWallet defaulted to deployer — now explicit constructor param)
  - Fixed: E-03 (brand.ts Tier 2 daily was 2^256-1, now 0 matching contract convention)
  - Documented: D-04 (ScheduledPayouts has no daily limit — intentional, see security-review.md)
  - Verified: Permit2 and USDC have bytecode on Arc testnet at canonical addresses.
  - Dry-run simulation passed: all 4 contracts, roles, gas ~2.22 USDC on Arc testnet.
  - No Critical/High open issues.
- 224 unit tests (forge test --via-ir), 0 failures.
- Frontend: 0 lint errors, 0 TypeScript errors.

## Tier Cap Values (corrected)
| Tier | Per-payment | Daily |
|------|------------|-------|
| 0 | 5 USDC (5_000_000) | 50 USDC (50_000_000) |
| 1 | 100 USDC (100_000_000) | 20,000 USDC (20_000_000_000) |
| 2 | 20,000 USDC (20_000_000_000) | unlimited (0 = no cap) |
| Global cap | 25 USDC (25_000_000) | overrides all tiers |

## feeWallet
PayRouter.feeWallet is set via explicit constructor param `feeWallet_` (6th arg).
Deploy script passes DEPLOY_FEE_WALLET_ADDRESS (defaults to DEPLOY_ADMIN_ADDRESS).
Can be updated post-deploy via 24h timelocked queueConfigChange(keccak256("feeWallet"), abi.encode(newAddr)).

## Files
- `config/brand.ts` — sole source of product name and all constructor constants
- `contracts/HandleRegistry.sol` — handle claim/release
- `contracts/KycRegistry.sol` — tier 0/1/2 with expiry
- `contracts/PayRouter.sol` — all payment flows, escrow, timelock config
- `contracts/test/` — Foundry test files (6 files)
- `contracts/test-helpers/` — MockERC20, MockPermit2
- `src/lib/` — permit2.ts, tiers.ts, hash.ts, webhooks.ts, share.ts
- `src/hooks/` — useHandleRegistry, useKycTier, usePayRouter, useBillOrder
- `src/components/shared/` — WalletBar, ChainGuard, TxStatus, BottomSheet, Permit2Notice
- `server/index.ts` — bills API backend (port 3001, `bun run server`)
- `src/lib/billers.ts` — biller types, fetch hook, recents/favorites helpers
- `src/components/bills/` — BillerCard, BillerCatalog, BillOrderForm, OrderStatus
- `src/components/send/` — SendForm
- `src/components/request/` — RequestForm
- `src/pages/` — Home, Send, Request, Scan, Bills, OrderStatusPage, Settings, Profile
