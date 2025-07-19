// Document Types
export type DocumentType =
  | "aadhaar"
  | "pan"
  | "passport"
  | "voter_id"
  | "selfie";

// KYC Verification Record Interface
export interface KYCVerificationRecord {
  workflowId: string;
  userId: string;
  documents: {
    aadhaar?: string; // IPFS hash
    pan?: string; // IPFS hash
    passport?: string; // IPFS hash
    voter_id?: string; // IPFS hash
    selfie: string; // IPFS hash (required)
  };
  extractedData: {
    name: string;
    dateOfBirth: string;
    idNumber: string;
    address: string;
    aadhaarNumber?: string;
    panNumber?: string;
  };
  verificationResults: {
    ocrStatus: "passed" | "failed";
    faceVerificationStatus: "passed" | "failed";
    complianceStatus: "passed" | "failed";
    similarityScore?: number;
  };
  blockchainHash?: string;
  transactionHash?: string;
  status: "pending" | "completed" | "failed";
  createdAt: Date;
  completedAt?: Date;
}

// Workflow Status Interface
export interface WorkflowStatus {
  workflowId: string;
  status: "RUNNING" | "COMPLETED" | "FAILED" | "TERMINATED";
  currentTask?: string;
  completedTasks: string[];
  failureReason?: string;
  output?: any;
}

// Document Upload Types
export interface DocumentUpload {
  file: File;
  type: DocumentType;
}

export interface UploadResponse {
  ipfsHash: string;
  fileName: string;
  fileSize: number;
  uploadedAt: Date;
}

// OCR Processing Types
export interface OCRResult {
  extractedData: {
    name?: string;
    dateOfBirth?: string;
    idNumber?: string;
    address?: string;
    aadhaarNumber?: string;
    panNumber?: string;
  };
  rawText?: string; // Complete OCR extracted text
  confidence: number;
  status: "success" | "failed";
  errors?: string[];
  geminiEnhanced?: boolean; // Whether Gemini AI was used
  comparisonData?: {
    geminiConfidence: number;
    mistralConfidence: number;
    usedGemini: boolean;
  };
}

// Face Verification Types
export interface FaceVerificationResult {
  similarityScore: number;
  isMatch: boolean;
  confidence: number;
  status: "success" | "failed";
  error?: string;
}

// Compliance Check Types
export interface ComplianceResult {
  status: "passed" | "failed";
  checks: {
    fieldConsistency: boolean;
    logicalValidation: boolean;
    tamperingDetection: boolean;
    documentPresence: boolean;
  };
  failureReasons?: string[];
}

// Error Types
export interface KYCError {
  code:
    | "UPLOAD_FAILED"
    | "OCR_FAILED"
    | "FACE_VERIFICATION_FAILED"
    | "COMPLIANCE_FAILED"
    | "BLOCKCHAIN_FAILED"
    | "VERIFICATION_FAILED";
  message: string;
  details?: any;
}

// API Response Types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: KYCError;
  message?: string;
}

// Workflow Task Types
export type WorkflowTask =
  | "upload_to_ipfs"
  | "ocr_processing"
  | "face_verification"
  | "compliance_check"
  | "generate_hash"
  | "store_on_blockchain";

export interface TaskResult {
  taskName: WorkflowTask;
  status: "success" | "failed";
  output?: any;
  error?: string;
  executedAt: Date;
}
