import { GoogleGenerativeAI } from "@google/generative-ai";

export interface DocumentData {
  extractedData: Record<string, any>;
  rawText: string;
  documentType?: string;
  imageData?: string; // base64 encoded image
}

export interface DocumentVerificationResult {
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

export interface CrossDocumentAnalysis {
  documentsAnalyzed: number;
  overallConsistency: boolean;
  personIdentityConfidence: number;
  riskFactors: string[];
  verificationSummary: string;
  nameAnalysis?: {
    consistent: boolean;
    variations: string[];
    confidence: number;
  };
  dobAnalysis?: {
    consistent: boolean;
    dates: string[];
    confidence: number;
  };
  addressAnalysis?: {
    consistent: boolean;
    addresses: string[];
    confidence: number;
  };
  recommendedActions?: string[];
}

export class GeminiDocumentVerificationService {
  private static instance: GeminiDocumentVerificationService;
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey =
      process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key not configured");
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  }

  static getInstance(): GeminiDocumentVerificationService {
    if (!GeminiDocumentVerificationService.instance) {
      GeminiDocumentVerificationService.instance =
        new GeminiDocumentVerificationService();
    }
    return GeminiDocumentVerificationService.instance;
  }

  /**
   * Extract structured data from document image using Vision
   */
  async extractDocumentData(
    imageData: string,
    documentType: string
  ): Promise<DocumentData> {
    try {
      console.log(`Extracting data from ${documentType}...`);

      const prompt = this.getExtractionPrompt(documentType);

      const result = await this.model.generateContent([
        prompt,
        {
          inlineData: {
            data: imageData,
            mimeType: "image/jpeg",
          },
        },
      ]);

      const response = await result.response;
      const text = response.text();

      // Parse JSON response
      let extractedData = {};
      try {
        extractedData = JSON.parse(text);
      } catch (e) {
        console.warn("Failed to parse JSON, using text extraction fallback");
        extractedData = this.parseUnstructuredText(text, documentType);
      }

      return {
        extractedData,
        rawText: text,
        documentType,
        imageData,
      };
    } catch (error) {
      console.error("Gemini extraction error:", error);
      throw error;
    }
  }

  /**
   * Verify consistency and authenticity of a single document
   */
  async verifySingleDocument(
    documentData: DocumentData
  ): Promise<DocumentVerificationResult> {
    try {
      console.log(`Verifying single document consistency...`);

      const prompt = `
You are an expert KYC document analyst. Analyze this document for consistency, authenticity, and completeness.

IMPORTANT CONTEXT: Documents come in various formats and OCR extraction may be imperfect. Focus on SUBSTANCE over FORMAT.

Document Type: ${documentData.documentType}
Extracted Data: ${JSON.stringify(documentData.extractedData, null, 2)}
Raw Text: ${documentData.rawText}

ANALYSIS GUIDELINES:
1. **Be LENIENT with variations**: Minor spelling differences, format variations are NORMAL
2. **Focus on core identity markers**: Name essence, birth date essence, key identifiers
3. **OCR imperfections are expected**: Missing characters, extra spaces, case differences are common
4. **Different document types have different fields**: Don't expect identical structure
5. **Realistic assessment**: If you can reasonably identify a person from this document, it's likely valid

VALIDATION RULES:
- Names: Accept reasonable variations (nicknames, middle names, spelling differences)
- Dates: Accept different formats (DD/MM/YYYY, MM/DD/YYYY, DD-MM-YY, etc.)
- Numbers: Accept spacing differences (1234 5678 vs 12345678)
- Addresses: Accept abbreviated vs full forms, different ordering
- Missing fields: Don't penalize heavily if core identity is clear

IMPORTANT: Unless there are MAJOR red flags (completely different names, impossible dates, obvious forgery), lean towards ACCEPTING the document.

CRITICAL: Return ONLY raw JSON, no markdown. Example:
{"isConsistent":true,"confidence":85,"inconsistencies":[],"verificationDetails":{"nameConsistency":true,"dateConsistency":true,"addressConsistency":true,"documentAuthenticity":true,"crossDocumentValidation":true},"fieldAnalysis":{"name":{"valid":true,"issues":[]},"dateOfBirth":{"valid":true,"issues":[]},"idNumber":{"valid":true,"issues":[]},"address":{"valid":true,"issues":[]},"other":{"valid":true,"issues":[]}},"suggestions":[]}
`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      console.log("🤖 Gemini raw response:", text);

      // Parse JSON response, handling markdown code blocks
      let verification;
      try {
        // Remove markdown code blocks if present
        const cleanedText = this.extractJsonFromMarkdown(text);
        verification = JSON.parse(cleanedText);
      } catch (parseError) {
        console.warn(
          "📋 JSON parsing failed, using fallback parsing:",
          parseError
        );
        verification = this.parseFallbackVerification(text);
      }

      return {
        ...verification,
        belongsToSamePerson: true, // Single document analysis
      };
    } catch (error) {
      console.error("Single document verification error:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : null,
        errorType: typeof error,
      });

      // Return more specific error information
      return {
        ...this.getDefaultVerificationResult(),
        inconsistencies: [
          `AI verification failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        ],
        suggestions: [
          "Check API configuration and try again",
          "Ensure document is clear and readable",
        ],
      };
    }
  }

  /**
   * Cross-verify multiple documents to ensure they belong to the same person
   */
  async crossVerifyDocuments(
    documents: DocumentData[]
  ): Promise<CrossDocumentAnalysis> {
    try {
      console.log(`Cross-verifying ${documents.length} documents...`);

      if (documents.length < 2) {
        throw new Error("At least 2 documents required for cross-verification");
      }

      const prompt = `
You are an expert KYC analyst specializing in cross-document identity verification. Your task is to determine if these ${
        documents.length
      } documents belong to the same person.

CRITICAL UNDERSTANDING: 
- Different document types (Aadhaar, PAN, Passport, etc.) have COMPLETELY DIFFERENT formats
- OCR extraction will produce DIFFERENT field names and structures for the SAME person's info
- You must be INTELLIGENT about mapping equivalent information across documents
- Focus on SEMANTIC SIMILARITY, not exact matches

SMART MATCHING RULES:
1. **Name Matching**: 
   - "JOHN SMITH" = "John Smith" = "J SMITH" = "SMITH JOHN" 
   - Accept abbreviations, case differences, word order changes
   - Middle names may be present/absent
   - Nicknames are common (e.g., "Bob" for "Robert")

2. **Date Matching**:
   - "01/01/1990" = "01-01-1990" = "1990-01-01" = "1 Jan 1990"
   - Different date formats are NORMAL across document types
   - Focus on day, month, year values, not format

3. **Address Matching**:
   - "123 Main St" = "123 Main Street" = "123, Main Street"
   - Abbreviations vs full forms are NORMAL
   - Partial addresses are common (some docs show full, others abbreviated)
   - Pin codes/postal codes should match

4. **ID Number Cross-Reference**:
   - Look for ANY numbers that could be related
   - Different documents will have different ID formats
   - Focus on unique identifiers when present

ANALYSIS APPROACH:
- Extract key identity markers from each document
- Map equivalent fields intelligently (don't expect identical field names)
- Look for CORE CONSISTENCY in identity, not format perfection
- Be LENIENT with variations that are typical across document types

Documents to analyze:
${documents
  .map(
    (doc, index) => `
Document ${index + 1} (${doc.documentType}):
Extracted Data: ${JSON.stringify(doc.extractedData, null, 2)}
Raw Text: ${doc.rawText}
`
  )
  .join("\n")}

DECISION CRITERIA:
- If names are reasonably similar AND dates roughly match → LIKELY SAME PERSON
- If there's clear address correlation → STRONG INDICATOR
- If ANY unique identifiers match → VERY STRONG INDICATOR
- Minor variations in format/spelling are EXPECTED and NORMAL

CRITICAL: Return ONLY raw JSON. Focus on intelligent cross-document matching:
{"documentsAnalyzed":${
        documents.length
      },"overallConsistency":true,"personIdentityConfidence":90,"riskFactors":[],"verificationSummary":"Documents show consistent identity across different formats"}
`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      console.log("🤖 Gemini cross-verification response:", text);

      // Parse JSON response, handling markdown code blocks
      let crossAnalysis;
      try {
        const cleanedText = this.extractJsonFromMarkdown(text);
        crossAnalysis = JSON.parse(cleanedText);
      } catch (parseError) {
        console.warn(
          "📋 Cross-verification JSON parsing failed, using fallback:",
          parseError
        );
        crossAnalysis = this.parseFallbackCrossAnalysis(text, documents.length);
      }

      return crossAnalysis;
    } catch (error) {
      console.error("Cross document verification error:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : null,
        errorType: typeof error,
      });

      return {
        documentsAnalyzed: documents.length,
        overallConsistency: false,
        personIdentityConfidence: 0,
        riskFactors: [
          `Cross-verification failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        ],
        verificationSummary:
          "Unable to complete cross-document verification due to technical error",
      };
    }
  }

  /**
   * Comprehensive verification of multiple documents with detailed analysis
   */
  async comprehensiveDocumentVerification(documents: DocumentData[]): Promise<{
    individualVerifications: DocumentVerificationResult[];
    crossDocumentAnalysis: CrossDocumentAnalysis;
    finalRecommendation: {
      approved: boolean;
      confidence: number;
      reason: string;
      requiredActions: string[];
    };
  }> {
    try {
      console.log(
        `🚀 Starting comprehensive verification of ${documents.length} documents...`
      );

      // Step 1: Verify each document individually
      console.log("📋 Step 1: Individual document verification...");
      const individualVerifications = await Promise.all(
        documents.map((doc) => this.verifySingleDocument(doc))
      );

      // Step 2: Cross-verify all documents
      console.log("Step 2: Cross-document verification...");
      const crossDocumentAnalysis = await this.crossVerifyDocuments(documents);

      // Step 3: Generate final recommendation
      console.log("⚖️ Step 3: Generating final recommendation...");
      const finalRecommendation = this.generateFinalRecommendation(
        individualVerifications,
        crossDocumentAnalysis
      );

      return {
        individualVerifications,
        crossDocumentAnalysis,
        finalRecommendation,
      };
    } catch (error) {
      console.error("Comprehensive verification error:", error);
      throw error;
    }
  }

  /**
   * Smart comparison of extracted data from IPFS with newly extracted data
   */
  async compareWithStoredData(
    newDocument: DocumentData,
    storedDataUrl: string
  ): Promise<{
    matches: boolean;
    confidence: number;
    differences: string[];
    analysis: string;
  }> {
    try {
      console.log("📦 Loading stored data from IPFS...");
      const response = await fetch(storedDataUrl);
      if (!response.ok) {
        throw new Error(`Failed to load IPFS data: ${response.status}`);
      }
      const storedData = await response.json();

      const prompt = `
Compare this newly extracted document data with previously stored reference data.
Determine if they represent the same person and document, accounting for:
1. OCR variations and errors
2. Different extraction methods
3. Formatting differences
4. Partial data in either source
5. Natural variations in how information is presented

New Document Data:
Type: ${newDocument.documentType}
Extracted: ${JSON.stringify(newDocument.extractedData, null, 2)}
Raw Text: ${newDocument.rawText}

Stored Reference Data:
${JSON.stringify(storedData, null, 2)}

Focus on the core identity information (name, ID numbers, dates) rather than exact text matches.

Return JSON:
{
  "matches": boolean,
  "confidence": number (0-100),
  "differences": ["list of significant differences"],
  "analysis": "detailed explanation of comparison results",
  "coreIdentityMatch": boolean,
  "dataQualityAssessment": {
    "newDocument": number (0-100),
    "storedData": number (0-100)
  }
}
`;

      const result = await this.model.generateContent(prompt);
      const response_text = await result.response;
      const analysis = JSON.parse(response_text.text());

      return analysis;
    } catch (error) {
      console.error("Data comparison error:", error);
      return {
        matches: false,
        confidence: 0,
        differences: ["Comparison failed due to technical error"],
        analysis: "Unable to complete data comparison",
      };
    }
  }

  private getExtractionPrompt(documentType: string): string {
    const basePrompt = `Extract all relevant information from this ${documentType} document. `;

    switch (documentType.toLowerCase()) {
      case "aadhaar":
        return (
          basePrompt +
          `Return JSON with: {"name": "", "aadhaar_number": "", "date_of_birth": "", "address": "", "gender": "", "mobile": ""}`
        );
      case "pan":
        return (
          basePrompt +
          `Return JSON with: {"name": "", "pan_number": "", "date_of_birth": "", "father_name": ""}`
        );
      case "passport":
        return (
          basePrompt +
          `Return JSON with: {"name": "", "passport_number": "", "date_of_birth": "", "place_of_birth": "", "nationality": "", "issue_date": "", "expiry_date": ""}`
        );
      case "voter_id":
        return (
          basePrompt +
          `Return JSON with: {"name": "", "voter_id_number": "", "date_of_birth": "", "address": "", "constituency": ""}`
        );
      default:
        return (
          basePrompt +
          `Return JSON with all identifiable information including: {"name": "", "id_number": "", "date_of_birth": "", "address": ""}`
        );
    }
  }

  private parseUnstructuredText(text: string, documentType: string): any {
    // Fallback parsing when JSON parsing fails
    const result: any = {};

    // Basic regex patterns for common fields
    const patterns = {
      name: /(?:name|नाम)[:\s]+([a-zA-Z\s]+)/i,
      aadhaar: /(\d{4}\s?\d{4}\s?\d{4})/,
      pan: /([A-Z]{5}\d{4}[A-Z])/,
      dob: /(?:dob|birth|जन्म)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      mobile: /(?:mobile|phone)[:\s]*(\d{10})/i,
    };

    for (const [key, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match) {
        result[key] = match[1].trim();
      }
    }

    return result;
  }

  private generateFinalRecommendation(
    individualVerifications: DocumentVerificationResult[],
    crossAnalysis: CrossDocumentAnalysis
  ) {
    const avgIndividualConfidence =
      individualVerifications.reduce((sum, v) => sum + v.confidence, 0) /
      individualVerifications.length;

    // More lenient thresholds for realistic KYC
    const individualPassThreshold = 60; // Lowered from implicit 100%
    const crossVerificationThreshold = 70; // For cross-document consistency
    const finalConfidenceThreshold = 65; // Lowered from 70%

    const allIndividualPassed = individualVerifications.every(
      (v) => v.confidence >= individualPassThreshold
    );
    const crossVerificationPassed =
      crossAnalysis.personIdentityConfidence >= crossVerificationThreshold;

    // Use weighted average favoring cross-document analysis for identity matching
    const finalConfidence =
      Math.round(
        (avgIndividualConfidence * 0.4 +
          crossAnalysis.personIdentityConfidence * 0.6) *
          10
      ) / 10;

    // More intelligent approval logic
    const approved =
      (allIndividualPassed || avgIndividualConfidence >= 65) &&
      crossVerificationPassed &&
      finalConfidence >= finalConfidenceThreshold;

    let reason = "";
    const requiredActions: string[] = [];
    const detailedIssues: string[] = [];

    if (!allIndividualPassed) {
      const failedDocs = individualVerifications.filter(
        (v) => v.confidence < individualPassThreshold
      );
      if (failedDocs.length > 0) {
        failedDocs.forEach((doc, index) => {
          if (doc.inconsistencies && doc.inconsistencies.length > 0) {
            detailedIssues.push(
              `Document ${index + 1}: ${doc.inconsistencies.join(", ")}`
            );
          }
        });
        reason += `${failedDocs.length} document(s) below confidence threshold (${individualPassThreshold}%). `;
        requiredActions.push("Review individual document quality and clarity");
      }
    }

    if (!crossVerificationPassed) {
      if (crossAnalysis.riskFactors && crossAnalysis.riskFactors.length > 0) {
        detailedIssues.push(
          `Cross-verification issues: ${crossAnalysis.riskFactors.join(", ")}`
        );
      }
      reason += `Cross-document identity confidence ${crossAnalysis.personIdentityConfidence}% below ${crossVerificationThreshold}% threshold. `;
      requiredActions.push("Review identity consistency across documents");
    }

    if (finalConfidence < finalConfidenceThreshold) {
      reason += `Overall confidence ${finalConfidence}% below required ${finalConfidenceThreshold}% threshold. `;
      requiredActions.push("Consider additional documents or manual review");
    }

    if (approved) {
      reason = `Identity verification successful with ${finalConfidence}% confidence. Documents consistently belong to the same person.`;
      requiredActions.length = 0; // Clear actions for approved cases
    } else {
      // Add detailed issues to the reason for better debugging
      if (detailedIssues.length > 0) {
        reason += `Specific issues: ${detailedIssues.join(" | ")}`;
      }
    }

    return {
      approved,
      confidence: finalConfidence,
      reason: reason.trim(),
      requiredActions,
      detailedIssues, // Add this for debugging
    };
  }

  private getDefaultVerificationResult(): DocumentVerificationResult {
    return {
      isConsistent: false,
      belongsToSamePerson: false,
      confidence: 0,
      inconsistencies: ["Verification failed due to technical error"],
      verificationDetails: {
        nameConsistency: false,
        dateConsistency: false,
        addressConsistency: false,
        documentAuthenticity: false,
        crossDocumentValidation: false,
      },
      suggestions: ["Please try again or contact support"],
    };
  }

  /**
   * Extract JSON from Gemini's markdown-formatted response
   */
  private extractJsonFromMarkdown(text: string): string {
    // Remove markdown code blocks
    let cleaned = text.trim();

    // Remove ```json and ``` markers
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.substring(7);
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.substring(3);
    }

    if (cleaned.endsWith("```")) {
      cleaned = cleaned.substring(0, cleaned.length - 3);
    }

    return cleaned.trim();
  }

  /**
   * Fallback parsing for verification results when JSON parsing fails
   */
  private parseFallbackVerification(text: string): DocumentVerificationResult {
    console.warn("🔧 Using fallback verification parsing");

    // Try to extract basic information from text - be more optimistic
    const positiveIndicators = [
      "consistent",
      "valid",
      "authentic",
      "verified",
      "pass",
      "good",
      "correct",
    ];
    const negativeIndicators = [
      "inconsistent",
      "invalid",
      "fake",
      "tampered",
      "fail",
      "error",
      "wrong",
    ];

    const textLower = text.toLowerCase();
    const positiveCount = positiveIndicators.filter((word) =>
      textLower.includes(word)
    ).length;
    const negativeCount = negativeIndicators.filter((word) =>
      textLower.includes(word)
    ).length;

    const isConsistentMatch = positiveCount > negativeCount;
    const confidenceMatch = text.match(/confidence[:\s]*(\d+)/i);
    const confidence = confidenceMatch
      ? parseInt(confidenceMatch[1])
      : isConsistentMatch
      ? 75
      : 45;

    return {
      isConsistent: isConsistentMatch,
      belongsToSamePerson: true,
      confidence: confidence,
      inconsistencies: isConsistentMatch
        ? []
        : ["Unable to fully parse AI response - manual review recommended"],
      verificationDetails: {
        nameConsistency: isConsistentMatch,
        dateConsistency: isConsistentMatch,
        addressConsistency: isConsistentMatch,
        documentAuthenticity: isConsistentMatch,
        crossDocumentValidation: isConsistentMatch,
      },
      fieldAnalysis: {
        name: { valid: isConsistentMatch, issues: [] },
        dateOfBirth: { valid: isConsistentMatch, issues: [] },
        idNumber: { valid: isConsistentMatch, issues: [] },
        address: { valid: isConsistentMatch, issues: [] },
        other: { valid: isConsistentMatch, issues: [] },
      },
      suggestions: isConsistentMatch
        ? []
        : ["Manual review recommended due to parsing difficulties"],
    };
  }

  /**
   * Fallback parsing for cross-document analysis
   */
  private parseFallbackCrossAnalysis(
    text: string,
    documentsCount: number
  ): CrossDocumentAnalysis {
    console.warn("🔧 Using fallback cross-analysis parsing");

    // Be more optimistic in fallback parsing
    const positiveIndicators = [
      "consistent",
      "same",
      "match",
      "belong",
      "identical",
      "similar",
      "verify",
    ];
    const negativeIndicators = [
      "inconsistent",
      "different",
      "mismatch",
      "fraud",
      "fake",
      "suspicious",
    ];

    const textLower = text.toLowerCase();
    const positiveCount = positiveIndicators.filter((word) =>
      textLower.includes(word)
    ).length;
    const negativeCount = negativeIndicators.filter((word) =>
      textLower.includes(word)
    ).length;

    const isConsistentMatch = positiveCount >= negativeCount;
    const confidenceMatch = text.match(/confidence[:\s]*(\d+)/i);
    const confidence = confidenceMatch
      ? parseInt(confidenceMatch[1])
      : isConsistentMatch
      ? 80
      : 50;

    return {
      documentsAnalyzed: documentsCount,
      overallConsistency: isConsistentMatch,
      personIdentityConfidence: confidence,
      riskFactors: isConsistentMatch
        ? []
        : ["Parsing difficulties - manual verification recommended"],
      verificationSummary: isConsistentMatch
        ? "Documents appear to belong to the same person (fallback analysis)"
        : "Unable to fully analyze document consistency - manual review required",
      nameAnalysis: {
        consistent: isConsistentMatch,
        variations: [],
        confidence: confidence,
      },
      dobAnalysis: {
        consistent: isConsistentMatch,
        dates: [],
        confidence: confidence,
      },
      addressAnalysis: {
        consistent: isConsistentMatch,
        addresses: [],
        confidence: confidence,
      },
      recommendedActions: isConsistentMatch
        ? []
        : ["Manual verification recommended due to parsing error"],
    };
  }
}

export default GeminiDocumentVerificationService;
