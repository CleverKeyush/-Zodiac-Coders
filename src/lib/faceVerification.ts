import * as faceapi from 'face-api.js';
import { FaceVerificationResult } from '@/types';

export class FaceVerificationService {
  private static instance: FaceVerificationService;
  private modelsLoaded = false;

  static getInstance(): FaceVerificationService {
    if (!FaceVerificationService.instance) {
      FaceVerificationService.instance = new FaceVerificationService();
    }
    return FaceVerificationService.instance;
  }

  // Load face-api.js models
  async loadModels(): Promise<void> {
    if (this.modelsLoaded) return;

    try {
      const MODEL_URL = '/models'; // Models should be in public/models directory
      
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      ]);

      this.modelsLoaded = true;
      console.log('Face-api.js models loaded successfully');
    } catch (error) {
      console.error('Failed to load face-api.js models:', error);
      throw new Error('Failed to load face recognition models');
    }
  }

  // Load image from URL
  private async loadImage(imageUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageUrl;
    });
  }

  // Extract face descriptor from image
  private async extractFaceDescriptor(imageUrl: string): Promise<Float32Array | null> {
    try {
      const img = await this.loadImage(imageUrl);
      
      const detection = await faceapi
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        return null;
      }

      return detection.descriptor;
    } catch (error) {
      console.error('Face extraction error:', error);
      return null;
    }
  }
  
  // Extract face from document and return as data URL
  async extractFaceFromDocument(documentHash: string): Promise<string | null> {
    try {
      // Ensure models are loaded
      await this.loadModels();
      
      // Construct IPFS URL
      const imageUrl = `https://ipfs.io/ipfs/${documentHash}`;
      const img = await this.loadImage(imageUrl);
      
      // Detect face
      const detection = await faceapi
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks();
      
      if (!detection) {
        console.log('No face detected in document');
        return null;
      }
      
      // Check if we're in a browser environment
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        console.log('Not in browser environment, cannot create canvas');
        // For server-side, we can't create a canvas, so return a placeholder or null
        return null;
      }
      
      try {
        // Create a canvas to extract the face
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (!context) {
          console.log('Could not get canvas context');
          return null;
        }
        
        // Get face box with some padding
        const box = detection.detection.box;
        const padding = {
          width: box.width * 0.4,
          height: box.height * 0.4
        };
        
        // Ensure we don't go outside the image boundaries
        const x = Math.max(0, box.x - padding.width);
        const y = Math.max(0, box.y - padding.height);
        const width = Math.min(img.width - x, box.width + padding.width * 2);
        const height = Math.min(img.height - y, box.height + padding.height * 2);
        
        // Set canvas size to face dimensions plus padding
        canvas.width = width;
        canvas.height = height;
        
        // Draw the face region to the canvas
        context.drawImage(
          img,
          x, y, width, height,
          0, 0, canvas.width, canvas.height
        );
        
        // Convert canvas to data URL
        return canvas.toDataURL('image/jpeg', 0.9);
      } catch (canvasError) {
        console.error('Canvas error:', canvasError);
        
        // Fallback: if we can't extract the face, return the full image
        // This is better than returning null for the UI
        if (img.src) {
          return img.src;
        }
        return null;
      }
    } catch (error) {
      console.error('Face extraction error:', error);
      return null;
    }
  }

  // Calculate cosine similarity between two face descriptors
  private calculateCosineSimilarity(desc1: Float32Array, desc2: Float32Array): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < desc1.length; i++) {
      dotProduct += desc1[i] * desc2[i];
      norm1 += desc1[i] * desc1[i];
      norm2 += desc2[i] * desc2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }

  // Verify faces between ID document and selfie
  async verifyFaces(idDocumentHash: string, selfieHash: string): Promise<FaceVerificationResult> {
    try {
      // Ensure models are loaded
      await this.loadModels();

      // Construct IPFS URLs
      const idImageUrl = `https://ipfs.io/ipfs/${idDocumentHash}`;
      const selfieImageUrl = `https://ipfs.io/ipfs/${selfieHash}`;

      // Extract face descriptors
      const [idDescriptor, selfieDescriptor] = await Promise.all([
        this.extractFaceDescriptor(idImageUrl),
        this.extractFaceDescriptor(selfieImageUrl),
      ]);

      if (!idDescriptor) {
        return {
          similarityScore: 0,
          isMatch: false,
          confidence: 0,
          status: 'failed',
          error: 'No face detected in ID document',
        };
      }

      if (!selfieDescriptor) {
        return {
          similarityScore: 0,
          isMatch: false,
          confidence: 0,
          status: 'failed',
          error: 'No face detected in selfie',
        };
      }

      // Calculate similarity
      const similarity = this.calculateCosineSimilarity(idDescriptor, selfieDescriptor);
      const threshold = 0.80;
      const isMatch = similarity >= threshold;

      // Calculate confidence based on how far from threshold
      let confidence: number;
      if (isMatch) {
        confidence = Math.min(95, 70 + (similarity - threshold) * 100);
      } else {
        confidence = Math.max(5, 70 - (threshold - similarity) * 100);
      }

      return {
        similarityScore: Math.round(similarity * 100) / 100,
        isMatch,
        confidence: Math.round(confidence),
        status: 'success',
      };

    } catch (error) {
      console.error('Face verification error:', error);
      return {
        similarityScore: 0,
        isMatch: false,
        confidence: 0,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Face verification failed',
      };
    }
  }

  // Detect multiple faces in an image (for validation)
  async detectFaces(imageUrl: string): Promise<number> {
    try {
      await this.loadModels();
      const img = await this.loadImage(imageUrl);
      
      const detections = await faceapi.detectAllFaces(
        img,
        new faceapi.TinyFaceDetectorOptions()
      );

      return detections.length;
    } catch (error) {
      console.error('Face detection error:', error);
      return 0;
    }
  }

  // Validate image quality for face verification
  async validateImageQuality(imageUrl: string): Promise<{
    isValid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      await this.loadModels();
      const img = await this.loadImage(imageUrl);

      // Check image dimensions
      if (img.width < 200 || img.height < 200) {
        issues.push('Image resolution too low (minimum 200x200)');
      }

      // Detect faces
      const faceCount = await this.detectFaces(imageUrl);
      
      if (faceCount === 0) {
        issues.push('No face detected in image');
      } else if (faceCount > 1) {
        issues.push('Multiple faces detected - please use image with single face');
      }

      return {
        isValid: issues.length === 0,
        issues,
      };

    } catch (error) {
      issues.push('Failed to validate image quality');
      return {
        isValid: false,
        issues,
      };
    }
  }
}