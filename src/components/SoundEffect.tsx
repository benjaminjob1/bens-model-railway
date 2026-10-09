"use client";

import { useEffect, useRef } from "react";
import { useSound } from "@/context/SoundContext";

const WHISTLE_URL = "/sounds/whistle.mp3";
const DEPARTURE_URL = "/sounds/departure.mp3";

export function useTrainWhistle() {
  const { isMuted } = useSound();
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    ref.current = new Audio(WHISTLE_URL);
    ref.current.volume = 0.25;
  }, []);
  return () => {
    if (!isMuted && ref.current) {
      ref.current.currentTime = 0;
      ref.current.play().catch(() => {});
    }
  };
}

// Returns a function to call on an actual departure event. Unmuting never replays it;
// muting stops a departure that is still playing.
export function useDepartureSound() {
  const { isMuted } = useSound();
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const el = new Audio(DEPARTURE_URL);
    el.volume = 0.2;
    ref.current = el;
    return () => { el.pause(); ref.current = null; };
  }, []);
  useEffect(() => {
    if (isMuted && ref.current) {
      ref.current.pause();
      ref.current.currentTime = 0;
    }
  }, [isMuted]);
  return () => {
    if (!isMuted && ref.current) {
      ref.current.currentTime = 0;
      ref.current.play().catch(() => {});
    }
  };
}

// Wrap a child element to play train whistle on click
export function Soundful({
  children,
  href,
  onClick,
  className,
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const play = useTrainWhistle();
  return (
    <a
      href={href}
      onClick={() => { play(); onClick?.(); }}
      className={className}
    >
      {children}
    </a>
  );
}
