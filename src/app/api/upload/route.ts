import { NextRequest, NextResponse } from 'next/server';
import { uploadToIPFS, validateFile } from '@/config/ipfs';
import { APIResponse, UploadResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const fileType = formData.get('type') as string;

    if (!file) {
      return NextResponse.json<APIResponse>({
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: 'No file provided',
        },
      }, { status: 400 });
    }

    if (!fileType || !['aadhaar', 'pan', 'passport', 'voter_id', 'selfie'].includes(fileType)) {
      return NextResponse.json<APIResponse>({
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Invalid file type. Must be aadhaar, pan, passport, voter_id, or selfie',
        },
      }, { status: 400 });
    }

    // Validate file
    const validation = validateFile(file);
    if (!validation.isValid) {
      return NextResponse.json<APIResponse>({
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: validation.error || 'File validation failed',
        },
      }, { status: 400 });
    }

    // Upload to IPFS
    const ipfsHash = await uploadToIPFS(file);

    const response: UploadResponse = {
      ipfsHash,
      fileName: file.name,
      fileSize: file.size,
      uploadedAt: new Date(),
    };

    return NextResponse.json<APIResponse<UploadResponse>>({
      success: true,
      data: response,
      message: 'File uploaded successfully to IPFS',
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json<APIResponse>({
      success: false,
      error: {
        code: 'UPLOAD_FAILED',
        message: error instanceof Error ? error.message : 'Failed to upload documents',
      },
    }, { status: 500 });
  }
}