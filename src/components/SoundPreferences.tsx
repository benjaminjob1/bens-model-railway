"use client";

import { useSound } from "@/context/SoundContext";
import SoundConsentModal from "./SoundConsentModal";

export default function SoundPreferences() {
  const { isReady, hasDecided, setIsMuted } = useSound();
  if (!isReady || hasDecided) return null;
  return <SoundConsentModal onPlaySounds={() => {
    setIsMuted(false);
    const audio = new Audio("/sounds/page-load.mp3");
    audio.volume = 0.2;
    audio.play().catch(() => {});
  }} />;
}
