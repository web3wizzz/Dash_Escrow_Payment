import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arc, arcTestnet } from 'viem/chains'
import { injected, walletConnect } from 'wagmi/connectors'
import { registerChain } from './tracing'
import { requireChain } from './onchain-facts'

const arcFact = requireChain(5042)
const arcTestnetFact = requireChain(5042002)

registerChain(arc.id, arcFact.rpcUrls[0])
registerChain(arcTestnet.id, arcTestnetFact.rpcUrls[0])

const walletConnectProjectId =
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined

const connectors = [
  injected({ target: 'metaMask' }),
  injected(),
  ...(walletConnectProjectId
    ? [walletConnect({ projectId: walletConnectProjectId })]
    : []),
]

export const config = createConfig({
  chains: [arcTestnet, arc, mainnet],
  connectors,
  transports: {
    [arcTestnet.id]: http(arcTestnetFact.rpcUrls[0]),
    [arc.id]: http(arcFact.rpcUrls[0]),
    [mainnet.id]: http(),
  },
})

export const TARGET_CHAIN_ID = arcTestnet.id // 5042002
export const TARGET_CHAIN_ID_TESTNET = arcTestnet.id
