import { TASK_NAMES } from "@/config/conductor";
import { OrkesWorkerClient } from "@/lib/orkesClient";

/**
 * Face Extraction Worker for Orkes Conductor
 * This worker extracts face images from identity documents
 */
export class FaceExtractionWorker {
  private workerClient: OrkesWorkerClient;

  constructor(workerClient: OrkesWorkerClient) {
    this.workerClient = workerClient;
  }

  /**
   * Start the face extraction worker
   */
  async start() {
    console.log("🚀 Starting Face Extraction Worker...");

    // Register the face extraction task with Orkes Conductor
    this.workerClient.registerWorker(
      TASK_NAMES.FACE_EXTRACTION,
      1,
      this.processFaceExtraction.bind(this),
      {
        pollingInterval: 2000, // Poll every 2 seconds
        domain: "kyc", // Optional domain
        concurrency: 3, // Process up to 3 tasks concurrently
      }
    );

    console.log(
      `✅ Face Extraction Worker registered for task: ${TASK_NAMES.FACE_EXTRACTION}`
    );
  }

  /**
   * Process face extraction task
   */
  async processFaceExtraction(inputData: any) {
    try {
      console.log("👤 Processing face extraction task:", inputData);

      const { imageUrl, documentType } = inputData;

      if (!imageUrl) {
        throw new Error("Image URL is required for face extraction");
      }

      console.log(
        `Extracting face from ${
          documentType || "unknown"
        } document: ${imageUrl}`
      );

      // Use the FaceVerificationService to extract face from document
      const { FaceVerificationService } = await import(
        "@/lib/faceVerification"
      );
      const faceService = FaceVerificationService.getInstance();

      // Extract face from the document image
      const faceImageUrl = await faceService.extractFaceFromDocument(imageUrl);

      if (!faceImageUrl) {
        return {
          faceImageUrl: "",
          confidence: 0,
          status: "failed",
          error: "No face detected in document",
        };
      }

      // Calculate confidence based on successful extraction
      const confidence = 90; // High confidence if face was successfully extracted

      const result = {
        faceImageUrl,
        confidence,
        status: "success",
      };

      console.log(
        `✅ Face extraction completed with confidence: ${result.confidence}%`
      );

      return result;
    } catch (error) {
      console.error(
        `❌ Face extraction task failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );

      return {
        faceImageUrl: "",
        confidence: 0,
        status: "failed",
        error:
          error instanceof Error ? error.message : "Face extraction failed",
      };
    }
  }
}
