import { WorkflowService } from '@/lib/workflow';

// Mock all dependencies
jest.mock('@/config/conductor');
jest.mock('@/lib/ocr');
jest.mock('@/lib/faceVerification');
jest.mock('@/lib/compliance');
jest.mock('@/lib/blockchain');

describe('WorkflowService', () => {
  let workflowService: WorkflowService;

  beforeEach(() => {
    workflowService = WorkflowService.getInstance();
  });

  describe('startKYCWorkflow', () => {
    const mockInput = {
      userId: '0x123',
      userAddress: '0x123',
      documents: {
        idDocument: 'ipfs-hash-1',
        selfie: 'ipfs-hash-2',
      },
    };

    it('should start workflow successfully', async () => {
      // Mock conductor health check to return true
      const mockConductorClient = {
        healthCheck: jest.fn().mockResolvedValue(true),
        startWorkflow: jest.fn().mockResolvedValue({ workflowId: 'workflow-123' }),
      };

      (workflowService as any).conductorClient = mockConductorClient;

      const result = await workflowService.startKYCWorkflow(mockInput);

      expect(result.success).toBe(true);
      expect(result.workflowId).toBe('workflow-123');
    });

    it('should fallback to local execution when conductor is unavailable', async () => {
      // Mock conductor health check to return false
      const mockConductorClient = {
        healthCheck: jest.fn().mockResolvedValue(false),
      };

      (workflowService as any).conductorClient = mockConductorClient;

      const result = await workflowService.startKYCWorkflow(mockInput);

      expect(result.success).toBe(true);
      expect(result.workflowId).toContain('local_');
    });

    it('should handle workflow start errors', async () => {
      const mockConductorClient = {
        healthCheck: jest.fn().mockRejectedValue(new Error('Connection failed')),
      };

      (workflowService as any).conductorClient = mockConductorClient;

      const result = await workflowService.startKYCWorkflow(mockInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection failed');
    });
  });

  describe('getWorkflowStatus', () => {
    it('should return status for local workflow', async () => {
      const workflowId = 'local_test_123';
      const mockResult = {
        workflowId,
        userId: '0x123',
        status: 'completed' as const,
        documents: { idDocument: 'hash1', selfie: 'hash2' },
        extractedData: { name: 'John Doe', dateOfBirth: '', idNumber: '', address: '' },
        verificationResults: {
          ocrStatus: 'passed' as const,
          faceVerificationStatus: 'passed' as const,
          complianceStatus: 'passed' as const,
        },
        createdAt: new Date(),
      };

      (workflowService as any).localWorkflowResults.set(workflowId, mockResult);

      const status = await workflowService.getWorkflowStatus(workflowId);

      expect(status.workflowId).toBe(workflowId);
      expect(status.status).toBe('COMPLETED');
    });

    it('should return status from conductor for remote workflow', async () => {
      const workflowId = 'remote_workflow_123';
      const mockConductorClient = {
        healthCheck: jest.fn().mockResolvedValue(true),
        getWorkflowStatus: jest.fn().mockResolvedValue({
          status: 'RUNNING',
          currentTask: 'ocr_processing',
          completedTasks: ['upload_to_ipfs'],
        }),
      };

      (workflowService as any).conductorClient = mockConductorClient;

      const status = await workflowService.getWorkflowStatus(workflowId);

      expect(status.workflowId).toBe(workflowId);
      expect(status.status).toBe('RUNNING');
      expect(status.currentTask).toBe('ocr_processing');
    });
  });

  describe('getCompletedTasks', () => {
    it('should return correct completed tasks based on KYC record', () => {
      const mockRecord = {
        workflowId: 'test',
        userId: '0x123',
        documents: { idDocument: 'hash1', selfie: 'hash2' },
        extractedData: { name: 'John', dateOfBirth: '', idNumber: '', address: '' },
        verificationResults: {
          ocrStatus: 'passed' as const,
          faceVerificationStatus: 'passed' as const,
          complianceStatus: 'passed' as const,
        },
        blockchainHash: 'hash123',
        transactionHash: '0xabc123',
        status: 'completed' as const,
        createdAt: new Date(),
      };

      const completedTasks = (workflowService as any).getCompletedTasks(mockRecord);

      expect(completedTasks).toContain('upload_to_ipfs');
      expect(completedTasks).toContain('ocr_processing');
      expect(completedTasks).toContain('face_verification');
      expect(completedTasks).toContain('compliance_check');
      expect(completedTasks).toContain('generate_hash');
      expect(completedTasks).toContain('store_on_blockchain');
    });
  });
});