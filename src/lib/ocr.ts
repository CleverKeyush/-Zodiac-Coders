import { OCRResult } from "@/types";

// OCR Processing Service OCR via direct HTTP
export class OCRService {
  private static instance: OCRService;
  private mistralApiKey: string;

  constructor() {
    this.mistralApiKey = process.env.MISTRAL_API_KEY || "";
  }

  static getInstance(): OCRService {
    if (!OCRService.instance) {
      OCRService.instance = new OCRService();
    }
    return OCRService.instance;
  }

  // Convert file to base64 for API transmission (Node.js compatible)
  private async fileToBase64(file: File | Blob): Promise<string> {
    try {
      // Convert File/Blob to Buffer in Node.js environment
      const buffer = Buffer.from(await file.arrayBuffer());
      return buffer.toString("base64");
    } catch (error) {
      console.error("Failed to convert file to base64:", error);
      throw new Error("Failed to process file for OCR");
    }
  }

  // Use API directly for OCR
  private async extractTextWithMistralAPI(
    imageFile: File | Blob
  ): Promise<string> {
    if (!this.mistralApiKey) {
      throw new Error("API key not configured");
    }

    try {
      console.log("📤 Sending OCR request to API...");

      const base64Image = await this.fileToBase64(imageFile);

      const response = await fetch(
        "https://api.mistral.ai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.mistralApiKey}`,
          },
          body: JSON.stringify({
            model: "pixtral-12b-2409",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Extract all text from this document image. Return only the extracted text, without any additional commentary or formatting. Focus on getting the text exactly as it appears in the image.",
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:image/jpeg;base64,${base64Image}`,
                    },
                  },
                ],
              },
            ],
            max_tokens: 1000,
            temperature: 0.1,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error("Invalid response format from API");
      }

      const extractedText = data.choices[0].message.content.trim();
      console.log("✅ OCR completed successfully");

      return extractedText;
    } catch (error) {
      console.error("❌ API OCR failed:", error);
      throw error;
    }
  }

  // Extract text from image API only
  async extractText(imageFile: File | Blob): Promise<string> {
    console.log("🚀 Starting OCR text extraction with API");

    if (!this.mistralApiKey) {
      throw new Error("API key not configured");
    }

    try {
      console.log("🔄 Processing with API...");
      const result = await this.extractTextWithMistralAPI(imageFile);

      if (result && result.trim().length > 0) {
        console.log("✅ API succeeded");
        return result;
      } else {
        throw new Error("No text extracted from image");
      }
    } catch (error) {
      console.error("❌ API failed:", error);
      throw error;
    }
  }

  // Process identity document and extract structured data
  async processDocument(ipfsHash: string): Promise<OCRResult> {
    try {
      // Fetch the image from IPFS
      const imageUrl = `https://ipfs.io/ipfs/${ipfsHash}`;
      const response = await fetch(imageUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch image from IPFS: ${response.status}`);
      }

      const imageBlob = await response.blob();
      const extractedText = await this.extractText(imageBlob);

      // Extract structured data from text
      const extractedData = this.parseExtractedText(extractedText);

      // Calculate confidence based on how many fields were extracted
      const fieldsFound = Object.values(extractedData).filter(
        (value) => value && value.trim() !== ""
      ).length;
      const confidence = (fieldsFound / 4) * 100; // 4 expected fields

      return {
        extractedData,
        rawText: extractedText,
        confidence,
        status: confidence > 30 ? "success" : "failed",
        errors:
          confidence <= 30
            ? ["Insufficient data extracted from document"]
            : undefined,
      };
    } catch (error) {
      return {
        extractedData: {},
        rawText: "",
        confidence: 0,
        status: "failed",
        errors: [
          error instanceof Error ? error.message : "OCR processing failed",
        ],
      };
    }
  }

  // Process file directly using OCR
  async processFile(file: File): Promise<OCRResult> {
    console.log(`Starting OCR processFile for:`, {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    try {
      // Extract text using OCR
      console.log(`🤖 Calling extractText with file...`);
      const extractedText = await this.extractText(file);

      console.log(`📝 Extracted text length: ${extractedText.length}`);
      if (extractedText.length > 0) {
        console.log(
          `📄 Raw extracted text preview: "${extractedText.substring(
            0,
            200
          )}..."`
        );
      } else {
        console.log(`⚠️ No text extracted from image`);
      }

      // Extract structured data from text
      console.log(`🔧 Parsing extracted text for structured data...`);
      const extractedData = this.parseExtractedText(extractedText);
      console.log(`📊 Parsed extracted data:`, extractedData);

      // Calculate confidence based on how many fields were extracted and text quality
      const fieldsFound = Object.values(extractedData).filter(
        (value) => value && value.trim() !== ""
      ).length;
      const hasSignificantText = extractedText.length > 20;
      const confidence = hasSignificantText
        ? Math.max(30, (fieldsFound / 4) * 100)
        : 0;

      console.log(
        `📈 OCR Analysis: Fields found: ${fieldsFound}, Confidence: ${confidence}%`
      );

      const result: OCRResult = {
        extractedData,
        rawText: extractedText,
        confidence,
        status: hasSignificantText ? "success" : "failed",
        errors: !hasSignificantText
          ? ["No meaningful text extracted from document"]
          : undefined,
      };

      console.log(`✅ OCR processFile completed:`, {
        status: result.status,
        confidence: result.confidence,
        rawTextLength: result.rawText?.length || 0,
        hasErrors: !!result.errors,
      });

      return result;
    } catch (error) {
      console.error("💥 OCR processFile error:", error);
      return {
        extractedData: {},
        rawText: "",
        confidence: 0,
        status: "failed",
        errors: [
          error instanceof Error ? error.message : "OCR processing failed",
        ],
      };
    }
  }

  // Parse extracted text to find structured data
  private parseExtractedText(text: string): {
    name?: string;
    dateOfBirth?: string;
    idNumber?: string;
    address?: string;
  } {
    const result: any = {};

    // Clean up text
    const cleanText = text.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();

    // Extract name (look for common patterns)
    const namePatterns = [
      /Name[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      /Full Name[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      /([A-Z][A-Z\s]+[A-Z])/g, // All caps names
    ];

    for (const pattern of namePatterns) {
      const match = cleanText.match(pattern);
      if (match && match[1] && match[1].length > 2) {
        result.name = match[1].trim();
        break;
      }
    }

    // Extract date of birth
    const dobPatterns = [
      /(?:DOB|Date of Birth|Born)[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/g,
    ];

    for (const pattern of dobPatterns) {
      const match = cleanText.match(pattern);
      if (match && match[1]) {
        result.dateOfBirth = this.standardizeDateFormat(match[1]);
        break;
      }
    }

    // Extract ID number (PAN format: 5 letters + 4 digits + 1 letter)
    const idPatterns = [
      /([A-Z]{5}\d{4}[A-Z])/g,
      /(?:PAN|ID|Number)[:\s]+([A-Z0-9]+)/i,
      /([A-Z]{2,}\d{4,}[A-Z]?)/g,
    ];

    for (const pattern of idPatterns) {
      const matches = cleanText.match(pattern);
      if (matches) {
        for (const match of matches) {
          if (this.validatePANFormat(match)) {
            result.idNumber = match;
            break;
          }
        }
        if (result.idNumber) break;
      }
    }

    // Extract address (look for common address keywords)
    const addressPatterns = [
      /(?:Address|Addr)[:\s]+([^,]+(?:,\s*[^,]+)*)/i,
      /(\d+[^,\n]*(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln)[^,\n]*)/i,
    ];

    for (const pattern of addressPatterns) {
      const match = cleanText.match(pattern);
      if (match && match[1] && match[1].length > 10) {
        result.address = match[1].trim();
        break;
      }
    }

    return result;
  }

  // Validate PAN format (5 letters + 4 digits + 1 letter)
  private validatePANFormat(pan: string): boolean {
    const panRegex = /^[A-Z]{5}\d{4}[A-Z]$/;
    return panRegex.test(pan);
  }

  // Standardize date format to YYYY-MM-DD
  private standardizeDateFormat(dateStr: string): string {
    try {
      // Handle different date formats
      const cleanDate = dateStr.replace(/[^\d\/\-\.]/g, "");
      const parts = cleanDate.split(/[\/\-\.]/);

      if (parts.length === 3) {
        let [first, second, third] = parts;

        // Assume DD/MM/YYYY or MM/DD/YYYY format
        if (third.length === 2) {
          third = "20" + third; // Convert YY to YYYY
        }

        // If first part is 4 digits, it's YYYY-MM-DD
        if (first.length === 4) {
          return `${first}-${second.padStart(2, "0")}-${third.padStart(
            2,
            "0"
          )}`;
        }

        // Otherwise assume DD/MM/YYYY
        return `${third}-${second.padStart(2, "0")}-${first.padStart(2, "0")}`;
      }

      return dateStr;
    } catch {
      return dateStr;
    }
  }
}

// Default export for easy importing
export default OCRService;
