/**
 * wagmi configuration — Arc mainnet + Arc Testnet
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arc, arcTestnet } from 'viem/chains'
import { injected, walletConnect } from 'wagmi/connectors'
import { registerChain } from './tracing'
import { requireChain } from './onchain-facts'

// Resolve RPC URLs from the generated onchain-facts registry
const arcFact = requireChain(5042)
const arcTestnetFact = requireChain(5042002)

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arc.id, arcFact.rpcUrls[0])
registerChain(arcTestnet.id, arcTestnetFact.rpcUrls[0])

const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined

const connectors = walletConnectProjectId
  ? [injected(), walletConnect({ projectId: walletConnectProjectId })]
  : [injected()]

export const config = createConfig({
  chains: [arc, arcTestnet, mainnet],
  connectors,
  transports: {
    [arc.id]: http(arcFact.rpcUrls[0]),
    [arcTestnet.id]: http(arcTestnetFact.rpcUrls[0]),
    [mainnet.id]: http(), // ENS resolution only
  },
})

/** The chain to target for all payment operations — switch to arc (5042) for mainnet */
export const TARGET_CHAIN_ID = arc.id // 5042 (Arc mainnet)
export const TARGET_CHAIN_ID_TESTNET = arcTestnet.id // 5042002 (Arc Testnet)
