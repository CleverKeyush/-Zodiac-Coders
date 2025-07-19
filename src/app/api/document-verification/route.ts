import { NextRequest, NextResponse } from "next/server";
import { APIResponse } from "@/types";
import {
  GeminiDocumentVerificationService,
  DocumentData,
} from "@/lib/geminiDocumentVerification";

export async function POST(request: NextRequest) {
  console.log("🚀 Document Verification API called");

  try {
    const body = await request.json();
    const { documents, storedDataUrl, verificationType } = body;

    console.log("📋 Request data:", {
      documentsCount: documents?.length || 0,
      hasStoredDataUrl: !!storedDataUrl,
      verificationType,
    });

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: "VERIFICATION_FAILED",
            message: "At least one document is required for verification",
          },
        },
        { status: 400 }
      );
    }

    const verificationService = GeminiDocumentVerificationService.getInstance();

    switch (verificationType) {
      case "single":
        return await handleSingleDocumentVerification(
          verificationService,
          documents[0]
        );

      case "cross":
        return await handleCrossDocumentVerification(
          verificationService,
          documents
        );

      case "comprehensive":
        return await handleComprehensiveVerification(
          verificationService,
          documents
        );

      case "compare":
        if (!storedDataUrl) {
          return NextResponse.json<APIResponse>(
            {
              success: false,
              error: {
                code: "VERIFICATION_FAILED",
                message: "Stored data URL is required for comparison",
              },
            },
            { status: 400 }
          );
        }
        return await handleDataComparison(
          verificationService,
          documents[0],
          storedDataUrl
        );

      default:
        // Default to comprehensive verification
        return await handleComprehensiveVerification(
          verificationService,
          documents
        );
    }
  } catch (error) {
    console.error("💥 Document Verification API error:", error);
    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: "VERIFICATION_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "Document verification failed",
        },
      },
      { status: 500 }
    );
  }
}

async function handleSingleDocumentVerification(
  service: GeminiDocumentVerificationService,
  document: DocumentData
) {
  console.log("Processing single document verification...");

  const result = await service.verifySingleDocument(document);

  return NextResponse.json<APIResponse>({
    success: result.isConsistent,
    data: result,
    message: result.isConsistent
      ? "Document verification completed successfully"
      : "Document verification found inconsistencies",
  });
}

async function handleCrossDocumentVerification(
  service: GeminiDocumentVerificationService,
  documents: DocumentData[]
) {
  console.log(
    `Processing cross-document verification for ${documents.length} documents...`
  );

  if (documents.length < 2) {
    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: "VERIFICATION_FAILED",
          message: "At least 2 documents required for cross-verification",
        },
      },
      { status: 400 }
    );
  }

  const result = await service.crossVerifyDocuments(documents);

  return NextResponse.json<APIResponse>({
    success: result.overallConsistency,
    data: result,
    message: result.overallConsistency
      ? "Cross-document verification passed"
      : "Cross-document verification found inconsistencies",
  });
}

async function handleComprehensiveVerification(
  service: GeminiDocumentVerificationService,
  documents: DocumentData[]
) {
  console.log(
    `🚀 Processing comprehensive verification for ${documents.length} documents...`
  );

  try {
    const result = await service.comprehensiveDocumentVerification(documents);

    console.log("📊 Comprehensive verification result:", {
      approved: result.finalRecommendation.approved,
      confidence: result.finalRecommendation.confidence,
      reason: result.finalRecommendation.reason,
      individualResults: result.individualVerifications.map((v) => ({
        consistent: v.isConsistent,
        confidence: v.confidence,
        issues: v.inconsistencies,
      })),
      crossAnalysis: {
        consistent: result.crossDocumentAnalysis.overallConsistency,
        confidence: result.crossDocumentAnalysis.personIdentityConfidence,
        riskFactors: result.crossDocumentAnalysis.riskFactors,
      },
    });

    return NextResponse.json<APIResponse>({
      success: true,
      data: result,
      message: result.finalRecommendation.approved
        ? "Comprehensive verification passed"
        : result.finalRecommendation.reason,
    });
  } catch (error) {
    console.error("💥 Comprehensive verification error:", error);

    return NextResponse.json<APIResponse>(
      {
        success: false,
        data: null,
        error: {
          code: "VERIFICATION_FAILED",
          message: `Comprehensive verification failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        },
      },
      { status: 500 }
    );
  }
}

async function handleDataComparison(
  service: GeminiDocumentVerificationService,
  document: DocumentData,
  storedDataUrl: string
) {
  console.log("📦 Processing data comparison with stored reference...");

  const result = await service.compareWithStoredData(document, storedDataUrl);

  return NextResponse.json<APIResponse>({
    success: result.matches,
    data: result,
    message: result.matches
      ? "Document data matches stored reference"
      : "Document data does not match stored reference",
  });
}
