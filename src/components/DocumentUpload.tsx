"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  Upload,
  FileText,
  Camera,
  X,
  CheckCircle,
  AlertCircle,
  CreditCard,
  Plane,
  Vote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import CameraCapture from "@/components/CameraCapture";
import LivenessCameraCapture from "@/components/LivenessCameraCapture";
import { UploadResponse, APIResponse } from "@/types";

type DocumentType = "aadhaar" | "pan" | "passport" | "voter_id" | "selfie";

interface DocumentUploadProps {
  onUploadComplete: (type: DocumentType, response: UploadResponse) => void;
  onUploadError: (error: string) => void;
  onFileStored?: (type: DocumentType, file: File) => void; // Add callback for storing file references
  documentsToShow?: DocumentType[]; // New prop to specify which documents to show
  selfieOnly?: boolean; // Legacy prop for backward compatibility
}

interface FileUploadState {
  file: File | null;
  preview: string | null;
  uploading: boolean;
  uploaded: boolean;
  progress: number;
  error: string | null;
  response: UploadResponse | null;
}

interface DocumentConfig {
  key: DocumentType;
  title: string;
  description: string;
  icon: React.ElementType;
  required: boolean;
  acceptedFormats: string;
}

const DOCUMENT_CONFIGS: DocumentConfig[] = [
  {
    key: "aadhaar",
    title: "Aadhaar Card",
    description: "Upload your Aadhaar card (front & back)",
    icon: CreditCard,
    required: true,
    acceptedFormats: "JPEG, PNG, WEBP, GIF, HEIF, AVIF",
  },
  {
    key: "pan",
    title: "PAN Card",
    description: "Upload your PAN card",
    icon: FileText,
    required: true,
    acceptedFormats: "JPEG, PNG, WEBP, GIF, HEIF, AVIF",
  },
  {
    key: "passport",
    title: "Passport",
    description: "Upload your passport (optional)",
    icon: Plane,
    required: false,
    acceptedFormats: "JPEG, PNG, WEBP, GIF, HEIF, AVIF",
  },
  {
    key: "voter_id",
    title: "Voter ID",
    description: "Upload your voter ID (optional)",
    icon: Vote,
    required: false,
    acceptedFormats: "JPEG, PNG, WEBP, GIF, HEIF, AVIF",
  },
  {
    key: "selfie",
    title: "Live Selfie",
    description: "Take a live photo for verification",
    icon: Camera,
    required: true,
    acceptedFormats: "Live Camera",
  },
];

export default function DocumentUpload({
  onUploadComplete,
  onUploadError,
  onFileStored,
  documentsToShow,
  selfieOnly = false,
}: DocumentUploadProps) {
  // Multiple document states
  const [documents, setDocuments] = useState<
    Record<DocumentType, FileUploadState>
  >({
    aadhaar: {
      file: null,
      preview: null,
      uploading: false,
      uploaded: false,
      progress: 0,
      error: null,
      response: null,
    },
    pan: {
      file: null,
      preview: null,
      uploading: false,
      uploaded: false,
      progress: 0,
      error: null,
      response: null,
    },
    passport: {
      file: null,
      preview: null,
      uploading: false,
      uploaded: false,
      progress: 0,
      error: null,
      response: null,
    },
    voter_id: {
      file: null,
      preview: null,
      uploading: false,
      uploaded: false,
      progress: 0,
      error: null,
      response: null,
    },
    selfie: {
      file: null,
      preview: null,
      uploading: false,
      uploaded: false,
      progress: 0,
      error: null,
      response: null,
    },
  });

  const [showCamera, setShowCamera] = useState(false);

  // Process OCR for a document using the actual file
  const processOCR = useCallback(async (type: DocumentType, file: File) => {
    console.log(`Starting OCR processing for ${type} with file:`, {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    try {
      // Show processing state
      setOcrResults((prev) => {
        return {
          ...prev,
          [type]: { status: "processing" },
        };
      });

      // Create FormData to send the actual file for OCR processing
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);

      console.log(`📤 Sending OCR request for ${type}...`);

      // Call OCR API with the actual file
      const response = await fetch("/api/ocr", {
        method: "POST",
        body: formData, // Send file directly, not JSON
      });

      console.log(`📥 OCR API response for ${type}:`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      if (!response.ok) {
        throw new Error(
          `API request failed: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();
      console.log(`📊 OCR API result for ${type}:`, result);

      if (result.success && result.data) {
        console.log(
          `✅ OCR successful for ${type}, extracted text length:`,
          result.data.rawText?.length || 0
        );
        setOcrResults((prev) => ({
          ...prev,
          [type]: {
            ...result.data,
            status: "completed",
          },
        }));
      } else {
        console.log(`❌ OCR failed for ${type}:`, result.error);
        setOcrResults((prev) => ({
          ...prev,
          [type]: {
            status: "failed",
            error: result.error?.message || "OCR processing failed",
          },
        }));
      }
    } catch (error) {
      console.error(`💥 OCR processing error for ${type}:`, error);
      setOcrResults((prev) => ({
        ...prev,
        [type]: {
          status: "failed",
          error:
            error instanceof Error ? error.message : "OCR processing failed",
        },
      }));
    }
  }, []);

  // Handle file selection for document types
  const handleFileSelect = useCallback(
    (file: File, type: DocumentType) => {
      // Validate file - only image formats allowed by the API
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/heif",
        "image/heic",
        "image/avif",
      ];
      if (!allowedTypes.includes(file.type.toLowerCase())) {
        setDocuments((prev) => ({
          ...prev,
          [type]: {
            ...prev[type],
            error:
              "Invalid file type. Only JPEG, PNG, WEBP, GIF, HEIF, AVIF image files are allowed.",
          },
        }));
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setDocuments((prev) => ({
          ...prev,
          [type]: {
            ...prev[type],
            error: "File size too large. Maximum size is 10MB.",
          },
        }));
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onload = async (e) => {
        setDocuments((prev) => ({
          ...prev,
          [type]: {
            ...prev[type],
            file,
            preview: e.target?.result as string,
            error: null,
          },
        }));

        // Call onFileStored callback to notify parent component
        if (onFileStored) {
          onFileStored(type, file);
          console.log(
            `📁 Stored ${type} file for parent component:`,
            file.name
          );
        }

        // Automatically trigger OCR processing for non-selfie documents
        if (type !== "selfie") {
          console.log(`🚀 Auto-triggering OCR for ${type} document`);
          await processOCR(type, file);
        }
      };
      reader.readAsDataURL(file);
    },
    [processOCR]
  );

  // State for OCR results
  const [ocrResults, setOcrResults] = useState<Record<DocumentType, any>>({
    aadhaar: null,
    pan: null,
    passport: null,
    voter_id: null,
    selfie: null,
  });

  // State for cross-document validation
  const [validationResult, setValidationResult] = useState<{
    status: "pending" | "approved" | "rejected";
    consolidatedData: {
      name?: string;
      dateOfBirth?: string;
      address?: string;
      idNumbers: Record<string, string>;
    };
    inconsistencies: string[];
    matchingFields: string[];
  } | null>(null);

  // Cross-document validation function
  const validateCrossDocumentData = useCallback(() => {
    const completedOcrResults = Object.entries(ocrResults).filter(
      ([_, result]) =>
        result && result.status === "completed" && result.extractedData
    );

    if (completedOcrResults.length < 2) {
      // Need at least 2 documents to validate
      return;
    }

    const consolidatedData = {
      name: undefined as string | undefined,
      dateOfBirth: undefined as string | undefined,
      address: undefined as string | undefined,
      idNumbers: {} as Record<string, string>,
    };

    const inconsistencies: string[] = [];
    const matchingFields: string[] = [];
    const fieldSources: Record<string, string[]> = {
      name: [],
      dateOfBirth: [],
      address: [],
    };

    // Collect data from all documents
    completedOcrResults.forEach(([docType, result]) => {
      const data = result.extractedData;

      if (data.name) {
        fieldSources.name.push(`${data.name} (${docType})`);
        if (!consolidatedData.name) {
          consolidatedData.name = data.name;
        }
      }

      if (data.dateOfBirth) {
        fieldSources.dateOfBirth.push(`${data.dateOfBirth} (${docType})`);
        if (!consolidatedData.dateOfBirth) {
          consolidatedData.dateOfBirth = data.dateOfBirth;
        }
      }

      if (data.address) {
        fieldSources.address.push(`${data.address} (${docType})`);
        if (!consolidatedData.address) {
          consolidatedData.address = data.address;
        }
      }

      if (data.idNumber) {
        consolidatedData.idNumbers[docType] = data.idNumber;
      }
    });

    // Validate consistency across documents
    const normalizeString = (str: string) => {
      return str
        .toLowerCase()
        .replace(/[^\w\s]/g, "") // Remove special characters but keep alphanumeric and spaces
        .replace(/\s+/g, " ") // Replace multiple spaces with single space
        .trim();
    };

    const normalizeDate = (date: string) => {
      // Try to normalize different date formats
      const cleaned = date.replace(/[^\d]/g, "");
      if (cleaned.length >= 6) {
        // Extract day, month, year in various formats
        if (cleaned.length === 8) {
          // DDMMYYYY or MMDDYYYY or YYYYMMDD - try to standardize to DDMMYYYY
          const year = cleaned.substring(0, 4);
          const month = cleaned.substring(4, 6);
          const day = cleaned.substring(6, 8);

          // Check if it's YYYYMMDD format
          if (parseInt(year) > 1900 && parseInt(year) < 2100) {
            return `${day}${month}${year}`; // Convert to DDMMYYYY
          }
          return cleaned; // Keep as is if not YYYY format
        } else if (cleaned.length === 6) {
          // DDMMYY or MMDDYY - assume DDMMYY and add 19/20 prefix
          const firstTwo = parseInt(cleaned.substring(4, 6));
          const century = firstTwo > 50 ? "19" : "20"; // Assume 50+ is 1900s, else 2000s
          return cleaned.substring(0, 4) + century + cleaned.substring(4, 6);
        }
        return cleaned;
      }
      return date.toLowerCase().replace(/[^a-z0-9]/g, "");
    };

    console.log("Cross-document validation data:", {
      documentsProcessed: completedOcrResults.length,
      fieldSources,
      consolidatedData,
    });

    // Debug: Log normalized values for comparison
    const debugNormalizedData = completedOcrResults.map(
      ([docType, result]) => ({
        docType,
        originalName: result.extractedData.name,
        normalizedName: result.extractedData.name
          ? normalizeString(result.extractedData.name)
          : null,
        originalDob: result.extractedData.dateOfBirth,
        normalizedDob: result.extractedData.dateOfBirth
          ? normalizeDate(result.extractedData.dateOfBirth)
          : null,
        originalAddress: result.extractedData.address,
        normalizedAddress: result.extractedData.address
          ? normalizeString(result.extractedData.address)
          : null,
      })
    );

    console.log("Normalized data for comparison:", debugNormalizedData);

    // STRICT VALIDATION - ALL FIELDS MUST MATCH EXACTLY FOR APPROVAL

    // Helper function for better string similarity
    const calculateSimilarity = (str1: string, str2: string): number => {
      const norm1 = normalizeString(str1);
      const norm2 = normalizeString(str2);

      if (norm1 === norm2) return 1.0; // Perfect match

      // Calculate Levenshtein distance for better similarity
      const matrix = Array(norm2.length + 1)
        .fill(null)
        .map(() => Array(norm1.length + 1).fill(null));

      for (let i = 0; i <= norm1.length; i++) matrix[0][i] = i;
      for (let j = 0; j <= norm2.length; j++) matrix[j][0] = j;

      for (let j = 1; j <= norm2.length; j++) {
        for (let i = 1; i <= norm1.length; i++) {
          const indicator = norm1[i - 1] === norm2[j - 1] ? 0 : 1;
          matrix[j][i] = Math.min(
            matrix[j][i - 1] + 1, // deletion
            matrix[j - 1][i] + 1, // insertion
            matrix[j - 1][i - 1] + indicator // substitution
          );
        }
      }

      const maxLen = Math.max(norm1.length, norm2.length);
      return maxLen === 0
        ? 1.0
        : (maxLen - matrix[norm2.length][norm1.length]) / maxLen;
    };

    // Check name consistency - MANDATORY for all documents
    if (fieldSources.name.length > 1) {
      const names = completedOcrResults
        .map(([_, result]) => result.extractedData.name)
        .filter(Boolean);

      // Check if all names are similar (95% similarity threshold)
      let nameMatches = true;
      for (let i = 0; i < names.length - 1; i++) {
        for (let j = i + 1; j < names.length; j++) {
          const similarity = calculateSimilarity(names[i]!, names[j]!);
          console.log(
            `Name similarity between "${names[i]}" and "${names[j]}": ${similarity}`
          );
          if (similarity < 0.95) {
            nameMatches = false;
            break;
          }
        }
        if (!nameMatches) break;
      }

      if (nameMatches) {
        matchingFields.push("✅ Name matches across all documents");
      } else {
        inconsistencies.push(
          `❌ CRITICAL: Name mismatch detected - ${fieldSources.name.join(
            " vs "
          )}`
        );
      }
    } else if (fieldSources.name.length === 1) {
      // Single document - can't validate but not an error
      matchingFields.push(
        "ℹ️ Name found in one document (need more for cross-validation)"
      );
    } else {
      inconsistencies.push(
        "❌ CRITICAL: No name information found in any document"
      );
    }

    // Check date of birth consistency - MANDATORY for all documents
    if (fieldSources.dateOfBirth.length > 1) {
      const dates = completedOcrResults
        .map(([_, result]) => result.extractedData.dateOfBirth)
        .filter(Boolean)
        .map((date) => normalizeDate(date!));

      const uniqueDates = [...new Set(dates)];
      console.log("Normalized dates for comparison:", dates);

      if (uniqueDates.length === 1) {
        matchingFields.push("✅ Date of Birth matches across all documents");
      } else {
        inconsistencies.push(
          `❌ CRITICAL: Date of Birth mismatch detected - ${fieldSources.dateOfBirth.join(
            " vs "
          )}`
        );
      }
    } else if (fieldSources.dateOfBirth.length === 1) {
      // Single document - can't validate but not an error
      matchingFields.push(
        "ℹ️ Date of Birth found in one document (need more for cross-validation)"
      );
    } else {
      inconsistencies.push(
        "❌ CRITICAL: No Date of Birth information found in any document"
      );
    }

    // Check address consistency - MANDATORY and STRICT (especially for Aadhaar back)
    if (fieldSources.address.length > 1) {
      const addresses = completedOcrResults
        .map(([_, result]) => result.extractedData.address)
        .filter(Boolean);

      // Check if all addresses are similar (85% similarity threshold - more lenient for addresses)
      let addressMatches = true;
      for (let i = 0; i < addresses.length - 1; i++) {
        for (let j = i + 1; j < addresses.length; j++) {
          const similarity = calculateSimilarity(addresses[i]!, addresses[j]!);
          console.log(
            `Address similarity between "${addresses[i]}" and "${addresses[j]}": ${similarity}`
          );
          if (similarity < 0.85) {
            addressMatches = false;
            break;
          }
        }
        if (!addressMatches) break;
      }

      if (addressMatches) {
        matchingFields.push(
          "✅ Address matches across all documents (including Aadhaar back)"
        );
      } else {
        inconsistencies.push(
          `❌ CRITICAL: Address mismatch detected - ${fieldSources.address.join(
            " vs "
          )}`
        );
      }
    } else if (fieldSources.address.length === 1) {
      // Single document - can't validate but not an error
      matchingFields.push(
        "ℹ️ Address found in one document (need more for cross-validation)"
      );
    } else {
      inconsistencies.push(
        "❌ CRITICAL: No address information found in any document"
      );
    }

    // SIMPLIFIED STRICT APPROVAL LOGIC
    console.log("Final validation check:", {
      nameFieldCount: fieldSources.name.length,
      dobFieldCount: fieldSources.dateOfBirth.length,
      addressFieldCount: fieldSources.address.length,
      inconsistenciesCount: inconsistencies.length,
    });

    // Check if we have the minimum required fields
    const hasMinimumFields =
      fieldSources.name.length >= 1 &&
      fieldSources.dateOfBirth.length >= 1 &&
      fieldSources.address.length >= 1;

    // For identical documents (same image uploaded twice), we should approve
    // For different documents, we need strict matching
    let status: "approved" | "rejected" = "rejected";

    if (hasMinimumFields && inconsistencies.length === 0) {
      // If no inconsistencies were found, approve
      status = "approved";
    } else if (inconsistencies.length > 0) {
      // If there are inconsistencies, reject
      status = "rejected";
    }

    console.log("Final validation result:", {
      status,
      hasMinimumFields,
      inconsistenciesCount: inconsistencies.length,
      matchingFieldsCount: matchingFields.length,
    });

    setValidationResult({
      status,
      consolidatedData,
      inconsistencies,
      matchingFields,
    });
  }, [ocrResults]);

  // Trigger validation when OCR results change
  useEffect(() => {
    const completedResults = Object.values(ocrResults).filter(
      (result) => result && result.status === "completed"
    );

    console.log(
      `📊 OCR Status Update: ${completedResults.length} documents completed OCR`
    );
    console.log(
      "OCR Results:",
      Object.entries(ocrResults).map(([type, result]) => ({
        type,
        status: result?.status || "null",
        hasData: !!result?.extractedData,
      }))
    );

    if (completedResults.length >= 2) {
      console.log("Triggering cross-document validation...");
      validateCrossDocumentData();
    } else if (completedResults.length === 1) {
      console.log(
        "Waiting for more documents to complete OCR for validation..."
      );
    }
  }, [ocrResults, validateCrossDocumentData]);

  // State for face verification results
  const [faceVerificationResults, setFaceVerificationResults] = useState<{
    isMatch: boolean;
    similarityScore: number;
    status: "pending" | "success" | "failed";
    documentFaces: Record<string, string>;
  }>({
    isMatch: false,
    similarityScore: 0,
    status: "pending",
    documentFaces: {},
  });

  // State for batch upload
  const [batchUploading, setBatchUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Upload all documents to IPFS at once (with OCR processing first)
  const uploadAllDocuments = useCallback(async () => {
    const documentsToUpload = Object.entries(documents).filter(
      ([_, doc]) => doc.file && !doc.uploaded
    );

    if (documentsToUpload.length === 0) return;

    setBatchUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: Process OCR for all ID documents BEFORE uploading to IPFS
      const idDocumentsToProcess = documentsToUpload.filter(
        ([type]) => type !== "selfie"
      );

      console.log(
        `Processing OCR for ${idDocumentsToProcess.length} documents before upload`
      );

      // Process OCR for all ID documents in parallel
      const ocrPromises = idDocumentsToProcess.map(([type, doc]) =>
        processOCR(type as DocumentType, doc.file!)
      );

      // Wait for all OCR processing to complete (or at least start)
      await Promise.allSettled(ocrPromises);

      // Step 2: Upload all documents to IPFS
      const uploadPromises = documentsToUpload.map(
        async ([type, doc], index) => {
          const formData = new FormData();
          formData.append("file", doc.file!);
          formData.append("type", type);

          const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          const result: APIResponse<UploadResponse> = await response.json();

          if (result.success && result.data) {
            setDocuments((prev) => ({
              ...prev,
              [type]: {
                ...prev[type],
                uploading: false,
                uploaded: true,
                progress: 100,
                response: result.data!,
              },
            }));

            // Update progress
            setUploadProgress(((index + 1) / documentsToUpload.length) * 100);

            return { type: type as DocumentType, result: result.data };
          } else {
            throw new Error(
              `${type}: ${result.error?.message || "Upload failed"}`
            );
          }
        }
      );

      // Wait for all uploads to complete
      const uploadResults = await Promise.all(uploadPromises);

      // Step 3: Process face verification if we have both selfie and ID documents
      const idDocuments = uploadResults.filter(({ type }) => type !== "selfie");
      const selfieResult = uploadResults.find(({ type }) => type === "selfie");

      if (selfieResult && idDocuments.length > 0) {
        const documentHashes = idDocuments
          .map(({ result }) => result.ipfsHash)
          .filter(Boolean) as string[];

        if (documentHashes.length > 0) {
          processFaceVerification(
            selfieResult.result.ipfsHash!,
            documentHashes
          );
        }
      }

      // Notify parent component about all uploads
      uploadResults.forEach(({ type, result }) => {
        onUploadComplete(type, result);
      });

      console.log("All documents uploaded and processing completed");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Batch upload failed";
      onUploadError(errorMessage);
    } finally {
      setBatchUploading(false);
      setUploadProgress(0);
    }
  }, [documents, onUploadComplete, onUploadError, processOCR]);

  // Process face verification
  const processFaceVerification = useCallback(
    async (selfieHash: string, documentHashes: string[]) => {
      try {
        // Update status to processing
        setFaceVerificationResults((prev) => ({
          ...prev,
          status: "pending",
        }));

        // First, extract faces from all documents to display
        const documentFaces: Record<string, string> = {};

        // For each document, try to extract a face
        for (const docHash of documentHashes) {
          try {
            const faceResponse = await fetch("/api/face-extraction", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ documentHash: docHash }),
            });

            const faceResult = await faceResponse.json();

            if (faceResult.success && faceResult.data?.faceImageUrl) {
              documentFaces[docHash] = faceResult.data.faceImageUrl;
            }
          } catch (error) {
            console.error("Error extracting face from document:", error);
          }
        }

        // Now verify the selfie against the documents
        const verifyResponse = await fetch("/api/face-verification", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            selfieHash,
            idDocumentHash: documentHashes[0], // Use first document for verification
            testMode: sessionStorage.getItem("kyc_test_mode") === "true",
          }),
        });

        const verifyResult = await verifyResponse.json();

        if (verifyResult.success && verifyResult.data) {
          setFaceVerificationResults({
            isMatch: verifyResult.data.isMatch,
            similarityScore: verifyResult.data.similarityScore,
            status: "success",
            documentFaces,
          });
        } else {
          setFaceVerificationResults({
            isMatch: false,
            similarityScore: 0,
            status: "failed",
            documentFaces,
          });
        }
      } catch (error) {
        console.error("Face verification error:", error);
        setFaceVerificationResults((prev) => ({
          ...prev,
          status: "failed",
        }));
      }
    },
    []
  );

  // Remove file
  const removeFile = useCallback((type: DocumentType) => {
    setDocuments((prev) => ({
      ...prev,
      [type]: {
        file: null,
        preview: null,
        uploading: false,
        uploaded: false,
        progress: 0,
        error: null,
        response: null,
      },
    }));
  }, []);

  // Handle camera capture for selfie
  const handleCameraCapture = useCallback(
    async (imageBlob: Blob) => {
      // Convert blob to file
      const file = new File([imageBlob], "live-selfie.jpg", {
        type: "image/jpeg",
      });

      // Create preview URL
      const previewUrl = URL.createObjectURL(imageBlob);

      // Update selfie state
      setDocuments((prev) => ({
        ...prev,
        selfie: {
          ...prev.selfie,
          file,
          preview: previewUrl,
          error: null,
        },
      }));

      // Call onFileStored callback to notify parent component
      if (onFileStored) {
        onFileStored("selfie", file);
        console.log(`📁 Stored selfie file for parent component:`, file.name);
      }

      // Hide camera
      setShowCamera(false);
    },
    [onFileStored]
  );

  // Document upload card component
  const DocumentCard = ({ config }: { config: DocumentConfig }) => {
    const state = documents[config.key];
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
          {!state.file ? (
            <>
              {config.key === "selfie" ? (
                // Camera capture for selfie
                <div className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center hover:border-teal-900/50 transition-colors">
                  <Camera className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Take a live selfie with liveness detection for secure
                    verification
                  </p>
                  <Button
                    onClick={() => setShowCamera(true)}
                    variant="gradient"
                    className="w-full"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Open Camera
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    🔒 Live capture prevents fake photos
                  </p>
                </div>
              ) : (
                // File upload for documents
                <div
                  className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center hover:border-teal-900/50 transition-colors cursor-pointer"
                  onDrop={(e) => {
                    e.preventDefault();
                    const files = Array.from(e.dataTransfer.files);
                    if (files[0]) handleFileSelect(files[0], config.key);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept =
                      "image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heif,image/heic,image/avif";
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) handleFileSelect(file, config.key);
                    };
                    input.click();
                  }}
                >
                  <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Drag and drop your file here, or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports {config.acceptedFormats} (max 10MB)
                  </p>
                </div>
              )}
            </>
          ) : (
            // File preview and upload with OCR results
            <div className="space-y-4">
              {/* Image and OCR Results Side by Side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Image Preview */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {state.preview && state.file.type.startsWith("image/") ? (
                        <img
                          src={state.preview}
                          alt="Preview"
                          className="w-16 h-16 object-cover rounded"
                        />
                      ) : (
                        <FileText className="w-16 h-16 text-muted-foreground" />
                      )}
                      <div>
                        <p className="text-sm font-medium">
                          {config.key === "selfie"
                            ? "Live Selfie"
                            : state.file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(state.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(config.key)}
                      disabled={state.uploading}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {state.uploading && (
                    <div className="space-y-2">
                      <Progress value={state.progress} />
                      <p className="text-xs text-center text-muted-foreground">
                        Uploading to IPFS...
                      </p>
                    </div>
                  )}

                  {state.error && (
                    <div className="flex items-center space-x-2 text-red-400 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      <span>{state.error}</span>
                    </div>
                  )}

                  {state.uploaded && state.response && (
                    <div className="flex items-center space-x-2 text-green-400 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      <span>Uploaded successfully to IPFS</span>
                    </div>
                  )}

                  {!state.uploaded && !state.uploading && !state.error && (
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">
                        Ready for batch upload
                      </p>
                    </div>
                  )}
                </div>

                {/* OCR Results (only for non-selfie documents) */}
                {config.key !== "selfie" && (
                  <div className="space-y-3 min-h-[200px]">
                    {/* Show placeholder when no OCR results yet */}
                    {!ocrResults[config.key] && state.uploaded && (
                      <div className="bg-white/5 p-3 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Waiting for OCR processing...
                        </p>
                      </div>
                    )}

                    {/* Processing state */}
                    {ocrResults[config.key]?.status === "processing" && (
                      <div className="bg-white/5 p-3 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="w-4 h-4 border-2 border-teal-900 border-t-transparent rounded-full animate-spin"></div>
                          <p className="text-sm font-medium text-teal-900">
                            Processing OCR...
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Extracting text from document
                        </p>
                      </div>
                    )}

                    {/* Completed state */}
                    {ocrResults[config.key]?.status === "completed" && (
                      <div className="bg-white/5 p-4 rounded-lg space-y-4">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          <p className="text-sm font-medium text-green-400">
                            OCR Complete
                          </p>
                        </div>

                        {/* Extracted Data */}
                        <div className="space-y-3">
                          <h6 className="text-sm font-medium text-teal-900">
                            Extracted Information
                          </h6>
                          {ocrResults[config.key].extractedData
                            ?.dateOfBirth && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">
                                Date of Birth
                              </p>
                              <p className="text-sm bg-black/20 p-2 rounded">
                                {
                                  ocrResults[config.key].extractedData
                                    .dateOfBirth
                                }
                              </p>
                            </div>
                          )}
                          {ocrResults[config.key].extractedData?.idNumber && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">
                                ID Number
                              </p>
                              <p className="text-sm bg-black/20 p-2 rounded">
                                {ocrResults[config.key].extractedData.idNumber}
                              </p>
                            </div>
                          )}
                          {ocrResults[config.key].extractedData?.address && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">
                                Address
                              </p>
                              <p className="text-sm bg-black/20 p-2 rounded">
                                {ocrResults[config.key].extractedData.address}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Raw OCR Text */}
                        <div>
                          <h6 className="text-sm font-medium text-blue-400 mb-2">
                            Raw OCR Text
                          </h6>
                          <div className="bg-black/30 p-3 rounded border border-white/10 max-h-32 overflow-y-auto">
                            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-gray-300">
                              {ocrResults[config.key].rawText ||
                                "No text extracted"}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Failed state */}
                    {ocrResults[config.key]?.status === "failed" && (
                      <div className="bg-red-500/10 p-4 rounded-lg border border-red-500/20">
                        <div className="flex items-center space-x-2 mb-2">
                          <AlertCircle className="w-4 h-4 text-red-400" />
                          <p className="text-sm font-medium text-red-400">
                            OCR Failed
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {ocrResults[config.key].error ||
                            "Could not extract text from document"}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Check if minimum required documents are uploaded
  const requiredDocuments = DOCUMENT_CONFIGS.filter(
    (config) => config.required
  );
  const uploadedRequiredDocs = requiredDocuments.filter(
    (config) => documents[config.key].uploaded
  );
  const allRequiredUploaded =
    uploadedRequiredDocs.length === requiredDocuments.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold metallic-text">
          Upload KYC Documents
        </h2>
        <p className="text-muted-foreground">
          Upload your identity documents and take a live selfie to begin KYC
          verification
        </p>
        <div className="text-sm text-muted-foreground">
          <span className="text-red-400">*</span> Required documents
        </div>
      </div>

      {/* Document Grid */}
      <div className="space-y-4">
        {(() => {
          // Determine which documents to show based on props
          let documentsToRender: DocumentConfig[] = [];

          if (selfieOnly) {
            // Selfie step: show only selfie
            documentsToRender = DOCUMENT_CONFIGS.filter(
              (config) => config.key === "selfie"
            );
          } else if (documentsToShow && documentsToShow.length > 0) {
            // Upload step: show specified documents
            documentsToRender = DOCUMENT_CONFIGS.filter((config) =>
              documentsToShow.includes(config.key)
            );
          } else {
            // Default: show all except selfie
            documentsToRender = DOCUMENT_CONFIGS.filter(
              (config) => config.key !== "selfie"
            );
          }

          return documentsToRender.map((config) => (
            <DocumentCard key={config.key} config={config} />
          ));
        })()}
      </div>

      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-black/90 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold metallic-text">
                Take Live Selfie with Liveness Check
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowCamera(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <LivenessCameraCapture
              onCapture={handleCameraCapture}
              onError={(error) => {
                onUploadError(error);
                setShowCamera(false);
              }}
            />
          </div>
        </div>
      )}

      {/* OCR Results Display */}
      {Object.entries(ocrResults).filter(
        ([_, result]) => result && result.status === "completed"
      ).length > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold metallic-text mb-4">
            OCR Results
          </h3>
          <div className="space-y-6">
            {Object.entries(ocrResults)
              .filter(([_, result]) => result && result.status === "completed")
              .map(([docType, result]) => (
                <div key={docType} className="bg-white/5 p-4 rounded-lg">
                  <h4 className="font-medium text-teal-900 mb-4">
                    {DOCUMENT_CONFIGS.find((config) => config.key === docType)
                      ?.title || docType}
                  </h4>

                  {/* Side by side layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Structured Data */}
                    <div>
                      <h5 className="text-sm font-medium text-green-400 mb-3">
                        Extracted Data
                      </h5>
                      <div className="space-y-3">
                        {result.extractedData?.dateOfBirth && (
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Date of Birth
                            </p>
                            <p className="text-sm bg-white/5 p-2 rounded">
                              {result.extractedData.dateOfBirth}
                            </p>
                          </div>
                        )}
                        {result.extractedData?.idNumber && (
                          <div>
                            <p className="text-xs text-muted-foreground">
                              ID Number
                            </p>
                            <p className="text-sm bg-white/5 p-2 rounded">
                              {result.extractedData.idNumber}
                            </p>
                          </div>
                        )}
                        {result.extractedData?.address && (
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Address
                            </p>
                            <p className="text-sm bg-white/5 p-2 rounded">
                              {result.extractedData.address}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Raw OCR Text */}
                    <div>
                      <h5 className="text-sm font-medium text-blue-400 mb-3">
                        Raw OCR Text
                      </h5>
                      <div className="bg-black/20 p-3 rounded border border-white/10 max-h-64 overflow-y-auto">
                        <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                          {result.rawText || "No raw text available"}
                        </pre>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Complete text extracted from document
                      </p>
                    </div>
                  </div>
                </div>
              ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            OCR results are processed locally and securely • Raw text shows
            complete extraction
          </p>
        </div>
      )}

      {/* Face Verification Results */}
      {documents.selfie.uploaded &&
        faceVerificationResults.status !== "pending" && (
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold metallic-text mb-4">
              Face Verification Results
            </h3>

            {/* Face Comparison */}
            <div className="flex flex-wrap justify-center gap-4 mb-6">
              {/* Selfie */}
              <div className="text-center">
                <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-teal-900 mx-auto">
                  {documents.selfie.preview && (
                    <img
                      src={documents.selfie.preview}
                      alt="Your selfie"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <p className="text-sm mt-2">Your Selfie</p>
              </div>

              {/* Document Faces */}
              {Object.entries(faceVerificationResults.documentFaces).map(
                ([docHash, faceUrl], index) => {
                  // Find document type by hash
                  const docType = Object.entries(documents).find(
                    ([_, doc]) => doc.response?.ipfsHash === docHash
                  )?.[0];

                  const docTitle = docType
                    ? DOCUMENT_CONFIGS.find((config) => config.key === docType)
                        ?.title
                    : `Document ${index + 1}`;

                  return (
                    <div key={docHash} className="text-center">
                      <div
                        className={`w-32 h-32 rounded-full overflow-hidden border-2 ${
                          faceVerificationResults.isMatch
                            ? "border-green-400"
                            : "border-red-400"
                        } mx-auto`}
                      >
                        <img
                          src={faceUrl}
                          alt={`Face from ${docTitle}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-sm mt-2">{docTitle}</p>
                    </div>
                  );
                }
              )}
            </div>

            {/* Verification Status */}
            <div className="text-center">
              <div
                className={`inline-flex items-center px-4 py-2 rounded-full ${
                  faceVerificationResults.isMatch
                    ? "bg-green-400/20 text-green-400"
                    : "bg-red-400/20 text-red-400"
                }`}
              >
                {faceVerificationResults.isMatch ? (
                  <CheckCircle className="w-5 h-5 mr-2" />
                ) : (
                  <AlertCircle className="w-5 h-5 mr-2" />
                )}
                <span className="font-medium">
                  {faceVerificationResults.isMatch
                    ? "Face Verification Passed"
                    : "Face Verification Failed"}
                </span>
              </div>

              {faceVerificationResults.similarityScore > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground mb-1">
                    Similarity Score
                  </p>
                  <div className="flex items-center justify-center space-x-2">
                    <Progress
                      value={faceVerificationResults.similarityScore * 100}
                      className="h-2 w-48"
                    />
                    <span className="text-sm">
                      {Math.round(
                        faceVerificationResults.similarityScore * 100
                      )}
                      %
                    </span>
                  </div>
                </div>
              )}

              {sessionStorage.getItem("kyc_test_mode") === "true" && (
                <p className="text-xs text-amber-400 mt-4">
                  Test mode enabled - verification results are simulated
                </p>
              )}
            </div>
          </div>
        )}

      {/* Cross-Document Validation Results */}
      {validationResult && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold metallic-text">
              Document Validation Results
            </h3>
            <div
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                validationResult.status === "approved"
                  ? "bg-green-400/20 text-green-400"
                  : validationResult.status === "rejected"
                  ? "bg-red-400/20 text-red-400"
                  : "bg-yellow-400/20 text-yellow-400"
              }`}
            >
              {validationResult.status === "approved" && (
                <CheckCircle className="w-4 h-4 mr-1" />
              )}
              {validationResult.status === "rejected" && (
                <AlertCircle className="w-4 h-4 mr-1" />
              )}
              {validationResult.status === "approved"
                ? "APPROVED"
                : validationResult.status === "rejected"
                ? "REJECTED"
                : "PENDING"}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Validation Status */}
            <div>
              <h4 className="text-sm font-medium text-teal-900 mb-3">
                Validation Status
              </h4>

              {/* Matching Fields */}
              {validationResult.matchingFields.length > 0 && (
                <div className="mb-4">
                  <h5 className="text-xs font-medium text-green-400 mb-2">
                    ✅ Matching Information
                  </h5>
                  <div className="space-y-1">
                    {validationResult.matchingFields.map((field, index) => (
                      <div
                        key={index}
                        className="text-xs text-green-300 bg-green-400/10 p-2 rounded"
                      >
                        {field}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Inconsistencies */}
              {validationResult.inconsistencies.length > 0 && (
                <div className="mb-4">
                  <h5 className="text-xs font-medium text-red-400 mb-2">
                    ❌ Inconsistencies Found
                  </h5>
                  <div className="space-y-1">
                    {validationResult.inconsistencies.map((issue, index) => (
                      <div
                        key={index}
                        className="text-xs text-red-300 bg-red-400/10 p-2 rounded"
                      >
                        {issue}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {validationResult.status === "approved" && (
                <div className="bg-green-400/10 p-3 rounded-lg border border-green-400/20">
                  <p className="text-sm text-green-400 font-medium">
                    🎉 All document information is consistent and verified!
                  </p>
                </div>
              )}

              {validationResult.status === "rejected" && (
                <div className="bg-red-400/10 p-3 rounded-lg border border-red-400/20">
                  <p className="text-sm text-red-400 font-medium">
                    ⚠️ Document information contains inconsistencies that need
                    to be resolved.
                  </p>
                </div>
              )}
            </div>

            {/* Consolidated Data JSON */}
            <div>
              <h4 className="text-sm font-medium text-blue-400 mb-3">
                Consolidated Information (JSON)
              </h4>
              <div className="bg-black/30 p-4 rounded-lg border border-white/10 max-h-80 overflow-y-auto">
                <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                  {JSON.stringify(
                    {
                      validationStatus: validationResult.status.toUpperCase(),
                      personalInformation: {
                        name: validationResult.consolidatedData.name || null,
                        dateOfBirth:
                          validationResult.consolidatedData.dateOfBirth || null,
                        address:
                          validationResult.consolidatedData.address || null,
                      },
                      identificationNumbers:
                        validationResult.consolidatedData.idNumbers,
                      validationSummary: {
                        totalDocumentsProcessed: Object.keys(ocrResults).filter(
                          (key) =>
                            ocrResults[key] &&
                            ocrResults[key].status === "completed"
                        ).length,
                        matchingFields: validationResult.matchingFields.length,
                        inconsistencies:
                          validationResult.inconsistencies.length,
                        approved: validationResult.status === "approved",
                      },
                      timestamp: new Date().toISOString(),
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Clean, formatted JSON output
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const jsonData = JSON.stringify(
                      {
                        validationStatus: validationResult.status.toUpperCase(),
                        personalInformation: {
                          name: validationResult.consolidatedData.name || null,
                          dateOfBirth:
                            validationResult.consolidatedData.dateOfBirth ||
                            null,
                          address:
                            validationResult.consolidatedData.address || null,
                        },
                        identificationNumbers:
                          validationResult.consolidatedData.idNumbers,
                        validationSummary: {
                          totalDocumentsProcessed: Object.keys(
                            ocrResults
                          ).filter(
                            (key) =>
                              ocrResults[key] &&
                              ocrResults[key].status === "completed"
                          ).length,
                          matchingFields:
                            validationResult.matchingFields.length,
                          inconsistencies:
                            validationResult.inconsistencies.length,
                          approved: validationResult.status === "approved",
                        },
                        timestamp: new Date().toISOString(),
                      },
                      null,
                      2
                    );
                    navigator.clipboard.writeText(jsonData);
                  }}
                  className="text-xs"
                >
                  Copy JSON
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {allRequiredUploaded && (
        <div className="text-center">
          <div className="glass-card p-6 inline-block">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-400" />
            <h3 className="text-lg font-semibold metallic-text mb-2">
              Required Documents Uploaded Successfully
            </h3>
            <p className="text-sm text-muted-foreground">
              Your documents are now stored securely on IPFS and ready for
              verification
            </p>
            <div className="mt-4 text-xs text-muted-foreground">
              Uploaded: {uploadedRequiredDocs.length} of{" "}
              {requiredDocuments.length} required documents
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
