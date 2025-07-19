import { POST } from '@/app/api/upload/route';
import { NextRequest } from 'next/server';

// Mock IPFS config
jest.mock('@/config/ipfs', () => ({
  validateFile: jest.fn(),
  uploadToIPFS: jest.fn(),
}));

describe('/api/upload', () => {
  it('should handle successful file upload', async () => {
    const { validateFile, uploadToIPFS } = require('@/config/ipfs');
    
    validateFile.mockReturnValue({ isValid: true });
    uploadToIPFS.mockResolvedValue('QmTestHash123');

    const formData = new FormData();
    const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
    formData.append('file', mockFile);
    formData.append('type', 'id_document');

    const request = new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data.ipfsHash).toBe('QmTestHash123');
  });

  it('should handle file validation errors', async () => {
    const { validateFile } = require('@/config/ipfs');
    
    validateFile.mockReturnValue({ 
      isValid: false, 
      error: 'Invalid file type' 
    });

    const formData = new FormData();
    const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
    formData.append('file', mockFile);
    formData.append('type', 'id_document');

    const request = new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error.message).toBe('Invalid file type');
  });

  it('should handle missing file', async () => {
    const formData = new FormData();
    formData.append('type', 'id_document');

    const request = new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error.message).toBe('No file provided');
  });

  it('should handle invalid file type parameter', async () => {
    const formData = new FormData();
    const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
    formData.append('file', mockFile);
    formData.append('type', 'invalid_type');

    const request = new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error.message).toContain('Invalid file type');
  });
});