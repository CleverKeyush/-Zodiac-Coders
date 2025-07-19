import { NextRequest, NextResponse } from "next/server";
import { APIResponse, OCRResult } from "@/types";
import { OCRService } from "@/lib/ocr";
import { GeminiDocumentVerificationService } from "@/lib/geminiDocumentVerification";

export async function POST(request: NextRequest) {
  console.log("🚀 Enhanced OCR API called");

  try {
    // Parse the form data to get the uploaded file
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string;
    const useGemini = formData.get("useGemini") === "true";

    console.log("📋 Form data parsed:", {
      hasFile: !!file,
      fileName: file?.name,
      fileType: file?.type,
      fileSize: file?.size,
      documentType: type,
      useGemini,
    });

    if (!file) {
      console.log("❌ No file provided");
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: "OCR_FAILED",
            message: "File is required for OCR processing",
          },
        },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/jpg",
      "application/pdf",
    ];
    if (!allowedTypes.includes(file.type)) {
      console.log("❌ Invalid file type:", file.type);
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: "OCR_FAILED",
            message:
              "Invalid file type. Only JPEG, PNG, and PDF files are supported.",
          },
        },
        { status: 400 }
      );
    }

    console.log(
      `✅ Starting enhanced OCR processing for file: ${file.name}, type: ${file.type}, size: ${file.size}`
    );

    let ocrResult: OCRResult;

    if (useGemini && process.env.GEMINI_API_KEY) {
      console.log("Using AI for enhanced OCR processing...");
      ocrResult = await processWithGemini(file, type);
    } else {
      console.log("Using OCR service...");
      const ocrService = OCRService.getInstance();
      ocrResult = await ocrService.processFile(file);
    }

    // If Gemini is enabled and we have multiple processing methods, we can also compare results
    if (
      useGemini &&
      process.env.GEMINI_API_KEY &&
      process.env.MISTRAL_API_KEY
    ) {
      console.log("Cross-validating with dual OCR approach...");

      try {
        const ocrService = OCRService.getInstance();
        const mistralResult = await ocrService.processFile(file);

        // Compare results and use the one with higher confidence
        if (mistralResult.confidence > ocrResult.confidence) {
          console.log("AI Result has higher confidence");
          ocrResult = mistralResult;
        }

        // Add comparison metadata
        ocrResult.comparisonData = {
          geminiConfidence: ocrResult.confidence,
          mistralConfidence: mistralResult.confidence,
          usedGemini: ocrResult.confidence >= mistralResult.confidence,
        };
      } catch (error) {
        console.log("⚠️ Cross-validation failed, using primary result");
      }
    }

    console.log(`📊 Enhanced OCR processing result:`, {
      status: ocrResult.status,
      confidence: ocrResult.confidence,
      hasExtractedData: !!ocrResult.extractedData,
      rawTextLength: ocrResult.rawText?.length || 0,
      errors: ocrResult.errors,
    });

    return NextResponse.json<APIResponse<OCRResult>>({
      success: ocrResult.status === "success",
      data: ocrResult,
      message:
        ocrResult.status === "success"
          ? "Enhanced OCR processing completed successfully"
          : "OCR processing completed with issues",
    });
  } catch (error) {
    console.error("💥 Enhanced OCR API error:", error);
    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: "OCR_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "Enhanced OCR processing failed",
        },
      },
      { status: 500 }
    );
  }
}

async function processWithGemini(
  file: File,
  documentType: string
): Promise<OCRResult> {
  try {
    // Convert file to base64
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Image = buffer.toString("base64");

    const geminiService = GeminiDocumentVerificationService.getInstance();
    const documentData = await geminiService.extractDocumentData(
      base64Image,
      documentType
    );

    // Convert Gemini result to OCR result format
    const ocrResult: OCRResult = {
      extractedData: documentData.extractedData,
      rawText: documentData.rawText,
      confidence: calculateConfidence(documentData.extractedData),
      status: "success",
      geminiEnhanced: true,
    };

    return ocrResult;
  } catch (error) {
    console.error("Gemini OCR processing failed:", error);
    return {
      extractedData: {},
      rawText: "",
      confidence: 0,
      status: "failed",
      errors: [
        error instanceof Error ? error.message : "Gemini OCR processing failed",
      ],
      geminiEnhanced: false,
    };
  }
}

function calculateConfidence(extractedData: any): number {
  // Calculate confidence based on the quality and completeness of extracted data
  let score = 0;
  const fields = Object.values(extractedData).filter(
    (value) => value && String(value).trim() !== ""
  );

  // Base score for having any data
  if (fields.length > 0) score += 30;

  // Additional score for each meaningful field
  score += fields.length * 15;

  // Bonus for specific important fields
  if (extractedData.name && extractedData.name.length > 2) score += 10;
  if (
    extractedData.id_number ||
    extractedData.aadhaar_number ||
    extractedData.pan_number
  )
    score += 15;
  if (extractedData.date_of_birth) score += 10;

  return Math.min(score, 95); // Cap at 95% to leave room for manual verification
}
