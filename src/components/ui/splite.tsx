"use client";

import { Suspense, lazy } from "react";

const Spline = lazy(() => import("@splinetool/react-spline"));

interface SplineSceneProps {
  scene: string;
  className?: string;
}

export function SplineScene({ scene, className }: SplineSceneProps) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center">
            <span className="loader"></span>
          </div>
        }
      >
        <div className="absolute -inset-8 scale-150 pointer-events-none">
          <Spline scene={scene} className="w-full h-full pointer-events-none" />
        </div>
        {/* Bottom mask to hide any remaining watermark */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black to-transparent pointer-events-none z-10"></div>
      </Suspense>
    </div>
  );
}
