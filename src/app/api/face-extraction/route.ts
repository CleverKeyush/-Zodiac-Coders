import { NextRequest, NextResponse } from "next/server";
import { APIResponse } from "@/types";
import { OrkesApiClient } from "@/lib/orkesClient";
import { CONDUCTOR_CONFIG, TASK_NAMES } from "@/config/conductor";

// Initialize Orkes Conductor client
const orkesClient = new OrkesApiClient(CONDUCTOR_CONFIG);

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, documentType } = await request.json();

    if (!imageUrl) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: "FACE_VERIFICATION_FAILED",
            message: "Image URL is required for face extraction",
          },
        },
        { status: 400 }
      );
    }

    console.log("Starting face extraction for:", { imageUrl, documentType });

    // Execute face extraction task using Orkes Conductor
    const taskInput = {
      imageUrl,
      documentType: documentType || "identity_document",
    };

    console.log("📤 Executing face extraction task with input:", taskInput);

    // Execute the face extraction task
    const taskResult = await orkesClient.taskResource.executeTask(
      TASK_NAMES.FACE_EXTRACTION,
      taskInput
    );

    console.log("📥 Face extraction task execution result:", taskResult);

    // Poll for task completion
    const maxAttempts = 30; // 30 seconds max
    const pollingInterval = 1000; // 1 second
    let attempts = 0;
    let taskOutput = null;

    while (attempts < maxAttempts) {
      attempts++;

      // Get task status
      const taskStatus = await orkesClient.taskResource.getTask(
        taskResult.taskId
      );

      console.log(
        `📊 Face extraction task status (attempt ${attempts}): ${taskStatus.status}`
      );

      if (taskStatus.status === "COMPLETED") {
        taskOutput = taskStatus.outputData;
        break;
      } else if (
        taskStatus.status === "FAILED" ||
        taskStatus.status === "FAILED_WITH_TERMINAL_ERROR"
      ) {
        throw new Error(
          `Face extraction task failed: ${
            taskStatus.reasonForIncompletion || "Unknown error"
          }`
        );
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, pollingInterval));
    }

    if (!taskOutput) {
      throw new Error("Face extraction task timed out");
    }

    console.log("✅ Face extraction completed:", taskOutput);

    return NextResponse.json<
      APIResponse<{ faceImageUrl: string; confidence: number }>
    >({
      success: taskOutput.status === "success",
      data: {
        faceImageUrl: taskOutput.faceImageUrl,
        confidence: taskOutput.confidence || 0,
      },
      message:
        taskOutput.status === "success"
          ? "Face extraction completed successfully"
          : "Face extraction failed",
    });
  } catch (error) {
    console.error("❌ Face extraction API error:", error);
    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: "FACE_VERIFICATION_FAILED",
          message:
            error instanceof Error ? error.message : "Face extraction failed",
        },
      },
      { status: 500 }
    );
  }
}
