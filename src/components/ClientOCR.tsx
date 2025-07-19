"use client";

import React, { useState } from "react";
import { OCRResult } from "@/types";

interface ClientOCRProps {
  file: File | null;
  onOCRComplete: (result: OCRResult) => void;
  onOCRError: (error: string) => void;
}

/**
 * Client-side OCR component that can be used as an alternative to server-side OCR
 * This component uses the OCR API but could be modified to use Tesseract.js directly
 * in the browser if needed in the future.
 */
export default function ClientOCR({
  file,
  onOCRComplete,
  onOCRError,
}: ClientOCRProps) {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  // Process OCR when file changes
  React.useEffect(() => {
    if (!file) return;

    const processOCR = async () => {
      try {
        setProcessing(true);
        setProgress(10);

        // Create FormData to send the file
        const formData = new FormData();
        formData.append("file", file);
        formData.append(
          "type",
          file.name.toLowerCase().includes("aadhaar") ? "aadhaar" : "pan"
        );

        setProgress(30);

        // Call OCR API
        const response = await fetch("/api/ocr", {
          method: "POST",
          body: formData,
        });

        setProgress(70);

        if (!response.ok) {
          throw new Error(
            `OCR API error: ${response.status} ${response.statusText}`
          );
        }

        const result = await response.json();
        setProgress(100);

        if (result.success && result.data) {
          onOCRComplete(result.data);
        } else {
          onOCRError(result.error?.message || "OCR processing failed");
        }
      } catch (error) {
        console.error("OCR processing error:", error);
        onOCRError(
          error instanceof Error ? error.message : "OCR processing failed"
        );
      } finally {
        setProcessing(false);
      }
    };

    processOCR();
  }, [file, onOCRComplete, onOCRError]);

  if (!file) return null;

  return (
    <div className="mt-4">
      {processing && (
        <div className="space-y-2">
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-teal-900 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-center text-muted-foreground">
            Processing OCR... {progress}%
          </p>
        </div>
      )}
    </div>
  );
}
