import { OrkesApiClient, OrkesApiConfig } from '@/lib/orkesClient';

// Orkes Conductor Configuration
export const CONDUCTOR_CONFIG: OrkesApiConfig = {
  keyId: process.env.ORKES_KEY_ID || '',
  keySecret: process.env.ORKES_KEY_SECRET || '',
  serverUrl: process.env.ORKES_CONDUCTOR_PRIMARY_URL || 'https://edc9dd9319f4.ngrok-free.app',
  // Use secondary URL if available
  secondaryServerUrl: process.env.ORKES_CONDUCTOR_SECONDARY_URL || 'https://cd377e9381da.ngrok-free.app',
};

// OCR Worker Task Configuration
export const OCR_TASK_NAME = 'ocr_processing';
export const OCR_TASK_VERSION = 1;

// Workflow Names
export const KYC_WORKFLOW_NAME = 'kyc_verification_workflow';
export const KYC_WORKFLOW_VERSION = 1;

// Task Names
export const TASK_NAMES = {
  OCR_PROCESSING: 'ocr_processing',
  FACE_EXTRACTION: 'face_extraction',
  FACE_VERIFICATION: 'face_verification',
  COMPLIANCE_CHECK: 'compliance_check',
  BLOCKCHAIN_STORAGE: 'blockchain_storage',
};

// Workflow Status Mapping
export const WORKFLOW_STATUS = {
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  TERMINATED: 'TERMINATED',
};

// KYC Workflow Definition
export const KYC_WORKFLOW_DEFINITION = {
  name: KYC_WORKFLOW_NAME,
  description: "Complete KYC verification process with document processing, face verification, compliance checks, and blockchain storage",
  version: KYC_WORKFLOW_VERSION,
  tasks: [
    {
      name: "ocr_processing",
      taskReferenceName: "extract_document_data",
      type: "SIMPLE",
      inputParameters: {
        imageUrl: "${workflow.input.documentImageUrl}",
        documentType: "${workflow.input.documentType}",
        fileName: "${workflow.input.fileName}"
      }
    },
    {
      name: "face_extraction",
      taskReferenceName: "extract_face_from_document",
      type: "SIMPLE",
      inputParameters: {
        imageUrl: "${workflow.input.documentImageUrl}",
        documentType: "${workflow.input.documentType}"
      }
    },
    {
      name: "face_verification",
      taskReferenceName: "verify_face_match",
      type: "SIMPLE",
      inputParameters: {
        documentFaceUrl: "${extract_face_from_document.output.faceImageUrl}",
        selfieUrl: "${workflow.input.selfieImageUrl}",
        threshold: 0.8
      }
    },
    {
      name: "compliance_check",
      taskReferenceName: "perform_compliance_check",
      type: "SIMPLE",
      inputParameters: {
        extractedData: "${extract_document_data.output.extractedData}",
        documentType: "${workflow.input.documentType}",
        jurisdiction: "${workflow.input.jurisdiction}"
      }
    },
    {
      name: "blockchain_storage",
      taskReferenceName: "store_on_blockchain",
      type: "SIMPLE",
      inputParameters: {
        kycData: {
          documentData: "${extract_document_data.output.extractedData}",
          faceVerification: "${verify_face_match.output}",
          complianceResult: "${perform_compliance_check.output}",
          timestamp: "${workflow.startTime}",
          workflowId: "${workflow.workflowId}"
        },
        userAddress: "${workflow.input.userAddress}"
      }
    }
  ],
  inputParameters: [
    "documentImageUrl",
    "selfieImageUrl", 
    "documentType",
    "fileName",
    "jurisdiction",
    "userAddress"
  ],
  outputParameters: {
    kycStatus: "${store_on_blockchain.output.status}",
    blockchainHash: "${store_on_blockchain.output.transactionHash}",
    extractedData: "${extract_document_data.output.extractedData}",
    faceVerificationScore: "${verify_face_match.output.confidence}",
    complianceStatus: "${perform_compliance_check.output.status}",
    workflowId: "${workflow.workflowId}"
  },
  schemaVersion: 2,
  restartable: true,
  workflowStatusListenerEnabled: true
};

// Conductor Client Class
export class ConductorClient {
  private client: OrkesApiClient;

  constructor() {
    this.client = new OrkesApiClient(CONDUCTOR_CONFIG);
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.taskResource.getTaskTypes();
      return true;
    } catch (error) {
      console.log('Conductor health check failed:', error);
      return false;
    }
  }

  async registerWorkflow(workflowDef: any): Promise<void> {
    try {
      // Register the workflow definition with Orkes Conductor
      const response = await fetch(`${CONDUCTOR_CONFIG.serverUrl}/api/metadata/workflow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          ...(CONDUCTOR_CONFIG.keyId && CONDUCTOR_CONFIG.keySecret ? {
            'Authorization': `Basic ${Buffer.from(`${CONDUCTOR_CONFIG.keyId}:${CONDUCTOR_CONFIG.keySecret}`).toString('base64')}`
          } : {})
        },
        body: JSON.stringify(workflowDef)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Workflow registration failed (${response.status}): ${errorText}`);
        // Don't throw error - workflow might already be registered
      } else {
        console.log('✅ Workflow definition registered:', workflowDef.name);
      }
    } catch (error) {
      console.warn('Workflow registration error (continuing anyway):', error);
      // Don't throw error - workflow might already be registered
    }
  }

  async startWorkflow(workflowName: string, input: any, correlationId?: string): Promise<{ workflowId: string }> {
    const result = await this.client.workflowResource.startWorkflow(workflowName, KYC_WORKFLOW_VERSION, input);
    return { workflowId: result.workflowId };
  }

  async getWorkflowStatus(workflowId: string): Promise<any> {
    return await this.client.workflowResource.getWorkflow(workflowId, true);
  }
}