import { NextRequest, NextResponse } from 'next/server';
import { WorkflowService } from '@/lib/workflow';
import { APIResponse, WorkflowStatus } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  try {
    const { workflowId } = params;
    
    if (!workflowId) {
      return NextResponse.json<APIResponse>({
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Workflow ID is required',
        },
      }, { status: 400 });
    }

    const workflowService = WorkflowService.getInstance();
    const status = await workflowService.getWorkflowStatus(workflowId);

    return NextResponse.json<APIResponse<WorkflowStatus>>({
      success: true,
      data: status,
      message: 'Workflow status retrieved successfully',
    });

  } catch (error) {
    console.error('Workflow status error:', error);
    return NextResponse.json<APIResponse>({
      success: false,
      error: {
        code: 'UPLOAD_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get workflow status',
      },
    }, { status: 500 });
  }
}