"use client";

import { Suspense, lazy, useState, useEffect } from "react";

const Spline = lazy(() => import("@splinetool/react-spline"));

interface SplineSceneProps {
  scene: string;
  className?: string;
}

export default function SplineScene({ scene, className }: SplineSceneProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      /* Hide Spline watermark */
      .spline-watermark,
      [class*="watermark"],
      [id*="watermark"],
      a[href*="spline.design"],
      div[style*="position: absolute"][style*="bottom"],
      div[style*="position: fixed"][style*="bottom"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      
      /* Additional selectors for Spline watermark */
      canvas + div,
      canvas ~ div[style*="position: absolute"],
      canvas ~ div[style*="z-index"] {
        display: none !important;
      }
      
      /* Hide any bottom-positioned elements that might be watermarks */
      div[style*="bottom: 16px"],
      div[style*="bottom: 20px"],
      div[style*="bottom: 24px"] {
        display: none !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Don't render if scene URL is placeholder or invalid
  if (!scene || scene.includes("your-scene-url-here") || hasError) {
    return (
      <div
        className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/20 to-blue-900/20 ${className}`}
      >
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-teal-900 to-lavender-400 opacity-20"></div>
          <p className="text-sm text-muted-foreground">3D Scene Placeholder</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center">
            <span className="loader">Loading 3D Scene...</span>
          </div>
        }
      >
        <Spline
          scene={scene}
          className={className}
          onError={() => setHasError(true)}
        />
      </Suspense>
    </div>
  );
}
