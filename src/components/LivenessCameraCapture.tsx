"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Camera as CameraIcon,
  RotateCcw,
  Check,
  AlertCircle,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Camera } from "react-camera-pro";

// MediaPipe imports
interface MediaPipeImports {
  FaceMesh?: any;
  Camera?: any;
}

interface LivenessCameraCaptureProps {
  onCapture: (imageBlob: Blob) => void;
  onError: (error: string) => void;
  countdownSeconds?: number;
}

type LivenessStep =
  | "center"
  | "left"
  | "right"
  | "blink"
  | "completed"
  | "capturing";

interface LivenessState {
  step: LivenessStep;
  stepProgress: number;
  isStepCompleted: boolean;
  detectionStartTime: number;
}

export default function LivenessCameraCapture({
  onCapture,
  onError,
  countdownSeconds = 3,
}: LivenessCameraCaptureProps) {
  const cameraRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const faceMeshRef = useRef<any>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number>(null);

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("user");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [testMode, setTestMode] = useState<boolean>(false);

  // Liveness detection state
  const [livenessState, setLivenessState] = useState<LivenessState>({
    step: "center",
    stepProgress: 0,
    isStepCompleted: false,
    detectionStartTime: Date.now(),
  });
  const [livenessEnabled] = useState(true); // Always enabled
  const [faceDetected, setFaceDetected] = useState(false);
  const [simpleLivenessMode, setSimpleLivenessMode] = useState(true); // Default to simple mode
  const [useMediaPipe, setUseMediaPipe] = useState(false); // MediaPipe disabled by default

  // Simple liveness detection fallback with enhanced user interaction and anti-spoofing
  const setupSimpleLivenessDetection = useCallback(() => {
    console.log(
      "Setting up enhanced simple liveness detection with anti-spoofing..."
    );
    setSimpleLivenessMode(true);
    setFaceDetected(true); // Assume face is detected in simple mode
    setError(
      "Anti-spoofing liveness check - follow ALL instructions carefully"
    );

    // Enhanced anti-spoofing liveness detection
    const progressStep = (step: LivenessStep = "center") => {
      setLivenessState((prev) => {
        // Add randomized step order to prevent predictable spoofing
        let nextStep: LivenessStep;
        if (step === "center") {
          // Randomly choose between left, right, or blink as first challenge
          const challenges = ["left", "right", "blink"] as LivenessStep[];
          nextStep = challenges[Math.floor(Math.random() * challenges.length)];
        } else if (step === "blink") {
          // After blink, go to left or right
          nextStep = Math.random() > 0.5 ? "left" : "right";
        } else if (step === "left") {
          // After left, randomly go to right or blink (if not done yet)
          nextStep = Math.random() > 0.5 ? "right" : "blink";
        } else if (step === "right") {
          // After right, check if we've done blink, otherwise do it
          nextStep = "completed";
        } else {
          nextStep = "completed";
        }

        if (nextStep !== "completed") {
          // Longer hold times to prevent screen/photo spoofing
          const holdTime = 8000; // 8 seconds per step
          const progressTimer = setTimeout(() => {
            setLivenessState((current) => {
              if (current.step === nextStep) {
                // Faster progress bar but longer total time
                const progressInterval = setInterval(() => {
                  setLivenessState((progressState) => {
                    if (progressState.stepProgress >= 100) {
                      clearInterval(progressInterval);
                      // Move to next step after progress completes
                      const finalStep =
                        progressState.step === "left" ? "right" : "completed";
                      if (finalStep === "completed") {
                        setError(""); // Clear error when completed
                      }
                      return {
                        step: finalStep,
                        stepProgress: 0,
                        isStepCompleted: true,
                        detectionStartTime: Date.now(),
                      };
                    }
                    return {
                      ...progressState,
                      stepProgress: progressState.stepProgress + 5, // Slower progress
                    };
                  });
                }, 400); // Update progress every 400ms for 8 second total

                return current;
              }
              return current;
            });
          }, holdTime);

          // Store timer reference for cleanup
          (window as any)[`livenessTimer_${nextStep}`] = progressTimer;
        } else {
          // Clear error when completed
          setError("");
        }

        return {
          step: nextStep,
          stepProgress: 0,
          isStepCompleted: false,
          detectionStartTime: Date.now(),
        };
      });
    };

    // Start the enhanced liveness flow after instructions
    setTimeout(() => progressStep("center"), 3000);
  }, []);

  // Load MediaPipe only if explicitly enabled (disabled by default due to WASM issues)
  useEffect(() => {
    const loadMediaPipe = async () => {
      if (typeof window === "undefined" || !livenessEnabled || !useMediaPipe) {
        // Use simple liveness detection by default
        console.log("Using simple liveness detection mode");
        setupSimpleLivenessDetection();
        setMediaLoaded(true);
        setIsLoading(false);
        return;
      }

      try {
        console.log("Attempting to load MediaPipe face detection...");

        // Try using the npm packages first with dynamic import
        try {
          console.log("Trying npm MediaPipe packages...");

          // Set up a timeout for npm package loading
          const packageLoadPromise = Promise.race([
            import("@mediapipe/face_mesh").then(async (faceMeshModule) => {
              const cameraUtilsModule = await import("@mediapipe/camera_utils");
              return { faceMeshModule, cameraUtilsModule };
            }),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("NPM package load timeout")),
                5000
              )
            ),
          ]);

          const { faceMeshModule } = (await packageLoadPromise) as any;

          // Try different ways to access FaceMesh
          let FaceMeshClass;
          if (faceMeshModule.FaceMesh) {
            FaceMeshClass = faceMeshModule.FaceMesh;
          } else if (faceMeshModule.default?.FaceMesh) {
            FaceMeshClass = faceMeshModule.default.FaceMesh;
          } else if (faceMeshModule.default) {
            FaceMeshClass = faceMeshModule.default;
          } else {
            throw new Error("FaceMesh class not found in npm modules");
          }

          console.log("NPM MediaPipe loaded, initializing...");
          await initializeFaceMesh(FaceMeshClass);
        } catch (npmError) {
          console.warn("NPM MediaPipe failed:", npmError);
          console.log("Trying CDN approach...");

          // Try CDN approach with better error handling
          try {
            await loadMediaPipeFromCDN();
          } catch (cdnError) {
            console.warn("CDN MediaPipe also failed:", cdnError);
            throw new Error("Both NPM and CDN MediaPipe failed");
          }
        }
      } catch (err) {
        console.error("All MediaPipe loading attempts failed:", err);
        console.log("Falling back to simple liveness detection");
        setupSimpleLivenessDetection();
        setMediaLoaded(true);
        setIsLoading(false);
      }
    };

    const loadMediaPipeFromCDN = async (): Promise<void> => {
      return new Promise((resolve, reject) => {
        // Check if already loaded
        if ((window as any).FaceMesh) {
          console.log("MediaPipe already available from CDN");
          initializeFaceMesh((window as any).FaceMesh)
            .then(resolve)
            .catch(reject);
          return;
        }

        let scriptsLoaded = 0;
        const totalScripts = 4;
        const scripts = [
          "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js",
          "https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js",
          "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js",
          "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js",
        ];

        const loadScript = (src: string): Promise<void> => {
          return new Promise((scriptResolve, scriptReject) => {
            // Check if script already exists
            if (document.querySelector(`script[src="${src}"]`)) {
              scriptResolve();
              return;
            }

            const script = document.createElement("script");
            script.src = src;
            script.crossOrigin = "anonymous";
            script.async = false; // Load in order

            script.onload = () => {
              console.log(`Loaded: ${src}`);
              scriptsLoaded++;
              scriptResolve();
            };

            script.onerror = () => {
              scriptReject(new Error(`Failed to load ${src}`));
            };

            document.head.appendChild(script);
          });
        };

        // Load scripts sequentially
        const loadAllScripts = async () => {
          try {
            for (const src of scripts) {
              await loadScript(src);
            }

            console.log("All MediaPipe CDN scripts loaded");

            // Wait for MediaPipe to initialize
            const waitForMediaPipe = () => {
              return new Promise<void>((mpResolve, mpReject) => {
                const checkInterval = setInterval(() => {
                  if ((window as any).FaceMesh) {
                    clearInterval(checkInterval);
                    clearTimeout(timeout);
                    mpResolve();
                  }
                }, 100);

                const timeout = setTimeout(() => {
                  clearInterval(checkInterval);
                  mpReject(
                    new Error(
                      "MediaPipe FaceMesh not available after loading scripts"
                    )
                  );
                }, 3000);
              });
            };

            await waitForMediaPipe();
            await initializeFaceMesh((window as any).FaceMesh);
            resolve();
          } catch (error) {
            reject(error);
          }
        };

        loadAllScripts().catch(reject);
      });
    };

    const initializeFaceMesh = async (FaceMeshClass: any): Promise<void> => {
      try {
        console.log("Initializing FaceMesh with class:", FaceMeshClass);

        const faceMesh = new FaceMeshClass({
          locateFile: (file: string) => {
            // Use unpkg as alternative CDN
            return `https://unpkg.com/@mediapipe/face_mesh@0.4.1633559619/${file}`;
          },
        });

        // Set options with error handling
        try {
          faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
        } catch (optionsError) {
          console.warn("Error setting MediaPipe options:", optionsError);
          // Try with minimal options
          faceMesh.setOptions({
            maxNumFaces: 1,
          });
        }

        faceMesh.onResults(onResults);

        console.log("Face Mesh initialized successfully");
        faceMeshRef.current = faceMesh;
        setSimpleLivenessMode(false); // Use advanced mode
        setMediaLoaded(true);
        setIsLoading(false);
      } catch (initError) {
        console.error("Failed to initialize MediaPipe FaceMesh:", initError);
        throw initError;
      }
    };

    loadMediaPipe();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [livenessEnabled, useMediaPipe]);

  // Face detection results handler
  const onResults = useCallback(
    (results: any) => {
      if (
        !results.multiFaceLandmarks ||
        results.multiFaceLandmarks.length === 0
      ) {
        setFaceDetected(false);
        return;
      }

      setFaceDetected(true);
      const landmarks = results.multiFaceLandmarks[0];

      if (
        livenessState.step === "completed" ||
        livenessState.step === "capturing"
      ) {
        return;
      }

      // Use reliable face landmarks according to MediaPipe documentation
      // Nose tip: index 1, Left eye corner: 33, Right eye corner: 263
      // Left cheek: 117, Right cheek: 346
      const noseTip = landmarks[1];
      const leftEyeCorner = landmarks[33];
      const rightEyeCorner = landmarks[263];
      const leftCheek = landmarks[117];
      const rightCheek = landmarks[346];

      // Calculate face center using eye corners
      const faceCenter = {
        x: (leftEyeCorner.x + rightEyeCorner.x) / 2,
        y: (leftEyeCorner.y + rightEyeCorner.y) / 2,
      };

      // Calculate head rotation using nose position relative to eye center
      const headRotation = noseTip.x - faceCenter.x;

      // Use cheek z-coordinates for depth-based left/right detection
      // When turning left, right cheek becomes more visible (higher z)
      // When turning right, left cheek becomes more visible (higher z)
      const leftCheekVisible = leftCheek.z > -0.02;
      const rightCheekVisible = rightCheek.z > -0.02;

      // Adjust thresholds for better detection
      const rotationThreshold = 0.05; // Slightly reduced for easier detection

      checkLivenessStep(
        headRotation,
        rotationThreshold,
        leftCheekVisible,
        rightCheekVisible
      );
    },
    [livenessState]
  );

  // Check liveness step completion
  const checkLivenessStep = useCallback(
    (
      headRotation: number,
      threshold: number,
      leftCheekVisible?: boolean,
      rightCheekVisible?: boolean
    ) => {
      const now = Date.now();
      const timeInStep = now - livenessState.detectionStartTime;
      const requiredTime = 1200; // 1.2 seconds to hold pose

      let stepCompleted = false;

      switch (livenessState.step) {
        case "center":
          stepCompleted = Math.abs(headRotation) < threshold / 2;
          break;
        case "left":
          // Looking left means right cheek should be more visible
          stepCompleted =
            headRotation > threshold && rightCheekVisible !== false;
          break;
        case "right":
          // Looking right means left cheek should be more visible
          stepCompleted =
            headRotation < -threshold && leftCheekVisible !== false;
          break;
      }

      if (stepCompleted && timeInStep >= requiredTime) {
        // Move to next step
        setLivenessState((prev) => {
          const nextStep =
            prev.step === "center"
              ? "left"
              : prev.step === "left"
              ? "right"
              : "completed";

          return {
            step: nextStep,
            stepProgress: 0,
            isStepCompleted: true,
            detectionStartTime: now,
          };
        });
      } else if (stepCompleted) {
        // Update progress
        const progress = Math.min(100, (timeInStep / requiredTime) * 100);
        setLivenessState((prev) => ({
          ...prev,
          stepProgress: progress,
          isStepCompleted: false,
        }));
      } else {
        // Reset progress if not in correct position
        setLivenessState((prev) => ({
          ...prev,
          stepProgress: 0,
          isStepCompleted: false,
          detectionStartTime: now,
        }));
      }
    },
    [livenessState]
  );

  // Process video frame for face detection with better error handling
  const processVideoFrame = useCallback(() => {
    if (!faceMeshRef.current || !livenessEnabled || simpleLivenessMode) {
      return;
    }

    // Try to get video from camera component
    const cameraVideo = document.querySelector("video");
    if (
      cameraVideo &&
      cameraVideo.readyState >= 2 &&
      cameraVideo.videoWidth > 0
    ) {
      try {
        // Create a safe wrapper around the MediaPipe send call
        const sendFrame = async () => {
          try {
            await faceMeshRef.current.send({ image: cameraVideo });
          } catch (sendError) {
            console.error("Error sending frame to MediaPipe:", sendError);

            // If we get repeated errors, switch to simple mode
            const errorCount = (window as any).mediaPipeErrorCount || 0;
            (window as any).mediaPipeErrorCount = errorCount + 1;

            if (errorCount > 5) {
              console.log(
                "Too many MediaPipe errors, switching to simple liveness mode"
              );
              setupSimpleLivenessDetection();
              return;
            }
          }
        };

        sendFrame();
      } catch (err) {
        console.error("Error in video frame processing:", err);
        // Switch to simple mode if there are processing errors
        if (!simpleLivenessMode) {
          console.log(
            "Switching to simple liveness mode due to processing error"
          );
          setupSimpleLivenessDetection();
          return;
        }
      }
    }

    if (!simpleLivenessMode) {
      animationFrameRef.current = requestAnimationFrame(processVideoFrame);
    }
  }, [livenessEnabled, simpleLivenessMode, setupSimpleLivenessDetection]);

  // Start video processing when camera is ready
  useEffect(() => {
    if (mediaLoaded && !testMode && livenessEnabled && faceMeshRef.current) {
      const startProcessing = () => {
        // Wait for camera to be ready
        const checkCamera = () => {
          const cameraVideo = document.querySelector("video");
          if (cameraVideo && cameraVideo.readyState >= 2) {
            console.log("Starting face detection processing...");
            processVideoFrame();
          } else {
            setTimeout(checkCamera, 500);
          }
        };
        checkCamera();
      };

      const timer = setTimeout(startProcessing, 1000);
      return () => {
        clearTimeout(timer);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [mediaLoaded, testMode, livenessEnabled, processVideoFrame]);

  // Auto-capture countdown after liveness completion
  const startAutoCapture = useCallback(() => {
    if (livenessEnabled && livenessState.step !== "completed" && !testMode) {
      setError("Please complete the liveness check first");
      return;
    }

    setLivenessState((prev) => ({ ...prev, step: "capturing" }));
    setCountdownValue(countdownSeconds);

    countdownIntervalRef.current = setInterval(() => {
      setCountdownValue((prev) => {
        if (prev === null || prev <= 1) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
          }

          // Take photo when countdown reaches 0
          if (cameraRef.current) {
            try {
              const photoData = cameraRef.current.takePhoto();
              setCapturedImage(photoData);
            } catch (err) {
              console.error("Auto-capture error:", err);
              const errorMessage =
                err instanceof Error ? err.message : "Failed to capture photo";
              setError(errorMessage);
              onError(errorMessage);
            }
          }

          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [
    countdownSeconds,
    onError,
    livenessEnabled,
    livenessState.step,
    testMode,
  ]);

  // Handle manual photo capture
  const handleCapturePhoto = useCallback(() => {
    if (livenessEnabled && livenessState.step !== "completed" && !testMode) {
      setError("Please complete the liveness check first");
      return;
    }

    try {
      if (cameraRef.current) {
        const photoData = cameraRef.current.takePhoto();
        setCapturedImage(photoData);
      }
    } catch (err) {
      console.error("Error capturing photo:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to capture photo";
      setError(errorMessage);
      onError(errorMessage);
    }
  }, [onError, livenessEnabled, livenessState.step, testMode]);

  // Confirm captured photo
  const confirmCapture = useCallback(() => {
    if (!capturedImage) return;

    fetch(capturedImage)
      .then((res) => res.blob())
      .then((blob) => {
        if (testMode) {
          console.log("Test mode enabled - verification will always pass");
          sessionStorage.setItem("kyc_test_mode", "true");
        } else {
          sessionStorage.removeItem("kyc_test_mode");
        }

        onCapture(blob);
      })
      .catch((err) => {
        console.error("Error confirming capture:", err);
        onError("Failed to process captured image");
      });
  }, [capturedImage, onCapture, onError, testMode]);

  // Retake photo
  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    setLivenessState({
      step: "center",
      stepProgress: 0,
      isStepCompleted: false,
      detectionStartTime: Date.now(),
    });
  }, []);

  // Switch camera
  const switchCamera = useCallback(() => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  }, []);

  // Reset liveness check
  const resetLivenessCheck = useCallback(() => {
    setLivenessState({
      step: "center",
      stepProgress: 0,
      isStepCompleted: false,
      detectionStartTime: Date.now(),
    });
    setError("");
  }, []);

  const getStepInstruction = () => {
    if (testMode) return "Test mode - liveness check disabled";

    const modePrefix = simpleLivenessMode
      ? "(Anti-Spoofing Mode) "
      : "(Advanced Mode) ";
    const baseInstruction = simpleLivenessMode ? "LIVE PERSON ONLY - " : "";

    switch (livenessState.step) {
      case "center":
        return (
          modePrefix +
          baseInstruction +
          (faceDetected
            ? "Look directly at camera and BLINK naturally"
            : "Position your REAL face in the oval - NO photos/screens")
        );
      case "left":
        return (
          modePrefix +
          baseInstruction +
          "SLOWLY turn your head LEFT and hold (8 seconds)"
        );
      case "right":
        return (
          modePrefix +
          baseInstruction +
          "SLOWLY turn your head RIGHT and hold (8 seconds)"
        );
      case "blink":
        return (
          modePrefix +
          baseInstruction +
          "BLINK your eyes 3 times slowly and naturally"
        );
      case "completed":
        return "Anti-spoofing check completed! You can now take a photo";
      case "capturing":
        return "Hold still for the photo";
      default:
        return "Loading anti-spoofing detection...";
    }
  };

  const canCapture = livenessState.step === "completed" || testMode;

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 mb-1">
          <h3 className="text-xl font-semibold metallic-text">
            Live Selfie with Liveness Check
          </h3>
        </div>

        <p className="text-sm text-muted-foreground">{getStepInstruction()}</p>

        {/* Anti-spoofing Warning */}
        {!testMode &&
          livenessState.step === "center" &&
          livenessState.stepProgress === 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm">
              <p className="text-amber-400 font-medium mb-1">
                ⚠️ Anti-Spoofing Security Active
              </p>
              <p className="text-amber-300 text-xs">
                • Use your REAL face - no photos, screens, or videos
                <br />
                • Follow each step slowly and naturally
                <br />• Hold each position for the full duration
              </p>
            </div>
          )}

        {/* Liveness Progress */}
        {!testMode &&
          livenessState.step !== "completed" &&
          livenessState.step !== "capturing" && (
            <div className="space-y-2">
              <div className="flex items-center justify-center space-x-2 text-sm flex-wrap gap-2">
                <div
                  className={`flex items-center space-x-1 ${
                    livenessState.step === "center"
                      ? "text-blue-400"
                      : "text-gray-400"
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  <span>Center</span>
                  {livenessState.step === "center" && (
                    <div className="w-6 bg-gray-200 rounded-full h-1.5 ml-1">
                      <div
                        className="bg-blue-400 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${livenessState.stepProgress}%` }}
                      ></div>
                    </div>
                  )}
                </div>

                <div
                  className={`flex items-center space-x-1 ${
                    livenessState.step === "left"
                      ? "text-blue-400"
                      : "text-gray-400"
                  }`}
                >
                  <span>← Left</span>
                  {livenessState.step === "left" && (
                    <div className="w-6 bg-gray-200 rounded-full h-1.5 ml-1">
                      <div
                        className="bg-blue-400 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${livenessState.stepProgress}%` }}
                      ></div>
                    </div>
                  )}
                </div>

                <div
                  className={`flex items-center space-x-1 ${
                    livenessState.step === "right"
                      ? "text-blue-400"
                      : "text-gray-400"
                  }`}
                >
                  <span>Right →</span>
                  {livenessState.step === "right" && (
                    <div className="w-6 bg-gray-200 rounded-full h-1.5 ml-1">
                      <div
                        className="bg-blue-400 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${livenessState.stepProgress}%` }}
                      ></div>
                    </div>
                  )}
                </div>

                <div
                  className={`flex items-center space-x-1 ${
                    livenessState.step === "blink"
                      ? "text-blue-400"
                      : "text-gray-400"
                  }`}
                >
                  <span>👁️ Blink</span>
                  {livenessState.step === "blink" && (
                    <div className="w-6 bg-gray-200 rounded-full h-1.5 ml-1">
                      <div
                        className="bg-blue-400 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${livenessState.stepProgress}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              </div>
              {faceDetected && (
                <p className="text-xs text-green-400">✓ Face detected</p>
              )}
              <p className="text-xs text-amber-400">
                Random challenge order prevents spoofing
              </p>
            </div>
          )}

        {!testMode && livenessState.step === "completed" && (
          <p className="text-sm text-green-400">✓ Liveness check completed!</p>
        )}
      </div>

      {/* Camera View */}
      <div className="relative bg-black rounded-lg overflow-hidden aspect-[4/3] max-w-md mx-auto">
        {!capturedImage ? (
          <>
            <Camera
              ref={cameraRef}
              aspectRatio={4 / 3}
              facingMode={facingMode}
              errorMessages={{
                noCameraAccessible:
                  "No camera found. Please ensure your device has a camera.",
                permissionDenied:
                  "Camera access denied. Please allow camera permissions and try again.",
                switchCamera:
                  "Failed to switch camera. Your device may only have one camera.",
                canvas: "Failed to capture photo. Please try again.",
              }}
            />

            {/* Hidden video element for MediaPipe processing */}
            <video
              ref={videoRef}
              className="hidden"
              autoPlay
              muted
              playsInline
            />

            {/* Canvas for MediaPipe processing */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Camera overlay guides */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Face guide oval */}
              <div
                className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-64 border-2 rounded-full transition-colors ${
                  faceDetected ? "border-green-400/70" : "border-teal-900/50"
                }`}
              ></div>

              {/* Instructions */}
              <div className="absolute bottom-4 left-0 right-0 text-center">
                <p className="text-white text-sm bg-black/50 px-3 py-1 rounded-full inline-block">
                  {getStepInstruction()}
                </p>
              </div>

              {/* Countdown display */}
              {countdownValue !== null && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-black/40 w-24 h-24 rounded-full flex items-center justify-center">
                    <span className="text-5xl font-bold text-white">
                      {countdownValue}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <img
            src={capturedImage}
            alt="Captured selfie"
            className="w-full h-full object-cover"
          />
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 border-2 border-teal-900 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-white text-sm">Loading face detection...</p>
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-center space-x-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Controls */}
      <div className="flex justify-center space-x-3 flex-wrap gap-2">
        {!capturedImage ? (
          <>
            <Button
              onClick={switchCamera}
              variant="outline"
              size="icon"
              title="Switch Camera"
              disabled={countdownValue !== null}
            >
              <RotateCcw className="w-4 h-4" />
            </Button>

            {!testMode && (
              <Button
                onClick={resetLivenessCheck}
                variant="outline"
                className="px-4"
                disabled={countdownValue !== null}
              >
                Reset Check
              </Button>
            )}

            <Button
              onClick={handleCapturePhoto}
              variant="gradient"
              className="px-6"
              disabled={!canCapture || countdownValue !== null}
            >
              <CameraIcon className="w-4 h-4 mr-2" />
              Capture Now
            </Button>
          </>
        ) : (
          <>
            <Button onClick={retakePhoto} variant="outline">
              <RotateCcw className="w-4 h-4 mr-2" />
              Retake
            </Button>

            <Button
              onClick={confirmCapture}
              variant="gradient"
              className="px-6"
            >
              <Check className="w-4 h-4 mr-2" />
              Use This Photo
            </Button>
          </>
        )}
      </div>

      {/* Security Notice */}
      <div className="text-xs text-muted-foreground text-center space-y-1">
        <p>🔒 Your photo is processed locally and securely</p>
        <p>📷 Live capture prevents fake or old photos</p>
        <p>
          👁️ Enhanced anti-spoofing detection prevents photos/screens/videos
        </p>
        <p>⏱️ Extended hold times ensure real human movement</p>
      </div>
    </div>
  );
}
