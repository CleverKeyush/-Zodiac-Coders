import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Upload,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Brain,
  FileText,
  Zap,
  CreditCard,
  Plane,
  Vote,
  Camera,
  X,
} from "lucide-react";
import { DocumentType, UploadResponse } from "@/types";

// Document configurations matching the Basic tab style
const DOCUMENT_CONFIGS = [
  {
    key: "aadhaar" as DocumentType,
    title: "Aadhaar Card",
    description: "Upload your Aadhaar card (front & back)",
    icon: CreditCard,
    required: true,
    acceptedFormats: "JPEG, PNG, WEBP, GIF, HEIF, AVIF",
  },
  {
    key: "pan" as DocumentType,
    title: "PAN Card",
    description: "Upload your PAN card",
    icon: FileText,
    required: true,
    acceptedFormats: "JPEG, PNG, WEBP, GIF, HEIF, AVIF",
  },
  {
    key: "passport" as DocumentType,
    title: "Passport",
    description: "Upload your passport (optional)",
    icon: Plane,
    required: false,
    acceptedFormats: "JPEG, PNG, WEBP, GIF, HEIF, AVIF",
  },
  {
    key: "voter_id" as DocumentType,
    title: "Voter ID",
    description: "Upload your voter ID (optional)",
    icon: Vote,
    required: false,
    acceptedFormats: "JPEG, PNG, WEBP, GIF, HEIF, AVIF",
  },
];

interface DocumentData {
  extractedData: Record<string, any>;
  rawText: string;
  documentType?: string;
  imageData?: string;
}

interface VerificationResult {
  isConsistent: boolean;
  belongsToSamePerson: boolean;
  confidence: number;
  inconsistencies: string[];
  verificationDetails: {
    nameConsistency: boolean;
    dateConsistency: boolean;
    addressConsistency: boolean;
    documentAuthenticity: boolean;
    crossDocumentValidation: boolean;
  };
  fieldAnalysis?: {
    name: { valid: boolean; issues: string[] };
    dateOfBirth: { valid: boolean; issues: string[] };
    idNumber: { valid: boolean; issues: string[] };
    address: { valid: boolean; issues: string[] };
    other: { valid: boolean; issues: string[] };
  };
  suggestions: string[];
}

interface CrossDocumentAnalysis {
  documentsAnalyzed: number;
  overallConsistency: boolean;
  personIdentityConfidence: number;
  riskFactors: string[];
  verificationSummary: string;
}

interface EnhancedDocumentVerificationProps {
  onUploadComplete?: (type: DocumentType, response: UploadResponse) => void;
  onUploadError?: (error: string) => void;
  onFileStored?: (type: DocumentType, file: File) => void; // New prop to store files
  documentsToShow?: DocumentType[];
}

export default function EnhancedDocumentVerification({
  onUploadComplete,
  onUploadError,
  onFileStored,
  documentsToShow = ["aadhaar", "pan", "passport", "voter_id"],
}: EnhancedDocumentVerificationProps) {
  const [documents, setDocuments] = useState<
    { file: File; type: DocumentType; uploaded: boolean }[]
  >([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [verificationResults, setVerificationResults] = useState<any>(null);
  const [error, setError] = useState<string>("");
  const [processingStep, setProcessingStep] = useState<string>("");

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    console.log(
      "Files selected:",
      files.length,
      files.map((f) => ({ name: f.name, size: f.size, type: f.type }))
    );

    // Determine document type from input id
    const inputId = event.target.id;
    const documentType = inputId.replace("upload-", "") as DocumentType;

    const newDocs = files.map((file) => ({
      file,
      type: documentType,
      uploaded: false,
    }));

    setDocuments((prev) => {
      // Remove existing document of same type
      const filtered = prev.filter((doc) => doc.type !== documentType);
      const updated = [...filtered, ...newDocs];
      console.log("Documents state updated:", updated.length);
      return updated;
    });

    setError("");

    // Clear the input value so the same file can be selected again
    event.target.value = "";

    // Call onFileStored after state update is complete
    if (onFileStored && newDocs.length > 0) {
      // Use setTimeout to avoid calling during render
      setTimeout(() => {
        onFileStored(documentType, newDocs[0].file);
      }, 0);
    }
  };

  const removeDocument = (index: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadDocumentToIPFS = async (
    file: File,
    type: DocumentType
  ): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error?.message || "Upload failed");
    }

    return result.data;
  };

  const processDocuments = async () => {
    console.log("Processing documents, count:", documents.length);

    if (documents.length === 0) {
      setError("Please upload at least one document");
      return;
    }

    console.log(
      "Documents to process:",
      documents.map((d) => ({
        name: d.file.name,
        type: d.type,
        size: d.file.size,
      }))
    );

    setIsProcessing(true);
    setError("");
    setProcessingStep("Extracting data from documents OCR...");

    try {
      // Step 1: Extract data from all documents using existing OCR
      const documentData: DocumentData[] = [];

      console.log("Starting OCR processing for", documents.length, "documents");

      // Quick connectivity check
      try {
        console.log("Testing server connectivity...");
        const testResponse = await fetch("/api/document-verification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documents: [],
            verificationType: "comprehensive",
          }),
        });
        console.log("Server connectivity test:", testResponse.status);
      } catch (connectError) {
        console.error("Server connectivity test failed:", connectError);
        throw new Error(
          "Unable to connect to server. Please check your connection."
        );
      }

      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        const file = doc.file;

        console.log(`📄 Processing document ${i + 1}/${documents.length}:`, {
          name: file.name,
          size: file.size,
          type: file.type,
          documentType: doc.type,
        });

        setProcessingStep(
          `Processing document ${i + 1}/${documents.length}: ${
            file.name
          } with OCR...`
        );

        // Use the same OCR endpoint as the existing system
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", doc.type);

        console.log(`Sending OCR request for ${file.name}...`);

        let response;
        try {
          response = await fetch("/api/ocr", {
            method: "POST",
            body: formData,
          });
        } catch (fetchError) {
          console.error("Fetch error:", fetchError);
          throw new Error(
            `Network error while processing ${file.name}: ${
              fetchError instanceof Error ? fetchError.message : "Unknown error"
            }`
          );
        }

        console.log(
          `📡 OCR response status for ${file.name}:`,
          response.status,
          response.statusText
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`OCR failed for ${file.name}:`, errorText);
          throw new Error(
            `Failed to process ${file.name} with OCR: ${response.status} ${response.statusText}`
          );
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(
            result.error?.message || `Failed to extract data from ${file.name}`
          );
        }

        console.log(`OCR completed for ${file.name}:`, result.data);

        // Convert file to base64 for Gemini processing
        const base64 = await fileToBase64(file);

        documentData.push({
          extractedData: result.data.extractedData,
          rawText: result.data.rawText || "",
          documentType: doc.type,
          imageData: base64,
        });

        // Upload to IPFS and notify parent component
        if (onUploadComplete) {
          try {
            const uploadResponse = await uploadDocumentToIPFS(file, doc.type);
            onUploadComplete(doc.type, uploadResponse);

            // Mark as uploaded
            setDocuments((prev) =>
              prev.map((d, idx) => (idx === i ? { ...d, uploaded: true } : d))
            );
          } catch (uploadError) {
            console.warn(
              `Upload to IPFS failed for ${file.name}:`,
              uploadError
            );
            // Continue with verification even if upload fails
          }
        }
      }

      // Step 2: Use Gemini AI to intelligently analyze the OCR results
      setProcessingStep(
        "Analyzing OCR results with Gemini AI for intelligent verification..."
      );

      const verificationResponse = await fetch("/api/document-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documents: documentData,
          verificationType: "comprehensive",
        }),
      });

      if (!verificationResponse.ok) {
        throw new Error("Gemini AI verification analysis failed");
      }

      const verificationResult = await verificationResponse.json();

      if (!verificationResult.success) {
        // Provide detailed error information for better debugging
        const errorDetails =
          verificationResult.error?.message || "Verification failed";
        const errorData = verificationResult.data;

        if (errorData && errorData.inconsistencies) {
          const inconsistencyDetails = errorData.inconsistencies.join(", ");
          throw new Error(
            `Verification failed: ${inconsistencyDetails} | ${errorDetails}`
          );
        }

        if (
          errorData &&
          errorData.finalRecommendation &&
          !errorData.finalRecommendation.approved
        ) {
          throw new Error(
            `Verification failed: ${errorData.finalRecommendation.reason} | ${errorDetails}`
          );
        }

        throw new Error(errorDetails);
      }

      setVerificationResults(verificationResult.data);
      setProcessingStep("");
    } catch (err) {
      console.error("Document processing error:", err);
      setError(
        err instanceof Error ? err.message : "Document processing failed"
      );
      setProcessingStep("");
    } finally {
      setIsProcessing(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data:image/jpeg;base64, prefix
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  const getStatusIcon = (status: boolean, size: "sm" | "lg" = "sm") => {
    const iconSize = size === "lg" ? 24 : 16;
    return status ? (
      <CheckCircle
        className={`text-green-500 w-${iconSize === 24 ? "6" : "4"} h-${
          iconSize === 24 ? "6" : "4"
        }`}
      />
    ) : (
      <XCircle
        className={`text-red-500 w-${iconSize === 24 ? "6" : "4"} h-${
          iconSize === 24 ? "6" : "4"
        }`}
      />
    );
  };

  // Document upload card component matching Basic tab style
  const DocumentCard = ({
    config,
  }: {
    config: (typeof DOCUMENT_CONFIGS)[0];
  }) => {
    const documentState = documents.find((doc) => doc.type === config.key);
    const Icon = config.icon;

    return (
      <div className="bento-item w-full">
        <div className="flex flex-col space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Icon className="w-6 h-6 text-teal-900" />
              <div>
                <h3 className="metallic-text text-lg flex items-center space-x-2">
                  <span>{config.title}</span>
                  {config.required && (
                    <span className="text-red-400 text-sm">*</span>
                  )}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {config.description}
                </p>
              </div>
            </div>
          </div>

          {/* Upload Area */}
          {!documentState?.file ? (
            <div className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center hover:border-teal-900/50 transition-colors">
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">
                Click to upload your {config.title.toLowerCase()}
              </p>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => handleFileUpload(e)}
                className="hidden"
                id={`upload-${config.key}`}
                disabled={isProcessing}
              />
              <label
                htmlFor={`upload-${config.key}`}
                className="cursor-pointer"
              >
                <Button variant="outline" className="w-full" asChild>
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload {config.title}
                  </span>
                </Button>
              </label>
              <p className="text-xs text-muted-foreground mt-2">
                {config.acceptedFormats}
              </p>
            </div>
          ) : (
            <div className="bg-white/5 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-teal-900" />
                  <div>
                    <p className="text-sm font-medium">
                      {documentState.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(documentState.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {documentState.uploaded && (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      removeDocument(
                        documents.findIndex((doc) => doc.type === config.key)
                      )
                    }
                    disabled={isProcessing}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Preview if it's an image */}
              {documentState.file.type.startsWith("image/") && (
                <div className="mt-3">
                  <img
                    src={URL.createObjectURL(documentState.file)}
                    alt={`Preview of ${config.title}`}
                    className="w-full h-32 object-cover rounded border"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold metallic-text">
          AI-Powered Document Verification
        </h2>
        <p className="text-muted-foreground">
          Upload your identity documents for intelligent AI verification using
          Gemini
        </p>
        <div className="text-sm text-muted-foreground">
          <span className="text-red-400">*</span> Required documents
        </div>
      </div>

      {/* Document Grid */}
      <div className="space-y-4">
        {(() => {
          let documentsToRender = DOCUMENT_CONFIGS;

          if (documentsToShow && documentsToShow.length > 0) {
            documentsToRender = DOCUMENT_CONFIGS.filter((config) =>
              documentsToShow.includes(config.key)
            );
          }

          return documentsToRender.map((config) => (
            <DocumentCard key={config.key} config={config} />
          ));
        })()}
      </div>

      {/* Batch Upload Section */}
      {documents.length > 0 && (
        <div className="glass-card p-6 text-center">
          <h3 className="text-lg font-semibold metallic-text mb-4">
            Ready for Verification
          </h3>

          {isProcessing ? (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto border-4 border-teal-900 border-t-transparent rounded-full animate-spin"></div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {processingStep}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                <Brain className="w-5 h-5 mr-2" />
                {documents.length} document(s) ready for intelligent AI analysis
                analysis
              </p>
              <Button
                onClick={processDocuments}
                variant="gradient"
                size="lg"
                className="px-8"
              >
                <Brain className="w-5 h-5 mr-2" />
                Verify
              </Button>
              <p className="text-xs text-muted-foreground">
                Documents will be analyzed OCR + AI for intelligent verification
              </p>
            </div>
          )}
        </div>
      )}

      {/* AI Verification Results */}
      {verificationResults && (
        <div className="space-y-6">
          {/* Overall Results */}
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 dark:from-blue-400/10 dark:to-purple-400/10 p-6 rounded-lg border border-blue-200/20 dark:border-blue-400/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                Overall Verification Result
              </h3>
              {getStatusIcon(
                verificationResults.finalRecommendation.approved,
                "lg"
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500 dark:text-blue-400">
                  {verificationResults.finalRecommendation.confidence}%
                </div>
                <div className="text-sm text-muted-foreground">
                  Confidence Score
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-500 dark:text-purple-400">
                  {verificationResults.crossDocumentAnalysis.documentsAnalyzed}
                </div>
                <div className="text-sm text-muted-foreground">
                  Documents Analyzed
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500 dark:text-green-400">
                  {
                    verificationResults.crossDocumentAnalysis
                      .personIdentityConfidence
                  }
                  %
                </div>
                <div className="text-sm text-muted-foreground">
                  Identity Match
                </div>
              </div>
            </div>

            <div className="bg-card border border-border p-4 rounded">
              <h4 className="font-medium mb-2 text-card-foreground">
                AI Analysis Summary:
              </h4>
              <p className="text-sm text-muted-foreground">
                {verificationResults.crossDocumentAnalysis.verificationSummary}
              </p>
            </div>

            {verificationResults.finalRecommendation.reason && (
              <div className="mt-4 p-4 bg-card border border-border rounded">
                <h4 className="font-medium mb-2 text-card-foreground">
                  Recommendation:
                </h4>
                <p className="text-sm text-muted-foreground">
                  {verificationResults.finalRecommendation.reason}
                </p>
              </div>
            )}
          </div>

          {/* Individual Document Results */}
          <div>
            <h3 className="text-lg font-semibold mb-4">
              Individual Document Analysis
            </h3>
            <div className="space-y-4">
              {verificationResults.individualVerifications.map(
                (verification: VerificationResult, index: number) => (
                  <div
                    key={index}
                    className="border border-border rounded-lg p-4 bg-card"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-card-foreground">
                        Document {index + 1}
                      </h4>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(verification.isConsistent)}
                        <span className="text-sm text-muted-foreground">
                          {verification.confidence}% confidence
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        {getStatusIcon(
                          verification.verificationDetails.nameConsistency
                        )}
                        <span className="text-muted-foreground">Name</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(
                          verification.verificationDetails.dateConsistency
                        )}
                        <span className="text-muted-foreground">Date</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(
                          verification.verificationDetails.addressConsistency
                        )}
                        <span className="text-muted-foreground">Address</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(
                          verification.verificationDetails.documentAuthenticity
                        )}
                        <span className="text-muted-foreground">
                          Authenticity
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(
                          verification.verificationDetails
                            .crossDocumentValidation
                        )}
                        <span className="text-muted-foreground">
                          Cross-validation
                        </span>
                      </div>
                    </div>

                    {verification.inconsistencies.length > 0 && (
                      <div className="mt-3 p-3 bg-red-500/10 dark:bg-red-400/10 rounded border border-red-500/20 dark:border-red-400/20">
                        <h5 className="font-medium text-red-600 dark:text-red-400 mb-1">
                          Issues Found:
                        </h5>
                        <ul className="text-sm text-red-600 dark:text-red-400 list-disc list-inside">
                          {verification.inconsistencies.map((issue, i) => (
                            <li key={i}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {verification.fieldAnalysis && (
                      <div className="mt-3 p-3 bg-muted/50 rounded border border-border">
                        <h5 className="font-medium text-muted-foreground mb-2">
                          Field Analysis:
                        </h5>
                        <div className="space-y-2">
                          {Object.entries(verification.fieldAnalysis).map(
                            ([field, analysis]: [string, any]) => (
                              <div
                                key={field}
                                className="flex items-start gap-2"
                              >
                                {getStatusIcon(analysis.valid)}
                                <div className="flex-1">
                                  <span className="text-sm font-medium capitalize text-card-foreground">
                                    {field.replace(/([A-Z])/g, " $1")}
                                  </span>
                                  {analysis.issues &&
                                    analysis.issues.length > 0 && (
                                      <ul className="text-xs text-red-600 dark:text-red-400 mt-1 list-disc list-inside ml-4">
                                        {analysis.issues.map(
                                          (issue: string, idx: number) => (
                                            <li key={idx}>{issue}</li>
                                          )
                                        )}
                                      </ul>
                                    )}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {verification.suggestions.length > 0 && (
                      <div className="mt-3 p-3 bg-yellow-500/10 dark:bg-yellow-400/10 rounded border border-yellow-500/20 dark:border-yellow-400/20">
                        <h5 className="font-medium text-yellow-600 dark:text-yellow-400 mb-1">
                          Suggestions:
                        </h5>
                        <ul className="text-sm text-yellow-600 dark:text-yellow-400 list-disc list-inside">
                          {verification.suggestions.map((suggestion, i) => (
                            <li key={i}>{suggestion}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          </div>

          {/* Risk Factors */}
          {verificationResults.crossDocumentAnalysis.riskFactors.length > 0 && (
            <div className="bg-red-500/10 dark:bg-red-400/10 p-4 rounded-lg border border-red-500/20 dark:border-red-400/20">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400" />
                <h3 className="font-semibold text-red-600 dark:text-red-400">
                  Risk Factors Identified
                </h3>
              </div>
              <ul className="text-sm text-red-600 dark:text-red-400 list-disc list-inside space-y-1">
                {verificationResults.crossDocumentAnalysis.riskFactors.map(
                  (risk: string, index: number) => (
                    <li key={index}>{risk}</li>
                  )
                )}
              </ul>
            </div>
          )}

          {/* Required Actions */}
          {verificationResults.finalRecommendation.requiredActions.length >
            0 && (
            <div className="bg-blue-500/10 dark:bg-blue-400/10 p-4 rounded-lg border border-blue-500/20 dark:border-blue-400/20">
              <h3 className="font-semibold text-blue-600 dark:text-blue-400 mb-3">
                Required Actions
              </h3>
              <ul className="text-sm text-blue-600 dark:text-blue-400 list-disc list-inside space-y-1">
                {verificationResults.finalRecommendation.requiredActions.map(
                  (action: string, index: number) => (
                    <li key={index}>{action}</li>
                  )
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Clear All Button */}
      {(documents.length > 0 || verificationResults) && (
        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => {
              setDocuments([]);
              setVerificationResults(null);
              setError("");
            }}
            disabled={isProcessing}
          >
            Clear All
          </Button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            <span className="font-medium text-red-700">Error</span>
          </div>
          <p className="text-sm text-red-600 mt-1">{error}</p>
        </div>
      )}
    </div>
  );
}
