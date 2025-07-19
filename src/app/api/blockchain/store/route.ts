import { NextRequest, NextResponse } from "next/server";
import { APIResponse } from "@/types";
import { OrkesApiClient } from "@/lib/orkesClient";
import { CONDUCTOR_CONFIG, TASK_NAMES } from "@/config/conductor";

// Initialize Orkes Conductor client
const orkesClient = new OrkesApiClient(CONDUCTOR_CONFIG);

export async function POST(request: NextRequest) {
  try {
    const { kycData, userAddress } = await request.json();

    if (!kycData || !userAddress) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: "BLOCKCHAIN_FAILED",
            message: "KYC data and user address are required",
          },
        },
        { status: 400 }
      );
    }

    // Validate Ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: "BLOCKCHAIN_FAILED",
            message: "Invalid Ethereum address format",
          },
        },
        { status: 400 }
      );
    }

    console.log("Processing blockchain storage request:", {
      userAddress,
      hasKycData: !!kycData,
    });

    // Execute blockchain storage task using Orkes Conductor
    const taskInput = {
      kycData,
      userAddress,
    };

    console.log("📤 Executing blockchain storage task with input:", taskInput);

    // Execute the blockchain storage task
    const taskResult = await orkesClient.taskResource.executeTask(
      TASK_NAMES.BLOCKCHAIN_STORAGE,
      taskInput
    );

    console.log("📥 Blockchain storage task execution result:", taskResult);

    // Poll for task completion
    const maxAttempts = 60; // 60 seconds max for blockchain operations
    const pollingInterval = 2000; // 2 seconds
    let attempts = 0;
    let taskOutput = null;

    while (attempts < maxAttempts) {
      attempts++;

      // Get task status
      const taskStatus = await orkesClient.taskResource.getTask(
        taskResult.taskId
      );

      console.log(
        `📊 Blockchain storage task status (attempt ${attempts}): ${taskStatus.status}`
      );

      if (taskStatus.status === "COMPLETED") {
        taskOutput = taskStatus.outputData;
        break;
      } else if (
        taskStatus.status === "FAILED" ||
        taskStatus.status === "FAILED_WITH_TERMINAL_ERROR"
      ) {
        throw new Error(
          `Blockchain storage task failed: ${
            taskStatus.reasonForIncompletion || "Unknown error"
          }`
        );
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, pollingInterval));
    }

    if (!taskOutput) {
      throw new Error("Blockchain storage task timed out");
    }

    console.log("✅ Blockchain storage completed:", taskOutput);

    if (taskOutput.status === "success") {
      return NextResponse.json<APIResponse>({
        success: true,
        data: {
          transactionHash: taskOutput.transactionHash,
          blockchainHash:
            taskOutput.blockchainHash || taskOutput.transactionHash,
          blockNumber: taskOutput.blockNumber,
        },
        message: "KYC hash stored successfully on blockchain",
      });
    } else {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: "BLOCKCHAIN_FAILED",
            message:
              taskOutput.error || "Failed to store KYC hash on blockchain",
          },
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("❌ Blockchain storage API error:", error);
    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: "BLOCKCHAIN_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "Blockchain storage failed",
        },
      },
      { status: 500 }
    );
  }
}
