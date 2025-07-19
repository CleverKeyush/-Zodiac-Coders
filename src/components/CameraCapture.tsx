"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Camera as CameraIcon,
  RotateCcw,
  Check,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Camera } from "react-camera-pro";

interface CameraCaptureProps {
  onCapture: (imageBlob: Blob) => void;
  onError: (error: string) => void;
  countdownSeconds?: number;
}

export default function CameraCapture({
  onCapture,
  onError,
  countdownSeconds = 5,
}: CameraCaptureProps) {
  const cameraRef = useRef<any>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("user");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [autoCapturing, setAutoCapturing] = useState(false);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [testMode, setTestMode] = useState<boolean>(false);

  // Initialize camera loading
  useEffect(() => {
    const loadTimer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => {
      clearTimeout(loadTimer);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  // Auto-capture countdown
  const startAutoCapture = useCallback(() => {
    setAutoCapturing(true);
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

          setAutoCapturing(false);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [countdownSeconds, onError]);

  // Handle manual photo capture
  const handleCapturePhoto = useCallback(() => {
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
  }, [onError]);

  // Confirm captured photo
  const confirmCapture = useCallback(() => {
    if (!capturedImage) return;

    // Convert the captured image data URL to a blob
    fetch(capturedImage)
      .then((res) => res.blob())
      .then((blob) => {
        // Store test mode flag in session storage for the workflow to check
        if (testMode) {
          console.log("Test mode enabled - verification will always pass");
          sessionStorage.setItem("kyc_test_mode", "true");
        } else {
          sessionStorage.removeItem("kyc_test_mode");
        }

        // Pass the blob to the parent component
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
  }, []);

  // Switch camera (front/back)
  const switchCamera = useCallback(() => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  }, []);

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 mb-1">
          <h3 className="text-xl font-semibold metallic-text">
            Live Selfie Capture
          </h3>
          <div className="flex items-center">
            <label
              htmlFor="test-mode"
              className="text-xs text-muted-foreground mr-2"
            >
              Test Mode
            </label>
            <div className="relative inline-block w-10 h-5 rounded-full bg-gray-200 cursor-pointer">
              <input
                type="checkbox"
                id="test-mode"
                className="sr-only"
                checked={testMode}
                onChange={() => setTestMode(!testMode)}
              />
              <span
                className={`absolute left-1 top-1 w-3 h-3 rounded-full transition-transform duration-200 ease-in-out ${
                  testMode
                    ? "transform translate-x-5 bg-green-500"
                    : "bg-gray-400"
                }`}
              ></span>
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {testMode
            ? "Test mode enabled - verification will always pass"
            : `Click "Start Countdown" to automatically capture after ${countdownSeconds} seconds`}
        </p>
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

            {/* Camera overlay guides */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Face guide oval */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-64 border-2 border-teal-900/50 rounded-full"></div>

              {/* Instructions */}
              <div className="absolute bottom-4 left-0 right-0 text-center">
                <p className="text-white text-sm bg-black/50 px-3 py-1 rounded-full inline-block">
                  {autoCapturing
                    ? "Hold still for the photo"
                    : "Position your face in the oval"}
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
          /* Captured Image Preview */
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
              <p className="text-white text-sm">Starting camera...</p>
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
      <div className="flex justify-center space-x-3">
        {!capturedImage ? (
          <>
            <Button
              onClick={switchCamera}
              variant="outline"
              size="icon"
              title="Switch Camera"
              disabled={autoCapturing}
            >
              <RotateCcw className="w-4 h-4" />
            </Button>

            <Button
              onClick={startAutoCapture}
              variant="gradient"
              className="px-6"
              disabled={autoCapturing}
            >
              <CameraIcon className="w-4 h-4 mr-2" />
              {autoCapturing
                ? `Capturing in ${countdownValue}...`
                : "Start Countdown"}
            </Button>

            <Button
              onClick={handleCapturePhoto}
              variant="outline"
              className="px-6"
              disabled={autoCapturing}
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
      </div>
    </div>
  );
}
