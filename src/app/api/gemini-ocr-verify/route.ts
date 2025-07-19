import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { APIResponse } from "@/types";

// Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

interface OCRData {
  name?: string;
  aadhaar_number?: string;
  [key: string]: any;
}

interface IPFSData {
  name?: string;
  aadhaar_number?: string;
  [key: string]: any;
}

export async function POST(request: NextRequest) {
  console.log("Gemini OCR Verification API called");

  try {
    const formData = await request.formData();
    const imageFile = formData.get("image") as File;
    const ipfsJsonUrl = formData.get("ipfsJsonUrl") as string;

    if (!imageFile) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: "OCR_FAILED",
            message: "Image file is required",
          },
        },
        { status: 400 }
      );
    }

    if (!ipfsJsonUrl) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: "VERIFICATION_FAILED",
            message: "IPFS JSON URL is required",
          },
        },
        { status: 400 }
      );
    }

    // Initialize Gemini
    if (!GEMINI_API_KEY) {
      throw new Error("Gemini API key not configured");
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Step 1: Extract text using OCR
    console.log("Running OCR with Gemini...");
    const imageBytes = await imageFile.arrayBuffer();
    const imageData = Buffer.from(imageBytes);

    const ocrResult = await model.generateContent([
      "Extract full name and Aadhaar number from this Aadhaar card. Return in JSON format with keys: name and aadhaar_number. Be precise and only return the JSON object.",
      {
        inlineData: {
          mimeType: imageFile.type,
          data: imageData.toString("base64"),
        },
      },
    ]);

    const ocrResponse = await ocrResult.response;
    const ocrText = ocrResponse.text();

    console.log("🤖 Gemini OCR Response:", ocrText);

    // Parse OCR JSON
    let ocrData: OCRData;
    try {
      // Try to find JSON in the response
      const jsonStart = ocrText.indexOf("{");
      const jsonEnd = ocrText.lastIndexOf("}") + 1;
      if (jsonStart === -1 || jsonEnd === 0) {
        throw new Error("No JSON found in response");
      }
      const jsonStr = ocrText.substring(jsonStart, jsonEnd);
      ocrData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("❌ Error parsing Gemini response:", parseError);
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: "OCR_FAILED",
            message: "Failed to parse OCR response as JSON",
          },
          data: { rawResponse: ocrText },
        },
        { status: 500 }
      );
    }

    console.log("✅ OCR Extracted Data:", ocrData);

    // Step 2: Load JSON from IPFS
    console.log("📦 Loading JSON from IPFS...");
    let ipfsResponse;
    try {
      ipfsResponse = await fetch(ipfsJsonUrl);
      if (!ipfsResponse.ok) {
        throw new Error(`IPFS fetch failed: ${ipfsResponse.status}`);
      }
    } catch (fetchError) {
      console.error("❌ Failed to load IPFS data:", fetchError);
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: "VERIFICATION_FAILED",
            message: "Failed to load reference data from IPFS",
          },
        },
        { status: 500 }
      );
    }

    const ipfsData: IPFSData[] = await ipfsResponse.json();
    console.log("✅ Reference Data from IPFS:", ipfsData);

    // Step 3: Compare data
    const comparisonResult = compareData(ocrData, ipfsData);

    if (comparisonResult.isMatch) {
      console.log("✅ MATCH: Data Verified!");

      return NextResponse.json<APIResponse>({
        success: true,
        data: {
          verified: true,
          ocrData,
          ipfsData: comparisonResult.matchedEntry, // Return the matched entry, not the array
          comparison_only: true,
        },
        message:
          "Data successfully verified against IPFS reference - comparison only",
      });
    } else {
      console.log("❌ MISMATCH: Data doesn't match reference.");

      return NextResponse.json<APIResponse>({
        success: false,
        data: {
          verified: false,
          ocrData,
          ipfsData,
          mismatchDetails: getMismatchDetails(ocrData, ipfsData),
        },
        error: {
          code: "VERIFICATION_FAILED",
          message: "OCR data does not match reference data from IPFS",
        },
      });
    }
  } catch (error) {
    console.error("💥 Gemini OCR Verification error:", error);

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: "VERIFICATION_FAILED",
          message: `OCR verification failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        },
      },
      { status: 500 }
    );
  }
}

function compareData(
  ocrData: OCRData,
  ipfsData: IPFSData[]
): { isMatch: boolean; matchedEntry?: IPFSData } {
  // Compare OCR data with each entry in IPFS data array
  for (const entry of ipfsData) {
    // Check name match (required)
    const nameMatch =
      ocrData.name?.toLowerCase().trim() === entry.name?.toLowerCase().trim();

    // Check Aadhaar number match (if present in IPFS data)
    const aadhaarMatch =
      !entry.aadhaar_number || ocrData.aadhaar_number === entry.aadhaar_number;

    if (nameMatch && aadhaarMatch) {
      return { isMatch: true, matchedEntry: entry };
    }
  }
  return { isMatch: false };
}

function getMismatchDetails(ocrData: OCRData, ipfsData: IPFSData[]): string[] {
  const mismatches: string[] = [];

  // Check if name exists in any IPFS entry
  const nameExists = ipfsData.some(
    (entry) =>
      entry.name?.toLowerCase().trim() === ocrData.name?.toLowerCase().trim()
  );

  if (!nameExists) {
    mismatches.push(`Name "${ocrData.name}" not found in reference data`);
  }

  // Check Aadhaar numbers
  const aadhaarExists = ipfsData.some(
    (entry) => entry.aadhaar_number === ocrData.aadhaar_number
  );

  if (ocrData.aadhaar_number && !aadhaarExists) {
    mismatches.push(
      `Aadhaar number "${ocrData.aadhaar_number}" not found in reference data`
    );
  }

  return mismatches;
}
