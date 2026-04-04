"use client";

import { useEffect, useRef, useState } from "react";

// A nice oval with a branch line - looks like a simple railway layout
const TRACK_PATH = "M 200 200 Q 200 100 400 100 Q 600 100 600 200 Q 600 300 400 300 Q 200 300 200 200";
const BRANCH_PATH = "M 600 200 L 700 200 Q 720 200 720 180 L 720 140";

export default function InteractiveTrain() {
  const trainRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const branchRef = useRef<SVGPathElement>(null);
  const [trainPos, setTrainPos] = useState({ x: 50, y: 50 });
  const [visible, setVisible] = useState(false);
  const [trail, setTrail] = useState<Array<{ x: number; y: number; id: number; age: number }>>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [pathSize, setPathSize] = useState({ w: 800, h: 400 });
  
  const progress = useRef(0);
  const animFrame = useRef<number>(0);
  const trailId = useRef(0);
  const lastTrailTime = useRef(0);
  const trainAngle = useRef(0);
  const lastPos = useRef({ x: 200, y: 200 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const path = pathRef.current;
    const branch = branchRef.current;
    if (!path) return;
    
    const mainPathLength = path.getTotalLength();
    const branchPathLength = branch?.getTotalLength() || 0;
    const totalLength = mainPathLength + branchPathLength;

    const updatePosition = (p: number) => {
      let point;
      let angle = 0;
      
      if (p <= mainPathLength / totalLength) {
        // On main oval
        const mainP = p / (mainPathLength / totalLength);
        point = path.getPointAtLength(mainP * mainPathLength);
        // Calculate angle from previous point
        if (mainP > 0.01) {
          const prev = path.getPointAtLength((mainP - 0.01) * mainPathLength);
          angle = Math.atan2(point.y - prev.y, point.x - prev.x) * (180 / Math.PI);
        }
      } else if (branch) {
        // On branch line
        const branchP = (p - mainPathLength / totalLength) / (branchPathLength / totalLength);
        point = branch.getPointAtLength(branchP * branchPathLength);
        if (branchP > 0.01) {
          const prev = branch.getPointAtLength((branchP - 0.01) * branchPathLength);
          angle = Math.atan2(point.y - prev.y, point.x - prev.x) * (180 / Math.PI);
        }
      }
      
      if (!point) return;
      
      const x = (point.x / pathSize.w) * 100;
      const y = (point.y / pathSize.h) * 100;
      setTrainPos({ x, y });
      trainAngle.current = angle;
      lastPos.current = { x: point.x, y: point.y };
      
      // Add trail dot
      const now = Date.now();
      if (now - lastTrailTime.current > 60) {
        lastTrailTime.current = now;
        const id = ++trailId.current;
        setTrail(t => [...t.slice(-25), { x, y, id, age: 0 }]);
        setTimeout(() => setTrail(t => t.filter(i => i.id !== id)), 2000);
      }
    };

    const animate = () => {
      if (!isDragging) {
        progress.current = (progress.current + 0.0005) % 1;
        updatePosition(progress.current);
      }
      animFrame.current = requestAnimationFrame(animate);
    };

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      
      const rect = path.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      
      // Convert mouse position to path coordinate
      const mouseX = ((clientX - rect.left) / rect.width) * pathSize.w;
      const mouseY = ((clientY - rect.top) / rect.height) * pathSize.h;

      // Find closest point on main path
      let minDist = Infinity;
      let bestP = 0;
      
      for (let i = 0; i <= 100; i++) {
        const p = i / 100;
        const pt = path.getPointAtLength(p * mainPathLength);
        const d = Math.hypot(mouseX - pt.x, mouseY - pt.y);
        if (d < minDist) {
          minDist = d;
          bestP = p;
        }
      }
      
      // Check branch path too
      if (branch) {
        for (let i = 0; i <= 50; i++) {
          const p = i / 50;
          const pt = branch.getPointAtLength(p * branchPathLength);
          const d = Math.hypot(mouseX - pt.x, mouseY - pt.y);
          if (d < minDist) {
            minDist = d;
            bestP = (mainPathLength / totalLength) + (p * (branchPathLength / totalLength));
          }
        }
      }
      
      progress.current = Math.max(0, Math.min(0.999, bestP * (mainPathLength / totalLength)));
      updatePosition(progress.current);
      if (!visible) setVisible(true);
    };

    const handleDown = (e: MouseEvent | TouchEvent) => {
      if (!trainRef.current) return;
      const rect = trainRef.current.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      
      const dist = Math.hypot(clientX - (rect.left + rect.width / 2), clientY - (rect.top + rect.height / 2));
      if (dist < 40) {
        setIsDragging(true);
        const a = new Audio("/sounds/train-move.mp3");
        a.volume = 0.2;
        a.play().catch(() => {});
      }
    };

    const handleUp = () => setIsDragging(false);

    const handleResize = () => {
      const container = document.getElementById("train-path-container");
      if (container) {
        const rect = container.getBoundingClientRect();
        // Match the hero SVG aspect ratio
        setPathSize({ w: 800, h: 400 });
      }
    };

    window.addEventListener("mousemove", handleMove, { passive: true });
    window.addEventListener("touchmove", handleMove, { passive: true });
    window.addEventListener("mousedown", handleDown);
    window.addEventListener("touchstart", handleDown);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchend", handleUp);
    window.addEventListener("resize", handleResize);
    
    animFrame.current = requestAnimationFrame(animate);
    setVisible(true);
    handleResize();

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("mousedown", handleDown);
      window.removeEventListener("touchstart", handleDown);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchend", handleUp);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animFrame.current);
    };
  }, [isDragging, visible, pathSize]);

  return (
    <>
      <style>{`
        .train-trail-dot {
          position: fixed;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: rgba(212,168,67,0.5);
          pointer-events: none;
          z-index: 9996;
          animation: trainTrailFade 2s ease-out forwards;
          transform: translate(-50%, -50%);
        }
        @keyframes trainTrailFade {
          0% { opacity: 0.6; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(0.2); }
        }
        .train-cursor {
          position: fixed;
          width: 32px;
          height: 20px;
          pointer-events: all;
          z-index: 9997;
          cursor: grab;
          transform: translate(-50%, -50%);
          transition: opacity 0.5s;
          filter: drop-shadow(0 0 8px rgba(212,168,67,0.8));
        }
        .train-cursor:active { cursor: grabbing; }
        .train-cursor svg { width: 100%; height: 100%; }
        .train-glow {
          position: absolute;
          inset: -15px;
          background: radial-gradient(circle, rgba(212,168,67,0.3) 0%, transparent 70%);
          border-radius: 50%;
          animation: trainGlow 1.5s ease-in-out infinite;
        }
        @keyframes trainGlow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.3); }
        }
        .track-path-svg {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: min(85vw, 800px);
          height: min(42.5vw, 400px);
          pointer-events: none;
          z-index: 1;
          opacity: 0.25;
        }
        @media (max-width: 640px) {
          .track-path-svg {
            width: 95vw;
            height: 47.5vw;
          }
        }
      `}</style>

      {/* Track path visible on page */}
      <svg className="track-path-svg" viewBox="0 0 800 400">
        {/* Main oval track - sleepers (dark) */}
        <path d={TRACK_PATH} fill="none" stroke="#1a1d28" strokeWidth="24" strokeLinecap="round"/>
        {/* Branch track - sleepers */}
        <path d={BRANCH_PATH} fill="none" stroke="#1a1d28" strokeWidth="16" strokeLinecap="round"/>
        
        {/* Main oval track - rails */}
        <path d={TRACK_PATH} fill="none" stroke="#2a2a3a" strokeWidth="18" strokeLinecap="round"/>
        {/* Branch track - rails */}
        <path d={BRANCH_PATH} fill="none" stroke="#2a2a3a" strokeWidth="12" strokeLinecap="round"/>
        
        {/* Main oval - running rail (golden) */}
        <path d={TRACK_PATH} fill="none" stroke="#d4a843" strokeWidth="2" strokeDasharray="12,8" strokeLinecap="round" opacity="0.6"/>
        {/* Branch - running rail */}
        <path d={BRANCH_PATH} fill="none" stroke="#d4a843" strokeWidth="2" strokeDasharray="8,6" strokeLinecap="round" opacity="0.5"/>
        
        {/* Station marker */}
        <rect x="360" y="155" width="80" height="50" rx="4" fill="#111520" stroke="#d4a843" strokeWidth="1.5" opacity="0.8"/>
        <text x="400" y="177" textAnchor="middle" fill="#d4a843" fontSize="8" fontFamily="monospace" fontWeight="bold" opacity="0.9">STATION</text>
        <rect x="370" y="185" width="60" height="12" rx="2" fill="#0a0d15" stroke="#d4a843" strokeWidth="0.5" opacity="0.6"/>
        
        {/* Hidden reference paths for interaction */}
        <path ref={pathRef} d={TRACK_PATH} fill="none" stroke="transparent" strokeWidth="30"/>
        <path ref={branchRef} d={BRANCH_PATH} fill="none" stroke="transparent" strokeWidth="20"/>
      </svg>

      {/* Trail dots */}
      {trail.map(dot => (
        <div
          key={dot.id}
          className="train-trail-dot"
          style={{ left: `${dot.x}%`, top: `${dot.y}%` }}
        />
      ))}

      {/* Train cursor - stylized locomotive */}
      <div
        ref={trainRef}
        className="train-cursor"
        style={{
          left: `${trainPos.x}%`,
          top: `${trainPos.y}%`,
          opacity: visible ? 1 : 0,
          transform: `translate(-50%, -50%) rotate(${trainAngle.current}deg)`,
        }}
      >
        <div className="train-glow" />
        <svg viewBox="0 0 40 24" fill="none">
          {/* Locomotive body */}
          <rect x="2" y="8" width="28" height="12" rx="3" fill="#d4a843"/>
          <rect x="4" y="10" width="8" height="8" rx="1.5" fill="#0a0d15"/>
          <rect x="14" y="10" width="6" height="8" rx="1" fill="#1a1d28"/>
          <rect x="22" y="10" width="6" height="8" rx="1" fill="#1a1d28"/>
          {/* Chimney */}
          <rect x="28" y="4" width="6" height="8" rx="1" fill="#d4a843"/>
          <rect x="29" y="2" width="4" height="3" rx="0.5" fill="#d4a843"/>
          {/* Boiler bands */}
          <rect x="8" y="9" width="1" height="10" fill="#b8942f"/>
          <rect x="12" y="9" width="1" height="10" fill="#b8942f"/>
          <rect x="18" y="9" width="1" height="10" fill="#b8942f"/>
          {/* Wheels */}
          <circle cx="10" cy="20" r="3" fill="#2a2a3a" stroke="#d4a843" strokeWidth="0.5"/>
          <circle cx="10" cy="20" r="1" fill="#d4a843"/>
          <circle cx="20" cy="20" r="3" fill="#2a2a3a" stroke="#d4a843" strokeWidth="0.5"/>
          <circle cx="20" cy="20" r="1" fill="#d4a843"/>
          <circle cx="28" cy="18" r="2.5" fill="#2a2a3a" stroke="#d4a843" strokeWidth="0.5"/>
          <circle cx="28" cy="18" r="0.8" fill="#d4a843"/>
          {/* Cowcatcher */}
          <path d="M 2 16 L 0 20 L 0 22 L 4 20 Z" fill="#b8942f"/>
          {/* Headlight */}
          <circle cx="32" cy="12" r="2" fill="#fff" opacity="0.9"/>
          <circle cx="32" cy="12" r="1" fill="#ffeb3b"/>
        </svg>
      </div>
    </>
  );
}
