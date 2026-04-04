"use client";

import { useEffect, useRef, useState } from "react";

const TRACK_PATH = "M 150 200 Q 150 80 400 80 Q 650 80 650 200 Q 650 320 400 320 Q 150 320 150 200";

export default function InteractiveTrain() {
  const trainRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [trainPos, setTrainPos] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);
  const [trail, setTrail] = useState<Array<{ x: number; y: number; id: number }>>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [windowSize, setWindowSize] = useState({ w: 1920, h: 1080 });
  
  const progress = useRef(0); // 0 to 1
  const animFrame = useRef<number>(0);
  const trailId = useRef(0);
  const lastTrailPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!pathRef.current) return;
    const path = pathRef.current;
    const totalLength = path.getTotalLength();

    const updatePosition = (p: number) => {
      const point = path.getPointAtLength(p * totalLength);
      // Map 800x400 SVG to viewport %
      // Note: The SVG in the site is usually centered. 
      // This is a simplified mapping that assumes the SVG covers most of the view or is used as a reference.
      // For a better experience, we'll use viewport-relative coordinates if possible, 
      // but since the railway is a background element, we'll try to match its scale.
      setTrainPos({ x: (point.x / 800) * 100, y: (point.y / 400) * 100 });
      
      // Update trail if moved significantly
      const dist = Math.hypot(point.x - lastTrailPos.current.x, point.y - lastTrailPos.current.y);
      if (dist > 15) {
        const id = ++trailId.current;
        const x = (point.x / 800) * 100;
        const y = (point.y / 400) * 100;
        setTrail(t => [...t.slice(-15), { x, y, id }]);
        setTimeout(() => setTrail(t => t.filter(i => i.id !== id)), 1500);
        lastTrailPos.current = { x: point.x, y: point.y };
      }
    };

    const animate = () => {
      if (!isDragging) {
        progress.current = (progress.current + 0.0008) % 1; // Slow auto-move
        updatePosition(progress.current);
      }
      animFrame.current = requestAnimationFrame(animate);
    };

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      
      // Simple path-snapping: 
      // We iterate through segments to find the closest progress point.
      // For better perf, we just check 100 points along the path.
      let minSourceDist = Infinity;
      let bestProgress = progress.current;
      
      const rect = path.getBoundingClientRect();
      const mouseX = ((clientX - rect.left) / rect.width) * 800;
      const mouseY = ((clientY - rect.top) / rect.height) * 400;

      for (let i = 0; i <= 100; i++) {
        const p = i / 100;
        const pt = path.getPointAtLength(p * totalLength);
        const d = Math.hypot(mouseX - pt.x, mouseY - pt.y);
        if (d < minSourceDist) {
          minSourceDist = d;
          bestProgress = p;
        }
      }
      
      progress.current = bestProgress;
      updatePosition(progress.current);
      if (!visible) setVisible(true);
    };

    const handleDown = (e: MouseEvent | TouchEvent) => {
      if (!trainRef.current) return;
      const rect = trainRef.current.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      
      const dist = Math.hypot(clientX - (rect.left + rect.width / 2), clientY - (rect.top + rect.height / 2));
      if (dist < 50) {
        setIsDragging(true);
        const a = new Audio("/sounds/train-move.mp3");
        a.volume = 0.15;
        a.play().catch(() => {});
      }
    };

    const handleUp = () => setIsDragging(false);

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("touchmove", handleMove);
    window.addEventListener("mousedown", handleDown);
    window.addEventListener("touchstart", handleDown);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchend", handleUp);
    
    animFrame.current = requestAnimationFrame(animate);
    setVisible(true);
    const handleResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("mousedown", handleDown);
      window.removeEventListener("touchstart", handleDown);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchend", handleUp);
      cancelAnimationFrame(animFrame.current);
    };
  }, [isDragging, visible]);

  return (
    <>
      <style>{`
        .train-trail-dot {
          position: fixed;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgba(212,168,67,0.4);
          pointer-events: none;
          z-index: 9996;
          animation: trainTrail 1.5s ease-out forwards;
          transform: translate(-50%, -50%);
        }
        @keyframes trainTrail {
          0% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(0.2); }
        }
        .interactive-train {
          position: fixed;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: radial-gradient(circle, #f0d060 0%, #d4a843 60%, rgba(212,168,67,0) 100%);
          box-shadow: 0 0 20px 4px rgba(212,168,67,0.6);
          pointer-events: all;
          z-index: 9999;
          cursor: grab;
          transform: translate(-50%, -50%);
          transition: transform 0.1s;
        }
        .interactive-train:active { cursor: grabbing; scale: 1.2; }
        .interactive-train::after {
          content: "";
          position: absolute;
          inset: -6px;
          border-radius: 50%;
          border: 1px solid rgba(212,168,67,0.4);
          animation: trainPulse 2s ease-in-out infinite;
        }
        @keyframes trainPulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.5); opacity: 0; }
        }
        .path-container {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: min(90vw, 800px);
          height: min(45vw, 400px);
          pointer-events: none;
          z-index: 0;
          opacity: 0;
        }
      `}</style>

      {/* Hidden reference path to match the hero SVG */}
      <div className="path-container">
        <svg viewBox="0 0 800 400" className="w-full h-full">
          <path ref={pathRef} d={TRACK_PATH} />
        </svg>
      </div>

      {trail.map(dot => (
        <div
          key={dot.id}
          className="train-trail-dot"
          style={{ 
            left: `calc(50% + ${(dot.x - 50) * (Math.min(90, 80000/windowSize.w)/100)}vw)`, 
            top: `calc(50% + ${(dot.y - 50) * (Math.min(45, 40000/windowSize.h)/100)}vh)` 
          }}
        />
      ))}

      <div
        ref={trainRef}
        className="interactive-train"
        style={{
          left: `calc(50% + ${(trainPos.x - 50) * (Math.min(90, 80000/windowSize.w)/100)}vw)`,
          top: `calc(50% + ${(trainPos.y - 50) * (Math.min(45, 40000/windowSize.h)/100)}vh)`,
          opacity: visible ? 1 : 0,
        }}
      />
    </>
  );
}
