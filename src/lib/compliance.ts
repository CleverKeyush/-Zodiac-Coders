import { ComplianceResult, OCRResult } from '@/types';

export class ComplianceService {
  private static instance: ComplianceService;

  static getInstance(): ComplianceService {
    if (!ComplianceService.instance) {
      ComplianceService.instance = new ComplianceService();
    }
    return ComplianceService.instance;
  }

  // Main compliance validation function
  async validateCompliance(
    ocrResults: OCRResult[],
    documentHashes: string[]
  ): Promise<ComplianceResult> {
    const failureReasons: string[] = [];
    
    // Check field consistency across documents
    const fieldConsistency = this.checkFieldConsistency(ocrResults, failureReasons);
    
    // Check logical validation
    const logicalValidation = this.checkLogicalValidation(ocrResults, failureReasons);
    
    // Check document tampering (basic checks)
    const tamperingDetection = await this.checkTamperingDetection(documentHashes, failureReasons);
    
    // Check document presence
    const documentPresence = this.checkDocumentPresence(ocrResults, failureReasons);

    const allChecksPassed = fieldConsistency && logicalValidation && tamperingDetection && documentPresence;

    return {
      status: allChecksPassed ? 'passed' : 'failed',
      checks: {
        fieldConsistency,
        logicalValidation,
        tamperingDetection,
        documentPresence,
      },
      failureReasons: failureReasons.length > 0 ? failureReasons : undefined,
    };
  }

  // Check field consistency across multiple documents
  private checkFieldConsistency(ocrResults: OCRResult[], failureReasons: string[]): boolean {
    if (ocrResults.length < 1) {
      failureReasons.push('No OCR results available for consistency check');
      return false;
    }

    let isConsistent = true;

    // If multiple documents, check consistency
    if (ocrResults.length > 1) {
      const [first, ...rest] = ocrResults;

      for (let i = 0; i < rest.length; i++) {
        const current = rest[i];

        // Check name consistency
        if (first.extractedData.name && current.extractedData.name) {
          if (!this.namesMatch(first.extractedData.name, current.extractedData.name)) {
            failureReasons.push(`Name inconsistency between documents: "${first.extractedData.name}" vs "${current.extractedData.name}"`);
            isConsistent = false;
          }
        }

        // Check date of birth consistency
        if (first.extractedData.dateOfBirth && current.extractedData.dateOfBirth) {
          if (first.extractedData.dateOfBirth !== current.extractedData.dateOfBirth) {
            failureReasons.push(`Date of birth inconsistency: "${first.extractedData.dateOfBirth}" vs "${current.extractedData.dateOfBirth}"`);
            isConsistent = false;
          }
        }

        // Check ID number consistency
        if (first.extractedData.idNumber && current.extractedData.idNumber) {
          if (first.extractedData.idNumber !== current.extractedData.idNumber) {
            failureReasons.push(`ID number inconsistency: "${first.extractedData.idNumber}" vs "${current.extractedData.idNumber}"`);
            isConsistent = false;
          }
        }
      }
    }

    return isConsistent;
  }

  // Check logical validation of extracted data
  private checkLogicalValidation(ocrResults: OCRResult[], failureReasons: string[]): boolean {
    let isValid = true;

    for (const result of ocrResults) {
      const { extractedData } = result;

      // Validate date of birth
      if (extractedData.dateOfBirth) {
        if (!this.isValidDateOfBirth(extractedData.dateOfBirth)) {
          failureReasons.push(`Invalid date of birth: ${extractedData.dateOfBirth}`);
          isValid = false;
        }

        // Check if person is of legal age (18+)
        const age = this.calculateAge(extractedData.dateOfBirth);
        if (age < 18) {
          failureReasons.push(`Person must be at least 18 years old. Current age: ${age}`);
          isValid = false;
        }
        if (age > 120) {
          failureReasons.push(`Invalid age calculated: ${age} years`);
          isValid = false;
        }
      }

      // Validate ID number format (PAN format)
      if (extractedData.idNumber) {
        if (!this.isValidPANFormat(extractedData.idNumber)) {
          failureReasons.push(`Invalid ID number format: ${extractedData.idNumber}`);
          isValid = false;
        }
      }

      // Validate name format
      if (extractedData.name) {
        if (!this.isValidNameFormat(extractedData.name)) {
          failureReasons.push(`Invalid name format: ${extractedData.name}`);
          isValid = false;
        }
      }

      // Validate address format
      if (extractedData.address) {
        if (!this.isValidAddressFormat(extractedData.address)) {
          failureReasons.push(`Invalid address format: ${extractedData.address}`);
          isValid = false;
        }
      }
    }

    return isValid;
  }

  // Basic tampering detection (placeholder for more sophisticated checks)
  private async checkTamperingDetection(documentHashes: string[], failureReasons: string[]): Promise<boolean> {
    // This is a simplified implementation
    // In a real system, you would implement more sophisticated image analysis
    
    let isValid = true;

    for (const hash of documentHashes) {
      // Check if hash is valid IPFS hash format
      if (!this.isValidIPFSHash(hash)) {
        failureReasons.push(`Invalid IPFS hash format: ${hash}`);
        isValid = false;
      }

      // Additional tampering checks could include:
      // - Image metadata analysis
      // - Font consistency analysis
      // - Image quality analysis
      // - Digital signature verification
    }

    return isValid;
  }

  // Check if all required documents are present and parsed
  private checkDocumentPresence(ocrResults: OCRResult[], failureReasons: string[]): boolean {
    if (ocrResults.length === 0) {
      failureReasons.push('No documents processed');
      return false;
    }

    let hasValidDocument = false;

    for (const result of ocrResults) {
      if (result.status === 'success' && result.confidence > 50) {
        // Check if at least basic required fields are present
        const { extractedData } = result;
        const requiredFields = ['name', 'dateOfBirth', 'idNumber'];
        const presentFields = requiredFields.filter(field => 
          extractedData[field as keyof typeof extractedData] && 
          extractedData[field as keyof typeof extractedData]!.trim() !== ''
        );

        if (presentFields.length >= 2) { // At least 2 out of 3 required fields
          hasValidDocument = true;
          break;
        }
      }
    }

    if (!hasValidDocument) {
      failureReasons.push('No document contains sufficient required information (name, date of birth, ID number)');
    }

    return hasValidDocument;
  }

  // Helper methods for validation

  private namesMatch(name1: string, name2: string): boolean {
    // Normalize names for comparison (remove extra spaces, convert to lowercase)
    const normalize = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim();
    return normalize(name1) === normalize(name2);
  }

  private isValidDateOfBirth(dateStr: string): boolean {
    // Check if date is in valid format and is a real date
    const date = new Date(dateStr);
    return !isNaN(date.getTime()) && date < new Date();
  }

  private calculateAge(dateOfBirth: string): number {
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  private isValidPANFormat(pan: string): boolean {
    // PAN format: 5 letters + 4 digits + 1 letter
    const panRegex = /^[A-Z]{5}\d{4}[A-Z]$/;
    return panRegex.test(pan);
  }

  private isValidNameFormat(name: string): boolean {
    // Basic name validation
    const nameRegex = /^[A-Za-z\s.'-]{2,50}$/;
    return nameRegex.test(name.trim());
  }

  private isValidAddressFormat(address: string): boolean {
    // Basic address validation
    return address.trim().length >= 10 && address.trim().length <= 200;
  }

  private isValidIPFSHash(hash: string): boolean {
    // Basic IPFS hash validation (simplified)
    return hash.length >= 40 && /^[A-Za-z0-9]+$/.test(hash);
  }

  // Generate compliance report
  generateComplianceReport(result: ComplianceResult): string {
    let report = `Compliance Validation Report\n`;
    report += `Status: ${result.status.toUpperCase()}\n\n`;
    
    report += `Checks Performed:\n`;
    report += `- Field Consistency: ${result.checks.fieldConsistency ? 'PASSED' : 'FAILED'}\n`;
    report += `- Logical Validation: ${result.checks.logicalValidation ? 'PASSED' : 'FAILED'}\n`;
    report += `- Tampering Detection: ${result.checks.tamperingDetection ? 'PASSED' : 'FAILED'}\n`;
    report += `- Document Presence: ${result.checks.documentPresence ? 'PASSED' : 'FAILED'}\n`;
    
    if (result.failureReasons && result.failureReasons.length > 0) {
      report += `\nFailure Reasons:\n`;
      result.failureReasons.forEach((reason, index) => {
        report += `${index + 1}. ${reason}\n`;
      });
    }
    
    return report;
  }
}