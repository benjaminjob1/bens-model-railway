"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useSound } from "@/context/SoundContext";

// ============================================
// REAL 00 GAUGE (4mm/ft) TRACK SPECIFICATIONS
// Based on Hornby/Peco Setrack geometry
// Track gauge: 16.5mm | Track spacing: 67mm centre-to-centre
// Turnout angle: 22.5° | Rail height: code 100
// Standard radii: 371mm (1st), 438mm (2nd), 505mm (3rd), 571.5mm (4th)
// ============================================

const MM = 0.2; // 1 unit = 5mm real → 1mm = 0.2 SVG units
const TRACK_GAP = Math.round(67 * MM); // 13 units

// ──────────────────────────────────────────────

// ──────────────────────────────────────────────
// LAYOUT 1: Grand Oval with Extended Network
// ──────────────────────────────────────────────
function makeDoubleOval(ox: number, oy: number) {
  const outerRX = 355, outerRY = 165;
  const midRX = 270, midRY = 120;
  const brX = ox + outerRX - 20, brY = oy - outerRY + 20;

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
    { path: `M ${ox + outerRX} ${oy} L ${ox + outerRX + 10} ${oy - 20} A 40 35 0 0 1 ${ox + outerRX + 50} ${oy - 55} L ${ox + outerRX + 50} ${oy - 95}`, trackWidth: 18, type: 'branch' as const },
    { path: `M ${ox + outerRX + 20} ${oy - 30} L ${ox + outerRX + 20} ${oy - 15}`, trackWidth: 16, type: 'siding' as const },
    { path: `M ${ox + outerRX + 50} ${oy - 55} L ${ox + outerRX + 80} ${oy - 55}`, trackWidth: 16, type: 'siding' as const },
    { path: `M ${ox} ${oy + outerRY - 10} L ${ox} ${oy + outerRY - 50} A 60 50 0 0 0 ${ox + 80} ${oy + outerRY - 100}`, trackWidth: 15, type: 'main' as const },
    { path: `M ${ox + 40} ${oy + outerRY - 60} L ${ox + 120} ${oy + outerRY - 60}`, trackWidth: 14, type: 'branch' as const },
    { path: `M ${ox + 80} ${oy + outerRY - 100} L ${ox + 140} ${oy + outerRY - 100}`, trackWidth: 12, type: 'yard' as const },
  ];
  const stations = [
    { x: ox, y: oy - outerRY - 10, label: 'MAIN LINE' },
    { x: 765, y: 55, label: 'TERMINUS' },
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
  const innerRX = 300, innerRY = 125;
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
    { path: `M ${rightX + 50} ${oy + 80} L ${rightX + 50} ${oy + 120}`, trackWidth: 16, type: 'yard' as const },
    { path: `M ${rightX + 50} ${oy + 120} L ${rightX + 80} ${oy + 120}`, trackWidth: 14, type: 'siding' as const },
    { path: `M ${leftX} ${oy} L ${leftX} ${oy + 80} A 60 50 0 0 0 ${leftX - 35} ${oy + 130} L ${leftX - 35} ${oy + 160}`, trackWidth: 20, type: 'branch' as const },
    { path: `M ${leftX - 15} ${oy + 50} L ${leftX - 50} ${oy + 50}`, trackWidth: 16, type: 'yard' as const },
    { path: `M ${leftX - 35} ${oy + 90} L ${leftX - 70} ${oy + 90}`, trackWidth: 14, type: 'siding' as const },
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
    { path: `M ${ox + outerRX} ${oy} L ${ox + outerRX} ${oy + 70} A 55 45 0 0 1 ${ox + outerRX + 50} ${oy + 115} L ${ox + outerRX + 50} ${oy + 145}`, trackWidth: 18, type: 'branch' as const },
    { path: `M ${ox + outerRX + 20} ${oy + 45} L ${ox + outerRX + 55} ${oy + 45}`, trackWidth: 13, type: 'siding' as const },
    { path: `M ${ox + outerRX + 50} ${oy + 75} L ${ox + outerRX + 80} ${oy + 75}`, trackWidth: 13, type: 'yard' as const },
    { path: `M ${ox - outerRX} ${oy} L ${ox - outerRX} ${oy + 70} A 55 45 0 0 0 ${ox - outerRX - 50} ${oy + 115} L ${ox - outerRX - 50} ${oy + 145}`, trackWidth: 18, type: 'branch' as const },
    { path: `M ${ox - outerRX - 20} ${oy + 45} L ${ox - outerRX - 55} ${oy + 45}`, trackWidth: 13, type: 'siding' as const },
    { path: `M ${ox - outerRX - 50} ${oy + 75} L ${ox - outerRX - 80} ${oy + 75}`, trackWidth: 13, type: 'yard' as const },
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
    { path: `M ${rightEndX + 40} ${oy - 70} L ${rightEndX + 60} ${oy - 70}`, trackWidth: 13, type: 'yard' as const },
    { path: `M ${leftEndX} ${oy} L ${leftEndX} ${oy + 50} A 45 35 0 0 0 ${leftEndX - 45} ${oy + 80} L ${leftEndX - 45} ${oy + 115}`, trackWidth: 18, type: 'branch' as const },
    { path: `M ${leftEndX - 20} ${oy + 50} L ${leftEndX - 50} ${oy + 50}`, trackWidth: 14, type: 'siding' as const },
    { path: `M ${leftEndX - 45} ${oy + 80} L ${leftEndX - 80} ${oy + 80}`, trackWidth: 13, type: 'yard' as const },
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
  const brX = ox + outerRX - 40, brY = oy - outerRY + 30;

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
      const mirrored = p.path.replace(/(-?[\d.]+)\s+(-?[\d.]+)/g, (_, x, y) => `${(800 - parseFloat(x)).toFixed(1)} ${y}`);
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
  // Oval track: rx=250, ry=130. Peak y=70, nadir y=330, left x=150, right x=650.
  mainPath: "M 150 200 A 250 130 0 0 1 650 200 A 250 130 0 0 1 150 200",
  // Figure-8 crossing loop: same rx=250 so same width, offset vertically. Peak y=70, nadir y=330 — crosses OVER oval.
  branchPath: "M 150 200 A 250 130 0 0 1 400 70 A 250 130 0 0 1 650 200",
  // Figure-8 crossing loop 2: same rx=250, peak y=330, nadir y=70 — crosses UNDER oval.
  upMainPath: "M 650 200 A 250 130 0 0 1 400 330 A 250 130 0 0 1 150 200",
};

// ──────────────────────────────────────────────
// COMPONENT
// ──────────────────────────────────────────────
interface InteractiveTrainProps {
  /** Hide the Layout / Random selector — use for decorative background mode */
  showControls?: boolean;
}

export default function InteractiveTrain({ showControls = true }: InteractiveTrainProps) {
  const trainRef = useRef<HTMLDivElement>(null);
  const mainPathRef = useRef<SVGPathElement>(null);
  const branchPathRef = useRef<SVGPathElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const initialized = useRef(false);
  
  const [trackMode, setTrackMode] = useState<'default' | 'random'>('default');
  const [trainPos, setTrainPos] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);
  const [trail, setTrail] = useState<Array<{ x: number; y: number; id: number }>>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [trainAngle, setTrainAngle] = useState(0);
  const [trainScaleX, setTrainScaleX] = useState(1);
  const [trainScaleY, setTrainScaleY] = useState(1);
  // Auto-whistle refs: interval starts at 30s, increases each trigger up to 30min
  const autoIntervalRef = useRef(10000); // ms — starts at 10s after first interaction
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep refs in sync with state so interval can read current values
  const trainAngleRef = useRef(trainAngle);
  const trainPosRef = useRef(trainPos);
  useEffect(() => { trainAngleRef.current = trainAngle; }, [trainAngle]);
  useEffect(() => { trainPosRef.current = trainPos; }, [trainPos]);
  const [smokeParticles, setSmokeParticles] = useState<Array<{ id: number; x: number; y: number; age: number }>>([]);
  const [activeSignals, setActiveSignals] = useState<Set<string>>(new Set());
  const smokeId = useRef(0);
  const ambientRef = useRef<HTMLAudioElement | null>(null);
  const hasInteractedRef = useRef(false);

  const { isMuted } = useSound();
  const isMutedRef = useRef(isMuted);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

  // Start ambient loop + trigger first smoke+whistle on first user interaction (unlocks audio context)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleFirstInteraction = (e: Event) => {
      if (hasInteractedRef.current) return;
      hasInteractedRef.current = true;
      // Start ambient loop
      const a = new Audio('/sounds/train-move.mp3');
      a.loop = true;
      a.volume = 0.12;
      a.play().catch(() => {});
      ambientRef.current = a;
      // Trigger first smoke + whistle immediately on first click
      if (!isMutedRef.current) {
        const rad = (trainAngleRef.current * Math.PI) / 180;
        const px = trainPosRef.current.x + Math.cos(rad) * 22;
        const py = trainPosRef.current.y + Math.sin(rad) * 22 - 20;
        const newParts: Array<{ id: number; x: number; y: number; age: number }> = [];
        for (let i = 0; i < 10; i++) newParts.push({ id: ++smokeId.current, x: px, y: py, age: 0 });
        setSmokeParticles(prev => [...prev, ...newParts]);
        const w = new Audio('/sounds/cta-whistle.mp3');
        w.volume = 0.08;
        w.play().catch(() => {});
      }
    };
    window.addEventListener('click', handleFirstInteraction, { once: true });
    window.addEventListener('touchstart', handleFirstInteraction, { once: true });
    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
  });

  // Signal positions on the default oval layout
  const SIGNAL_POSITIONS = [
    { id: 'sig-1', x: 400, y: 80 },
    { id: 'sig-2', x: 650, y: 200 },
    { id: 'sig-3', x: 400, y: 320 },
    { id: 'sig-4', x: 250, y: 80 },
    { id: 'sig-5', x: 150, y: 200 },
  ];
  const [svgRect, setSvgRect] = useState({
    left: typeof window !== 'undefined' ? window.innerWidth / 2 - 400 : 0,
    top: typeof window !== 'undefined' ? window.innerHeight / 2 - 200 : 0,
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
  
  const progress = useRef(0.1);
  const animFrame = useRef<number>(0);
  const trailId = useRef(0);
  const lastTrailTime = useRef(0);
  const pathLength = useRef(0);
  const branchLength = useRef(0);
  const totalLength = useRef(0);
  
  const randomLayout = useMemo(() => genLayout(Date.now()), []);
  
  const trackParts = trackMode === 'default'
    ? [
        { path: ORIGINAL_LAYOUT.mainPath, trackWidth: 22, type: 'main' as const },
        { path: ORIGINAL_LAYOUT.branchPath, trackWidth: 16, type: 'branch' as const },
        { path: ORIGINAL_LAYOUT.upMainPath, trackWidth: 16, type: 'branch' as const },
      ]
    : randomLayout.parts;

  const currentViewBox = trackMode === 'default' ? '0 0 800 400' : randomLayout.viewBox;
  const currentStations = trackMode === 'default' 
    ? [{ x: 400, y: 200, label: 'CENTRAL' }]
    : randomLayout.stations;

  // Auto-whistle: runs smoke + whistle at increasing intervals (30s → 1m → 2m → 3m → 5m → ... → 30m)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem('railway-track-mode');
    if (saved === 'random' || saved === 'default') setTrackMode(saved);

    const updateRect = () => { if (svgRef.current) { const r = svgRef.current.getBoundingClientRect(); setSvgRect({ left: r.left, top: r.top, width: r.width, height: r.height }); } };
    updateRect();

    const doAutoWhistle = () => {
      if (isMutedRef.current) return;
      const rad = (trainAngleRef.current * Math.PI) / 180;
      const aheadDist = 22, smokeRise = 20;
      const px = trainPosRef.current.x + Math.cos(rad) * aheadDist;
      const py = trainPosRef.current.y + Math.sin(rad) * aheadDist - smokeRise;
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
    setTrackMode(mode);
    localStorage.setItem('railway-track-mode', mode);
  }, []);

  const updateSvgRect = useCallback(() => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    setSvgRect({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const mainPath = mainPathRef.current;
    const branchPath = branchPathRef.current;
    if (!mainPath) return;
    
    pathLength.current = mainPath.getTotalLength();
    if (branchPath) branchLength.current = branchPath.getTotalLength();
    totalLength.current = pathLength.current + branchLength.current;

    updateSvgRect();

    // Closed loop: train completes full oval FIRST, then visits branch and returns
    // Progress 0 → pathLength.main/total: traverse FULL main oval once
    // Progress pathLength.main/total → 1: traverse branch OUT AND BACK
    const ovalFraction = pathLength.current / totalLength.current;
    
    const getPointAtProgress = (p: number) => {
      if (p <= 0 || p > 1) p = ((p % 1) + 1) % 1;
      
      if (p <= ovalFraction) {
        // First phase: traverse the FULL main oval
        const mainP = p / ovalFraction; // 0 → 1 maps to full oval traversal
        const clampedP = Math.max(0, Math.min(1, mainP));
        return { point: mainPath.getPointAtLength(clampedP * pathLength.current), onBranch: false };
      } else if (branchPath) {
        // Second phase: branch out AND back to close the loop
        const branchP = (p - ovalFraction) / (1 - ovalFraction); // 0 → 1 = out, 1 → 0 = back
        const pingPongP = 1 - Math.abs((branchP * 2) - 1); // 0→1→0 triangle wave
        const clampedP = Math.max(0, Math.min(1, pingPongP));
        return { point: branchPath.getPointAtLength(clampedP * branchLength.current), onBranch: true };
      }
      return { point: mainPath.getPointAtLength(0), onBranch: false };
    };

    const updatePosition = (p: number, isRev = false) => {
      const { point } = getPointAtProgress(p);
      
      const delta = 0.003;
      const { point: nextPoint } = getPointAtProgress(Math.min(p + delta, 0.9999));
      const dx = nextPoint.x - point.x;
      const dy = nextPoint.y - point.y;
      
      let angle = Math.atan2(dy, dx) * (180 / Math.PI);
      if (isRev) angle += 180;
      const rotation = angle;
      const normalized = ((rotation % 360) + 360) % 360;
      // Rotation between 90 and 270 degrees makes the train appear upside-down.
      // We flip it vertically (scaleY = -1) in that range to keep wheels on the track.
      const shouldFlipY = (normalized > 90 && normalized < 270);
      const flipY = shouldFlipY ? -1 : 1;
      
      const scaleX = svgRect.width / 800;
      const scaleY_factor = svgRect.height / 400;
      const pixelX = point.x * scaleX;
      const pixelY = point.y * scaleY_factor;
      
      setTrainPos({ x: pixelX, y: pixelY });
      setTrainAngle(rotation);
      setTrainScaleX(1); 
      setTrainScaleY(flipY);
      
      const now = Date.now();
      if (now - lastTrailTime.current > 80) {
        lastTrailTime.current = now;
        const id = ++trailId.current;
        setTrail(t => [...t.slice(-25), { x: pixelX, y: pixelY, id }]);
        setTimeout(() => setTrail(t => t.filter(i => i.id !== id)), 1200);
      }
    };

    const animate = () => {
      if (!isDragging) {
        const prev = progress.current;
        progress.current = (progress.current + 0.00025) % 1;
        // Detect wrap-around: when progress resets from ~1 back to ~0, train is NOT reversing
        const isRev = progress.current < prev;
        updatePosition(progress.current, isRev);
      }
      animFrame.current = requestAnimationFrame(animate);
    };

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const svgEl = svgRef.current;
      if (!svgEl) return;
      const rect = svgEl.getBoundingClientRect();
      
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      
      const mouseX = ((clientX - rect.left) / rect.width) * 800;
      const mouseY = ((clientY - rect.top) / rect.height) * 400;

      let minDist = Infinity, bestP = progress.current;
      
      for (let i = 0; i <= 300; i++) {
        const p = i / 300;
        const pt = mainPath.getPointAtLength(p * pathLength.current);
        const d = Math.hypot(mouseX - pt.x, mouseY - pt.y);
        if (d < minDist) { minDist = d; bestP = p * (pathLength.current / totalLength.current); }
      }
      
      if (branchPath) {
        for (let i = 0; i <= 150; i++) {
          const p = i / 150;
          const pt = branchPath.getPointAtLength(p * branchLength.current);
          const d = Math.hypot(mouseX - pt.x, mouseY - pt.y);
          if (d < minDist) { minDist = d; bestP = (pathLength.current / totalLength.current) + (p * (branchLength.current / totalLength.current)); }
        }
      }
      
      progress.current = Math.max(0.001, Math.min(0.999, bestP));
      updatePosition(progress.current);
      if (!visible) setVisible(true);
    };

    const handleDown = (e: MouseEvent | TouchEvent) => {
      if (!trainRef.current) return;
      const rect = trainRef.current.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const dist = Math.hypot(clientX - (rect.left + rect.width / 2), clientY - (rect.top + rect.height / 2));
      if (dist < 70) {
        setIsDragging(true);
        // Play move sound
        const a = new Audio("/sounds/train-move.mp3");
        a.volume = 0.2;
        a.play().catch(() => {});
        // Play whistle on click (quieter)
        if (!isMuted) {
          const w = new Audio("/sounds/cta-whistle.mp3");
          w.volume = 0.08;
          w.play().catch(() => {});
        }
        // Spawn smoke at chimney (front of train = ahead of center along travel direction)
        // SVG rotated 180° internally so chimney faces right in screen space when angle=0
        const rad = (trainAngle * Math.PI) / 180;
        const aheadDist = 22;   // px ahead of center toward chimney
        const smokeRise = 20;   // px above center (smoke rises up in screen space)
        const smokeX = trainPos.x + Math.cos(rad) * aheadDist;
        const smokeY = trainPos.y + Math.sin(rad) * aheadDist - smokeRise;
        const newParticles: Array<{ id: number; x: number; y: number; age: number }> = [];
        for (let i = 0; i < 10; i++) {
          newParticles.push({ id: ++smokeId.current, x: smokeX, y: smokeY, age: 0 });
        }
        setSmokeParticles(prev => [...prev, ...newParticles]);
      }
    };

    const handleUp = () => setIsDragging(false);

    const resizeObserver = new ResizeObserver(() => updateSvgRect());
    if (svgRef.current) resizeObserver.observe(svgRef.current);
    window.addEventListener('resize', updateSvgRect, { passive: true });
    window.addEventListener('scroll', updateSvgRect, { passive: true });

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
      window.removeEventListener("resize", updateSvgRect);
      window.removeEventListener("scroll", updateSvgRect);
      resizeObserver.disconnect();
      cancelAnimationFrame(animFrame.current);
    };
  }, [isDragging, visible, svgRect, trackMode, updateSvgRect]);

  // Always use the first path as main (it's always a closed oval in every layout)
  // Branch = first branch-type path that differs from main, else undefined
  const mainTrackPath = trackParts[0]?.path || '';
  const branchTrackPath = trackParts.find(p => p.type === 'branch' && p.path !== mainTrackPath)?.path || '';

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
          pointer-events: all;
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
        .track-mode-selector {
          position: fixed;
          bottom: 24px; right: 24px;
          z-index: 9990;
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 6px;
          background: rgba(10, 13, 21, 0.9);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(212, 168, 67, 0.25);
          border-radius: 14px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        }
        .track-mode-btn {
          padding: 8px 16px;
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
        .track-mode-btn:hover:not(.active) {
          color: rgba(212, 168, 67, 0.9);
          background: rgba(212, 168, 67, 0.08);
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

      {/* Track mode selector — hidden when used as decorative background */}
      {showControls && (
      <div className="track-mode-selector">
        <button 
          className={`track-mode-btn default ${trackMode === 'default' ? 'active' : ''}`}
          onClick={() => handleModeChange('default')}
        >
          Layout
        </button>
        <button 
          className={`track-mode-btn random ${trackMode === 'random' ? 'active' : ''}`}
          onClick={() => handleModeChange('random')}
        >
          Random
        </button>
      </div>
      )}

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
              const railW = Math.max(sw - (isMain ? 16 : 12), 4);
              
              return (
                <g key={idx}>
                  {/* Ballast */}
                  <path d={part.path} fill="none" stroke={ballastColor} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"/>
                  {/* Rail base */}
                  <path d={part.path} fill="none" stroke="#252530" strokeWidth={sw - 4} strokeLinecap="round" strokeLinejoin="round"/>
                  {/* Golden running rail with glow */}
                  <path d={part.path} fill="none" stroke={railColor} strokeWidth="2" strokeDasharray="12,10" strokeLinecap="round" opacity="0.9" filter="url(#railGlow)">
                    {idx === 0 && <animate attributeName="stroke-dashoffset" from="0" to="-44" dur="2.5s" repeatCount="indefinite"/>}
                  </path>
                </g>
              );
            })}
            
            {/* Junction markers — show physical connection points between tracks */}
            {trackMode === 'default' && (
              <g>
                {/* Junction at (150,200): leftmost point where all tracks meet */}
                <circle cx="150" cy="200" r="9" fill="#1a1d28" stroke="#d4a843" strokeWidth="2" opacity="0.9"/>
                <circle cx="150" cy="200" r="4" fill="#d4a843" opacity="0.8"/>
                {/* Junction at (650,200): rightmost point where all tracks meet */}
                <circle cx="650" cy="200" r="9" fill="#1a1d28" stroke="#d4a843" strokeWidth="2" opacity="0.9"/>
                <circle cx="650" cy="200" r="4" fill="#d4a843" opacity="0.8"/>
                {/* Central crossing highlight */}
                <circle cx="400" cy="200" r="9" fill="#1a1d28" stroke="#d4a843" strokeWidth="2" opacity="0.9"/>
                <circle cx="400" cy="200" r="4" fill="#d4a843" opacity="0.8"/>
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

            {/* Signal indicators — shown in all layouts (positions scale with viewBox) */}
            {SIGNAL_POSITIONS.map(sig => {
              const active = activeSignals.has(sig.id);
              const toggleSignal = (e: React.MouseEvent) => {
                e.stopPropagation();
                e.preventDefault();
                if (!isMuted) {
                  const s = new Audio("/sounds/train-move.mp3");
                  s.volume = 0.15;
                  s.play().catch(() => {});
                }
                setActiveSignals(prev => {
                  const next = new Set(prev);
                  if (next.has(sig.id)) next.delete(sig.id);
                  else next.add(sig.id);
                  return next;
                });
              };
              return (
                <g key={sig.id} style={{ cursor: 'pointer', touchAction: 'none' }}
                  onClick={toggleSignal}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <line x1={sig.x} y1={sig.y} x2={sig.x} y2={sig.y + 18} stroke={active ? '#22c55e' : '#ef4444'} strokeWidth="1.5" opacity="0.6" pointerEvents="none"/>
                  <circle cx={sig.x} cy={sig.y} r="24" fill="rgba(255,255,255,0.05)" style={{ cursor: 'pointer' }} pointerEvents="all"
                    onClick={(e) => { e.stopPropagation(); toggleSignal(e); }}
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                  <circle cx={sig.x} cy={sig.y} r="6" fill={active ? '#22c55e' : '#ef4444'} opacity={active ? 1 : 0.8}
                    style={{ filter: active ? 'drop-shadow(0 0 5px #22c55e)' : 'drop-shadow(0 0 4px #ef4444)' }} pointerEvents="none" />
                  {active && <circle cx={sig.x} cy={sig.y} r="10" fill="none" stroke="#22c55e" strokeWidth="1.5" opacity="0.5" pointerEvents="none" />}
                </g>
              );
            })}

            {/* Hidden main path for train interaction — pointerEvents="none" so clicks pass through to signals beneath */}
            <path ref={mainPathRef} d={mainTrackPath} fill="none" stroke="transparent" strokeWidth="50" pointerEvents="none"/>
            {branchTrackPath && (
              <path ref={branchPathRef} d={branchTrackPath} fill="none" stroke="transparent" strokeWidth="40" pointerEvents="none"/>
            )}
          </svg>
          
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

          {/* Train cursor */}
          <div
            ref={trainRef}
            className="train-cursor"
            style={{
              left: trainPos.x,
              top: trainPos.y,
              opacity: visible ? 0.6 : 0,
              transform: `translate(-50%, -50%) rotate(${trainAngle}deg) scale(${trainScaleX}, ${trainScaleY})`,
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
      </div>
    </>
  );
}
