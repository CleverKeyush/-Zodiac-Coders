import { NextRequest, NextResponse } from "next/server";
import { APIResponse, ComplianceResult } from "@/types";
import { OrkesApiClient } from "@/lib/orkesClient";
import { CONDUCTOR_CONFIG, TASK_NAMES } from "@/config/conductor";

// Initialize Orkes Conductor client
const orkesClient = new OrkesApiClient(CONDUCTOR_CONFIG);

export async function POST(request: NextRequest) {
  try {
    const { extractedData, documentType, jurisdiction } = await request.json();

    if (!extractedData) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: "COMPLIANCE_FAILED",
            message: "Extracted data is required for compliance check",
          },
        },
        { status: 400 }
      );
    }

    console.log("Processing compliance check request:", {
      extractedData,
      documentType,
      jurisdiction,
    });

    // Execute compliance check task using Orkes Conductor
    const taskInput = {
      extractedData,
      documentType: documentType || "identity_document",
      jurisdiction: jurisdiction || "IN",
    };

    console.log("📤 Executing compliance check task with input:", taskInput);

    // Execute the compliance check task
    const taskResult = await orkesClient.taskResource.executeTask(
      TASK_NAMES.COMPLIANCE_CHECK,
      taskInput
    );

    console.log("📥 Compliance check task execution result:", taskResult);

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
        `📊 Compliance check task status (attempt ${attempts}): ${taskStatus.status}`
      );

      if (taskStatus.status === "COMPLETED") {
        taskOutput = taskStatus.outputData;
        break;
      } else if (
        taskStatus.status === "FAILED" ||
        taskStatus.status === "FAILED_WITH_TERMINAL_ERROR"
      ) {
        throw new Error(
          `Compliance check task failed: ${
            taskStatus.reasonForIncompletion || "Unknown error"
          }`
        );
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, pollingInterval));
    }

    if (!taskOutput) {
      throw new Error("Compliance check task timed out");
    }

    console.log("✅ Compliance check completed:", taskOutput);

    // Transform the output to match our ComplianceResult interface
    const result: ComplianceResult = {
      status: taskOutput.status === "passed" ? "passed" : "failed",
      checks: {
        fieldConsistency: taskOutput.checks?.fieldConsistency || false,
        logicalValidation: taskOutput.checks?.logicalValidation || false,
        tamperingDetection: taskOutput.checks?.tamperingDetection || false,
        documentPresence: taskOutput.checks?.documentPresence || false,
      },
      failureReasons: taskOutput.failureReasons || [],
    };

    return NextResponse.json<APIResponse<ComplianceResult>>({
      success: result.status === "passed",
      data: result,
      message:
        result.status === "passed"
          ? "Compliance validation passed"
          : "Compliance validation failed",
    });
  } catch (error) {
    console.error("❌ Compliance API error:", error);
    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: "COMPLIANCE_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "Compliance validation failed",
        },
      },
      { status: 500 }
    );
  }
}
