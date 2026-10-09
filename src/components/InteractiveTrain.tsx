"use client";

import { useEffect, useRef, useState, useMemo, useCallback, useSyncExternalStore } from "react";
import { useReducedMotion } from "framer-motion";
import { createPortal } from "react-dom";
import { useHydrated, usePreference, writePreference } from "@/lib/preferences";
import { mirrorTrackPath } from "@/lib/trackGeometry";
import { useSound } from "@/context/SoundContext";
import {
  anyTrainMoving, effectiveSpeed, frameScaleFor, freshTrains, isTrainMoving, locateOnRoute,
  pauseAll, progressForRoutePoint, routeLength, runAll, setTrainSpeed, stepProgress, toggleTrain,
  type Route, type TrainControlState,
} from "@/lib/trainMotion";

interface TrainView { x: number; y: number; angle: number; flipY: number }

const subscribeNoop = () => () => {};
const leadOf = (list: TrainView[]): TrainView => list[0] ?? { x: 0, y: 0, angle: 0, flipY: 1 };

// ============================================
// REAL 00 GAUGE (4mm/ft) TRACK SPECIFICATIONS
// Based on Hornby/Peco Setrack geometry
// Track gauge: 16.5mm | Track spacing: 67mm centre-to-centre
// Turnout angle: 22.5° | Rail height: code 100
// Standard radii: 371mm (1st), 438mm (2nd), 505mm (3rd), 571.5mm (4th)
// ============================================


// ──────────────────────────────────────────────

// ──────────────────────────────────────────────
// LAYOUT 1: Grand Oval with Extended Network
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
    { path: `M ${ovalRightX + 35} ${oy + 140} L ${ovalRightX + 80} ${oy + 140}`, trackWidth: 12, type: 'yard' as const },
    { path: `M ${ovalLeftX} ${oy} L ${ovalLeftX + 65} ${oy + 80} A 60 50 0 0 0 ${ovalLeftX + 130} ${oy + 130} L ${ovalLeftX + 130} ${oy + 180}`, trackWidth: 17, type: 'branch' as const },
    { path: `M ${ovalLeftX + 80} ${oy + 110} L ${ovalLeftX + 130} ${oy + 110}`, trackWidth: 13, type: 'siding' as const },
    { path: `M ${ovalLeftX + 130} ${oy + 140} L ${ovalLeftX + 175} ${oy + 140}`, trackWidth: 12, type: 'yard' as const },
    { path: `M ${ox + midRX} ${oy} L ${ox + midRX + 20} ${oy - 30} A 40 35 0 0 1 ${ox + midRX + 60} ${oy - 60}`, trackWidth: 14, type: 'main' as const },
  ];
  const stations = [
    { x: ox, y: oy - midRY - 8, label: 'CENTRAL STATION' },
    { x: ovalRightX + 20, y: oy + 170, label: 'EAST HALT' },
    { x: ovalLeftX + 65, y: oy + 170, label: 'WEST HALT' },
  ];
  return { parts, stations, name: "Grand Oval Network", desc: "Massive oval filling 90% of screen with extended branch network", viewBox: "0 0 800 400" };
}

// ──────────────────────────────────────────────
// LAYOUT 2: Long Main Line with Full-Length Branch
// ──────────────────────────────────────────────
function makeTerminus(ox: number, oy: number) {
  const outerRX = 370, outerRY = 140;
  const termY = oy - outerRY + 10;

  const parts = [
    { path: `M ${ox - outerRX} ${oy} A ${outerRX} ${outerRY} 0 0 1 ${ox + outerRX} ${oy} A ${outerRX} ${outerRY} 0 0 1 ${ox - outerRX} ${oy}`, trackWidth: 24, type: 'main' as const },
    { path: `M ${ox - outerRX + 50} ${oy} A ${outerRX - 50} ${outerRY - 40} 0 0 1 ${ox + outerRX - 50} ${oy} A ${outerRX - 50} ${outerRY - 40} 0 0 1 ${ox - outerRX + 50} ${oy}`, trackWidth: 17, type: 'main' as const },
    { path: `M ${ox + outerRX} ${oy} L ${ox + outerRX + 15} ${oy - 30} A 45 40 0 0 1 ${ox + outerRX + 55} ${oy - 70} L ${ox + outerRX + 55} ${oy - 110}`, trackWidth: 18, type: 'branch' as const },
    { path: `M ${ox + outerRX + 30} ${oy - 45} L ${ox + outerRX + 30} ${oy - 20}`, trackWidth: 16, type: 'siding' as const },
    { path: `M ${ox + outerRX + 55} ${oy - 70} L ${ox + outerRX + 95} ${oy - 70}`, trackWidth: 16, type: 'siding' as const },
    { path: `M ${ox} ${oy + outerRY - 10} L ${ox} ${oy + outerRY - 50} A 60 50 0 0 0 ${ox + 80} ${oy + outerRY - 100}`, trackWidth: 15, type: 'main' as const },
    { path: `M ${ox + 40} ${oy + outerRY - 60} L ${ox + 120} ${oy + outerRY - 60}`, trackWidth: 14, type: 'branch' as const },
    { path: `M ${ox + 80} ${oy + outerRY - 100} L ${ox + 140} ${oy + outerRY - 100}`, trackWidth: 12, type: 'yard' as const },
  ];
  const stations = [
    { x: ox, y: oy - outerRY - 10, label: 'MAIN LINE' },
    { x: ox + 190, y: termY - 135, label: 'TERMINUS' },
  ];
  return { parts, stations, name: "Terminus & Branch", desc: "Full-width main line with extended terminus branch", viewBox: "0 0 800 400" };
}

// ──────────────────────────────────────────────
// LAYOUT 3: Dual Oval Junction
// ──────────────────────────────────────────────
function makeJunction(ox: number, oy: number) {
  const outerRX = 330, outerRY = 155;
  const innerRX = 210, innerRY = 95;
  const rbx = ox + outerRX, rby = oy;
  const lbx = ox - outerRX, lby = oy;

  // Oval path analysis:
  // Outer: x[70..730], y[45..355]  |  Inner: x[190..610], y[105..295]
  // Gap at y=200 center: 120px on each side between inner and outer ovals

  const parts = [
    // Outer oval (main line)
    { path: `M ${ox - outerRX} ${oy} A ${outerRX} ${outerRY} 0 0 1 ${ox + outerRX} ${oy} A ${outerRX} ${outerRY} 0 0 1 ${ox - outerRX} ${oy}`, trackWidth: 26, type: 'main' as const },
    // Inner oval (reversing loop)
    { path: `M ${ox - innerRX} ${oy} A ${innerRX} ${innerRY} 0 0 1 ${ox + innerRX} ${oy} A ${innerRX} ${innerRY} 0 0 1 ${ox - innerRX} ${oy}`, trackWidth: 18, type: 'main' as const },
    // Right side connection: inner oval right → outer oval right  (closes 120px gap at center)
    { path: `M ${ox + innerRX} ${oy} L ${ox + outerRX} ${oy}`, trackWidth: 18, type: 'main' as const },
    // Left side connection: inner oval left → outer oval left  (closes 120px gap at center)
    { path: `M ${ox - innerRX} ${oy} L ${ox - outerRX} ${oy}`, trackWidth: 18, type: 'main' as const },
    // Top section: add connecting track between outer oval top area
    { path: `M ${ox - 60} ${oy - innerRY} L ${ox - 60} ${oy - outerRY + 10}`, trackWidth: 16, type: 'main' as const },
    { path: `M ${ox + 60} ${oy - innerRY} L ${ox + 60} ${oy - outerRY + 10}`, trackWidth: 16, type: 'main' as const },
    // Bottom section: connect inner oval bottom to outer oval bottom
    { path: `M ${ox - 60} ${oy + innerRY} L ${ox - 60} ${oy + outerRY - 10}`, trackWidth: 16, type: 'main' as const },
    { path: `M ${ox + 60} ${oy + innerRY} L ${ox + 60} ${oy + outerRY - 10}`, trackWidth: 16, type: 'main' as const },
    // Right branch: splits from outer oval right side, goes UP within viewBox
    { path: `M ${rbx} ${rby} L ${rbx + 20} ${rby - 25} A 80 65 0 0 1 ${rbx + 60} ${rby - 80} L ${rbx + 60} ${rby - 120}`, trackWidth: 18, type: 'branch' as const },
    // Left branch: splits from outer oval left side, goes DOWN within viewBox
    { path: `M ${lbx} ${lby} L ${lbx - 20} ${lby + 25} A 80 65 0 0 0 ${lbx - 60} ${lby + 80} L ${lbx - 60} ${lby + 120}`, trackWidth: 18, type: 'branch' as const },
    // Sidings on right branch
    { path: `M ${rbx + 40} ${rby - 50} L ${rbx + 90} ${rby - 50}`, trackWidth: 13, type: 'siding' as const },
    { path: `M ${rbx + 60} ${rby - 80} L ${rbx + 60} ${rby - 120}`, trackWidth: 13, type: 'yard' as const },
    // Sidings on left branch
    { path: `M ${lbx - 40} ${lby + 50} L ${lbx - 90} ${lby + 50}`, trackWidth: 13, type: 'siding' as const },
    { path: `M ${lbx - 60} ${lby + 80} L ${lbx - 60} ${lby + 120}`, trackWidth: 13, type: 'yard' as const },
  ];
  const stations = [
    { x: ox, y: oy - innerRY - 25, label: 'CENTRAL JUNCTION' },
    { x: rbx + 50, y: rby - 110, label: 'EASTERN BRANCH' },
    { x: lbx - 50, y: lby + 110, label: 'WESTERN BRANCH' },
  ];
  return { parts, stations, name: "Dual Junction Network", desc: "Massive dual-branch layout spanning the full screen", viewBox: "0 0 800 400" };
}

// ──────────────────────────────────────────────
// LAYOUT 4: Complex Figure-8
// ──────────────────────────────────────────────
function makeFigure8(ox: number, oy: number) {
  const rX = 220, rY = 135, gap = 55;
  const rightX = ox + rX - gap/2, leftX = ox - rX + gap/2;

  const parts = [
    { path: `M ${ox - rX} ${oy - gap/2} A ${rX} ${rY} 0 0 1 ${ox + rX} ${oy - gap/2} A ${rX} ${rY} 0 0 1 ${ox - rX} ${oy - gap/2}`, trackWidth: 24, type: 'main' as const },
    { path: `M ${ox - rX} ${oy + gap/2} A ${rX} ${rY} 0 0 0 ${ox + rX} ${oy + gap/2} A ${rX} ${rY} 0 0 0 ${ox - rX} ${oy + gap/2}`, trackWidth: 24, type: 'main' as const },
    { path: `M ${ox - rX + gap/2} ${oy - gap/2} Q ${ox - rX/2 + gap/4} ${oy + gap/2} ${ox - rX + gap/2} ${oy + gap/2}`, trackWidth: 18, type: 'branch' as const },
    { path: `M ${ox + rX - gap/2} ${oy - gap/2} Q ${ox + rX/2 - gap/4} ${oy + gap/2} ${ox + rX - gap/2} ${oy + gap/2}`, trackWidth: 18, type: 'branch' as const },
    { path: `M ${rightX} ${oy} L ${rightX} ${oy + 80} A 60 50 0 0 1 ${rightX + 50} ${oy + 130} L ${rightX + 50} ${oy + 160}`, trackWidth: 17, type: 'branch' as const },
    { path: `M ${rightX + 25} ${oy + 50} L ${rightX + 70} ${oy + 50}`, trackWidth: 13, type: 'siding' as const },
    { path: `M ${rightX + 50} ${oy + 90} L ${rightX + 90} ${oy + 90}`, trackWidth: 13, type: 'yard' as const },
    { path: `M ${leftX} ${oy} L ${leftX} ${oy + 80} A 60 50 0 0 0 ${leftX - 50} ${oy + 130} L ${leftX - 50} ${oy + 160}`, trackWidth: 17, type: 'branch' as const },
    { path: `M ${leftX - 25} ${oy + 50} L ${leftX - 70} ${oy + 50}`, trackWidth: 13, type: 'siding' as const },
    { path: `M ${leftX - 50} ${oy + 90} L ${leftX - 90} ${oy + 90}`, trackWidth: 13, type: 'yard' as const },
    { path: `M ${ox} ${oy - gap/2} L ${ox} ${oy - gap/2 - 30}`, trackWidth: 14, type: 'main' as const },
  ];
  const stations = [
    { x: ox - 80, y: oy - rY - gap/2 + 5, label: 'NORTH STATION' },
    { x: ox + 80, y: oy + rY + gap/2 - 5, label: 'SOUTH STATION' },
    { x: 650, y: oy - 80, label: 'EASTERN BRANCH' },
  ];
  return { parts, stations, name: "Figure-8 Express", desc: "Huge interconnected figure-8 spanning the full screen", viewBox: "0 0 800 400" };
}

// ──────────────────────────────────────────────
// LAYOUT 5: Depot & Yard Complex
// ──────────────────────────────────────────────
function makeDepot(ox: number, oy: number) {
  const outerRX = 350, outerRY = 160;
  // Oval: x 50→750, y 40→360
  // Branches split from sides of oval (y=200) and extend DOWN within viewBox
  const rightX = ox + outerRX - 10; // 740 — just inside right edge
  const leftX = ox - outerRX + 10;   // 60  — just inside left edge

  const parts = [
    // Main oval (train travels this)
    { path: `M ${ox - outerRX} ${oy} A ${outerRX} ${outerRY} 0 0 1 ${ox + outerRX} ${oy} A ${outerRX} ${outerRY} 0 0 1 ${ox - outerRX} ${oy}`, trackWidth: 26, type: 'main' as const },
    // Inner oval (reversing loop)
    { path: `M ${ox - outerRX + 45} ${oy} A ${outerRX - 45} ${outerRY - 35} 0 0 1 ${ox + outerRX - 45} ${oy} A ${outerRX - 45} ${outerRY - 35} 0 0 1 ${ox - outerRX + 45} ${oy}`, trackWidth: 18, type: 'main' as const },
    { path: `M ${rightX} ${oy} L ${rightX} ${oy + 80} A 60 50 0 0 1 ${rightX + 60} ${oy + 130} L ${rightX + 60} ${oy + 160}`, trackWidth: 20, type: 'branch' as const },
    { path: `M ${rightX + 30} ${oy + 50} L ${rightX + 70} ${oy + 50}`, trackWidth: 16, type: 'yard' as const },
    { path: `M ${rightX + 60} ${oy + 90} L ${rightX + 100} ${oy + 90}`, trackWidth: 16, type: 'yard' as const },
    { path: `M ${rightX + 60} ${oy + 130} L ${rightX + 100} ${oy + 130}`, trackWidth: 14, type: 'siding' as const },
    { path: `M ${leftX} ${oy} L ${leftX} ${oy + 80} A 60 50 0 0 0 ${leftX - 40} ${oy + 130} L ${leftX - 40} ${oy + 160}`, trackWidth: 20, type: 'branch' as const },
    { path: `M ${leftX - 20} ${oy + 50} L ${leftX - 55} ${oy + 50}`, trackWidth: 16, type: 'yard' as const },
    { path: `M ${leftX - 40} ${oy + 90} L ${leftX - 80} ${oy + 90}`, trackWidth: 14, type: 'siding' as const },
    // Central lead connecting oval tops to main deadline label
    { path: `M ${ox} ${oy - outerRY + 15} L ${ox} ${oy - outerRY + 55}`, trackWidth: 16, type: 'main' as const },
    { path: `M ${ox} ${oy - outerRY + 55} L ${ox} ${oy - outerRY + 90}`, trackWidth: 16, type: 'main' as const },
    // Connect left and right sides of the depot area to the deadline
    { path: `M ${ox - 50} ${oy - outerRY + 55} L ${ox + 50} ${oy - outerRY + 55}`, trackWidth: 14, type: 'main' as const },
  ];
  const stations = [
    { x: ox, y: oy - outerRY + 38, label: 'MAIN DEADLINE' },
    { x: rightX + 30, y: oy + 145, label: 'ENGINE SHED' },
    { x: leftX - 30, y: oy + 145, label: 'FREIGHT YARD' },
  ];
  return { parts, stations, name: "Depot Complex", desc: "Massive depot with full-length engine shed roads", viewBox: "0 0 800 400" };
}

// ──────────────────────────────────────────────
// LAYOUT 6: Triple Track Wide Screen
// ──────────────────────────────────────────────
function makeTriple(ox: number, oy: number) {
  const outerRX = 360, outerRY = 160, gap = 16;

  const parts = [
    { path: `M ${ox - outerRX} ${oy} A ${outerRX} ${outerRY} 0 0 1 ${ox + outerRX} ${oy} A ${outerRX} ${outerRY} 0 0 1 ${ox - outerRX} ${oy}`, trackWidth: 26, type: 'main' as const },
    { path: `M ${ox - outerRX + gap} ${oy} A ${outerRX - gap} ${outerRY - gap} 0 0 1 ${ox + outerRX - gap} ${oy} A ${outerRX - gap} ${outerRY - gap} 0 0 1 ${ox - outerRX + gap} ${oy}`, trackWidth: 20, type: 'main' as const },
    { path: `M ${ox - outerRX + gap*2} ${oy} A ${outerRX - gap*2} ${outerRY - gap*2} 0 0 1 ${ox + outerRX - gap*2} ${oy} A ${outerRX - gap*2} ${outerRY - gap*2} 0 0 1 ${ox - outerRX + gap*2} ${oy}`, trackWidth: 15, type: 'branch' as const },
    { path: `M ${ox + outerRX} ${oy} L ${ox + outerRX} ${oy + 80} A 60 50 0 0 1 ${ox + outerRX + 60} ${oy + 130} L ${ox + outerRX + 60} ${oy + 160}`, trackWidth: 18, type: 'branch' as const },
    { path: `M ${ox + outerRX + 30} ${oy + 50} L ${ox + outerRX + 70} ${oy + 50}`, trackWidth: 13, type: 'siding' as const },
    { path: `M ${ox + outerRX + 60} ${oy + 90} L ${ox + outerRX + 95} ${oy + 90}`, trackWidth: 13, type: 'yard' as const },
    { path: `M ${ox - outerRX} ${oy} L ${ox - outerRX} ${oy + 80} A 60 50 0 0 0 ${ox - outerRX - 60} ${oy + 130} L ${ox - outerRX - 60} ${oy + 160}`, trackWidth: 18, type: 'branch' as const },
    { path: `M ${ox - outerRX - 30} ${oy + 50} L ${ox - outerRX - 70} ${oy + 50}`, trackWidth: 13, type: 'siding' as const },
    { path: `M ${ox - outerRX - 60} ${oy + 90} L ${ox - outerRX - 95} ${oy + 90}`, trackWidth: 13, type: 'yard' as const },
  ];
  const stations = [
    { x: ox, y: oy - outerRY - 10, label: 'TRIPLE MAIN' },
    { x: ox + outerRX + 30, y: oy + 145, label: 'NORTH BRANCH' },
    { x: ox - outerRX - 30, y: oy + 145, label: 'SOUTH BRANCH' },
  ];
  return { parts, stations, name: "Triple Track Express", desc: "Three parallel tracks with full-length branch extensions", viewBox: "0 0 800 400" };
}

// ──────────────────────────────────────────────
// LAYOUT 7: Dog-Bone Wide Scenic Layout
// ──────────────────────────────────────────────
function makeDogBone(ox: number, oy: number) {
  const endR = 100, straight = 380;
  const leftEndX = Math.max(0, ox - straight/2 - endR);
  const rightEndX = Math.min(800, ox + straight/2 + endR);

  const parts = [
    { path: `M ${leftEndX} ${oy} A ${endR} ${endR * 0.72} 0 0 1 ${ox + straight/2} ${oy} A ${endR} ${endR * 0.72} 0 0 1 ${leftEndX} ${oy}`, trackWidth: 26, type: 'main' as const },
    { path: `M ${leftEndX + 40} ${oy} A ${endR - 40} ${endR * 0.72 - 25} 0 0 1 ${ox + straight/2 - 40} ${oy} A ${endR - 40} ${endR * 0.72 - 25} 0 0 1 ${leftEndX + 40} ${oy}`, trackWidth: 18, type: 'main' as const },
    { path: `M ${rightEndX} ${oy} L ${rightEndX} ${oy - 40} A 40 32 0 0 1 ${rightEndX + 40} ${oy - 70} L ${rightEndX + 40} ${oy - 110}`, trackWidth: 18, type: 'branch' as const },
    { path: `M ${rightEndX + 20} ${oy - 40} L ${rightEndX + 55} ${oy - 40}`, trackWidth: 14, type: 'siding' as const },
    { path: `M ${rightEndX + 40} ${oy - 70} L ${rightEndX + 75} ${oy - 70}`, trackWidth: 13, type: 'yard' as const },
    { path: `M ${leftEndX} ${oy} L ${leftEndX} ${oy + 50} A 50 40 0 0 0 ${leftEndX - 50} ${oy + 80} L ${leftEndX - 50} ${oy + 120}`, trackWidth: 18, type: 'branch' as const },
    { path: `M ${leftEndX - 25} ${oy + 50} L ${leftEndX - 60} ${oy + 50}`, trackWidth: 14, type: 'siding' as const },
    { path: `M ${leftEndX - 50} ${oy + 80} L ${leftEndX - 90} ${oy + 80}`, trackWidth: 13, type: 'yard' as const },
    { path: `M ${ox} ${oy - endR * 0.72 + 10} L ${ox + 60} ${oy - endR * 0.72 - 40} A 50 40 0 0 1 ${ox + 110} ${oy - endR * 0.72 - 80}`, trackWidth: 14, type: 'main' as const },
  ];
  const stations = [
    { x: ox - 100, y: oy - endR * 0.72 - 10, label: 'MAIN LINE' },
    { x: rightEndX + 25, y: oy - 80, label: 'EASTERN BRANCH' },
    { x: leftEndX - 25, y: oy + 80, label: 'WESTERN BRANCH' },
  ];
  return { parts, stations, name: "Dog-Bone Express", desc: "Ultra-wide dog-bone layout with long branch extensions", viewBox: "0 0 800 400" };
}

// ──────────────────────────────────────────────
// LAYOUT 8: Heritage Complex
// ──────────────────────────────────────────────
function makeHeritage(ox: number, oy: number) {
  const outerRX = 310, outerRY = 155;

  const parts = [
    { path: `M ${ox - outerRX} ${oy} A ${outerRX} ${outerRY} 0 0 1 ${ox + outerRX} ${oy} A ${outerRX} ${outerRY} 0 0 1 ${ox - outerRX} ${oy}`, trackWidth: 26, type: 'main' as const },
    { path: `M ${ox - outerRX + 45} ${oy} A ${outerRX - 45} ${outerRY - 40} 0 0 1 ${ox + outerRX - 45} ${oy} A ${outerRX - 45} ${outerRY - 40} 0 0 1 ${ox - outerRX + 45} ${oy}`, trackWidth: 18, type: 'main' as const },
    { path: `M ${ox + outerRX} ${oy} L ${ox + outerRX + 30} ${oy - 30} A 45 38 0 0 1 ${ox + outerRX + 75} ${oy - 60} L ${ox + outerRX + 75} ${oy - 100}`, trackWidth: 18, type: 'branch' as const },
    { path: `M ${ox + outerRX + 40} ${oy - 30} L ${ox + outerRX + 75} ${oy - 30}`, trackWidth: 14, type: 'branch' as const },
    { path: `M ${ox + outerRX + 75} ${oy - 60} L ${ox + outerRX + 110} ${oy - 60}`, trackWidth: 14, type: 'siding' as const },
    { path: `M ${ox - outerRX} ${oy} L ${ox - outerRX - 25} ${oy + 50} A 45 38 0 0 0 ${ox - outerRX - 70} ${oy + 90} L ${ox - outerRX - 70} ${oy + 130}`, trackWidth: 16, type: 'branch' as const },
    { path: `M ${ox - outerRX - 45} ${oy + 60} L ${ox - outerRX - 95} ${oy + 60}`, trackWidth: 13, type: 'siding' as const },
    { path: `M ${ox - outerRX - 70} ${oy + 90} L ${ox - outerRX - 110} ${oy + 90}`, trackWidth: 13, type: 'yard' as const },
    { path: `M ${ox - 80} ${oy - outerRY + 10} L ${ox + 80} ${oy - outerRY + 10}`, trackWidth: 16, type: 'main' as const },
  ];
  const stations = [
    { x: ox, y: oy - outerRY - 10, label: 'HERITAGE MAIN' },
    { x: ox + outerRX + 45, y: oy - 80, label: 'BRANCH HALT' },
    { x: ox - outerRX - 55, y: oy + 110, label: 'VALLEY BRANCH' },
  ];
  return { parts, stations, name: "Heritage Network", desc: "Large heritage layout with dual branch extensions", viewBox: "0 0 800 400" };
}


// ──────────────────────────────────────────────
const FACTORIES = [makeDoubleOval, makeTerminus, makeJunction, makeFigure8, makeDepot, makeTriple, makeDogBone, makeHeritage];

// ──────────────────────────────────────────────
// GENERATOR
// ──────────────────────────────────────────────
function genLayout(seed: number) {
  const rng = (n: number) => {
    const x = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  
  const idx = Math.floor(rng(0) * FACTORIES.length);
  const jx = (rng(1) - 0.5) * 20;
  const jy = (rng(2) - 0.5) * 10;
  
  const layout = FACTORIES[idx](400 + jx, 200 + jy);
  
  // Mirror horizontally 50% of time
  if (rng(3) > 0.5) {
    layout.parts = layout.parts.map(p => {
      const mirrored = mirrorTrackPath(p.path);
      return { ...p, path: mirrored };
    });
    layout.stations = layout.stations.map(s => ({ ...s, x: 800 - s.x }));
  }
  
  return layout;
}

// ──────────────────────────────────────────────
// ORIGINAL LAYOUT (from 2D track plan)
// ──────────────────────────────────────────────
const ORIGINAL_LAYOUT = {
  // Complete counterclockwise oval: left(150,200) → top(400,80) → right(650,200) → bottom(400,320) → left
  mainPath: "M 150 200 Q 150 80 400 80 Q 650 80 650 200 Q 650 320 400 320 Q 150 320 150 200",
  // Branch from oval right (650,200) — goes right/up and returns to oval bottom (490,310)
  branchPath: "M 650 200 L 720 200 A 35 35 0 0 1 720 130 L 650 130 A 30 30 0 0 1 650 100 L 590 100 A 25 25 0 0 1 590 75 L 530 75 A 20 20 0 0 1 530 55 L 490 55 A 35 35 0 0 0 490 125 Q 490 310 490 310",
  // Station loop: splits from oval top-left (250,80), goes up and returns to oval right side (550,200)
  upMainPath: "M 250 80 L 250 25 A 30 30 0 0 1 310 25 L 310 35 A 45 35 0 0 1 400 35 L 400 25 A 50 40 0 0 1 500 25 L 550 25 A 40 35 0 0 1 550 95 Q 550 200 550 200",
};

// ──────────────────────────────────────────────
// COMPONENT
// ──────────────────────────────────────────────
interface InteractiveTrainProps {
  /** Hide the Train controls — use for decorative background mode */
  showControls?: boolean;
}

function seededRandom(seed: number) {
  let index = 0;
  return () => {
    const value = Math.sin(seed * 12.9898 + ++index * 78.233) * 43758.5453;
    return value - Math.floor(value);
  };
}

export default function InteractiveTrain({ showControls = true }: InteractiveTrainProps) {
  const trainRef = useRef<HTMLDivElement>(null);
  const mainPathRef = useRef<SVGPathElement>(null);
  const branchPathsRef = useRef<Array<SVGPathElement | null>>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  
  const hydrated = useHydrated();
  const reducedMotion = useReducedMotion();
  const storedMode = usePreference('railway-track-mode');
  const trackMode = storedMode === 'random' ? 'random' : 'default';
  // Changes each time Random is clicked → re-randomizes signals, layout, train start positions
  const [randomTick, setRandomTick] = useState(0);
  // One entry per train on the current layout. Rebuilt whole every frame, so a layout with
  // fewer trains never leaves stale locomotives frozen on screen.
  const [trains, setTrains] = useState<TrainView[]>([]);
  const [visible, setVisible] = useState(false);
  const [trail, setTrail] = useState<Array<{ x: number; y: number; id: number }>>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  // Auto-whistle refs: interval starts at 30s, increases each trigger up to 30min
  const autoIntervalRef = useRef(10000); // ms — starts at 10s after first interaction
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Kept in a ref so timers and the animation loop read the latest positions without restarting
  const trainsRef = useRef<TrainView[]>([]);
  useEffect(() => { trainsRef.current = trains; }, [trains]);
  const [smokeParticles, setSmokeParticles] = useState<Array<{ id: number; x: number; y: number; age: number }>>([]);
  const [activeSignals, setActiveSignals] = useState<Set<string>>(new Set());
  const smokeId = useRef(0);
  const ambientRef = useRef<HTMLAudioElement | null>(null);
  const hasInteractedRef = useRef(false);

  const { isMuted, setIsMuted } = useSound();
  const isMutedRef = useRef(isMuted);
  // Train control values for the animation loop and timers (see "Train controls" below)
  const controlsRef = useRef<TrainControlState>({ allPaused: false, trains: [] });
  const globalSpeedRef = useRef(1);
  const anyMovingRef = useRef(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const panelToggleRef = useRef<HTMLButtonElement>(null);
  const closePanel = useCallback(() => { setPanelOpen(false); panelToggleRef.current?.focus(); }, []);
  // The pages put an empty slot in their nav bar; the controls render there so they never float over content.
  const navSlot = useSyncExternalStore(subscribeNoop,
    () => document.getElementById('train-controls-slot'), () => null);
  const toggleSignal = useCallback((id: string) => {
    if (!isMutedRef.current) {
      const s = new Audio("/sounds/train-move.mp3");
      s.volume = 0.15; s.play().catch(() => {});
    }
    setActiveSignals(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const unmutedAtRef = useRef(0);
  // Starts/resumes the ambient loop. Must be called from inside a user gesture.
  const startAmbient = useCallback(() => {
    if (isMutedRef.current) return;
    let a = ambientRef.current;
    if (!a) {
      a = new Audio('/sounds/train-move.mp3');
      a.loop = true;
      a.volume = 0.12;
      ambientRef.current = a;
    }
    a.muted = false;
    if (a.paused) a.play().catch(() => {});
  }, []);
  useEffect(() => {
    isMutedRef.current = isMuted;
    if (isMuted) {
      if (ambientRef.current) { ambientRef.current.muted = true; ambientRef.current.pause(); }
    } else {
      // Don't replay anything on the unmute itself; the next user gesture starts ambient audio.
      unmutedAtRef.current = performance.now();
    }
  }, [isMuted]);

  // Start (or resume) the ambient loop on a user gesture so browsers allow playback, and
  // trigger the first smoke + whistle on the very first interaction.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleGesture = (e: Event) => {
      if (isMutedRef.current || !anyMovingRef.current || e.timeStamp <= unmutedAtRef.current) return;
      startAmbient();
      if (hasInteractedRef.current) return;
      hasInteractedRef.current = true;
      const rad = (leadOf(trainsRef.current).angle * Math.PI) / 180;
      const px = leadOf(trainsRef.current).x + Math.cos(rad) * 22;
      const py = leadOf(trainsRef.current).y + Math.sin(rad) * 22 - 20;
      const newParts: Array<{ id: number; x: number; y: number; age: number }> = [];
      for (let i = 0; i < 10; i++) newParts.push({ id: ++smokeId.current, x: px, y: py, age: 0 });
      setSmokeParticles(prev => [...prev, ...newParts]);
      const w = new Audio('/sounds/cta-whistle.mp3');
      w.volume = 0.08;
      w.play().catch(() => {});
    };
    // touchend/click/keydown count as user activation (touchstart does not on iOS).
    const events = ['click', 'touchend', 'keydown'] as const;
    events.forEach(ev => window.addEventListener(ev, handleGesture));
    return () => {
      events.forEach(ev => window.removeEventListener(ev, handleGesture));
      ambientRef.current?.pause();
      ambientRef.current = null;
      hasInteractedRef.current = false;
    };
  }, [startAmbient]);

  // Signal positions: fixed in default, random each time Random is clicked
  const signalPositions = useMemo(() => {
    if (trackMode === 'default') {
      return [
        { id: 'sig-1', x: 400, y: 80 },
        { id: 'sig-2', x: 650, y: 200 },
        { id: 'sig-3', x: 400, y: 320 },
        { id: 'sig-4', x: 250, y: 80 },
        { id: 'sig-5', x: 150, y: 200 },
      ];
    }
    const seed = randomTick + 1;
    const rng = (n: number) => { const x = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
    const count = Math.floor(rng(77) * 3) + 3; // 3–5 signals
    return Array.from({ length: count }).map((_, i) => ({
      id: `sig-rnd-${i}-${seed}`,
      x: 80 + rng(i * 3 + 1) * 640,
      y: 70 + rng(i * 3 + 2) * 260,
    }));
  }, [trackMode, randomTick]);
  const [svgRect, setSvgRect] = useState({
    left: 0, top: 0,
    width: 800, height: 400
  });

  // Animate smoke particles
  useEffect(() => {
    if (smokeParticles.length === 0) return;
    const interval = setInterval(() => {
      setSmokeParticles(prev =>
        prev.map(p => ({ ...p, age: p.age + 1 })).filter(p => p.age < 20)
      );
    }, 50);
    return () => clearInterval(interval);
  }, [smokeParticles.length]);
  
  // Number of trains: default=2, random=2-4 (very rarely 1)
  const numTrains = useMemo(() => {
    if (trackMode === 'default') return 2;
    const random = seededRandom(randomTick + 1);
    return random() > 0.1 ? Math.floor(random() * 3) + 2 : 1;
  }, [trackMode, randomTick]);

  // Progress per train — useRef so it persists across renders without re-init
  const progress = useRef<number[]>([]);
  useEffect(() => {
    const random = seededRandom(randomTick + 1);
    progress.current = Array.from({ length: numTrains }, (_, i) =>
      trackMode === 'default' ? (i === 0 ? 0.1 : 0.6) : random()
    );
  }, [numTrains, trackMode, randomTick]);
  // Train controls. Settings belong to the current layout: Random starts its new trains
  // running at 1×, while "Pause all" carries over. Mirrored into refs so the animation loop
  // reads them without restarting or regenerating the layout.
  const layoutKey = `${trackMode}:${trackMode === 'random' ? randomTick : 0}:${numTrains}`;
  const [controls, setControls] = useState<TrainControlState & { key: string }>(
    () => ({ key: '', allPaused: false, trains: [] }));
  const controlState = useMemo<TrainControlState>(() => controls.key === layoutKey
    ? controls : { allPaused: controls.allPaused, trains: freshTrains(numTrains) }, [controls, layoutKey, numTrains]);
  const [globalSpeed, setGlobalSpeed] = useState(1);
  const anyMoving = anyTrainMoving(controlState);
  const allStopped = !anyMoving;
  useEffect(() => {
    controlsRef.current = controlState;
    anyMovingRef.current = anyTrainMoving(controlState);
    if (!anyMovingRef.current) ambientRef.current?.pause();
  }, [controlState]);
  const updateControls = useCallback((change: (state: TrainControlState) => TrainControlState) => {
    setControls(prev => {
      const base = prev.key === layoutKey ? prev : { allPaused: prev.allPaused, trains: freshTrains(numTrains) };
      return { key: layoutKey, ...change(base) };
    });
  }, [layoutKey, numTrains]);
  const changeGlobalSpeed = useCallback((value: number) => { globalSpeedRef.current = value; setGlobalSpeed(value); }, []);
  // Pause the SVG rail-flow animation with the trains so nothing appears to keep moving.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof svg.pauseAnimations !== 'function') return;
    if (allStopped) svg.pauseAnimations(); else svg.unpauseAnimations();
  }, [allStopped]);

  const animFrame = useRef<number>(0);
  const trailId = useRef(0);
  const lastTrailTime = useRef(0);
  const svgRectRef = useRef({ left: 0, top: 0, width: 800, height: 400 });
  
  const randomLayout = useMemo(() => genLayout(randomTick + 1), [randomTick]);
  
  const trackParts = trackMode === 'default'
    ? [
        { path: ORIGINAL_LAYOUT.mainPath, trackWidth: 22, type: 'main' as const },
        { path: ORIGINAL_LAYOUT.branchPath, trackWidth: 16, type: 'branch' as const },
        { path: ORIGINAL_LAYOUT.upMainPath, trackWidth: 16, type: 'branch' as const },
      ]
    : randomLayout.parts;

  const currentViewBox = trackMode === 'default' ? '0 0 800 400' : randomLayout.viewBox;
  const currentStations = trackMode === 'default' 
    ? [{ x: 400, y: 160, label: 'STATION' }]
    : randomLayout.stations;

  // Auto-whistle: runs smoke + whistle at increasing intervals (30s → 1m → 2m → 3m → 5m → ... → 30m)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const doAutoWhistle = () => {
      if (isMutedRef.current || !anyMovingRef.current || !hasInteractedRef.current || document.hidden) return;
      const rad = (leadOf(trainsRef.current).angle * Math.PI) / 180;
      const aheadDist = 22, smokeRise = 20;
      const px = leadOf(trainsRef.current).x + Math.cos(rad) * aheadDist;
      const py = leadOf(trainsRef.current).y + Math.sin(rad) * aheadDist - smokeRise;
      const newParts: Array<{ id: number; x: number; y: number; age: number }> = [];
      for (let i = 0; i < 10; i++) newParts.push({ id: ++smokeId.current, x: px, y: py, age: 0 });
      setSmokeParticles(prev => [...prev, ...newParts]);
      // Use cta-whistle (shorter, cleaner) at low volume
      const w = new Audio("/sounds/cta-whistle.mp3");
      w.volume = 0.08;
      w.play().catch(() => {});
      // Increase interval: 10s → 20s → 30s → 1m → 2m → 5m → 10m → 20m → 30m (max)
      const intervals = [10000, 20000, 30000, 60000, 120000, 300000, 600000, 1200000, 1800000];
      const idx = intervals.indexOf(autoIntervalRef.current);
      autoIntervalRef.current = idx >= 0 && idx < intervals.length - 1 ? intervals[idx + 1] : 1800000;
      if (autoTimerRef.current) clearInterval(autoTimerRef.current);
      autoTimerRef.current = setInterval(doAutoWhistle, autoIntervalRef.current);
    };

    autoTimerRef.current = setInterval(doAutoWhistle, autoIntervalRef.current);
    return () => { if (autoTimerRef.current) clearInterval(autoTimerRef.current); };
  }, []);

  const handleModeChange = useCallback((mode: 'default' | 'random') => {
    if (mode === 'random') setRandomTick(Date.now());
    writePreference('railway-track-mode', mode);
  }, []);

  const updateSvgRect = useCallback(() => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    svgRectRef.current = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    setSvgRect(previous => previous.left === rect.left && previous.top === rect.top && previous.width === rect.width && previous.height === rect.height
      ? previous : { left: rect.left, top: rect.top, width: rect.width, height: rect.height });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mainPath = mainPathRef.current;
    const branchCandidates = branchPathsRef.current.filter((el): el is SVGPathElement => !!el && el.isConnected);
    let branchPath: SVGPathElement | null = null;
    if (!mainPath) return;

    // Route: main loop to the junction, out along the branch and back, then the rest of the
    // loop. Measured fresh for every layout, so a layout without a usable branch never keeps
    // the previous layout's branch length (which used to park trains at the loop start).
    const mainLength = mainPath.getTotalLength();
    let route: Route = { mainLength, branchLength: 0, junction: 0 };
    for (const candidate of branchCandidates) {
      const branchLength = candidate.getTotalLength();
      const start = candidate.getPointAtLength(0);
      let best = Infinity, junction = 0;
      for (let i = 0; i <= 400; i++) {
        const at = (i / 400) * mainLength;
        const pt = mainPath.getPointAtLength(at);
        const d = Math.hypot(pt.x - start.x, pt.y - start.y);
        if (d < best) { best = d; junction = at; }
      }
      // Only run onto a branch that actually leaves the loop; otherwise trains would teleport.
      if (best <= 24 && branchLength > 0) { route = { mainLength, branchLength, junction }; branchPath = candidate; break; }
    }
    const total = routeLength(route);

    const pointAt = (p: number) => {
      const loc = locateOnRoute(route, p);
      return loc.path === 'branch' && branchPath
        ? branchPath.getPointAtLength(loc.at)
        : mainPath.getPointAtLength(loc.at);
    };

    const viewFor = (p: number): TrainView => {
      const point = pointAt(p);
      // Heading from a point a little further along the route (wraps cleanly at the end of a lap)
      const ahead = pointAt(p + 3 / total);
      const angle = Math.atan2(ahead.y - point.y, ahead.x - point.x) * (180 / Math.PI);
      const normalized = ((angle % 360) + 360) % 360;
      const rect = svgRectRef.current;
      return {
        x: point.x * (rect.width / 800),
        y: point.y * (rect.height / 400),
        angle,
        flipY: normalized > 90 && normalized < 270 ? -1 : 1,
      };
    };

    const publish = () => {
      const views = progress.current.map(viewFor);
      trainsRef.current = views;
      setTrains(views);
      const lead = views[0];
      const now = Date.now();
      if (lead && anyMovingRef.current && now - lastTrailTime.current > 80) {
        lastTrailTime.current = now;
        const id = ++trailId.current;
        setTrail(t => [...t.slice(-25), { x: lead.x, y: lead.y, id }]);
        setTimeout(() => setTrail(t => t.filter(i => i.id !== id)), 1200);
      }
    };

    let previousFrame = 0;
    let lastRect = svgRectRef.current;
    const animate = (timestamp: number) => {
      const frameScale = frameScaleFor(previousFrame, timestamp);
      previousFrame = timestamp;
      const before = progress.current;
      progress.current = stepProgress(before, {
        frameScale,
        globalSpeed: globalSpeedRef.current,
        state: controlsRef.current,
        reducedMotion: !!reducedMotion,
        hold: dragIndexRef.current,
      });
      const moved = progress.current.some((p, i) => p !== before[i]);
      // Skip re-rendering while everything is stopped, unless the track was resized.
      if (moved || lastRect !== svgRectRef.current) { lastRect = svgRectRef.current; publish(); }
      animFrame.current = requestAnimationFrame(animate);
    };

    const pointerPoint = (e: MouseEvent | TouchEvent) => {
      const touch = "touches" in e ? e.touches[0] : null;
      if ("touches" in e && !touch) return null;
      return touch ? { x: touch.clientX, y: touch.clientY } : { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
    };

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const idx = dragIndexRef.current;
      if (idx === null) return;
      const at = pointerPoint(e);
      const svgEl = svgRef.current;
      if (!at || !svgEl) return;
      const rect = svgEl.getBoundingClientRect();
      const mouseX = ((at.x - rect.left) / rect.width) * 800;
      const mouseY = ((at.y - rect.top) / rect.height) * 400;

      let minDist = Infinity, bestP = progress.current[idx] ?? 0;
      for (let i = 0; i <= 300; i++) {
        const along = (i / 300) * route.mainLength;
        const pt = mainPath.getPointAtLength(along);
        const d = Math.hypot(mouseX - pt.x, mouseY - pt.y);
        if (d < minDist) { minDist = d; bestP = progressForRoutePoint(route, { path: 'main', at: along }); }
      }
      if (branchPath && route.branchLength > 0) {
        for (let i = 0; i <= 150; i++) {
          const along = (i / 150) * route.branchLength;
          const pt = branchPath.getPointAtLength(along);
          const d = Math.hypot(mouseX - pt.x, mouseY - pt.y);
          if (d < minDist) { minDist = d; bestP = progressForRoutePoint(route, { path: 'branch', at: along }); }
        }
      }
      const next = [...progress.current];
      next[idx] = bestP;
      progress.current = next;
      publish();
    };

    const handleDown = (e: MouseEvent | TouchEvent) => {
      // Don't drag from controls, links, dialogs or the nav bar
      const target = e.target as HTMLElement;
      if (target.closest('button, a, input, select, textarea, label, summary, nav, [role=dialog]')) return;
      const at = pointerPoint(e);
      if (!at) return;
      // Grab the nearest train, and only when the pointer is actually on it, so scrolling the
      // page past a train no longer stops anything.
      let nearest = -1, nearestDist = Infinity;
      const rect = svgRectRef.current;
      trainsRef.current.forEach((t, i) => {
        const d = Math.hypot(at.x - (rect.left + t.x), at.y - (rect.top + t.y));
        if (d < nearestDist) { nearestDist = d; nearest = i; }
      });
      if (nearest < 0 || nearestDist > 48) return;
      dragIndexRef.current = nearest;
      setDragIndex(nearest);
      if (!isMutedRef.current) {
        const a = new Audio("/sounds/train-move.mp3");
        a.volume = 0.2; a.play().catch(() => {});
        const w = new Audio("/sounds/cta-whistle.mp3");
        w.volume = 0.08; w.play().catch(() => {});
      }
      const t = trainsRef.current[nearest];
      const rad = (t.angle * Math.PI) / 180;
      const newParts: Array<{ id: number; x: number; y: number; age: number }> = [];
      for (let i = 0; i < 10; i++) newParts.push({ id: ++smokeId.current, x: t.x + Math.cos(rad) * 22, y: t.y + Math.sin(rad) * 22 - 20, age: 0 });
      setSmokeParticles(prev => [...prev, ...newParts]);
    };

    // Every way a press can end releases the train; a missed release used to freeze all trains.
    const handleUp = () => {
      if (dragIndexRef.current === null) return;
      dragIndexRef.current = null;
      setDragIndex(null);
    };

    // The running loop picks up a new size itself; with reduced motion there is no loop, so re-place here.
    const onResize = () => { updateSvgRect(); if (reducedMotion) publish(); };
    const resizeObserver = new ResizeObserver(onResize);
    if (svgRef.current) resizeObserver.observe(svgRef.current);
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('scroll', updateSvgRect, { passive: true });

    // First placement on the next frame (also the only placement when motion is reduced)
    const firstFrame = requestAnimationFrame(() => {
      updateSvgRect();
      publish();
      setVisible(true);
      if (!reducedMotion) animFrame.current = requestAnimationFrame(animate);
    });

    const releaseEvents = ["mouseup", "touchend", "touchcancel", "blur"] as const;
    window.addEventListener("mousemove", handleMove, { passive: true });
    window.addEventListener("touchmove", handleMove, { passive: true });
    window.addEventListener("mousedown", handleDown);
    window.addEventListener("touchstart", handleDown, { passive: true });
    releaseEvents.forEach(ev => window.addEventListener(ev, handleUp));
    document.addEventListener("visibilitychange", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("mousedown", handleDown);
      window.removeEventListener("touchstart", handleDown);
      releaseEvents.forEach(ev => window.removeEventListener(ev, handleUp));
      document.removeEventListener("visibilitychange", handleUp);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", updateSvgRect);
      resizeObserver.disconnect();
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(animFrame.current);
      dragIndexRef.current = null;
    };
  }, [trackMode, randomTick, numTrains, reducedMotion, updateSvgRect]);

  // Tap-through signals: only when the tap did not land on a link, control or dialog.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('a, button, input, select, textarea, label, summary, [role=dialog], [role=button]')) return;
      const radius = 32;
      const hit = signalPositions.find(sig => Math.hypot(
        event.clientX - (svgRect.left + sig.x / 800 * svgRect.width),
        event.clientY - (svgRect.top + sig.y / 400 * svgRect.height)) <= radius);
      if (hit) toggleSignal(hit.id);
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, [signalPositions, svgRect, toggleSignal]);

  // Always use the first path as main (it's always a closed oval in every layout)
  // Branch = first branch-type path that differs from main, else undefined
  const mainTrackPath = trackParts[0]?.path || '';
  // Every branch candidate is measured; the first one whose start touches the main loop is used.
  const branchTrackPaths = trackParts.filter(p => p.type === 'branch' && p.path && p.path !== mainTrackPath).map(p => p.path);

  const formatSpeed = (value: number) => `${Number(value.toFixed(2))}×`;
  const controlsUi = (
    <div className={`train-controls ${navSlot ? 'in-nav' : 'floating'}`}
      onKeyDown={e => { if (e.key === 'Escape' && panelOpen) { e.stopPropagation(); closePanel(); } }}>
      <button ref={panelToggleRef} type="button" className="train-controls-toggle"
        aria-expanded={panelOpen} aria-controls="train-controls-panel"
        aria-label={`Train controls${allStopped ? ' (paused)' : ''}`} title="Train controls"
        onClick={() => setPanelOpen(open => !open)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="5" y="3" width="14" height="13" rx="3"/><path d="M5 10h14M9 20l-2 2M15 20l2 2"/><circle cx="9" cy="13" r="0.6" fill="currentColor"/><circle cx="15" cy="13" r="0.6" fill="currentColor"/>
        </svg>
        <span className="train-controls-toggle-label">Trains</span>
        {allStopped && <span className="train-controls-dot" aria-hidden="true"/>}
      </button>
      {panelOpen && (
        <div id="train-controls-panel" role="group" aria-labelledby="train-controls-title" className="track-mode-selector">
          <div className="train-controls-row">
            <span id="train-controls-title" className="train-controls-title">Train controls</span>
            <button type="button" className="track-mode-btn default" autoFocus onClick={closePanel}>
              Close
            </button>
          </div>
          <div className="train-controls-row">
            <button type="button" className={`track-mode-btn default ${allStopped ? 'active' : ''}`}
              aria-pressed={allStopped} disabled={!!reducedMotion} onClick={() => updateControls(pauseAll)}>
              Pause all
            </button>
            <button type="button" className="track-mode-btn default"
              disabled={!!reducedMotion} onClick={() => { updateControls(runAll); startAmbient(); }}>
              Run all
            </button>
          </div>
          <div className="train-controls-row">
            <label htmlFor="train-speed">Speed (all)</label>
            <input id="train-speed" type="range" className="train-controls-speed"
              min={0.5} max={2} step={0.25} value={globalSpeed} disabled={!!reducedMotion}
              aria-valuetext={formatSpeed(globalSpeed)} onChange={e => changeGlobalSpeed(Number(e.target.value))} />
            <span aria-hidden="true" className="train-controls-value">{formatSpeed(globalSpeed)}</span>
          </div>
          {reducedMotion && (
            <p className="train-controls-note">Trains are still and speed is disabled because your device is set to reduce motion.</p>
          )}
          <details className="train-controls-trains">
            <summary>Individual trains ({controlState.trains.length})</summary>
            <ul>
              {controlState.trains.map((train, i) => {
                const moving = isTrainMoving(controlState, i);
                const name = `Train ${i + 1}`;
                return (
                  <li key={i} className="train-controls-row">
                    <span className="train-controls-name">{name}</span>
                    <button type="button" className={`track-mode-btn default ${moving ? '' : 'active'}`}
                      aria-pressed={!moving} aria-label={`${moving ? 'Pause' : 'Run'} ${name}`}
                      disabled={!!reducedMotion} onClick={() => { updateControls(state => toggleTrain(state, i)); if (!moving) startAmbient(); }}>
                      {moving ? 'Pause' : 'Run'}
                    </button>
                    <input type="range" className="train-controls-speed small" aria-label={`${name} speed`}
                      min={0.5} max={2} step={0.25} value={train.speed} disabled={!!reducedMotion}
                      aria-valuetext={`${formatSpeed(train.speed)}, effective ${formatSpeed(effectiveSpeed(globalSpeed, train.speed))}`}
                      onChange={e => { const value = Number(e.target.value); updateControls(state => setTrainSpeed(state, i, value)); }} />
                    <span aria-hidden="true" className="train-controls-value">{formatSpeed(train.speed)}</span>
                  </li>
                );
              })}
            </ul>
            <p className="train-controls-note">Each train runs at Speed (all) × its own speed.</p>
          </details>
          <div className="train-controls-row">
            <button type="button" className={`track-mode-btn default ${!isMuted ? 'active' : ''}`}
              aria-pressed={!isMuted} onClick={() => setIsMuted(!isMuted)}>
              {isMuted ? 'Sound: muted' : 'Sound: on'}
            </button>
            <span>Track</span>
            <button type="button"
              aria-pressed={trackMode === 'default'}
              className={`track-mode-btn default ${trackMode === 'default' ? 'active' : ''}`}
              onClick={() => handleModeChange('default')}
            >
              Layout
            </button>
            <button type="button"
              aria-pressed={trackMode === 'random'}
              className={`track-mode-btn random ${trackMode === 'random' ? 'active' : ''}`}
              onClick={() => handleModeChange('random')}
            >
              Random
            </button>
          </div>
          <p className="train-controls-note" aria-live="polite">
            Signals: {signalPositions.map((sig, i) => `S${i + 1} ${activeSignals.has(sig.id) ? 'Proceed' : 'Stop'}`).join(' · ')}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <>
      <style>{`
        .train-trail-dot {
          position: absolute;
          width: 5px; height: 5px;
          border-radius: 50%;
          background: rgba(212,168,67,0.75);
          pointer-events: none;
          z-index: 2;
          animation: trainTrailFade 1.2s ease-out forwards;
          transform: translate(-50%, -50%);
        }
        @keyframes trainTrailFade {
          0% { opacity: 0.8; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(0.1); }
        }
        .smoke-particle {
          position: absolute;
          border-radius: 50%;
          background: rgba(180, 180, 180, 0.7);
          pointer-events: none;
          z-index: 4;
          transform: translate(-50%, -50%);
        }
        .train-cursor {
          position: absolute;
          width: 60px; height: 26px;
          z-index: 3;
          cursor: grab;
          transform: translate(-50%, -50%);
          filter: drop-shadow(0 4px 12px rgba(0,0,0,0.8));
          transition: opacity 0.5s;
        }
        .train-cursor:active { cursor: grabbing; }
        .track-container {
          position: fixed;
          top: 0; left: 0;
          width: 100vw; height: 100vh;
          pointer-events: none;
          z-index: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .track-inner {
          position: relative;
          width: min(95vw, 1200px);
          height: min(47.5vw, 600px);
          opacity: 0.45;
        }
        /* In the nav the panel is positioned against the nav bar itself (static wrapper), so it
           spans the bar's width on phones instead of hanging off the button. */
        .train-controls { position: static; flex-shrink: 0; }
        .train-controls.floating { position: fixed; bottom: 16px; right: 16px; z-index: 9990; }
        .train-controls-toggle {
          display: inline-flex; align-items: center; gap: 6px;
          min-height: 40px; padding: 8px 10px;
          border-radius: 12px; border: 1px solid rgba(212, 168, 67, 0.3);
          background: rgba(212, 168, 67, 0.08); color: #d4a843;
          font: inherit; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
          cursor: pointer; position: relative; transition: background 0.2s;
        }
        .train-controls-toggle:hover, .train-controls-toggle[aria-expanded="true"] { background: rgba(212, 168, 67, 0.18); }
        .train-controls-toggle:focus-visible { outline: 2px solid #d4a843; outline-offset: 2px; }
        .train-controls-dot { position: absolute; top: 5px; right: 5px; width: 7px; height: 7px; border-radius: 50%; background: #ef4444; }
        @media (max-width: 479px) { .train-controls-toggle-label { display: none; } }
        .track-mode-selector {
          position: fixed;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 10px 6px;
          width: min(360px, calc(100vw - 24px));
          overflow-y: auto;
          overscroll-behavior: contain;
          color: rgba(212, 168, 67, 0.75);
          font-size: 11px;
          text-align: left;
          background: rgba(10, 13, 21, 0.96);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(212, 168, 67, 0.25);
          border-radius: 14px;
          box-shadow: 0 8px 28px rgba(0,0,0,0.6);
        }
        /* Drops down under the nav bar, like the mobile menu, and only while open */
        .train-controls.in-nav .track-mode-selector {
          position: absolute;
          top: calc(100% + 10px);
          right: max(12px, calc((100% - 72rem) / 2 + 16px));
          max-height: calc(100dvh - var(--banner-h, 0px) - 96px);
        }
        .train-controls.floating .track-mode-selector { right: 0; bottom: calc(100% + 8px); max-height: calc(100dvh - 140px); }
        .track-mode-btn {
          padding: 8px 14px;
          min-height: 34px;
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.05em; text-transform: uppercase;
          border-radius: 10px; border: none;
          cursor: pointer; transition: all 0.2s;
          font-family: inherit; text-align: center;
        }
        .track-mode-btn.default { background: transparent; color: rgba(212, 168, 67, 0.5); }
        .track-mode-btn.default.active {
          background: linear-gradient(135deg, rgba(212, 168, 67, 0.25) 0%, rgba(212, 168, 67, 0.1) 100%);
          color: #d4a843;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 0 12px rgba(212, 168, 67, 0.2);
        }
        .track-mode-btn.random { background: transparent; color: rgba(212, 168, 67, 0.5); }
        .track-mode-btn.random.active {
          background: linear-gradient(135deg, rgba(212, 168, 67, 0.25) 0%, rgba(212, 168, 67, 0.1) 100%);
          color: #d4a843;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 0 12px rgba(212, 168, 67, 0.2);
        }
        .track-mode-btn:hover:not(.active):not(:disabled) {
          color: rgba(212, 168, 67, 0.9);
          background: rgba(212, 168, 67, 0.08);
        }
        .track-mode-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .track-mode-selector button:focus-visible, .track-mode-selector input:focus-visible, .track-mode-selector summary:focus-visible {
          outline: 2px solid #d4a843;
          outline-offset: 2px;
        }
        .train-controls-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; padding: 0 6px; }
        .train-controls-title { font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #d4a843; flex: 1; }
        .train-controls-note { padding: 0 6px; margin: 0; color: rgba(212, 168, 67, 0.6); }
        .train-controls-speed { accent-color: #d4a843; width: 120px; flex: 1 1 100px; max-width: 160px; }
        .train-controls-speed.small { width: 90px; flex: 1 1 80px; }
        .train-controls-value { min-width: 34px; text-align: right; font-variant-numeric: tabular-nums; }
        .train-controls-trains { border-top: 1px solid rgba(212, 168, 67, 0.15); border-bottom: 1px solid rgba(212, 168, 67, 0.15); padding: 6px 0; }
        .train-controls-trains summary {
          cursor: pointer; padding: 6px; border-radius: 8px;
          font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #d4a843;
        }
        .train-controls-trains ul { list-style: none; margin: 4px 0; padding: 0; display: flex; flex-direction: column; gap: 6px; max-height: 200px; overflow-y: auto; }
        .train-controls-trains li { flex-wrap: nowrap; }
        .train-controls-name { min-width: 52px; font-weight: 700; color: #d4a843; white-space: nowrap; }
        .train-number {
          position: absolute; z-index: 4; transform: translate(-50%, -50%);
          min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px;
          font: 700 10px/16px 'Courier New', monospace; text-align: center;
          color: #0a0d15; background: #d4a843; pointer-events: none; transition: opacity 0.5s;
        }
        .station-label {
          position: absolute;
          font-family: 'Courier New', monospace;
          font-size: 7px;
          font-weight: bold;
          letter-spacing: 0.08em;
          color: rgba(212,168,67,0.7);
          pointer-events: none;
          white-space: nowrap;
        }
      `}</style>

      {/* Train controls — in the nav bar slot when the page has one; hidden in decorative mode */}
      {showControls && hydrated && (navSlot ? createPortal(controlsUi, navSlot) : controlsUi)}

      {/* Track path - behind everything */}
      <div className="track-container">
        <div className="track-inner">
          <svg 
            ref={svgRef}
            viewBox={currentViewBox} 
            className="w-full h-full"
            style={{ display: 'block' }}
          >
            <defs>
              <filter id="railGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            
            {/* Render all track parts */}
            {trackParts.map((part, idx) => {
              const isMain = part.type === 'main';
              const ballastColor = isMain ? '#3a3a4a' : '#323240';
              const railColor = '#d4a843';
              const sw = part.trackWidth;
              
              return (
                <g key={idx}>
                  {/* Ballast */}
                  <path d={part.path} fill="none" stroke={ballastColor} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"/>
                  {/* Rail base */}
                  <path d={part.path} fill="none" stroke="#252530" strokeWidth={sw - 4} strokeLinecap="round" strokeLinejoin="round"/>
                  {/* Golden running rail with glow */}
                  <path d={part.path} fill="none" stroke={railColor} strokeWidth="2" strokeDasharray="12,10" strokeLinecap="round" opacity="0.9" filter="url(#railGlow)">
                    {idx === 0 && !reducedMotion && <animate attributeName="stroke-dashoffset" from="0" to="-44" dur={`${(2.5 / globalSpeed).toFixed(2)}s`} repeatCount="indefinite"/>}
                  </path>
                </g>
              );
            })}
            
            {/* Junction markers — show physical connection points between tracks */}
            {trackMode === 'default' && (
              <g>
                {/* Junction at (650,200): oval right connects to branchPath */}
                <circle cx="650" cy="200" r="9" fill="#1a1d28" stroke="#d4a843" strokeWidth="2" opacity="0.9"/>
                <circle cx="650" cy="200" r="4" fill="#d4a843" opacity="0.8"/>
                {/* Junction at (490,310): branchPath returns to oval bottom-right */}
                <circle cx="490" cy="310" r="9" fill="#1a1d28" stroke="#d4a843" strokeWidth="2" opacity="0.9"/>
                <circle cx="490" cy="310" r="4" fill="#d4a843" opacity="0.8"/>
                {/* Junction at (250,80): oval top-left connects to upMainPath */}
                <circle cx="250" cy="80" r="9" fill="#1a1d28" stroke="#d4a843" strokeWidth="2" opacity="0.9"/>
                <circle cx="250" cy="80" r="4" fill="#d4a843" opacity="0.8"/>
                {/* Junction at (550,200): upMainPath returns to oval right side */}
                <circle cx="550" cy="200" r="9" fill="#1a1d28" stroke="#d4a843" strokeWidth="2" opacity="0.9"/>
                <circle cx="550" cy="200" r="4" fill="#d4a843" opacity="0.8"/>
              </g>
            )}
            
            {/* Station labels */}
            {currentStations.map((station, idx) => (
              <g key={`station-${idx}`}>
                <rect 
                  x={station.x - 42} 
                  y={station.y - 18} 
                  width="84" 
                  height="28" 
                  rx="3" 
                  fill="rgba(17,21,32,0.85)" 
                  stroke="#d4a843" 
                  strokeWidth="1.5"
                />
                <text 
                  x={station.x} 
                  y={station.y + 2} 
                  textAnchor="middle" 
                  fill="#d4a843" 
                  fontSize="8" 
                  fontFamily="'Courier New', monospace" 
                  fontWeight="bold"
                >
                  {station.label}
                </text>
              </g>
            ))}

            {/* Signal visuals (visual only — interactions via HTML buttons below) */}
            {signalPositions.map((sig, i) => {
              const active = activeSignals.has(sig.id);
              return (
                <g key={`sig-vis-${sig.id}`}>
                  <line x1={sig.x} y1={sig.y} x2={sig.x} y2={sig.y + 18} stroke={active ? '#22c55e' : '#ef4444'} strokeWidth="1.5" opacity="0.7" pointerEvents="none"/>
                  <circle cx={sig.x} cy={sig.y} r="9" fill={active ? '#22c55e' : '#ef4444'} opacity={active ? 1 : 0.85}
                    style={{ filter: active ? 'drop-shadow(0 0 7px #22c55e)' : 'drop-shadow(0 0 5px #ef4444)' }} pointerEvents="none" />
                  {active && <circle cx={sig.x} cy={sig.y} r="14" fill="none" stroke="#22c55e" strokeWidth="2" opacity="0.4" pointerEvents="none" />}
                  <text x={sig.x + 14} y={sig.y + 3} fill={active ? '#22c55e' : '#ef4444'} fontSize="8" fontFamily="'Courier New', monospace" fontWeight="bold" pointerEvents="none">
                    {`S${i + 1} ${active ? 'Proceed' : 'Stop'}`}
                  </text>
                </g>
              );
            })}

            {/* Hidden main path for train interaction — pointerEvents="none" so clicks pass through to signals beneath */}
            <path ref={mainPathRef} d={mainTrackPath} fill="none" stroke="transparent" strokeWidth="50" pointerEvents="none"/>
            {branchTrackPaths.map((d, i) => (
              <path key={i} ref={el => { branchPathsRef.current[i] = el; }} d={d} fill="none" stroke="transparent" strokeWidth="40" pointerEvents="none"/>
            ))}
          </svg>

          {/* Signal toggle buttons — handle touch directly to avoid click延迟 on iOS */}
          {hydrated && createPortal(signalPositions.map(sig => {
            const active = activeSignals.has(sig.id);
            // Pointer taps are resolved by the window click handler so these invisible
            // targets never sit on top of page content; the buttons stay for keyboard users.
            return (
              <button type="button" key={`sig-btn-${sig.id}`}
                data-signal-btn="true"
                onClick={() => toggleSignal(sig.id)}
                style={{
                  position: 'fixed',
                  left: svgRect.left + sig.x / 800 * svgRect.width,
                  top: svgRect.top + sig.y / 400 * svgRect.height,
                  transform: 'translate(-50%, -50%)',
                  width: 64, height: 64, borderRadius: '50%',
                  zIndex: 20, pointerEvents: 'none',
                  background: 'transparent',
                }}
                aria-pressed={active}
                aria-label={`Toggle signal ${sig.id}`}
              />
            );
          }), document.body)}

          {/* Trail dots */}
          {trail.map(dot => (
            <div key={dot.id} className="train-trail-dot" style={{ left: dot.x, top: dot.y }}/>
          ))}

          {/* Smoke particles — already in pixel coords (same as trainPos) */}
          {smokeParticles.map(p => (
            <div
              key={p.id}
              className="smoke-particle"
              style={{
                left: p.x,
                top: p.y,
                width: `${Math.max(2, 14 - p.age * 0.7)}px`,
                height: `${Math.max(2, 14 - p.age * 0.7)}px`,
                opacity: Math.max(0, 0.7 - p.age * 0.035),
                transform: `translate(-50%, -50%) translateY(${-p.age * 2}px)`,
              }}
            />
          ))}

          {/* Train cursors — one per train on the current layout; any train can be dragged */}
          {trains.slice(0, numTrains).map((pos, i) => (
          <div key={i}>
          {showControls && numTrains > 1 && (
            <span className="train-number" aria-hidden="true"
              style={{ left: pos.x, top: pos.y - 24, opacity: visible ? 0.85 : 0 }}>{i + 1}</span>
          )}
          <div
            ref={i === 0 ? trainRef : undefined}
            className="train-cursor"
            style={{
              left: pos.x,
              top: pos.y,
              opacity: visible ? (i === 0 ? 0.7 : 0.55) : 0,
              transform: `translate(-50%, -50%) rotate(${pos.angle}deg) scale(1, ${pos.flipY})`,
              // Never blocks taps; window-level handlers do drag detection
              pointerEvents: dragIndex === i ? 'all' : 'none',
            }}
          >
            <svg viewBox="0 0 70 30" fill="none">
              {/* Boiler — faces RIGHT */}
              <ellipse cx="38" cy="17" rx="24" ry="10" fill="url(#engineBoilerR)"/>
              <ellipse cx="50" cy="17" rx="0.8" ry="9" fill="#b8942f" opacity="0.7"/>
              <ellipse cx="42" cy="17" rx="0.8" ry="9" fill="#b8942f" opacity="0.7"/>
              <ellipse cx="32" cy="17" rx="0.8" ry="9" fill="#b8942f" opacity="0.7"/>
              {/* Smokebox */}
              <rect x="52" y="9" width="12" height="16" rx="2" fill="url(#smokeboxGradR)"/>
              <ellipse cx="62" cy="17" rx="4" ry="8" fill="#1a1d28"/>
              {/* Chimney */}
              <rect x="54" y="2" width="8" height="10" rx="1" fill="url(#chimneyEngineGradR)"/>
              <rect x="53" y="1" width="10" height="3" rx="1" fill="#c9a033"/>
              <rect x="55" y="0" width="6" height="2" rx="0.5" fill="#d4a843"/>
              {/* Dome */}
              <ellipse cx="35" cy="7" rx="5" ry="3.5" fill="url(#domeEngineGradR)"/>
              {/* Safety valves */}
              <rect x="26" y="4" width="3" height="5" rx="0.5" fill="#b8942f"/>
              <rect x="22" y="4" width="3" height="5" rx="0.5" fill="#b8942f"/>
              {/* Cab */}
              <rect x="4" y="7" width="16" height="20" rx="2" fill="url(#cabEngineGradR)"/>
              <rect x="7" y="10" width="10" height="7" rx="1" fill="#0a0d15" opacity="0.9"/>
              <rect x="2" y="5" width="20" height="3" rx="1" fill="#a07c2a"/>
              {/* Wheels — rightmost=front (cowcatcher side) */}
              <circle cx="60" cy="25" r="4" fill="#1a1d28"/>
              <circle cx="60" cy="25" r="3.2" fill="#2a2a3a"/>
              <circle cx="60" cy="25" r="1.2" fill="#d4a843"/>
              <circle cx="46" cy="25" r="5" fill="#1a1d28"/>
              <circle cx="46" cy="25" r="4" fill="#2a2a3a"/>
              <circle cx="46" cy="25" r="1.5" fill="#d4a843"/>
              <circle cx="34" cy="25" r="5" fill="#1a1d28"/>
              <circle cx="34" cy="25" r="4" fill="#2a2a3a"/>
              <circle cx="34" cy="25" r="1.5" fill="#d4a843"/>
              {/* Coupling rods — centered on wheel axle at y=25 */}
              <rect x="34" y="24" width="26" height="2" rx="1" fill="#b8942f"/>
              {/* Cowcatcher — RIGHT side (front) */}
              <path d="M 68 20 L 70 26 L 66 26 L 64 23 Z" fill="#c9a033"/>
              <line x1="69" y1="21" x2="68.5" y2="26" stroke="#8a7020" strokeWidth="0.5"/>
              <line x1="67" y1="20" x2="66.5" y2="26" stroke="#8a7020" strokeWidth="0.5"/>
              {/* Headlight — RIGHT side (front) */}
              <circle cx="68" cy="14" r="2.5" fill="#fffbe6"/>
              <circle cx="68" cy="14" r="1.8" fill="#ffeb3b"/>
              <circle cx="68" cy="14" r="0.8" fill="#fff"/>
              {/* Gradients */}
              <defs>
                <linearGradient id="engineBoilerR" x1="62" y1="7" x2="62" y2="27" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#e8c865"/>
                  <stop offset="40%" stopColor="#d4a843"/>
                  <stop offset="100%" stopColor="#9a7a20"/>
                </linearGradient>
                <linearGradient id="smokeboxGradR" x1="58" y1="9" x2="58" y2="25" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#3a3a4a"/>
                  <stop offset="100%" stopColor="#1a1d28"/>
                </linearGradient>
                <linearGradient id="chimneyEngineGradR" x1="58" y1="2" x2="58" y2="12" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#d4a843"/>
                  <stop offset="100%" stopColor="#8a7020"/>
                </linearGradient>
                <radialGradient id="domeEngineGradR" cx="50%" cy="30%" r="60%">
                  <stop offset="0%" stopColor="#e8d080"/>
                  <stop offset="100%" stopColor="#c9a033"/>
                </radialGradient>
                <linearGradient id="cabEngineGradR" x1="4" y1="7" x2="20" y2="27" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#c9a033"/>
                  <stop offset="100%" stopColor="#8a7020"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          </div>
          ))}
        </div>
      </div>
    </>
  );
}
