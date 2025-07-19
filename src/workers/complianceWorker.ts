import { TASK_NAMES } from "@/config/conductor";
import { OrkesWorkerClient } from "@/lib/orkesClient";

/**
 * Compliance Check Worker for Orkes Conductor
 * This worker performs regulatory compliance validation on extracted KYC data
 */
export class ComplianceWorker {
  private workerClient: OrkesWorkerClient;

  constructor(workerClient: OrkesWorkerClient) {
    this.workerClient = workerClient;
  }

  /**
   * Start the compliance worker
   */
  async start() {
    console.log("🚀 Starting Compliance Worker...");

    // Register the compliance check task with Orkes Conductor
    this.workerClient.registerWorker(
      TASK_NAMES.COMPLIANCE_CHECK,
      1,
      this.processComplianceCheck.bind(this),
      {
        pollingInterval: 2000, // Poll every 2 seconds
        domain: "kyc", // Optional domain
        concurrency: 5, // Process up to 5 tasks concurrently
      }
    );

    console.log(
      `✅ Compliance Worker registered for task: ${TASK_NAMES.COMPLIANCE_CHECK}`
    );
  }

  /**
   * Process compliance check task
   */
  async processComplianceCheck(inputData: any) {
    try {
      console.log("⚖️ Processing compliance check task:", inputData);

      const { extractedData, documentType, jurisdiction = "IN" } = inputData;

      if (!extractedData) {
        throw new Error("Extracted data is required for compliance check");
      }

      console.log(
        `Validating compliance for ${
          documentType || "unknown"
        } document in ${jurisdiction}`
      );

      // Use the ComplianceService for real compliance validation
      const { ComplianceService } = await import("@/lib/compliance");
      const complianceService = ComplianceService.getInstance();

      // Create OCR result format for compliance service
      const ocrResult = {
        extractedData,
        rawText: "",
        confidence: 80,
        status: "success" as const,
      };

      // Perform real compliance validation
      const complianceResult = await complianceService.validateCompliance(
        [ocrResult],
        []
      );

      const checks = complianceResult.checks;

      // Calculate overall compliance status
      const passedChecks = Object.values(checks).filter(
        (check) => check
      ).length;
      const totalChecks = Object.keys(checks).length;
      const complianceScore = passedChecks / totalChecks;

      const status = complianceScore >= 0.75 ? "passed" : "failed"; // 75% threshold

      const failureReasons: string[] = [];
      if (!checks.fieldConsistency)
        failureReasons.push("Field consistency validation failed");
      if (!checks.logicalValidation)
        failureReasons.push("Logical validation failed");
      if (!checks.tamperingDetection)
        failureReasons.push("Document tampering detected");
      if (!checks.documentPresence)
        failureReasons.push("Required document fields missing");

      const result = {
        status,
        checks,
        riskScore: Math.round((1 - complianceScore) * 100), // Higher score = higher risk
        flags: failureReasons,
        recommendations: this.generateRecommendations(failureReasons),
        complianceScore: Math.round(complianceScore * 100),
      };

      console.log(
        `✅ Compliance check completed: status=${status}, score=${result.complianceScore}%`
      );

      return result;
    } catch (error) {
      console.error(
        `❌ Compliance check task failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );

      return {
        status: "failed",
        checks: {
          fieldConsistency: false,
          logicalValidation: false,
          tamperingDetection: false,
          documentPresence: false,
        },
        riskScore: 100,
        flags: ["Compliance check processing failed"],
        recommendations: ["Manual review required"],
        error:
          error instanceof Error ? error.message : "Compliance check failed",
      };
    }
  }

  /**
   * Check field consistency across extracted data
   */
  private checkFieldConsistency(extractedData: any): boolean {
    // Check if required fields are present and consistent
    const requiredFields = ["name"];
    const hasRequiredFields = requiredFields.every(
      (field) =>
        extractedData[field] &&
        typeof extractedData[field] === "string" &&
        extractedData[field].trim().length > 0
    );

    // Check name format (should contain at least first and last name)
    const nameValid =
      extractedData.name && extractedData.name.trim().split(" ").length >= 2;

    return hasRequiredFields && nameValid;
  }

  /**
   * Check logical validation of data
   */
  private checkLogicalValidation(
    extractedData: any,
    documentType?: string
  ): boolean {
    let isValid = true;

    // Validate date of birth if present
    if (extractedData.dateOfBirth) {
      const dob = new Date(extractedData.dateOfBirth);
      const now = new Date();
      const age = now.getFullYear() - dob.getFullYear();

      // Age should be between 18 and 120
      if (age < 18 || age > 120) {
        isValid = false;
      }
    }

    // Validate ID number format based on document type
    if (documentType === "aadhaar" && extractedData.idNumber) {
      // Aadhaar should be 12 digits
      const cleanId = extractedData.idNumber.replace(/\s/g, "");
      if (!/^\d{12}$/.test(cleanId)) {
        isValid = false;
      }
    } else if (documentType === "pan" && extractedData.idNumber) {
      // PAN should be 5 letters + 4 digits + 1 letter
      if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(extractedData.idNumber)) {
        isValid = false;
      }
    }

    return isValid;
  }

  /**
   * Check for document tampering indicators
   */
  private checkTamperingDetection(extractedData: any): boolean {
    // In a real implementation, this would analyze:
    // - Image metadata
    // - Pixel-level analysis
    // - Font consistency
    // - Layout analysis

    // For now, we'll do basic checks on the extracted text
    const suspiciousPatterns = [
      /\b(test|sample|demo|fake)\b/i,
      /\b(xxx|000|111|222|333|444|555|666|777|888|999)\b/,
      /\b(lorem ipsum)\b/i,
    ];

    const allText = Object.values(extractedData).join(" ").toLowerCase();
    const hasSuspiciousContent = suspiciousPatterns.some((pattern) =>
      pattern.test(allText)
    );

    return !hasSuspiciousContent; // Return true if no tampering detected
  }

  /**
   * Check document presence and completeness
   */
  private checkDocumentPresence(extractedData: any): boolean {
    // Check if we have meaningful extracted data
    const meaningfulFields = Object.values(extractedData).filter(
      (value) => value && typeof value === "string" && value.trim().length > 2
    );

    // Should have at least 2 meaningful fields
    return meaningfulFields.length >= 2;
  }

  /**
   * Generate recommendations based on failure reasons
   */
  private generateRecommendations(failureReasons: string[]): string[] {
    const recommendations: string[] = [];

    if (failureReasons.some((reason) => reason.includes("consistency"))) {
      recommendations.push(
        "Verify document authenticity and re-scan with better quality"
      );
    }

    if (failureReasons.some((reason) => reason.includes("logical"))) {
      recommendations.push(
        "Check document validity and ensure all information is correct"
      );
    }

    if (failureReasons.some((reason) => reason.includes("tampering"))) {
      recommendations.push(
        "Document may be altered - manual verification required"
      );
    }

    if (failureReasons.some((reason) => reason.includes("missing"))) {
      recommendations.push(
        "Provide a clearer image with all required fields visible"
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("Document passed all compliance checks");
    }

    return recommendations;
  }
}
