import { POST } from '@/app/api/kyc/initiate/route';
import { NextRequest } from 'next/server';

// Mock workflow service
jest.mock('@/lib/workflow', () => ({
  WorkflowService: {
    getInstance: jest.fn(() => ({
      initialize: jest.fn(),
      startKYCWorkflow: jest.fn(),
    })),
  },
}));

describe('/api/kyc/initiate', () => {
  it('should initiate KYC workflow successfully', async () => {
    const { WorkflowService } = require('@/lib/workflow');
    const mockWorkflowService = WorkflowService.getInstance();
    
    mockWorkflowService.initialize.mockResolvedValue(true);
    mockWorkflowService.startKYCWorkflow.mockResolvedValue({
      success: true,
      workflowId: 'workflow-123',
    });

    const requestBody = {
      userId: '0x123',
      userAddress: '0x123',
      documents: {
        idDocument: 'ipfs-hash-1',
        selfie: 'ipfs-hash-2',
      },
    };

    const request = new NextRequest('http://localhost:3000/api/kyc/initiate', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data.workflowId).toBe('workflow-123');
  });

  it('should handle missing required fields', async () => {
    const requestBody = {
      userId: '0x123',
      // Missing userAddress and documents
    };

    const request = new NextRequest('http://localhost:3000/api/kyc/initiate', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error.message).toContain('Missing required fields');
  });

  it('should handle invalid Ethereum address', async () => {
    const requestBody = {
      userId: '0x123',
      userAddress: 'invalid-address',
      documents: {
        idDocument: 'ipfs-hash-1',
        selfie: 'ipfs-hash-2',
      },
    };

    const request = new NextRequest('http://localhost:3000/api/kyc/initiate', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error.message).toContain('Invalid Ethereum address format');
  });

  it('should handle workflow start failure', async () => {
    const { WorkflowService } = require('@/lib/workflow');
    const mockWorkflowService = WorkflowService.getInstance();
    
    mockWorkflowService.initialize.mockResolvedValue(true);
    mockWorkflowService.startKYCWorkflow.mockResolvedValue({
      success: false,
      error: 'Workflow failed to start',
    });

    const requestBody = {
      userId: '0x123',
      userAddress: '0x1234567890123456789012345678901234567890',
      documents: {
        idDocument: 'ipfs-hash-1',
        selfie: 'ipfs-hash-2',
      },
    };

    const request = new NextRequest('http://localhost:3000/api/kyc/initiate', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const result = await response.json();

    expect(response.status).toBe(500);
    expect(result.success).toBe(false);
    expect(result.error.message).toBe('Workflow failed to start');
  });
});