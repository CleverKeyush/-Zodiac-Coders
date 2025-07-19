import { NextRequest, NextResponse } from "next/server";
import { APIResponse, FaceVerificationResult } from "@/types";
import { OrkesApiClient } from "@/lib/orkesClient";
import { CONDUCTOR_CONFIG, TASK_NAMES } from "@/config/conductor";

// Initialize Orkes Conductor client
const orkesClient = new OrkesApiClient(CONDUCTOR_CONFIG);

export async function POST(request: NextRequest) {
  try {
    const { documentFaceUrl, selfieUrl, threshold } = await request.json();

    if (!documentFaceUrl || !selfieUrl) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: "FACE_VERIFICATION_FAILED",
            message: "Both document face URL and selfie URL are required",
          },
        },
        { status: 400 }
      );
    }

    console.log("Processing face verification request:", {
      documentFaceUrl,
      selfieUrl,
      threshold,
    });

    // Execute face verification task using Orkes Conductor
    const taskInput = {
      documentFaceUrl,
      selfieUrl,
      threshold: threshold || 0.8,
    };

    console.log("📤 Executing face verification task with input:", taskInput);

    // Execute the face verification task
    const taskResult = await orkesClient.taskResource.executeTask(
      TASK_NAMES.FACE_VERIFICATION,
      taskInput
    );

    console.log("📥 Face verification task execution result:", taskResult);

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
        `📊 Face verification task status (attempt ${attempts}): ${taskStatus.status}`
      );

      if (taskStatus.status === "COMPLETED") {
        taskOutput = taskStatus.outputData;
        break;
      } else if (
        taskStatus.status === "FAILED" ||
        taskStatus.status === "FAILED_WITH_TERMINAL_ERROR"
      ) {
        throw new Error(
          `Face verification task failed: ${
            taskStatus.reasonForIncompletion || "Unknown error"
          }`
        );
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, pollingInterval));
    }

    if (!taskOutput) {
      throw new Error("Face verification task timed out");
    }

    console.log("✅ Face verification completed:", taskOutput);

    // Transform the output to match our FaceVerificationResult interface
    const result: FaceVerificationResult = {
      similarityScore: taskOutput.confidence || 0,
      isMatch: taskOutput.isMatch || false,
      confidence: taskOutput.confidence || 0,
      status: taskOutput.status || "failed",
      error:
        taskOutput.status !== "success"
          ? "Face verification failed"
          : undefined,
    };

    return NextResponse.json<APIResponse<FaceVerificationResult>>({
      success: result.status === "success" && result.isMatch,
      data: result,
      message:
        result.status === "success"
          ? result.isMatch
            ? "Face verification passed"
            : "Face verification failed - faces do not match"
          : "Face verification failed",
    });
  } catch (error) {
    console.error("❌ Face verification API error:", error);
    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: "FACE_VERIFICATION_FAILED",
          message:
            error instanceof Error ? error.message : "Face verification failed",
        },
      },
      { status: 500 }
    );
  }
}
