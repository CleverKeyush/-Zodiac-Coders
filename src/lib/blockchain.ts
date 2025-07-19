import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import CryptoJS from 'crypto-js';
import { KYCVerificationRecord } from '@/types';

// Simple KYC Storage Contract ABI
const KYC_CONTRACT_ABI = parseAbi([
  'function storeKYCHash(bytes32 hash, uint256 timestamp) external',
  'function getKYCHash(address user) external view returns (bytes32, uint256)',
  'function isKYCVerified(address user) external view returns (bool)',
  'event KYCStored(address indexed user, bytes32 hash, uint256 timestamp)',
]);

export class BlockchainService {
  private static instance: BlockchainService;
  private publicClient;
  private walletClient;
  private contractAddress: string;

  constructor() {
    // Initialize Viem clients
    this.publicClient = createPublicClient({
      chain: sepolia,
      transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/your_infura_key'),
    });

    // For demo purposes, using a private key from env
    // In production, use proper wallet connection
    const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY as `0x${string}`;
    if (privateKey) {
      const account = privateKeyToAccount(privateKey);
      this.walletClient = createWalletClient({
        account,
        chain: sepolia,
        transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/your_infura_key'),
      });
    }

    this.contractAddress = process.env.NEXT_PUBLIC_KYC_CONTRACT_ADDRESS || '0x...';
  }

  static getInstance(): BlockchainService {
    if (!BlockchainService.instance) {
      BlockchainService.instance = new BlockchainService();
    }
    return BlockchainService.instance;
  }

  // Serialize KYC data to JSON and generate hash
  generateKYCHash(kycData: KYCVerificationRecord): string {
    // Create a deterministic JSON representation
    const dataToHash = {
      userId: kycData.userId,
      documents: kycData.documents,
      extractedData: kycData.extractedData,
      verificationResults: kycData.verificationResults,
      completedAt: kycData.completedAt?.toISOString(),
    };

    // Sort keys to ensure consistent hashing
    const sortedData = JSON.stringify(dataToHash, Object.keys(dataToHash).sort());
    
    // Generate SHA-256 hash
    const hash = CryptoJS.SHA256(sortedData).toString();
    return hash;
  }

  // Store KYC hash on blockchain
  async storeKYCHash(kycData: KYCVerificationRecord, userAddress: `0x${string}`): Promise<{
    success: boolean;
    transactionHash?: string;
    blockchainHash?: string;
    error?: string;
  }> {
    try {
      if (!this.walletClient) {
        throw new Error('Wallet client not initialized');
      }

      // Generate hash
      const kycHash = this.generateKYCHash(kycData);
      const hashBytes32 = `0x${kycHash}` as `0x${string}`;
      const timestamp = BigInt(Math.floor(Date.now() / 1000));

      // Prepare transaction
      const { request } = await this.publicClient.simulateContract({
        address: this.contractAddress as `0x${string}`,
        abi: KYC_CONTRACT_ABI,
        functionName: 'storeKYCHash',
        args: [hashBytes32, timestamp],
        account: this.walletClient.account,
      });

      // Execute transaction with retry logic
      let transactionHash: string | undefined;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          transactionHash = await this.walletClient.writeContract(request);
          break;
        } catch (error) {
          attempts++;
          if (attempts >= maxAttempts) {
            throw error;
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 2000 * attempts));
        }
      }

      if (!transactionHash) {
        throw new Error('Failed to get transaction hash after retries');
      }

      // Wait for transaction confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: transactionHash as `0x${string}`,
        timeout: 60000, // 60 seconds timeout
      });

      if (receipt.status === 'success') {
        return {
          success: true,
          transactionHash,
          blockchainHash: kycHash,
        };
      } else {
        throw new Error('Transaction failed');
      }

    } catch (error) {
      console.error('Blockchain storage error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Blockchain storage failed',
      };
    }
  }

  // Verify KYC hash on blockchain
  async verifyKYCHash(userAddress: `0x${string}`): Promise<{
    isVerified: boolean;
    hash?: string;
    timestamp?: number;
    error?: string;
  }> {
    try {
      const result = await this.publicClient.readContract({
        address: this.contractAddress as `0x${string}`,
        abi: KYC_CONTRACT_ABI,
        functionName: 'getKYCHash',
        args: [userAddress],
      });

      const [hash, timestamp] = result as [string, bigint];
      
      // Check if hash exists (not zero)
      const isVerified = hash !== '0x0000000000000000000000000000000000000000000000000000000000000000';

      return {
        isVerified,
        hash: isVerified ? hash : undefined,
        timestamp: isVerified ? Number(timestamp) : undefined,
      };

    } catch (error) {
      console.error('Blockchain verification error:', error);
      return {
        isVerified: false,
        error: error instanceof Error ? error.message : 'Blockchain verification failed',
      };
    }
  }

  // Check if user is KYC verified
  async isKYCVerified(userAddress: `0x${string}`): Promise<boolean> {
    try {
      const result = await this.publicClient.readContract({
        address: this.contractAddress as `0x${string}`,
        abi: KYC_CONTRACT_ABI,
        functionName: 'isKYCVerified',
        args: [userAddress],
      });

      return result as boolean;
    } catch (error) {
      console.error('KYC verification check error:', error);
      return false;
    }
  }

  // Get transaction details
  async getTransactionDetails(txHash: string): Promise<{
    success: boolean;
    blockNumber?: number;
    gasUsed?: string;
    timestamp?: number;
    error?: string;
  }> {
    try {
      const receipt = await this.publicClient.getTransactionReceipt({
        hash: txHash as `0x${string}`,
      });

      const block = await this.publicClient.getBlock({
        blockNumber: receipt.blockNumber,
      });

      return {
        success: receipt.status === 'success',
        blockNumber: Number(receipt.blockNumber),
        gasUsed: receipt.gasUsed.toString(),
        timestamp: Number(block.timestamp),
      };

    } catch (error) {
      console.error('Transaction details error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get transaction details',
      };
    }
  }

  // Estimate gas for KYC storage
  async estimateGas(kycData: KYCVerificationRecord): Promise<{
    gasEstimate?: bigint;
    gasCost?: string;
    error?: string;
  }> {
    try {
      if (!this.walletClient) {
        throw new Error('Wallet client not initialized');
      }

      const kycHash = this.generateKYCHash(kycData);
      const hashBytes32 = `0x${kycHash}` as `0x${string}`;
      const timestamp = BigInt(Math.floor(Date.now() / 1000));

      const gasEstimate = await this.publicClient.estimateContractGas({
        address: this.contractAddress as `0x${string}`,
        abi: KYC_CONTRACT_ABI,
        functionName: 'storeKYCHash',
        args: [hashBytes32, timestamp],
        account: this.walletClient.account,
      });

      // Get current gas price
      const gasPrice = await this.publicClient.getGasPrice();
      const gasCost = (gasEstimate * gasPrice).toString();

      return {
        gasEstimate,
        gasCost,
      };

    } catch (error) {
      console.error('Gas estimation error:', error);
      return {
        error: error instanceof Error ? error.message : 'Gas estimation failed',
      };
    }
  }
}