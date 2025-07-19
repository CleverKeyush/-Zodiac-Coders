import { BrowserProvider, Contract, formatUnits } from "ethers";

// Smart contract ABI for VerificationStorage
export const VERIFICATION_STORAGE_ABI = [
  {
    inputs: [],
    name: "InvalidHash",
    type: "error",
  },
  {
    inputs: [],
    name: "UnauthorizedAccess",
    type: "error",
  },
  {
    inputs: [],
    name: "VerificationNotFound",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "verificationIndex",
        type: "uint256",
      },
    ],
    name: "VerificationDeactivated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        indexed: false,
        internalType: "string",
        name: "hash",
        type: "string",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "verificationIndex",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
    ],
    name: "VerificationStored",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_index",
        type: "uint256",
      },
    ],
    name: "deactivateVerification",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_user",
        type: "address",
      },
    ],
    name: "getAllUserVerifications",
    outputs: [
      {
        internalType: "string[]",
        name: "hashes",
        type: "string[]",
      },
      {
        internalType: "uint256[]",
        name: "indices",
        type: "uint256[]",
      },
      {
        internalType: "uint256[]",
        name: "timestamps",
        type: "uint256[]",
      },
      {
        internalType: "bool[]",
        name: "activeStates",
        type: "bool[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_user",
        type: "address",
      },
    ],
    name: "getLatestVerification",
    outputs: [
      {
        internalType: "string",
        name: "hash",
        type: "string",
      },
      {
        internalType: "uint256",
        name: "verificationIndex",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
      {
        internalType: "bool",
        name: "isActive",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_user",
        type: "address",
      },
    ],
    name: "getUserVerificationCount",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_user",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "_index",
        type: "uint256",
      },
    ],
    name: "getVerificationByIndex",
    outputs: [
      {
        internalType: "string",
        name: "hash",
        type: "string",
      },
      {
        internalType: "uint256",
        name: "verificationIndex",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
      {
        internalType: "bool",
        name: "isActive",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "_hash",
        type: "string",
      },
    ],
    name: "storeVerificationHash",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "userVerifications",
    outputs: [
      {
        internalType: "string",
        name: "hash",
        type: "string",
      },
      {
        internalType: "uint256",
        name: "verificationIndex",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
      {
        internalType: "bool",
        name: "isActive",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "userVerificationCount",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_user",
        type: "address",
      },
      {
        internalType: "string",
        name: "_hash",
        type: "string",
      },
    ],
    name: "verificationExists",
    outputs: [
      {
        internalType: "bool",
        name: "exists",
        type: "bool",
      },
      {
        internalType: "uint256",
        name: "verificationIndex",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

// Contract address - This should be updated after deployment
export const VERIFICATION_STORAGE_ADDRESS =
  process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS ||
  "0x0000000000000000000000000000000000000000";

export interface BlockchainVerificationResult {
  success: boolean;
  transactionHash?: string;
  verificationIndex?: number;
  gasUsed?: string;
  gasFee?: string;
  error?: string;
}

export interface VerificationRecord {
  hash: string;
  verificationIndex: number;
  timestamp: number;
  isActive: boolean;
}

/**
 * Get wallet connection with provider and signer
 * @param walletClient - Optional wagmi wallet client for AppKit integration
 */
export async function getWalletConnection(walletClient?: any) {
  if (typeof window === "undefined") {
    throw new Error("Window object not available");
  }

  console.log("🔍 Searching for wallet provider...");

  // First priority: Use wagmi wallet client if provided (AppKit integration)
  if (walletClient?.transport) {
    try {
      console.log("🎯 Using wagmi wallet client from AppKit...");

      // Create a provider wrapper that uses wagmi's transport
      const providerWrapper = {
        request: async (args: { method: string; params?: any[] }) => {
          console.log(`🌐 RPC call via wagmi: ${args.method}`, args.params);
          try {
            // Check if walletClient is still valid
            if (!walletClient.transport) {
              throw new Error(
                "Wallet connection lost. Please reconnect your wallet."
              );
            }

            // Add timeout to prevent hanging requests
            const requestPromise = walletClient.transport.request({
              method: args.method as any,
              params: args.params as any,
            });

            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error("RPC request timeout")), 10000)
            );

            const result = await Promise.race([requestPromise, timeoutPromise]);
            console.log(`✅ RPC call successful:`, result);
            return result;
          } catch (error) {
            console.error(`❌ RPC call failed for ${args.method}:`, error);

            // Handle specific error types
            if (error instanceof Error) {
              if (
                error.message.includes("Request expired") ||
                error.message.includes("timeout") ||
                error.message.includes("session")
              ) {
                throw new Error(
                  "Wallet session expired. Please reconnect your wallet and try again."
                );
              }
            }
            throw error;
          }
        },
        // Add other required provider methods for ethers compatibility
        isConnected: () => true,
        chainId: walletClient.chain?.id
          ? `0x${walletClient.chain.id.toString(16)}`
          : "0x1",
        selectedAddress: walletClient.account?.address,
        networkVersion: walletClient.chain?.id?.toString() || "1",
        isMetaMask: walletClient.transport?.type === "injected",
      };

      const provider = new BrowserProvider(providerWrapper as any);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      console.log(
        "✅ Successfully connected via wagmi wallet client:",
        address
      );
      return { provider, signer, address };
    } catch (error) {
      console.warn("Failed to use wagmi wallet client:", error);
      // Fall through to other methods
    }
  }

  // Try to get active wagmi connection from global config
  let ethereum = null;
  try {
    // Check if wagmi has an active connection
    const wagmiConfig =
      (window as any).wagmiConfig || (window as any).wagmiAdapter?.wagmiConfig;
    if (wagmiConfig?.state?.current) {
      const currentConnector = wagmiConfig.state.current;
      if (currentConnector.getProvider) {
        console.log("🔄 Getting provider from active wagmi connector...");
        ethereum = await currentConnector.getProvider();
      }
    }
  } catch (e) {
    console.warn("Could not get provider from wagmi config:", e);
  }

  // Check AppKit modal for provider
  if (!ethereum && (window as any).modal?.getWalletProvider) {
    try {
      console.log("🔄 Getting provider from AppKit modal...");
      ethereum = await (window as any).modal.getWalletProvider();
    } catch (e) {
      console.warn("Could not get wallet provider from AppKit:", e);
    }
  }

  // Check wagmi adapters from global scope
  if (!ethereum && (window as any).wagmiAdapter?.wagmiConfig?.connectors) {
    try {
      console.log("🔄 Getting provider from wagmi connectors...");
      const connectors = (window as any).wagmiAdapter.wagmiConfig.connectors;
      for (const connector of connectors) {
        if (connector.provider || connector.getProvider) {
          ethereum = connector.provider || (await connector.getProvider?.());
          if (ethereum) {
            console.log("✅ Found provider from connector:", connector.name);
            break;
          }
        }
      }
    } catch (e) {
      console.warn("Could not get provider from wagmi connectors:", e);
    }
  }

  // Fallback to traditional provider locations
  if (!ethereum) {
    console.log("🔄 Checking fallback provider locations...");
    const possibleProviders = [
      (window as any).ethereum,
      (window as any).appKitProvider,
      (window as any).walletConnectProvider,
      (window as any).web3?.currentProvider,
      (window as any).provider,
    ];

    for (const provider of possibleProviders) {
      if (provider) {
        ethereum = provider;
        console.log("✅ Found provider in fallback location");
        break;
      }
    }
  }

  if (!ethereum) {
    console.error("❌ No wallet provider found");
    console.log(
      "Available window properties:",
      Object.keys(window).filter(
        (k) =>
          k.includes("ethereum") ||
          k.includes("wallet") ||
          k.includes("web3") ||
          k.includes("wagmi")
      )
    );
    throw new Error("No wallet found. Please connect your wallet first.");
  }

  console.log(
    "✅ Wallet provider found:",
    ethereum.constructor?.name || "Unknown provider"
  );

  // If multiple wallets are detected, try to use the selected one
  if (ethereum.providers && ethereum.providers.length > 0) {
    // Use the first available provider or the one that's been selected
    ethereum =
      ethereum.providers.find((provider: any) => provider.isConnected?.()) ||
      ethereum.providers[0];
  }

  try {
    const provider = new BrowserProvider(ethereum);

    // Check if accounts are already available
    let accounts = [];
    try {
      accounts = await provider.listAccounts();
    } catch (e) {
      console.log("No accounts available, requesting access...");
    }

    // Request account access if no accounts are available
    if (accounts.length === 0) {
      await provider.send("eth_requestAccounts", []);
    }

    const signer = await provider.getSigner();
    const address = await signer.getAddress();

    console.log("Successfully connected to wallet:", address);
    return { provider, signer, address };
  } catch (error) {
    console.error("Error connecting to wallet:", error);
    throw new Error(
      `Failed to connect to wallet: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Get the VerificationStorage contract instance
 * @param customSigner - Optional custom signer (from wagmi or other source)
 * @param walletClient - Optional wagmi wallet client for AppKit integration
 */
export async function getVerificationContract(
  customSigner?: any,
  walletClient?: any
) {
  let signer = customSigner;

  if (!signer) {
    const connection = await getWalletConnection(walletClient);
    signer = connection.signer;
  }

  return new Contract(
    VERIFICATION_STORAGE_ADDRESS,
    VERIFICATION_STORAGE_ABI,
    signer
  );
}

/**
 * Store a verification hash on the blockchain
 * @param hash - The verification hash to store
 * @param customSigner - Optional custom signer (from wagmi or other source)
 * @param walletClient - Optional wagmi wallet client for AppKit integration
 */
export async function storeVerificationOnBlockchain(
  hash: string,
  customSigner?: any,
  walletClient?: any
): Promise<BlockchainVerificationResult> {
  try {
    console.log("Starting blockchain storage for hash:", hash);

    if (!hash || hash.length !== 64) {
      throw new Error(
        "Invalid hash format. Expected 64-character SHA-256 hash."
      );
    }

    if (
      VERIFICATION_STORAGE_ADDRESS ===
      "0x0000000000000000000000000000000000000000"
    ) {
      throw new Error(
        "Contract address not configured. Please set NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS environment variable."
      );
    }

    const contract = await getVerificationContract(customSigner, walletClient);

    // Get address from custom signer if provided, otherwise use wallet connection
    let address: string;
    if (customSigner) {
      address = await customSigner.getAddress();
      console.log("✅ Using custom signer address:", address);
    } else {
      console.log("🔗 Getting wallet connection...");
      const connection = await getWalletConnection(walletClient);
      address = connection.address;
      console.log("✅ Using wallet connection address:", address);

      // Test the connection by getting the balance
      try {
        const balance = await connection.provider.getBalance(address);
        console.log("💰 Wallet balance:", formatUnits(balance, 18), "ETH");
      } catch (error) {
        console.warn("⚠️ Could not get wallet balance:", error);
      }
    }

    console.log("📦 Contract address:", VERIFICATION_STORAGE_ADDRESS);
    console.log("👤 User address:", address);

    // Estimate gas for the transaction with timeout
    console.log("⛽ Estimating gas...");
    const estimatedGas = (await Promise.race([
      contract.storeVerificationHash.estimateGas(hash),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Gas estimation timeout after 30 seconds")),
          30000
        )
      ),
    ])) as bigint;
    console.log("⛽ Estimated gas:", estimatedGas.toString());

    // Execute the transaction with 20% gas buffer and timeout
    const gasLimit = (estimatedGas * BigInt(120)) / BigInt(100);
    console.log("📤 Sending transaction with gas limit:", gasLimit.toString());

    const tx = (await Promise.race([
      contract.storeVerificationHash(hash, { gasLimit }),
      new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                "Transaction submission timeout after 30 seconds. Please check your wallet for pending transactions."
              )
            ),
          30000
        )
      ),
    ])) as any;

    console.log("📤 Transaction sent:", tx.hash);
    console.log("Waiting for confirmation...");

    // Wait for transaction to be mined with timeout
    const receipt = (await Promise.race([
      tx.wait(),
      new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error("Transaction confirmation timeout after 60 seconds")
            ),
          60000
        )
      ),
    ])) as any;

    if (!receipt) {
      throw new Error("Transaction failed - no receipt received");
    }

    console.log("✅ Transaction confirmed in block:", receipt.blockNumber);

    // Parse the logs to get the verification index
    let verificationIndex = 0;
    if (receipt.logs && receipt.logs.length > 0) {
      try {
        const parsedLogs = receipt.logs
          .map((log) => {
            try {
              return contract.interface.parseLog({
                topics: log.topics,
                data: log.data,
              });
            } catch {
              return null;
            }
          })
          .filter(Boolean);

        const verificationStoredEvent = parsedLogs.find(
          (log) => log && log.name === "VerificationStored"
        );

        if (verificationStoredEvent) {
          verificationIndex = Number(
            verificationStoredEvent.args.verificationIndex
          );
          console.log("📋 Verification index from event:", verificationIndex);
        }
      } catch (error) {
        console.warn("⚠️ Could not parse event logs:", error);
      }
    }

    // Calculate gas fee
    const gasUsed = receipt.gasUsed;
    const gasPrice = receipt.gasPrice || tx.gasPrice || BigInt(0);
    const gasFee = formatUnits(gasUsed * gasPrice, "ether");

    console.log("💰 Gas used:", gasUsed.toString());
    console.log("💰 Gas fee:", gasFee, "ETH");

    return {
      success: true,
      transactionHash: receipt.hash,
      verificationIndex: verificationIndex || undefined,
      gasUsed: gasUsed.toString(),
      gasFee: gasFee,
    };
  } catch (error: any) {
    console.error("❌ Blockchain storage failed:", error);

    let errorMessage = "Unknown blockchain error";

    // Handle session expiry and timeout errors
    if (
      error.message?.includes("Request expired") ||
      error.message?.includes("session expired") ||
      error.message?.includes("timeout")
    ) {
      errorMessage = "Wallet session expired or timed out";
    } else if (error.code === 4001) {
      errorMessage = "Transaction rejected by user";
    } else if (error.code === -32603) {
      errorMessage = "Internal RPC error - check network connection";
    } else if (error.reason) {
      errorMessage = error.reason;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Get the latest verification record for a user
 */
export async function getLatestVerification(
  userAddress: string
): Promise<VerificationRecord | null> {
  try {
    const contract = await getVerificationContract();
    const result = await contract.getLatestVerification(userAddress);

    return {
      hash: result.hash,
      verificationIndex: Number(result.verificationIndex),
      timestamp: Number(result.timestamp),
      isActive: result.isActive,
    };
  } catch (error) {
    console.error("Failed to get latest verification:", error);
    return null;
  }
}

/**
 * Get all verification records for a user
 */
export async function getAllUserVerifications(
  userAddress: string
): Promise<VerificationRecord[]> {
  try {
    const contract = await getVerificationContract();
    const result = await contract.getAllUserVerifications(userAddress);

    const records: VerificationRecord[] = [];
    for (let i = 0; i < result.hashes.length; i++) {
      records.push({
        hash: result.hashes[i],
        verificationIndex: Number(result.indices[i]),
        timestamp: Number(result.timestamps[i]),
        isActive: result.activeStates[i],
      });
    }

    return records;
  } catch (error) {
    console.error("Failed to get user verifications:", error);
    return [];
  }
}

/**
 * Get the verification count for a user
 */
export async function getUserVerificationCount(
  userAddress: string
): Promise<number> {
  try {
    const contract = await getVerificationContract();
    const count = await contract.getUserVerificationCount(userAddress);
    return Number(count);
  } catch (error) {
    console.error("Failed to get verification count:", error);
    return 0;
  }
}

/**
 * Check if a hash already exists for a user
 */
export async function verificationExists(
  userAddress: string,
  hash: string
): Promise<{ exists: boolean; verificationIndex: number }> {
  try {
    const contract = await getVerificationContract();
    const result = await contract.verificationExists(userAddress, hash);

    return {
      exists: result.exists,
      verificationIndex: Number(result.verificationIndex),
    };
  } catch (error) {
    console.error("Failed to check verification existence:", error);
    return { exists: false, verificationIndex: 0 };
  }
}
