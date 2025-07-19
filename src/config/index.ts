import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { SolanaAdapter } from '@reown/appkit-adapter-solana'
import { mainnet, sepolia, solana, solanaTestnet, solanaDevnet } from '@reown/appkit/networks'
import type { AppKitNetwork } from '@reown/appkit/networks'

// Get projectId from https://cloud.reown.com
export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID || "b56e18d47c72ab683b10814fe9495694" // this is a public projectId only to use on localhost

if (!projectId) {
  throw new Error('Project ID is not defined')
}

// Define networks - Ethereum networks and Solana
export const networks = [mainnet, sepolia, solana] as [AppKitNetwork, ...AppKitNetwork[]]

// Set up the Wagmi Adapter for Ethereum networks
export const wagmiAdapter = new WagmiAdapter({
  ssr: true,
  projectId,
  networks: [mainnet, sepolia]
})

// Set up the Solana Adapter
export const solanaAdapter = new SolanaAdapter({
  networks: [solana]
})

// Export both adapters for use in context
export const adapters = [wagmiAdapter, solanaAdapter]

export const config = wagmiAdapter.wagmiConfig