import { NextRequest, NextResponse } from "next/server";
import { APIResponse, OCRResult } from "@/types";
import { OCRService } from "@/lib/ocr";

export async function POST(request: NextRequest) {
  console.log("🚀 OCR API called");

  try {
    // Parse the form data to get the uploaded file
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string;

    console.log("📋 Form data parsed:", {
      hasFile: !!file,
      fileName: file?.name,
      fileType: file?.type,
      fileSize: file?.size,
      documentType: type,
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
      `✅ Starting OCR processing for file: ${file.name}, type: ${file.type}, size: ${file.size}`
    );

    // Process OCR service directly
    console.log("🔄 Processing OCR service");

    const ocrService = OCRService.getInstance();
    const ocrResult = await ocrService.processFile(file);

    console.log(`📊 OCR processing result:`, {
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
          ? "OCR processing completed successfully"
          : "OCR processing completed with issues",
    });
  } catch (error) {
    console.error("💥 OCR API error:", error);
    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: "OCR_FAILED",
          message:
            error instanceof Error ? error.message : "OCR processing failed",
        },
      },
      { status: 500 }
    );
  }
}
