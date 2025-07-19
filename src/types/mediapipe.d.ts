// MediaPipe type declarations for TypeScript
declare module "@mediapipe/face_mesh" {
  export interface FaceMeshOptions {
    locateFile?: (file: string) => string;
    maxNumFaces?: number;
    refineLandmarks?: boolean;
    minDetectionConfidence?: number;
    minTrackingConfidence?: number;
  }

  export interface FaceMeshResults {
    multiFaceLandmarks?: Array<
      Array<{
        x: number;
        y: number;
        z: number;
      }>
    >;
    image?: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement;
  }

  export class FaceMesh {
    constructor(config?: { locateFile?: (file: string) => string });
    setOptions(options: FaceMeshOptions): void;
    onResults(callback: (results: FaceMeshResults) => void): void;
    send(inputs: {
      image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;
    }): Promise<void>;
    close(): void;
  }
}

declare module "@mediapipe/camera_utils" {
  export interface CameraOptions {
    onFrame?: (input: { image: HTMLVideoElement }) => Promise<void>;
    width?: number;
    height?: number;
    facingMode?: "user" | "environment";
  }

  export class Camera {
    constructor(videoElement: HTMLVideoElement, options: CameraOptions);
    start(): Promise<void>;
    stop(): void;
  }
}
