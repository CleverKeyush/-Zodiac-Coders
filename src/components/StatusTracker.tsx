"use client";

import React, { useState, useEffect } from "react";
import {
  CheckCircle,
  Clock,
  AlertCircle,
  Shield,
  Eye,
  FileCheck,
  Hash,
  Database,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { WorkflowStatus, APIResponse } from "@/types";

interface StatusTrackerProps {
  workflowId: string;
  onComplete: (result: any) => void;
  onError: (error: string) => void;
}

interface TaskInfo {
  name: string;
  label: string;
  icon: React.ElementType;
  description: string;
}

const WORKFLOW_TASKS: TaskInfo[] = [
  {
    name: "upload_to_ipfs",
    label: "Document Upload",
    icon: Shield,
    description: "Uploading documents to IPFS storage",
  },
  {
    name: "ocr_processing",
    label: "OCR Processing",
    icon: FileCheck,
    description: "Extracting text from identity documents",
  },
  {
    name: "face_verification",
    label: "Face Verification",
    icon: Eye,
    description: "Comparing faces between ID and selfie",
  },
  {
    name: "compliance_check",
    label: "Compliance Check",
    icon: CheckCircle,
    description: "Validating document authenticity",
  },
  {
    name: "generate_hash",
    label: "Generate Hash",
    icon: Hash,
    description: "Creating verification hash",
  },
  {
    name: "store_on_blockchain",
    label: "Blockchain Storage",
    icon: Database,
    description: "Storing hash on Ethereum Sepolia",
  },
];

export default function StatusTracker({
  workflowId,
  onComplete,
  onError,
}: StatusTrackerProps) {
  const [status, setStatus] = useState<WorkflowStatus | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const [error, setError] = useState<string>("");

  // Poll workflow status
  useEffect(() => {
    if (!workflowId || !isPolling) return;

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/kyc/status/${workflowId}`);
        const result: APIResponse<WorkflowStatus> = await response.json();

        if (result.success && result.data) {
          setStatus(result.data);

          // Check if workflow is complete
          if (result.data.status === "COMPLETED") {
            setIsPolling(false);
            onComplete(result.data.output);
          } else if (
            result.data.status === "FAILED" ||
            result.data.status === "TERMINATED"
          ) {
            setIsPolling(false);
            onError(result.data.failureReason || "Workflow failed");
          }
        } else {
          throw new Error(result.error?.message || "Failed to get status");
        }
      } catch (error) {
        console.error("Status polling error:", error);
        setError(
          error instanceof Error ? error.message : "Failed to get status"
        );
      }
    };

    // Initial poll
    pollStatus();

    // Set up polling interval
    const interval = setInterval(pollStatus, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [workflowId, isPolling, onComplete, onError]);

  // Calculate progress percentage
  const calculateProgress = (): number => {
    if (!status) return 0;

    const totalTasks = WORKFLOW_TASKS.length;
    const completedTasks = status.completedTasks?.length || 0;

    return Math.round((completedTasks / totalTasks) * 100);
  };

  // Get task status
  const getTaskStatus = (
    taskName: string
  ): "completed" | "current" | "pending" | "failed" => {
    if (!status) return "pending";

    if (status.completedTasks?.includes(taskName)) {
      return "completed";
    }

    if (status.currentTask === taskName && status.status === "RUNNING") {
      return "current";
    }

    if (status.status === "FAILED" && status.currentTask === taskName) {
      return "failed";
    }

    return "pending";
  };

  const progress = calculateProgress();

  return (
    <div className="max-w-2xl mx-auto">
      <div className="glass-card p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold mb-4 metallic-text">
            Verification Progress
          </h3>
          <div className="space-y-4">
            <Progress value={progress} className="h-3" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Progress: {progress}%</span>
              <span>
                Status:{" "}
                {status?.status === "RUNNING"
                  ? "Processing"
                  : status?.status || "Starting"}
              </span>
            </div>
          </div>
        </div>

        {/* Task List */}
        <div className="space-y-4">
          {WORKFLOW_TASKS.map((task, index) => {
            const taskStatus = getTaskStatus(task.name);
            const Icon = task.icon;

            return (
              <div
                key={task.name}
                className={`flex items-center space-x-4 p-4 rounded-lg border transition-all ${
                  taskStatus === "completed"
                    ? "bg-green-500/10 border-green-500/30"
                    : taskStatus === "current"
                    ? "bg-turquoise-500/10 border-turquoise-500/30"
                    : taskStatus === "failed"
                    ? "bg-red-500/10 border-red-500/30"
                    : "bg-white/5 border-white/10"
                }`}
              >
                {/* Task Icon */}
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    taskStatus === "completed"
                      ? "bg-green-500/20"
                      : taskStatus === "current"
                      ? "bg-turquoise-500/20"
                      : taskStatus === "failed"
                      ? "bg-red-500/20"
                      : "bg-white/10"
                  }`}
                >
                  {taskStatus === "completed" ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : taskStatus === "current" ? (
                    <Clock className="w-5 h-5 text-teal-900 animate-spin" />
                  ) : taskStatus === "failed" ? (
                    <AlertCircle className="w-5 h-5 text-red-400" />
                  ) : (
                    <Icon
                      className={`w-5 h-5 ${
                        taskStatus === "completed"
                          ? "text-green-400"
                          : taskStatus === "current"
                          ? "text-teal-900"
                          : taskStatus === "failed"
                          ? "text-red-400"
                          : "text-muted-foreground"
                      }`}
                    />
                  )}
                </div>

                {/* Task Info */}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4
                      className={`font-semibold ${
                        taskStatus === "completed"
                          ? "text-green-400"
                          : taskStatus === "current"
                          ? "text-teal-900"
                          : taskStatus === "failed"
                          ? "text-red-400"
                          : "text-white"
                      }`}
                    >
                      {task.label}
                    </h4>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        taskStatus === "completed"
                          ? "bg-green-500/20 text-green-400"
                          : taskStatus === "current"
                          ? "bg-turquoise-500/20 text-teal-900"
                          : taskStatus === "failed"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-white/10 text-muted-foreground"
                      }`}
                    >
                      {taskStatus === "completed"
                        ? "Completed"
                        : taskStatus === "current"
                        ? "Processing"
                        : taskStatus === "failed"
                        ? "Failed"
                        : "Pending"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {task.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-center space-x-2 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span className="font-semibold">Error</span>
            </div>
            <p className="text-sm text-red-300 mt-2">{error}</p>
          </div>
        )}

        {/* Workflow Info */}
        {status && (
          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="text-xs text-muted-foreground space-y-1">
              <div>
                Workflow ID:{" "}
                <code className="bg-white/10 px-1 rounded">{workflowId}</code>
              </div>
              {status.currentTask && (
                <div>
                  Current Task:{" "}
                  <code className="bg-white/10 px-1 rounded">
                    {status.currentTask}
                  </code>
                </div>
              )}
              <div>Last Updated: {new Date().toLocaleTimeString()}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
