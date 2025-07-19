import { NextRequest, NextResponse } from 'next/server';
import { WorkflowService } from '@/lib/workflow';
import { APIResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { userId, userAddress, documents } = await request.json();

    // Validate required fields
    if (!userId || !userAddress || !documents) {
      return NextResponse.json<APIResponse>({
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Missing required fields: userId, userAddress, documents',
        },
      }, { status: 400 });
    }

    if (!documents.idDocument || !documents.selfie) {
      return NextResponse.json<APIResponse>({
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Both idDocument and selfie IPFS hashes are required',
        },
      }, { status: 400 });
    }

    // Validate Ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      return NextResponse.json<APIResponse>({
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Invalid Ethereum address format',
        },
      }, { status: 400 });
    }

    // Initialize workflow service
    const workflowService = WorkflowService.getInstance();
    await workflowService.initialize();

    // Start KYC workflow
    const result = await workflowService.startKYCWorkflow({
      userId,
      userAddress,
      documents,
    });

    if (result.success) {
      return NextResponse.json<APIResponse>({
        success: true,
        data: {
          workflowId: result.workflowId,
          status: 'initiated',
        },
        message: 'KYC workflow initiated successfully',
      });
    } else {
      return NextResponse.json<APIResponse>({
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: result.error || 'Failed to initiate KYC workflow',
        },
      }, { status: 500 });
    }

  } catch (error) {
    console.error('KYC initiation error:', error);
    return NextResponse.json<APIResponse>({
      success: false,
      error: {
        code: 'UPLOAD_FAILED',
        message: error instanceof Error ? error.message : 'Failed to initiate KYC workflow',
      },
    }, { status: 500 });
  }
}