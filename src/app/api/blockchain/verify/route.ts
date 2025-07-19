import { NextRequest, NextResponse } from 'next/server';
import { BlockchainService } from '@/lib/blockchain';
import { APIResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { userAddress } = await request.json();

    if (!userAddress) {
      return NextResponse.json<APIResponse>({
        success: false,
        error: {
          code: 'BLOCKCHAIN_FAILED',
          message: 'User address is required',
        },
      }, { status: 400 });
    }

    // Validate Ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      return NextResponse.json<APIResponse>({
        success: false,
        error: {
          code: 'BLOCKCHAIN_FAILED',
          message: 'Invalid Ethereum address format',
        },
      }, { status: 400 });
    }

    const blockchainService = BlockchainService.getInstance();
    const result = await blockchainService.verifyKYCHash(userAddress);

    if (result.error) {
      return NextResponse.json<APIResponse>({
        success: false,
        error: {
          code: 'BLOCKCHAIN_FAILED',
          message: result.error,
        },
      }, { status: 500 });
    }

    return NextResponse.json<APIResponse>({
      success: true,
      data: {
        isVerified: result.isVerified,
        hash: result.hash,
        timestamp: result.timestamp,
      },
      message: result.isVerified ? 'KYC verification found on blockchain' : 'No KYC verification found',
    });

  } catch (error) {
    console.error('Blockchain verification API error:', error);
    return NextResponse.json<APIResponse>({
      success: false,
      error: {
        code: 'BLOCKCHAIN_FAILED',
        message: error instanceof Error ? error.message : 'Blockchain verification failed',
      },
    }, { status: 500 });
  }
}