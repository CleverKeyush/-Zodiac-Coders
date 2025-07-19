"use client";

import { useEffect, useRef } from "react";
import rough from "roughjs";

interface HandDrawnArrowProps {
  className?: string;
  text?: string;
  arrowDirection?: "down" | "up" | "left" | "right";
  textClassName?: string;
}

export const HandDrawnArrow = ({
  className = "",
  text = "Get Started",
  arrowDirection = "down",
  textClassName = "",
}: HandDrawnArrowProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rc = rough.canvas(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set canvas size
    const width = 120;
    const height = 80;
    canvas.width = width;
    canvas.height = height;

    // Draw hand-drawn arrow based on direction
    const options = {
      stroke: "#06b6d4", // turquoise color
      strokeWidth: 3,
      roughness: 2.5,
      bowing: 3,
      fill: "#06b6d4",
      fillStyle: "solid" as const,
    };

    switch (arrowDirection) {
      case "down":
        // Arrow pointing down
        rc.line(60, 10, 60, 50, options);
        // Arrowhead
        rc.line(45, 35, 60, 50, options);
        rc.line(75, 35, 60, 50, options);
        break;
      case "up":
        // Arrow pointing up
        rc.line(60, 70, 60, 30, options);
        // Arrowhead
        rc.line(45, 45, 60, 30, options);
        rc.line(75, 45, 60, 30, options);
        break;
      case "left":
        // Arrow pointing left
        rc.line(100, 40, 20, 40, options);
        // Arrowhead
        rc.line(35, 25, 20, 40, options);
        rc.line(35, 55, 20, 40, options);
        break;
      case "right":
        // Arrow pointing right
        rc.line(20, 40, 100, 40, options);
        // Arrowhead
        rc.line(85, 25, 100, 40, options);
        rc.line(85, 55, 100, 40, options);
        break;
    }
  }, [arrowDirection]);

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {text && (
        <div
          className={`text-teal-900 font-semibold text-lg mb-2 animate-pulse ${textClassName}`}
        >
          {text}
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="pointer-events-none"
        style={{ filter: "drop-shadow(0 0 8px rgba(6, 182, 212, 0.3))" }}
      />
    </div>
  );
};
