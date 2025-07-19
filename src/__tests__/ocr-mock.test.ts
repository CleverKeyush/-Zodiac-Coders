import { OCRService } from '@/lib/ocr';
import { OCRResult } from '@/types';

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

describe('OCR Service with Mock Data', () => {
  let ocrService: OCRService;
  
  beforeEach(() => {
    ocrService = OCRService.getInstance();
    jest.clearAllMocks();
  });
  
  test('extractText should return mock text data', async () => {
    const mockText = await ocrService.extractText('test-image-url');
    
    expect(mockText).toContain('GOVERNMENT OF INDIA');
    expect(mockText).toContain('Name: John Doe');
    expect(mockText).toContain('DOB: 01/01/1990');
    expect(mockText).toContain('ID: ABCDE1234F');
  });
  
  test('processDocument should extract structured data from mock text', async () => {
    const result = await ocrService.processDocument('mock-ipfs-hash');
    
    expect(result).toHaveProperty('extractedData');
    expect(result).toHaveProperty('rawText');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('status');
    
    expect(result.extractedData.name).toBe('John Doe');
    expect(result.status).toBe('success');
    expect(result.confidence).toBeGreaterThan(50);
  });
  
  test('processFile should handle file objects and return structured data', async () => {
    // Create a mock file
    const mockFile = new File(['mock content'], 'test.jpg', { type: 'image/jpeg' });
    
    const result = await ocrService.processFile(mockFile);
    
    expect(result).toHaveProperty('extractedData');
    expect(result).toHaveProperty('rawText');
    expect(result.status).toBe('success');
    
    // Verify URL methods were called
    expect(URL.createObjectURL).toHaveBeenCalledWith(mockFile);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('mock-url');
  });
  
  test('validateConsistency should detect inconsistencies between documents', () => {
    const doc1: OCRResult = {
      extractedData: {
        name: 'John Doe',
        dateOfBirth: '1990-01-01',
        idNumber: 'ABC123',
        address: '123 Main St'
      },
      rawText: 'mock text',
      confidence: 90,
      status: 'success'
    };
    
    const doc2: OCRResult = {
      extractedData: {
        name: 'John Doe',
        dateOfBirth: '1990-01-01',
        idNumber: 'XYZ456', // Different ID
        address: '123 Main St'
      },
      rawText: 'mock text',
      confidence: 85,
      status: 'success'
    };
    
    const result = ocrService.validateConsistency([doc1, doc2]);
    
    expect(result.isConsistent).toBe(false);
    expect(result.inconsistencies.length).toBe(1);
    expect(result.inconsistencies[0]).toContain('ID number mismatch');
  });
});