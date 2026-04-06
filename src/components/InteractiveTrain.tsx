"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useSound } from "@/context/SoundContext";

// 1 SVG unit = 5mm real (approx)
const MM = 0.2; 

// ──────────────────────────────────────────────
// LAYOUT FACTORIES
// ──────────────────────────────────────────────

function makeDoubleOval(ox: number, oy: number) {
  const outerRX = 355, outerRY = 165;
  const midRX = 270, midRY = 120;
  const ovalRightX = ox + outerRX;
  const ovalLeftX = ox - outerRX;
  const parts = [
    { path: `M ${ovalLeftX} ${oy} A ${outerRX} ${outerRY} 0 0 1 ${ovalRightX} ${oy} A ${outerRX} ${outerRY} 0 0 1 ${ovalLeftX} ${oy}`, trackWidth: 24, type: 'main' as const },
    { path: `M ${ox - midRX} ${oy} A ${midRX} ${midRY} 0 0 1 ${ox + midRX} ${oy} A ${midRX} ${midRY} 0 0 1 ${ox - midRX} ${oy}`, trackWidth: 18, type: 'main' as const },
    { path: `M ${ovalRightX} ${oy} L ${ovalRightX + 35} ${oy + 80} A 60 50 0 0 1 ${ovalRightX + 35} ${oy + 150} L ${ovalRightX + 35} ${oy + 180}`, trackWidth: 17, type: 'branch' as const },
    { path: `M ${ovalRightX + 20} ${oy + 110} L ${ovalRightX + 65} ${oy + 110}`, trackWidth: 13, type: 'siding' as const },
    { path: `M ${ovalLeftX} ${oy} L ${ovalLeftX + 65} ${oy + 80} A 60 50 0 0 0 ${ovalLeftX + 130} ${oy + 130} L ${ovalLeftX + 130} ${oy + 180}`, trackWidth: 17, type: 'branch' as const },
  ];
  const stations = [{ x: ox, y: oy - midRY - 8, label: 'CENTRAL STATION' }];
  return { parts, stations, name: "Grand Oval Network", viewBox: "0 0 800 400" };
}

function makeTerminus(ox: number, oy: number) {
  const outerRX = 370, outerRY = 140;
  const parts = [
    { path: `M ${ox - outerRX} ${oy} A ${outerRX} ${outerRY} 0 0 1 ${ox + outerRX} ${oy} A ${outerRX} ${outerRY} 0 0 1 ${ox - outerRX} ${oy}`, trackWidth: 24, type: 'main' as const },
    { path: `M ${ox + outerRX} ${oy} L ${ox + outerRX + 50} ${oy - 95}`, trackWidth: 18, type: 'branch' as const },
  ];
  const stations = [{ x: ox, y: oy - outerRY - 10, label: 'MAIN LINE' }];
  return { parts, stations, name: "Terminus & Branch", viewBox: "0 0 800 400" };
}

function makeJunction(ox: number, oy: number) {
  const outerRX = 330, outerRY = 155;
  const innerRX = 210, innerRY = 95;
  const parts = [
    { path: `M ${ox - outerRX} ${oy} A ${outerRX} ${outerRY} 0 0 1 ${ox + outerRX} ${oy} A ${outerRX} ${outerRY} 0 0 1 ${ox - outerRX} ${oy}`, trackWidth: 26, type: 'main' as const },
    { path: `M ${ox - innerRX} ${oy} A ${innerRX} ${innerRY} 0 0 1 ${ox + innerRX} ${oy} A ${innerRX} ${innerRY} 0 0 1 ${ox - innerRX} ${oy}`, trackWidth: 18, type: 'main' as const },
  ];
  return { parts, stations: [{ x: ox, y: oy - innerRY - 25, label: 'CENTRAL JUNCTION' }], name: "Dual Junction", viewBox: "0 0 800 400" };
}

const FACTORIES = [makeDoubleOval, makeTerminus, makeJunction];

function genLayout(seed: number) {
  const rng = (n: number) => {
    const x = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  const idx = Math.floor(rng(0) * FACTORIES.length);
  const layout = FACTORIES[idx](400, 200);
  if (rng(3) > 0.5) {
    layout.parts = layout.parts.map(p => ({
      ...p, path: p.path.replace(/(-?[\d.]+)\s+(-?[\d.]+)/g, (_, x, y) => `${(800 - parseFloat(x)).toFixed(1)} ${y}`)
    }));
    layout.stations = layout.stations.map(s => ({ ...s, x: 800 - s.x }));
  }
  return layout;
}

const ORIGINAL_LAYOUT = {
  mainPath: "M 150 200 A 250 130 0 0 1 650 200 A 250 130 0 0 1 150 200",
  branchPath: "M 150 200 A 250 130 0 0 1 400 70 A 250 130 0 0 1 650 200",
  upMainPath: "M 650 200 A 250 130 0 0 1 400 330 A 250 130 0 0 1 150 200",
};

// ──────────────────────────────────────────────
// TRAIN COMPONENT
// ──────────────────────────────────────────────

function TrainSVG({ x, y, angle, scaleY, visible }: any) {
  return (
    <div className="absolute pointer-events-none z-[3] transition-opacity duration-500"
         style={{ left: x, top: y, opacity: visible ? 0.7 : 0, transform: `translate(-50%, -50%) rotate(${angle}deg) scale(1, ${scaleY})` }}>
      <svg width="60" height="26" viewBox="0 0 70 30" fill="none">
        <ellipse cx="38" cy="17" rx="24" ry="10" fill="#d4a843"/>
        <rect x="52" y="9" width="12" height="16" rx="2" fill="#1a1d28"/>
        <rect x="4" y="7" width="16" height="20" rx="2" fill="#c9a033"/>
        <circle cx="68" cy="14" r="2" fill="#ffeb3b"/>
      </svg>
    </div>
  );
}

// ──────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────

export default function InteractiveTrain({ showControls = true }: { showControls?: boolean }) {
  const [trackMode, setTrackMode] = useState<'default' | 'random'>('default');
  const [activeSignals, setActiveSignals] = useState<Set<string>>(new Set());
  const [svgRect, setSvgRect] = useState({ left: 0, top: 0, width: 800, height: 400 });
  const [trains, setTrains] = useState<any[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const { isMuted } = useSound();

  // Load mode
  useEffect(() => {
    const saved = localStorage.getItem('railway-track-mode');
    if (saved === 'random' || saved === 'default') setTrackMode(saved);
  }, []);

  const randomLayout = useMemo(() => genLayout(Date.now()), [trackMode]);

  const signalPositions = useMemo(() => {
    if (trackMode === 'default') {
      return [
        { id: 'sig-1', x: 400, y: 80 }, { id: 'sig-2', x: 650, y: 200 },
        { id: 'sig-3', x: 400, y: 320 }, { id: 'sig-4', x: 250, y: 80 }, { id: 'sig-5', x: 150, y: 200 },
      ];
    }
    // Random positions for random mode
    const count = Math.floor(Math.random() * 3) + 3;
    return Array.from({ length: count }).map((_, i) => ({
      id: `sig-rnd-${i}`,
      x: 100 + Math.random() * 600,
      y: 80 + Math.random() * 240
    }));
  }, [trackMode, randomLayout]);

  const trackParts = trackMode === 'default'
    ? [
        { path: ORIGINAL_LAYOUT.mainPath, trackWidth: 22, type: 'main' as const },
        { path: ORIGINAL_LAYOUT.branchPath, trackWidth: 16, type: 'branch' as const },
      ]
    : randomLayout.parts;

  // Initialize Trains
  useEffect(() => {
    const count = trackMode === 'default' ? 1 : Math.floor(Math.random() * 3) + 1;
    const newTrains = Array.from({ length: count }).map((_, i) => ({
      id: i,
      progress: Math.random(),
      speed: 0.00015 + Math.random() * 0.0002,
      x: 0, y: 0, angle: 0, scaleY: 1
    }));
    setTrains(newTrains);
  }, [trackMode, randomLayout]);

  const updateSvgRect = useCallback(() => {
    if (!svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    setSvgRect({ left: r.left, top: r.top, width: r.width, height: r.height });
  }, []);

  useEffect(() => {
    updateSvgRect();
    window.addEventListener('resize', updateSvgRect);
    return () => window.removeEventListener('resize', updateSvgRect);
  }, [updateSvgRect]);

  // Animation Loop
  useEffect(() => {
    let frame: number;
    const paths = Array.from(svgRef.current?.querySelectorAll('path.track-path') || []) as SVGPathElement[];
    if (paths.length === 0) return;

    const animate = () => {
      setTrains(prev => prev.map((t, i) => {
        const path = paths[i % paths.length] || paths[0];
        const len = path.getTotalLength();
        const newProgress = (t.progress + t.speed) % 1;
        
        const pt = path.getPointAtLength(newProgress * len);
        const pt2 = path.getPointAtLength(Math.min(newProgress + 0.001, 0.999) * len);
        const angle = Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * (180 / Math.PI);
        
        const scaleX = svgRect.width / 800;
        const scaleY_factor = svgRect.height / 400;

        return { ...t, progress: newProgress, x: pt.x * scaleX, y: pt.y * scaleY_factor, angle, scaleY: (angle > 90 || angle < -90) ? -1 : 1 };
      }));
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [trains.length, svgRect]);

  const toggleSignal = (id: string) => {
    if (!isMuted) {
      const s = new Audio("/sounds/nav-click.mp3");
      s.volume = 0.1; s.play().catch(() => {});
    }
    setActiveSignals(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <>
      <style>{`
        .track-container { position: fixed; inset: 0; pointer-events: none; z-index: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .track-inner { position: relative; width: min(95vw, 1200px); height: min(47.5vw, 600px); opacity: 0.5; pointer-events: none; }
        .track-mode-selector { position: fixed; bottom: 24px; right: 24px; z-index: 9999; display: flex; flex-direction: column; gap: 4px; padding: 6px; background: rgba(10,13,21,0.9); border: 1px solid rgba(212,168,67,0.3); border-radius: 14px; pointer-events: all; }
        .track-mode-btn { padding: 8px 16px; font-size: 11px; font-weight: 700; color: #d4a843; background: transparent; border: none; cursor: pointer; border-radius: 10px; }
        .track-mode-btn.active { background: rgba(212,168,67,0.2); }
        .sig-btn { position: absolute; width: 90px; height: 90px; border-radius: 50%; pointer-events: all; z-index: 9999; cursor: pointer; background: transparent; border: 2px solid transparent; transform: translate(-50%, -50%); transition: all 0.15s; }
        .sig-btn:active { transform: translate(-50%, -50%) scale(0.9); }
      `}</style>

      {showControls && (
        <div className="track-mode-selector">
          <button className={`track-mode-btn ${trackMode === 'default' ? 'active' : ''}`} onClick={() => { setTrackMode('default'); localStorage.setItem('railway-track-mode', 'default'); }}>Layout</button>
          <button className={`track-mode-btn ${trackMode === 'random' ? 'active' : ''}`} onClick={() => { setTrackMode('random'); localStorage.setItem('railway-track-mode', 'random'); }}>Random</button>
        </div>
      )}

      <div className="track-container">
        <div className="track-inner">
          <svg ref={svgRef} viewBox={trackMode === 'default' ? '0 0 800 400' : randomLayout.viewBox} className="w-full h-full">
            {trackParts.map((part, idx) => (
              <g key={idx}>
                <path d={part.path} fill="none" stroke="#3a3a4a" strokeWidth={part.trackWidth} strokeLinecap="round"/>
                <path className="track-path" d={part.path} fill="none" stroke="#d4a843" strokeWidth="2" strokeDasharray="10,8" opacity="0.8"/>
              </g>
            ))}
            {signalPositions.map(sig => {
              const active = activeSignals.has(sig.id);
              return (
                <g key={sig.id}>
                  <circle cx={sig.x} cy={sig.y} r="16" fill={active ? '#4ade80' : '#f87171'} opacity="0.9" style={{ filter: `drop-shadow(0 0 8px ${active ? '#4ade80' : '#f87171'})` }}/>
                  <circle cx={sig.x} cy={sig.y} r="6" fill={active ? '#86efac' : '#fca5a5'} opacity="0.8"/>
                </g>
              );
            })}
          </svg>

          {signalPositions.map(sig => (
            <button key={`btn-${sig.id}`} className="sig-btn" 
                    style={{ left: `${(sig.x / 800) * 100}%`, top: `${(sig.y / 400) * 100}%`, border: activeSignals.has(sig.id) ? '2px solid rgba(74,222,128,0.7)' : '2px solid rgba(248,113,113,0.7)' }}
                    onPointerDown={(e) => { e.stopPropagation(); toggleSignal(sig.id); }}
                    onTouchStart={(e) => { e.stopPropagation(); toggleSignal(sig.id); }}
            />
          ))}

          {trains.map(t => <TrainSVG key={t.id} {...t} visible={true} />)}
        </div>
      </div>
    </>
  );
}
