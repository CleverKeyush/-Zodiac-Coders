import { OCRService } from '@/lib/ocr';

// Mock Tesseract
jest.mock('tesseract.js', () => ({
  recognize: jest.fn(),
}));

describe('OCRService', () => {
  let ocrService: OCRService;

  beforeEach(() => {
    ocrService = OCRService.getInstance();
  });

  describe('parseExtractedText', () => {
    it('should extract name from text', () => {
      const text = 'Name: John Doe\nDOB: 01/01/1990\nID: ABCDE1234F';
      const result = (ocrService as any).parseExtractedText(text);
      
      expect(result.name).toBe('John Doe');
    });

    it('should extract date of birth', () => {
      const text = 'Name: John Doe\nDate of Birth: 01/01/1990\nID: ABCDE1234F';
      const result = (ocrService as any).parseExtractedText(text);
      
      expect(result.dateOfBirth).toBe('1990-01-01');
    });

    it('should extract PAN format ID number', () => {
      const text = 'Name: John Doe\nDOB: 01/01/1990\nPAN: ABCDE1234F';
      const result = (ocrService as any).parseExtractedText(text);
      
      expect(result.idNumber).toBe('ABCDE1234F');
    });
  });

  describe('validatePANFormat', () => {
    it('should validate correct PAN format', () => {
      const isValid = (ocrService as any).validatePANFormat('ABCDE1234F');
      expect(isValid).toBe(true);
    });

    it('should reject incorrect PAN format', () => {
      const isValid = (ocrService as any).validatePANFormat('ABC123');
      expect(isValid).toBe(false);
    });
  });

  describe('validateConsistency', () => {
    it('should detect consistent data', () => {
      const results = [
        {
          extractedData: { name: 'John Doe', dateOfBirth: '1990-01-01' },
          status: 'success' as const,
          confidence: 90,
        },
        {
          extractedData: { name: 'John Doe', dateOfBirth: '1990-01-01' },
          status: 'success' as const,
          confidence: 85,
        },
      ];

      const validation = ocrService.validateConsistency(results);
      expect(validation.isConsistent).toBe(true);
      expect(validation.inconsistencies).toHaveLength(0);
    });

    it('should detect inconsistent names', () => {
      const results = [
        {
          extractedData: { name: 'John Doe' },
          status: 'success' as const,
          confidence: 90,
        },
        {
          extractedData: { name: 'Jane Smith' },
          status: 'success' as const,
          confidence: 85,
        },
      ];

      const validation = ocrService.validateConsistency(results);
      expect(validation.isConsistent).toBe(false);
      expect(validation.inconsistencies).toContain(
        expect.stringContaining('Name mismatch')
      );
    });
  });
});