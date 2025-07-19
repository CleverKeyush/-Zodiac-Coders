import {
  ConductorClient,
  KYC_WORKFLOW_DEFINITION,
  KYC_WORKFLOW_NAME,
} from "@/config/conductor";
import { WorkflowStatus } from "@/types";

export class WorkflowService {
  private static instance: WorkflowService;
  private conductorClient: ConductorClient;

  constructor() {
    this.conductorClient = new ConductorClient();
  }

  static getInstance(): WorkflowService {
    if (!WorkflowService.instance) {
      WorkflowService.instance = new WorkflowService();
    }
    return WorkflowService.instance;
  }

  // Initialize workflow system
  async initialize(): Promise<boolean> {
    try {
      // Check Conductor health
      const isHealthy = await this.conductorClient.healthCheck();
      if (!isHealthy) {
        throw new Error(
          "Conductor service is not available. Please ensure Orkes Conductor is running and accessible."
        );
      }

      // Register workflow definition
      await this.conductorClient.registerWorkflow(KYC_WORKFLOW_DEFINITION);
      console.log("✅ KYC workflow registered successfully");

      return true;
    } catch (error) {
      console.error("❌ Workflow initialization error:", error);
      throw error;
    }
  }

  // Start KYC verification workflow
  async startKYCWorkflow(input: {
    userId: string;
    userAddress: string;
    documents: {
      idDocument: string; // IPFS hash
      selfie: string; // IPFS hash
    };
  }): Promise<{
    success: boolean;
    workflowId?: string;
    error?: string;
  }> {
    try {
      // Transform input to match workflow definition
      const workflowInput = {
        documentImageUrl: `https://ipfs.io/ipfs/${input.documents.idDocument}`,
        selfieImageUrl: `https://ipfs.io/ipfs/${input.documents.selfie}`,
        documentType: "identity_document",
        fileName: `document_${input.userId}`,
        jurisdiction: "IN", // Default to India
        userAddress: input.userAddress,
      };

      console.log(
        "Starting Orkes Conductor workflow with input:",
        workflowInput
      );

      // Use Conductor for workflow orchestration
      const result = await this.conductorClient.startWorkflow(
        KYC_WORKFLOW_NAME,
        workflowInput,
        `kyc_${input.userId}_${Date.now()}`
      );

      console.log("Workflow started successfully:", result.workflowId);

      return {
        success: true,
        workflowId: result.workflowId,
      };
    } catch (error) {
      console.error("Workflow start error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to start workflow",
      };
    }
  }

  // Get workflow status
  async getWorkflowStatus(workflowId: string): Promise<WorkflowStatus> {
    try {
      console.log(`Getting workflow status for: ${workflowId}`);

      // Get status from Conductor
      const isHealthy = await this.conductorClient.healthCheck();
      if (!isHealthy) {
        throw new Error(
          "Conductor service is not available. Please ensure Orkes Conductor is running and accessible."
        );
      }

      const result = await this.conductorClient.getWorkflowStatus(workflowId);

      console.log(`📊 Workflow status retrieved: ${result.status}`);

      // Transform Conductor response to our WorkflowStatus format
      return {
        workflowId,
        status: result.status || "RUNNING",
        currentTask: result.currentTask,
        completedTasks: this.extractCompletedTasks(result),
        failureReason: result.reasonForIncompletion,
        output: result.output,
      };
    } catch (error) {
      console.error("❌ Get workflow status error:", error);
      throw error;
    }
  }

  // Extract completed tasks from Conductor workflow result
  private extractCompletedTasks(workflowResult: any): string[] {
    const completedTasks: string[] = [];

    if (workflowResult.tasks) {
      for (const task of workflowResult.tasks) {
        if (task.status === "COMPLETED") {
          completedTasks.push(task.taskReferenceName || task.taskDefName);
        }
      }
    }

    return completedTasks;
  }
}
