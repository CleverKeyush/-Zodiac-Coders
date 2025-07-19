import { ComplianceService } from '@/lib/compliance';
import { OCRResult } from '@/types';

describe('ComplianceService', () => {
  let complianceService: ComplianceService;

  beforeEach(() => {
    complianceService = ComplianceService.getInstance();
  });

  describe('validateCompliance', () => {
    it('should pass validation for valid data', async () => {
      const ocrResults: OCRResult[] = [
        {
          extractedData: {
            name: 'John Doe',
            dateOfBirth: '1990-01-01',
            idNumber: 'ABCDE1234F',
            address: '123 Main Street, City, State',
          },
          confidence: 90,
          status: 'success',
        },
      ];

      const result = await complianceService.validateCompliance(
        ocrResults,
        ['valid-ipfs-hash']
      );

      expect(result.status).toBe('passed');
      expect(result.checks.fieldConsistency).toBe(true);
      expect(result.checks.logicalValidation).toBe(true);
      expect(result.checks.documentPresence).toBe(true);
    });

    it('should fail validation for underage person', async () => {
      const ocrResults: OCRResult[] = [
        {
          extractedData: {
            name: 'Young Person',
            dateOfBirth: '2010-01-01', // 14 years old
            idNumber: 'ABCDE1234F',
          },
          confidence: 90,
          status: 'success',
        },
      ];

      const result = await complianceService.validateCompliance(
        ocrResults,
        ['valid-ipfs-hash']
      );

      expect(result.status).toBe('failed');
      expect(result.failureReasons).toContain(
        expect.stringContaining('must be at least 18 years old')
      );
    });

    it('should fail validation for invalid PAN format', async () => {
      const ocrResults: OCRResult[] = [
        {
          extractedData: {
            name: 'John Doe',
            dateOfBirth: '1990-01-01',
            idNumber: 'INVALID123', // Invalid PAN format
          },
          confidence: 90,
          status: 'success',
        },
      ];

      const result = await complianceService.validateCompliance(
        ocrResults,
        ['valid-ipfs-hash']
      );

      expect(result.status).toBe('failed');
      expect(result.failureReasons).toContain(
        expect.stringContaining('Invalid ID number format')
      );
    });
  });

  describe('helper methods', () => {
    it('should validate PAN format correctly', () => {
      const isValid = (complianceService as any).isValidPANFormat('ABCDE1234F');
      expect(isValid).toBe(true);

      const isInvalid = (complianceService as any).isValidPANFormat('INVALID');
      expect(isInvalid).toBe(false);
    });

    it('should calculate age correctly', () => {
      const age = (complianceService as any).calculateAge('1990-01-01');
      expect(age).toBeGreaterThan(30);
    });

    it('should validate name format', () => {
      const validName = (complianceService as any).isValidNameFormat('John Doe');
      expect(validName).toBe(true);

      const invalidName = (complianceService as any).isValidNameFormat('123');
      expect(invalidName).toBe(false);
    });
  });
});