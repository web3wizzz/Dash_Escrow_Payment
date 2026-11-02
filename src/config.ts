/**
 * wagmi configuration — Arc Testnet
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arc, arcTestnet } from 'viem/chains'
import { injected } from 'wagmi/connectors'
import { registerChain } from './tracing'
import { requireChain } from './onchain-facts'

// Resolve RPC URLs from the generated onchain-facts registry
const arcFact = requireChain(5042)
const arcTestnetFact = requireChain(5042002)

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arc.id, arcFact.rpcUrls[0])
registerChain(arcTestnet.id, arcTestnetFact.rpcUrls[0])

// MetaMask injected connector only — no WalletConnect to prevent QR modal loops
const connectors = [injected({ target: 'metaMask' })]

export const config = createConfig({
  chains: [arcTestnet, arc, mainnet],
  connectors,
  transports: {
    [arcTestnet.id]: http(arcTestnetFact.rpcUrls[0]),
    [arc.id]: http(arcFact.rpcUrls[0]),
    [mainnet.id]: http(), // ENS resolution only
  },
})

/** The chain to target for all payment operations (Arc Testnet, chain ID 5042002) */
export const TARGET_CHAIN_ID = arcTestnet.id // 5042002

/**
 * Display name for the network shown in the UI.
 * Intentionally just "Arc" — no "Testnet" suffix for the public demo.
 * The actual chain target remains 5042002; do not use this for technical purposes.
 */
export const DISPLAY_NETWORK_NAME = 'Arc'
