"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useSound } from "@/context/SoundContext";

// ──────────────────────────────────────────────
// LAYOUT FACTORIES
// ──────────────────────────────────────────────

function makeDoubleOval(ox: number, oy: number) {
  const outerRX = 355, outerRY = 165;
  const midRX = 270, midRY = 120;
  const ovalRightX = ox + outerRX, ovalLeftX = ox - outerRX;
  const parts = [
    { path: `M ${ovalLeftX} ${oy} A ${outerRX} ${outerRY} 0 0 1 ${ovalRightX} ${oy} A ${outerRX} ${outerRY} 0 0 1 ${ovalLeftX} ${oy}`, trackWidth: 24, type: 'main' as const },
    { path: `M ${ox - midRX} ${oy} A ${midRX} ${midRY} 0 0 1 ${ox + midRX} ${oy} A ${midRX} ${midRY} 0 0 1 ${ox - midRX} ${oy}`, trackWidth: 18, type: 'main' as const },
    { path: `M ${ovalRightX} ${oy} L ${ovalRightX + 35} ${oy + 80} A 60 50 0 0 1 ${ovalRightX + 35} ${oy + 150} L ${ovalRightX + 35} ${oy + 180}`, trackWidth: 17, type: 'branch' as const },
    { path: `M ${ovalRightX + 20} ${oy + 110} L ${ovalRightX + 65} ${oy + 110}`, trackWidth: 13, type: 'siding' as const },
    { path: `M ${ovalLeftX} ${oy} L ${ovalLeftX + 65} ${oy + 80} A 60 50 0 0 0 ${ovalLeftX + 130} ${oy + 130} L ${ovalLeftX + 130} ${oy + 180}`, trackWidth: 17, type: 'branch' as const },
  ];
  return { parts, stations: [{ x: ox, y: oy - midRY - 8, label: 'CENTRAL STATION' }], name: "Grand Oval", viewBox: "0 0 800 400" };
}

function makeTerminus(ox: number, oy: number) {
  const outerRX = 370, outerRY = 140;
  const parts = [
    { path: `M ${ox - outerRX} ${oy} A ${outerRX} ${outerRY} 0 0 1 ${ox + outerRX} ${oy} A ${outerRX} ${outerRY} 0 0 1 ${ox - outerRX} ${oy}`, trackWidth: 24, type: 'main' as const },
    { path: `M ${ox + outerRX} ${oy} L ${ox + outerRX + 50} ${oy - 95}`, trackWidth: 18, type: 'branch' as const },
    { path: `M ${ox - outerRX + 50} ${oy} A ${outerRX - 50} ${outerRY - 40} 0 0 1 ${ox + outerRX - 50} ${oy}`, trackWidth: 17, type: 'main' as const },
  ];
  return { parts, stations: [{ x: ox, y: oy - outerRY - 10, label: 'MAIN LINE' }], name: "Terminus", viewBox: "0 0 800 400" };
}

function makeJunction(ox: number, oy: number) {
  const outerRX = 330, outerRY = 155, innerRX = 210, innerRY = 95;
  const parts = [
    { path: `M ${ox - outerRX} ${oy} A ${outerRX} ${outerRY} 0 0 1 ${ox + outerRX} ${oy} A ${outerRX} ${outerRY} 0 0 1 ${ox - outerRX} ${oy}`, trackWidth: 26, type: 'main' as const },
    { path: `M ${ox - innerRX} ${oy} A ${innerRX} ${innerRY} 0 0 1 ${ox + innerRX} ${oy} A ${innerRX} ${innerRY} 0 0 1 ${ox - innerRX} ${oy}`, trackWidth: 18, type: 'main' as const },
    { path: `M ${ox + innerRX} ${oy} L ${ox + outerRX} ${oy}`, trackWidth: 18, type: 'main' as const },
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
};

// ──────────────────────────────────────────────
// TRAIN ELEMENT
// ──────────────────────────────────────────────

function TrainEl({ x, y, angle, scaleY }: { x: number; y: number; angle: number; scaleY: number }) {
  return (
    <div className="absolute pointer-events-none z-[3]"
         style={{ left: x, top: y, opacity: 0.75, transform: `translate(-50%, -50%) rotate(${angle}deg) scale(1, ${scaleY})` }}>
      <svg width="58" height="24" viewBox="0 0 70 30" fill="none">
        <ellipse cx="38" cy="17" rx="24" ry="10" fill="#d4a843"/>
        <rect x="52" y="9" width="12" height="16" rx="2" fill="#1a1d28"/>
        <rect x="4" y="7" width="16" height="20" rx="2" fill="#c9a033"/>
        <circle cx="68" cy="14" r="2.5" fill="#ffeb3b"/>
        <circle cx="46" cy="26" r="4" fill="#1a1d28"/>
        <circle cx="30" cy="26" r="4" fill="#1a1d28"/>
      </svg>
    </div>
  );
}

// ──────────────────────────────────────────────
// MAIN COMPONENT
// Force remount via key when mode/layout changes so Math.random() runs fresh
// ──────────────────────────────────────────────

export default function InteractiveTrain({ showControls = true }: { showControls?: boolean }) {
  // ── Persistent state across re-renders ──
  const [trackMode, setTrackMode] = useState<'default' | 'random'>('default');
  // forceRefresh increments on every "Random" button click → forces child to remount with fresh Math.random()
  const [forceRefresh, setForceRefresh] = useState(0);
  const [activeSignals, setActiveSignals] = useState<Set<string>>(new Set());
  const svgRef = useRef<SVGSVGElement>(null);
  const { isMuted } = useSound();

  // ── Load saved mode on mount ──
  useEffect(() => {
    const saved = localStorage.getItem('railway-track-mode');
    if (saved === 'random' || saved === 'default') setTrackMode(saved);
  }, []);

  // ── Signal positions: recompute every remount ──
  const signalPositions = useMemo(() => {
    if (trackMode === 'default') {
      return [
        { id: 'sig-1', x: 400, y: 80 }, { id: 'sig-2', x: 650, y: 200 },
        { id: 'sig-3', x: 400, y: 320 }, { id: 'sig-4', x: 250, y: 80 }, { id: 'sig-5', x: 150, y: 200 },
      ];
    }
    // Fresh Math.random() on every render/mount in random mode
    const count = Math.floor(Math.random() * 3) + 3; // 3–5 signals
    return Array.from({ length: count }).map((_, i) => ({
      id: `sig-${Date.now()}-${i}`,
      x: 80 + Math.random() * 640,
      y: 70 + Math.random() * 260,
    }));
  }, [trackMode, forceRefresh]);

  // ── Train configs: recompute every remount ──
  const trainConfigs = useMemo(() => {
    if (trackMode === 'default') return [{ id: 0, progress: 0.1, speed: 0.0002 }];
    const count = Math.floor(Math.random() * 3) + 1; // 1–3 trains
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      progress: Math.random(),
      speed: 0.00012 + Math.random() * 0.00018,
    }));
  }, [trackMode, forceRefresh]);

  const randomLayout = useMemo(() => genLayout(Date.now()), [trackMode, forceRefresh]);

  const trackParts = trackMode === 'default'
    ? [
        { path: ORIGINAL_LAYOUT.mainPath, trackWidth: 22, type: 'main' as const },
        { path: ORIGINAL_LAYOUT.branchPath, trackWidth: 16, type: 'branch' as const },
      ]
    : randomLayout.parts;

  const currentViewBox = trackMode === 'default' ? '0 0 800 400' : randomLayout.viewBox;

  // ── Animate trains (reads DOM directly, no stale closure issues) ──
  const [trainStates, setTrainStates] = useState<Array<{ x: number; y: number; angle: number; scaleY: number }>>([]);
  const svgRectRef = useRef({ width: 800, height: 400 });
  const trainsRef = useRef(trainConfigs);

  useEffect(() => { trainsRef.current = trainConfigs; }, [trainConfigs]);

  useEffect(() => {
    const updateRect = () => {
      if (svgRef.current) {
        const r = svgRef.current.getBoundingClientRect();
        svgRectRef.current = { width: r.width, height: r.height };
      }
    };
    updateRect();
    window.addEventListener('resize', updateRect);
    return () => window.removeEventListener('resize', updateRect);
  }, []);

  useEffect(() => {
    let frame: number;
    // Wait for paths to be in DOM
    const timeout = setTimeout(() => {
      const svg = svgRef.current;
      if (!svg) return;
      const paths = Array.from(svg.querySelectorAll('path.track-path')) as SVGPathElement[];
      if (paths.length === 0) return;

      const animate = () => {
        setTrainStates(prev => {
          if (prev.length !== trainsRef.current.length) {
            prev = trainsRef.current.map(() => ({ x: 0, y: 0, angle: 0, scaleY: 1 }));
          }
          const { width, height } = svgRectRef.current;
          return trainsRef.current.map((t, i) => {
            const path = paths[i % paths.length];
            if (!path) return prev[i] || { x: 0, y: 0, angle: 0, scaleY: 1 };
            const len = path.getTotalLength();
            const newProgress = (t.progress + t.speed) % 1;
            trainsRef.current[i].progress = newProgress;
            const pt = path.getPointAtLength(newProgress * len);
            const pt2 = path.getPointAtLength(Math.min(newProgress + 0.002, 0.999) * len);
            const angle = Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * (180 / Math.PI);
            return {
              x: pt.x * (width / 800),
              y: pt.y * (height / 400),
              angle,
              scaleY: (angle > 90 || angle < -90) ? -1 : 1,
            };
          });
        });
        frame = requestAnimationFrame(animate);
      };
      frame = requestAnimationFrame(animate);
    }, 50);
    return () => { clearTimeout(timeout); cancelAnimationFrame(frame); };
  }, [trainConfigs]);

  const toggleSignal = useCallback((id: string) => {
    if (!isMuted) {
      const s = new Audio("/sounds/nav-click.mp3");
      s.volume = 0.1; s.play().catch(() => {});
    }
    setActiveSignals(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, [isMuted]);

  const handleModeChange = (mode: 'default' | 'random') => {
    if (mode === 'random') setForceRefresh(n => n + 1);
    setTrackMode(mode);
    localStorage.setItem('railway-track-mode', mode);
  };

  return (
    <>
      <style>{`
        .track-container { position: fixed; inset: 0; pointer-events: none; z-index: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .track-inner { position: relative; width: min(95vw, 1200px); height: min(47.5vw, 600px); opacity: 0.5; }
        .track-mode-selector { position: fixed; bottom: 24px; right: 24px; z-index: 9999; display: flex; flex-direction: column; gap: 4px; padding: 6px; background: rgba(10,13,21,0.92); border: 1px solid rgba(212,168,67,0.3); border-radius: 14px; pointer-events: all; }
        .track-mode-btn { padding: 8px 16px; font-size: 11px; font-weight: 700; color: rgba(212,168,67,0.6); background: transparent; border: none; cursor: pointer; border-radius: 10px; font-family: inherit; transition: all 0.2s; }
        .track-mode-btn.active { background: rgba(212,168,67,0.2); color: #d4a843; }
        .track-mode-btn:hover:not(.active) { color: rgba(212,168,67,0.9); }
        .sig-btn { position: absolute; width: 90px; height: 90px; border-radius: 50%; pointer-events: all; z-index: 9999; cursor: pointer; background: transparent; border: 2px solid transparent; transform: translate(-50%, -50%); transition: border-color 0.2s; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
        .sig-btn:active { transform: translate(-50%, -50%) scale(0.9); }
      `}</style>

      {showControls && (
        <div className="track-mode-selector">
          <button className={`track-mode-btn ${trackMode === 'default' ? 'active' : ''}`} onClick={() => handleModeChange('default')}>Layout</button>
          <button className={`track-mode-btn ${trackMode === 'random' ? 'active' : ''}`} onClick={() => handleModeChange('random')}>Random</button>
        </div>
      )}

      <div className="track-container">
        <div className="track-inner">
          <svg ref={svgRef} viewBox={currentViewBox} className="w-full h-full">
            <defs>
              <filter id="railGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>

            {trackParts.map((part, idx) => (
              <g key={idx}>
                <path d={part.path} fill="none" stroke="#3a3a4a" strokeWidth={part.trackWidth} strokeLinecap="round"/>
                <path className="track-path" d={part.path} fill="none" stroke="#d4a843" strokeWidth="2" strokeDasharray="12,10" strokeLinecap="round" opacity="0.85" filter="url(#railGlow)">
                  {idx === 0 && <animate attributeName="stroke-dashoffset" from="0" to="-44" dur="2s" repeatCount="indefinite"/>}
                </path>
              </g>
            ))}

            {signalPositions.map(sig => {
              const active = activeSignals.has(sig.id);
              return (
                <g key={sig.id}>
                  <circle cx={sig.x} cy={sig.y} r="4" fill="none" stroke={active ? '#4ade80' : '#f87171'} strokeWidth="1.5" opacity="0.4"/>
                  <circle cx={sig.x} cy={sig.y} r="14" fill={active ? '#4ade80' : '#f87171'} opacity="0.85"
                    style={{ filter: `drop-shadow(0 0 7px ${active ? '#4ade80' : '#f87171'})` }}/>
                  <circle cx={sig.x} cy={sig.y} r="5" fill={active ? '#86efac' : '#fca5a5'} opacity="0.9"/>
                </g>
              );
            })}
          </svg>

          {/* Signal buttons — positioned over the SVG circles */}
          {signalPositions.map(sig => (
            <button key={`btn-${sig.id}`} className="sig-btn"
              style={{
                left: `${(sig.x / 800) * 100}%`,
                top: `${(sig.y / 400) * 100}%`,
                borderColor: activeSignals.has(sig.id) ? 'rgba(74,222,128,0.7)' : 'rgba(248,113,113,0.7)',
              }}
              onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); toggleSignal(sig.id); }}
              onTouchStart={(e) => { e.stopPropagation(); e.preventDefault(); toggleSignal(sig.id); }}
            />
          ))}

          {/* Trains */}
          {trainStates.map((t, i) => <TrainEl key={i} {...t} />)}
        </div>
      </div>
    </>
  );
}
