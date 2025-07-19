import { OrkesWorkerClient } from "@/lib/orkesClient";
import { FaceExtractionWorker } from "../workers/faceExtractionWorker";
import { FaceVerificationWorker } from "../workers/faceVerificationWorker";
import { ComplianceWorker } from "../workers/complianceWorker";
import { BlockchainWorker } from "../workers/blockchainWorker";
import { CONDUCTOR_CONFIG } from "../config/conductor";

/**
 * Start all KYC workflow workers
 * This script starts all the workers needed for the complete KYC verification workflow
 */
async function startAllWorkers() {
  console.log("🚀 Starting All KYC Workers...");

  try {
    // Initialize Orkes Conductor worker client
    console.log(
      "🔄 Connecting to Orkes Conductor at:",
      CONDUCTOR_CONFIG.serverUrl
    );
    const workerClient = new OrkesWorkerClient(CONDUCTOR_CONFIG, 2000); // 2 second polling interval

    // Create and start all workers
    const workers = [
      new FaceExtractionWorker(workerClient),
      new FaceVerificationWorker(workerClient),
      new ComplianceWorker(workerClient),
      new BlockchainWorker(workerClient),
    ];

    // Start all workers
    console.log("🔄 Starting workers...");
    await Promise.all(workers.map((worker) => worker.start()));

    console.log("✅ All KYC Workers started successfully");
    console.log("🔄 Workers are now polling for tasks...");
    console.log("");
    console.log("Active Workers:");
    console.log("  👤 Face Extraction Worker");
    console.log("  Face Verification Worker");
    console.log("  ⚖️ Compliance Check Worker");
    console.log("  ⛓️ Blockchain Storage Worker");
    console.log("");
    console.log(
      "Note: OCR processing is now handled directly via API (no worker needed)"
    );
    console.log("");
    console.log("Press Ctrl+C to stop all workers");

    // Keep the process running
    process.on("SIGINT", () => {
      console.log("");
      console.log("🛑 Shutting down all KYC Workers...");
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      console.log("");
      console.log("🛑 Shutting down all KYC Workers...");
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Failed to start KYC Workers:", error);
    process.exit(1);
  }
}

// Start all workers
startAllWorkers().catch((error) => {
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});
