"use client";

import { useEffect, useRef, useState, useMemo } from "react";

// ============================================
// PROCEDURAL TRACK GENERATOR
// ============================================
function generateTrack(seed: number): { mainPath: string; branchPath: string; viewBox: string; stations: Array<{x: number, y: number, label: string}> } {
  // Simple seeded random
  const random = (n: number) => {
    const x = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  
  // Generate an oval-like path with variations
  const cx = 400;
  const cy = 200;
  const rx = 180 + random(1) * 60;  // horizontal radius
  const ry = 120 + random(2) * 40;  // vertical radius
  
  // Generate control points for a nice curved track
  const numPoints = 8;
  const points: Array<{x: number, y: number}> = [];
  
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const jitter = 20;
    const x = cx + Math.cos(angle) * rx + (random(i * 3) - 0.5) * jitter;
    const y = cy + Math.sin(angle) * ry + (random(i * 3 + 1) - 0.5) * jitter;
    points.push({x, y});
  }
  
  // Create smooth path through points using quadratic curves
  let mainPath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length; i++) {
    const p0 = points[i];
    const p1 = points[(i + 1) % points.length];
    const midX = (p0.x + p1.x) / 2;
    const midY = (p0.y + p1.y) / 2;
    mainPath += ` Q ${p0.x} ${p0.y} ${midX} ${midY}`;
  }
  mainPath += ' Z';
  
  // Maybe add a branch line
  const hasBranch = random(100) > 0.3;
  let branchPath = '';
  const stationPositions: Array<{x: number, y: number, label: string}> = [];
  
  if (hasBranch) {
    // Start from a point on the oval
    const branchStartIdx = Math.floor(random(50) * points.length);
    const branchStart = points[branchStartIdx];
    const branchAngle = Math.atan2(branchStart.y - cy, branchStart.x - cx);
    const branchLen = 80 + random(51) * 60;
    
    // Branch goes outward then curves
    const endX = branchStart.x + Math.cos(branchAngle) * branchLen;
    const endY = branchStart.y + Math.sin(branchAngle) * branchLen;
    const ctrlX = branchStart.x + Math.cos(branchAngle) * branchLen * 0.7;
    const ctrlY = branchStart.y + Math.sin(branchAngle) * branchLen * 0.5;
    
    branchPath = `M ${branchStart.x} ${branchStart.y} Q ${ctrlX} ${ctrlY} ${endX} ${endY}`;
    
    stationPositions.push({ x: endX, y: endY, label: hasBranch && random(52) > 0.5 ? 'DEPOT' : 'SIDING' });
  }
  
  // Add station in the middle of a section
  const stationIdx = Math.floor(points.length / 2);
  const stationPoint = points[stationIdx];
  stationPositions.push({ x: stationPoint.x, y: stationPoint.y, label: 'STATION' });
  
  return { 
    mainPath, 
    branchPath, 
    viewBox: '0 0 800 400',
    stations: stationPositions
  };
}

// Default track = the actual 2D track plan
const DEFAULT_TRACK = {
  mainPath: "M 150 200 Q 150 80 400 80 Q 650 80 650 200 Q 650 320 400 320 Q 150 320 150 200 Z",
  branchPath: "M 650 200 L 720 200 Q 730 200 730 170 L 730 140",
  viewBox: "0 0 800 400",
  stations: [
    { x: 400, y: 160, label: 'STATION' }
  ]
};

// ============================================
// TRAIN COMPONENT
// ============================================
export default function InteractiveTrain() {
  const trainRef = useRef<HTMLDivElement>(null);
  const mainPathRef = useRef<SVGPathElement>(null);
  const branchPathRef = useRef<SVGPathElement>(null);
  
  const [trackMode, setTrackMode] = useState<'default' | 'random'>('default');
  const [trainPos, setTrainPos] = useState({ x: 50, y: 50 });
  const [visible, setVisible] = useState(false);
  const [trail, setTrail] = useState<Array<{ x: number; y: number; id: number }>>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [trainAngle, setTrainAngle] = useState(0);
  
  const progress = useRef(0.1);
  const animFrame = useRef<number>(0);
  const trailId = useRef(0);
  const lastTrailTime = useRef(0);
  const pathLength = useRef(0);
  const branchLength = useRef(0);
  const totalLength = useRef(0);
  
  // Generate random track on mount
  const randomTrack = useMemo(() => generateTrack(Date.now()), []);
  
  // Current track data
  const track = trackMode === 'default' ? DEFAULT_TRACK : randomTrack;

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const mainPath = mainPathRef.current;
    const branchPath = branchPathRef.current;
    if (!mainPath) return;
    
    pathLength.current = mainPath.getTotalLength();
    if (branchPath) branchLength.current = branchPath.getTotalLength();
    totalLength.current = pathLength.current + branchLength.current;

    const getPointAtProgress = (p: number) => {
      if (p <= pathLength.current / totalLength.current) {
        const mainP = p * (totalLength.current / pathLength.current);
        return { point: mainPath.getPointAtLength(mainP * pathLength.current), onBranch: false };
      } else if (branchPath) {
        const branchP = (p - pathLength.current / totalLength.current) * (totalLength.current / branchLength.current);
        return { point: branchPath.getPointAtLength(branchP * branchLength.current), onBranch: true };
      }
      return { point: mainPath.getPointAtLength(0), onBranch: false };
    };

    const updatePosition = (p: number) => {
      const { point, onBranch } = getPointAtProgress(p);
      
      // Calculate angle from nearby point
      const delta = 0.02;
      const { point: nextPoint } = getPointAtProgress(Math.min(p + delta, 0.999));
      const angle = Math.atan2(nextPoint.y - point.y, nextPoint.x - point.x) * (180 / Math.PI);
      
      const x = (point.x / 800) * 100;
      const y = (point.y / 400) * 100;
      
      setTrainPos({ x, y });
      setTrainAngle(angle);
      
      // Trail
      const now = Date.now();
      if (now - lastTrailTime.current > 80) {
        lastTrailTime.current = now;
        const id = ++trailId.current;
        setTrail(t => [...t.slice(-30), { x, y, id }]);
        setTimeout(() => setTrail(t => t.filter(i => i.id !== id)), 2000);
      }
    };

    const animate = () => {
      if (!isDragging) {
        progress.current = (progress.current + 0.0004) % 1;
        updatePosition(progress.current);
      }
      animFrame.current = requestAnimationFrame(animate);
    };

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      
      const rect = mainPathRef.current?.parentElement?.getBoundingClientRect();
      if (!rect) return;
      
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      
      const mouseX = ((clientX - rect.left) / rect.width) * 800;
      const mouseY = ((clientY - rect.top) / rect.height) * 400;

      // Find closest point on main path
      let minDist = Infinity;
      let bestP = progress.current;
      
      for (let i = 0; i <= 100; i++) {
        const p = i / 100;
        const pt = mainPath.getPointAtLength(p * pathLength.current);
        const d = Math.hypot(mouseX - pt.x, mouseY - pt.y);
        if (d < minDist) {
          minDist = d;
          bestP = p * (pathLength.current / totalLength.current);
        }
      }
      
      // Check branch path
      if (branchPath) {
        for (let i = 0; i <= 50; i++) {
          const p = i / 50;
          const pt = branchPath.getPointAtLength(p * branchLength.current);
          const d = Math.hypot(mouseX - pt.x, mouseY - pt.y);
          if (d < minDist) {
            minDist = d;
            bestP = (pathLength.current / totalLength.current) + (p * (branchLength.current / totalLength.current));
          }
        }
      }
      
      progress.current = Math.max(0, Math.min(0.999, bestP));
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
        a.volume = 0.2;
        a.play().catch(() => {});
      }
    };

    const handleUp = () => setIsDragging(false);

    animFrame.current = requestAnimationFrame(animate);
    setVisible(true);

    window.addEventListener("mousemove", handleMove, { passive: true });
    window.addEventListener("touchmove", handleMove, { passive: true });
    window.addEventListener("mousedown", handleDown);
    window.addEventListener("touchstart", handleDown);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchend", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("mousedown", handleDown);
      window.removeEventListener("touchstart", handleDown);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchend", handleUp);
      cancelAnimationFrame(animFrame.current);
    };
  }, [isDragging, visible, track]);

  return (
    <>
      <style>{`
        .train-trail-dot {
          position: fixed;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(212,168,67,0.7) 0%, rgba(212,168,67,0) 100%);
          pointer-events: none;
          z-index: 9996;
          animation: trainTrailFade 2s ease-out forwards;
          transform: translate(-50%, -50%);
        }
        @keyframes trainTrailFade {
          0% { opacity: 0.7; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
        }
        .train-cursor {
          position: fixed;
          width: 48px;
          height: 28px;
          pointer-events: all;
          z-index: 9997;
          cursor: grab;
          transform: translate(-50%, -50%);
          filter: drop-shadow(0 0 12px rgba(212,168,67,0.7)) drop-shadow(0 2px 4px rgba(0,0,0,0.5));
          transition: filter 0.2s;
        }
        .train-cursor:hover {
          filter: drop-shadow(0 0 20px rgba(212,168,67,0.9)) drop-shadow(0 2px 4px rgba(0,0,0,0.5));
        }
        .train-cursor:active { cursor: grabbing; }
        .track-container {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: min(85vw, 900px);
          height: min(42.5vw, 450px);
          pointer-events: none;
          z-index: 1;
        }
        @media (max-width: 640px) {
          .track-container {
            width: 95vw;
            height: 47.5vw;
          }
        }
        .track-mode-selector {
          position: fixed;
          top: 70px;
          right: 16px;
          z-index: 9999;
          display: flex;
          gap: 4px;
          padding: 4px;
          background: rgba(10, 13, 21, 0.85);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(212, 168, 67, 0.2);
          border-radius: 12px;
        }
        .track-mode-btn {
          padding: 6px 12px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }
        .track-mode-btn.default {
          background: transparent;
          color: rgba(212, 168, 67, 0.6);
        }
        .track-mode-btn.default.active {
          background: rgba(212, 168, 67, 0.15);
          color: #d4a843;
          box-shadow: 0 0 12px rgba(212, 168, 67, 0.2);
        }
        .track-mode-btn.random {
          background: transparent;
          color: rgba(212, 168, 67, 0.6);
        }
        .track-mode-btn.random.active {
          background: rgba(212, 168, 67, 0.15);
          color: #d4a843;
          box-shadow: 0 0 12px rgba(212, 168, 67, 0.2);
        }
        .track-mode-btn:hover:not(.active) {
          color: rgba(212, 168, 67, 0.9);
          background: rgba(212, 168, 67, 0.05);
        }
      `}</style>

      {/* Track mode selector */}
      <div className="track-mode-selector">
        <button 
          className={`track-mode-btn default ${trackMode === 'default' ? 'active' : ''}`}
          onClick={() => setTrackMode('default')}
        >
          Layout
        </button>
        <button 
          className={`track-mode-btn random ${trackMode === 'random' ? 'active' : ''}`}
          onClick={() => setTrackMode('random')}
        >
          Random
        </button>
      </div>

      {/* Track path visible on page */}
      <div className="track-container">
        <svg viewBox={track.viewBox} className="w-full h-full">
          {/* Main track - ballast/sleepers */}
          <path d={track.mainPath} fill="none" stroke="#1a1d28" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round"/>
          {/* Branch ballast */}
          {track.branchPath && (
            <path d={track.branchPath} fill="none" stroke="#1a1d28" strokeWidth="18" strokeLinecap="round"/>
          )}
          
          {/* Main track - rail base */}
          <path d={track.mainPath} fill="none" stroke="#2a2a3a" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round"/>
          {track.branchPath && (
            <path d={track.branchPath} fill="none" stroke="#2a2a3a" strokeWidth="14" strokeLinecap="round"/>
          )}
          
          {/* Main track - running rail */}
          <path d={track.mainPath} fill="none" stroke="#d4a843" strokeWidth="2.5" strokeDasharray="14,10" strokeLinecap="round" strokeLinejoin="round" opacity="0.7">
            <animate attributeName="stroke-dashoffset" from="0" to="-48" dur="3s" repeatCount="indefinite"/>
          </path>
          {/* Branch rail */}
          {track.branchPath && (
            <path d={track.branchPath} fill="none" stroke="#d4a843" strokeWidth="2" strokeDasharray="10,8" strokeLinecap="round" opacity="0.5"/>
          )}
          
          {/* Station markers */}
          {track.stations.map((station, i) => (
            <g key={i}>
              <rect 
                x={station.x - 35} 
                y={station.y - 18} 
                width="70" 
                height="36" 
                rx="4" 
                fill="#111520" 
                stroke="#d4a843" 
                strokeWidth="1.5"
                opacity="0.85"
              />
              <text 
                x={station.x} 
                y={station.y + 4} 
                textAnchor="middle" 
                fill="#d4a843" 
                fontSize="9" 
                fontFamily="monospace" 
                fontWeight="bold"
                opacity="0.95"
              >
                {station.label}
              </text>
            </g>
          ))}
          
          {/* Hidden paths for interaction */}
          <path ref={mainPathRef} d={track.mainPath} fill="none" stroke="transparent" strokeWidth="40"/>
          {track.branchPath && (
            <path ref={branchPathRef} d={track.branchPath} fill="none" stroke="transparent" strokeWidth="30"/>
          )}
        </svg>
      </div>

      {/* Trail dots */}
      {trail.map(dot => (
        <div
          key={dot.id}
          className="train-trail-dot"
          style={{ left: `${dot.x}%`, top: `${dot.y}%` }}
        />
      ))}

      {/* Train cursor - detailed locomotive SVG */}
      <div
        ref={trainRef}
        className="train-cursor"
        style={{
          left: `${trainPos.x}%`,
          top: `${trainPos.y}%`,
          opacity: visible ? 1 : 0,
          transform: `translate(-50%, -60%) rotate(${trainAngle}deg)`,
        }}
      >
        <svg viewBox="0 0 60 36" fill="none">
          {/* Locomotive body - main boiler */}
          <ellipse cx="28" cy="20" rx="22" ry="10" fill="url(#boilerGrad)"/>
          
          {/* Boiler bands */}
          <ellipse cx="18" cy="20" rx="1" ry="9" fill="#c9a033" opacity="0.8"/>
          <ellipse cx="26" cy="20" rx="1" ry="9" fill="#c9a033" opacity="0.8"/>
          <ellipse cx="34" cy="20" rx="1" ry="9" fill="#c9a033" opacity="0.8"/>
          
          {/* Chimney / Smokebox */}
          <rect x="4" y="8" width="10" height="14" rx="2" fill="url(#chimneyGrad)"/>
          <rect x="2" y="6" width="14" height="4" rx="2" fill="#d4a843"/>
          
          {/* Chimney top rim */}
          <rect x="1" y="4" width="16" height="3" rx="1.5" fill="#b8942f"/>
          
          {/* Steam dome */}
          <ellipse cx="32" cy="10" rx="5" ry="4" fill="url(#domeGrad)"/>
          
          {/* Safety valves */}
          <rect x="36" y="7" width="3" height="6" rx="1" fill="#b8942f"/>
          <rect x="40" y="7" width="3" height="6" rx="1" fill="#b8942f"/>
          
          {/* Cab */}
          <rect x="44" y="10" width="14" height="16" rx="2" fill="url(#cabGrad)"/>
          <rect x="46" y="13" width="10" height="8" rx="1" fill="#0a0d15" opacity="0.8"/>
          
          {/* Wheels - driving */}
          <circle cx="14" cy="28" r="6" fill="#1a1d28"/>
          <circle cx="14" cy="28" r="5" fill="#2a2a3a"/>
          <circle cx="14" cy="28" r="2" fill="#d4a843"/>
          <circle cx="14" cy="28" r="4.5" fill="none" stroke="#d4a843" strokeWidth="0.5" opacity="0.5"/>
          
          <circle cx="28" cy="28" r="6" fill="#1a1d28"/>
          <circle cx="28" cy="28" r="5" fill="#2a2a3a"/>
          <circle cx="28" cy="28" r="2" fill="#d4a843"/>
          <circle cx="28" cy="28" r="4.5" fill="none" stroke="#d4a843" strokeWidth="0.5" opacity="0.5"/>
          
          {/* Wheel connecting rod */}
          <rect x="14" y="26" width="14" height="2" rx="1" fill="#b8942f"/>
          
          {/* Small front wheel */}
          <circle cx="6" cy="28" r="4" fill="#1a1d28"/>
          <circle cx="6" cy="28" r="3" fill="#2a2a3a"/>
          <circle cx="6" cy="28" r="1" fill="#d4a843"/>
          
          {/* Cowcatcher */}
          <path d="M 0 22 L -2 28 L 4 28 L 6 24 Z" fill="#b8942f"/>
          <line x1="0" y1="22" x2="1" y2="28" stroke="#8a7020" strokeWidth="0.5"/>
          <line x1="2" y1="22" x2="3" y2="28" stroke="#8a7020" strokeWidth="0.5"/>
          
          {/* Headlight */}
          <circle cx="0" cy="18" r="3" fill="#fffbe6"/>
          <circle cx="0" cy="18" r="2" fill="#ffeb3b"/>
          <circle cx="0" cy="18" r="1" fill="#fff"/>
          
          {/* Gradients */}
          <defs>
            <linearGradient id="boilerGrad" x1="6" y1="10" x2="6" y2="30">
              <stop offset="0%" stopColor="#e8c865"/>
              <stop offset="50%" stopColor="#d4a843"/>
              <stop offset="100%" stopColor="#a07c2a"/>
            </linearGradient>
            <linearGradient id="chimneyGrad" x1="9" y1="8" x2="9" y2="22">
              <stop offset="0%" stopColor="#d4a843"/>
              <stop offset="100%" stopColor="#8a7020"/>
            </linearGradient>
            <linearGradient id="cabGrad" x1="44" y1="10" x2="58" y2="26">
              <stop offset="0%" stopColor="#c9a033"/>
              <stop offset="100%" stopColor="#9a7a20"/>
            </linearGradient>
            <radialGradient id="domeGrad" cx="50%" cy="30%" r="60%">
              <stop offset="0%" stopColor="#e8d080"/>
              <stop offset="100%" stopColor="#c9a033"/>
            </radialGradient>
          </defs>
        </svg>
      </div>
    </>
  );
}
