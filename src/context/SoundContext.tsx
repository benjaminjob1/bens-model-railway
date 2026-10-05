"use client";

import { createContext, useContext, useCallback, ReactNode } from "react";
import { useHydrated, usePreference, writePreference } from "@/lib/preferences";

interface SoundContextValue {
  isMuted: boolean;
  setIsMuted: (value: boolean) => void;
  hasDecided: boolean;
  isReady: boolean;
}

const SoundContext = createContext<SoundContextValue>({
  isMuted: true,
  setIsMuted: () => {},
  hasDecided: false,
  isReady: false,
});

export function SoundProvider({ children }: { children: ReactNode }) {
  const preference = usePreference("railway-sound-muted");
  const isReady = useHydrated();
  const hasDecided = preference === "true" || preference === "false";
  const setIsMuted = useCallback((value: boolean) => writePreference("railway-sound-muted", String(value)), []);
  return (
    <SoundContext.Provider value={{ isMuted: preference !== "false", setIsMuted, hasDecided, isReady }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() { return useContext(SoundContext); }
