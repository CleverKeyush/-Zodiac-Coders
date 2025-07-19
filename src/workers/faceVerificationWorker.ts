import { TASK_NAMES } from "@/config/conductor";
import { OrkesWorkerClient } from "@/lib/orkesClient";

/**
 * Face Verification Worker for Orkes Conductor
 * This worker compares faces between document and selfie images
 */
export class FaceVerificationWorker {
  private workerClient: OrkesWorkerClient;

  constructor(workerClient: OrkesWorkerClient) {
    this.workerClient = workerClient;
  }

  /**
   * Start the face verification worker
   */
  async start() {
    console.log("🚀 Starting Face Verification Worker...");

    // Register the face verification task with Orkes Conductor
    this.workerClient.registerWorker(
      TASK_NAMES.FACE_VERIFICATION,
      1,
      this.processFaceVerification.bind(this),
      {
        pollingInterval: 2000, // Poll every 2 seconds
        domain: "kyc", // Optional domain
        concurrency: 3, // Process up to 3 tasks concurrently
      }
    );

    console.log(
      `✅ Face Verification Worker registered for task: ${TASK_NAMES.FACE_VERIFICATION}`
    );
  }

  /**
   * Process face verification task
   */
  async processFaceVerification(inputData: any) {
    try {
      console.log("Processing face verification task:", inputData);

      const { documentFaceUrl, selfieUrl, threshold = 0.8 } = inputData;

      if (!documentFaceUrl || !selfieUrl) {
        throw new Error("Both document face URL and selfie URL are required");
      }

      console.log(
        `Comparing faces: document=${documentFaceUrl}, selfie=${selfieUrl}, threshold=${threshold}`
      );

      // Use the FaceVerificationService for real face comparison
      const { FaceVerificationService } = await import(
        "@/lib/faceVerification"
      );
      const faceService = FaceVerificationService.getInstance();

      // Convert URLs to IPFS hashes if they are IPFS URLs
      const docHash = documentFaceUrl.includes("ipfs.io/ipfs/")
        ? documentFaceUrl.split("ipfs.io/ipfs/")[1]
        : documentFaceUrl;
      const selfieHash = selfieUrl.includes("ipfs.io/ipfs/")
        ? selfieUrl.split("ipfs.io/ipfs/")[1]
        : selfieUrl;

      // Perform real face verification
      const verificationResult = await faceService.verifyFaces(
        docHash,
        selfieHash
      );

      const result = {
        isMatch: verificationResult.isMatch,
        confidence: verificationResult.confidence,
        similarityScore: verificationResult.similarityScore,
        status: verificationResult.status,
        error: verificationResult.error,
      };

      console.log(
        `✅ Face verification completed: match=${result.isMatch}, confidence=${result.confidence}%`
      );

      return result;
    } catch (error) {
      console.error(
        `❌ Face verification task failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );

      return {
        isMatch: false,
        confidence: 0,
        similarityScore: 0,
        status: "failed",
        error:
          error instanceof Error ? error.message : "Face verification failed",
      };
    }
  }
}
