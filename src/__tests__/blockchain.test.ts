import { BlockchainService } from '@/lib/blockchain';
import { KYCVerificationRecord } from '@/types';

// Mock viem
jest.mock('viem', () => ({
  createPublicClient: jest.fn(() => ({
    simulateContract: jest.fn(),
    waitForTransactionReceipt: jest.fn(),
    readContract: jest.fn(),
    getTransactionReceipt: jest.fn(),
    getBlock: jest.fn(),
    estimateContractGas: jest.fn(),
    getGasPrice: jest.fn(),
  })),
  createWalletClient: jest.fn(() => ({
    writeContract: jest.fn(),
    account: '0x123',
  })),
  http: jest.fn(),
  parseAbi: jest.fn(() => []),
}));

jest.mock('viem/chains', () => ({
  sepolia: {},
}));

jest.mock('viem/accounts', () => ({
  privateKeyToAccount: jest.fn(() => ({ address: '0x123' })),
}));

describe('BlockchainService', () => {
  let blockchainService: BlockchainService;
  let mockKYCData: KYCVerificationRecord;

  beforeEach(() => {
    blockchainService = BlockchainService.getInstance();
    mockKYCData = {
      workflowId: 'test-workflow-123',
      userId: '0x123',
      documents: {
        idDocument: 'ipfs-hash-1',
        selfie: 'ipfs-hash-2',
      },
      extractedData: {
        name: 'John Doe',
        dateOfBirth: '1990-01-01',
        idNumber: 'ABCDE1234F',
        address: '123 Main St',
      },
      verificationResults: {
        ocrStatus: 'passed',
        faceVerificationStatus: 'passed',
        complianceStatus: 'passed',
      },
      status: 'completed',
      createdAt: new Date('2024-01-01'),
      completedAt: new Date('2024-01-01'),
    };
  });

  describe('generateKYCHash', () => {
    it('should generate consistent hash for same data', () => {
      const hash1 = blockchainService.generateKYCHash(mockKYCData);
      const hash2 = blockchainService.generateKYCHash(mockKYCData);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hash length
    });

    it('should generate different hash for different data', () => {
      const modifiedData = { ...mockKYCData, userId: '0x456' };
      
      const hash1 = blockchainService.generateKYCHash(mockKYCData);
      const hash2 = blockchainService.generateKYCHash(modifiedData);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('storeKYCHash', () => {
    it('should handle successful storage', async () => {
      // Mock successful transaction
      const mockPublicClient = {
        simulateContract: jest.fn().mockResolvedValue({ request: {} }),
        waitForTransactionReceipt: jest.fn().mockResolvedValue({ status: 'success' }),
      };
      
      const mockWalletClient = {
        writeContract: jest.fn().mockResolvedValue('0xabc123'),
        account: '0x123',
      };

      (blockchainService as any).publicClient = mockPublicClient;
      (blockchainService as any).walletClient = mockWalletClient;

      const result = await blockchainService.storeKYCHash(
        mockKYCData,
        '0x123' as `0x${string}`
      );

      expect(result.success).toBe(true);
      expect(result.transactionHash).toBe('0xabc123');
      expect(result.blockchainHash).toBeDefined();
    });

    it('should handle transaction failure', async () => {
      const mockPublicClient = {
        simulateContract: jest.fn().mockRejectedValue(new Error('Transaction failed')),
      };

      (blockchainService as any).publicClient = mockPublicClient;

      const result = await blockchainService.storeKYCHash(
        mockKYCData,
        '0x123' as `0x${string}`
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Transaction failed');
    });
  });

  describe('verifyKYCHash', () => {
    it('should return verification status', async () => {
      const mockPublicClient = {
        readContract: jest.fn().mockResolvedValue(['0xabc123', BigInt(1640995200)]),
      };

      (blockchainService as any).publicClient = mockPublicClient;

      const result = await blockchainService.verifyKYCHash('0x123' as `0x${string}`);

      expect(result.isVerified).toBe(true);
      expect(result.hash).toBe('0xabc123');
      expect(result.timestamp).toBe(1640995200);
    });

    it('should handle verification errors', async () => {
      const mockPublicClient = {
        readContract: jest.fn().mockRejectedValue(new Error('Contract error')),
      };

      (blockchainService as any).publicClient = mockPublicClient;

      const result = await blockchainService.verifyKYCHash('0x123' as `0x${string}`);

      expect(result.isVerified).toBe(false);
      expect(result.error).toContain('Contract error');
    });
  });
});