# Dash — USDC Payments on Arc

Non-custodial USDC spending app on Arc mainnet. Send USDC to wallet addresses or @handles, request money with shareable links and QR codes, scan QR codes to pay, and pay bills via a sandboxed biller flow. Identity verification and billers are sandboxed for this demo, clearly labeled in the UI.

Built with [Arc Studio](https://studio.arc.io).

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Framer Motion
- **Backend**: Bun HTTP server (port 3001) serving the bill provider catalog
- **Onchain**: wagmi v2, viem, ConnectKit
- **Payments**: Permit2 SignatureTransfer (exact amount, single-use nonce), USDC on Arc mainnet
- **Smart Contracts**: Foundry (Solidity 0.8.x) — HandleRegistry, KycRegistry, PayRouter
- **Chain**: Arc mainnet (chain ID 5042) — USDC is the native gas token

## Development

### Prerequisites
- [Bun](https://bun.sh) ≥ 1.0
- [Foundry](https://getfoundry.sh) (for contract compilation and testing)

### Install

```bash
bun install
```

### Environment Variables

| Variable | Purpose |
|---|---|
| `VITE_HANDLE_REGISTRY_ADDRESS` | Deployed HandleRegistry contract address |
| `VITE_KYC_REGISTRY_ADDRESS` | Deployed KycRegistry contract address |
| `VITE_PAY_ROUTER_ADDRESS` | Deployed PayRouter contract address |
| `VITE_WALLETCONNECT_PROJECT_ID` | Optional WalletConnect project ID for multi-wallet support |
| `RPC_PROXY_BASE_URL` | Arc Studio RPC proxy base URL (optional outside Arc Studio) |
| `RPC_PROXY_TOKEN` | Arc Studio RPC proxy token (optional outside Arc Studio) |
| `RPC_PROXY_CHAINS` | Comma-separated chain keys the RPC proxy covers (optional outside Arc Studio) |

Create `.env` with the values above before starting the dev server. Without the contract addresses, the app loads but all contract calls will fail.

### Run

Start the bills backend and the frontend dev server in two terminals:

```bash
# Terminal 1 — bills API (port 3001)
bun run server

# Terminal 2 — frontend (port 5173)
bun run dev
```

The frontend Vite dev server proxies `/api` to `http://localhost:3001`, so the backend must be running for the Bills screen to load billers.

### Build

```bash
bun run build
```

### Test (smart contracts)

```bash
forge test
```

### Lint & Typecheck

```bash
bun run check
```

## Smart Contracts

Three contracts in `contracts/`:

- **HandleRegistry** — free handle claim/release (one per wallet, non-transferable, reserved list at deploy)
- **KycRegistry** — tier 0/1/2 per address with expiry, VERIFIER_ROLE write access
- **PayRouter** — all payment flows: direct send, handle send, payment requests, 30-minute bill order escrow with Permit2 witness variant; timelocked config changes. Constructor accepts an `InitialBiller[]` array so multiple billers can be registered at deploy time

All payment actions use Permit2 `SignatureTransfer` (exact amount, single-use nonce). The one-time `USDC.approve(Permit2, max)` is documented in `AUDIT.md`.

Deploy order: HandleRegistry → KycRegistry → PayRouter. PayRouter takes both registry addresses as constructor arguments. After deploy, set contract addresses in `.env` and grant `OPERATOR_ROLE`, `VERIFIER_ROLE`, `PAUSER_ROLE` to the appropriate wallets.

See `AUDIT.md` for documented design decisions and `AGENTS.md` for deploy parameters.
