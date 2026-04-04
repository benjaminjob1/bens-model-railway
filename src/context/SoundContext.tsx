"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface SoundContextValue {
  isMuted: boolean;
  setIsMuted: (v: boolean) => void;
  hasDecided: boolean;
}

const SoundContext = createContext<SoundContextValue>({
  isMuted: false,
  setIsMuted: () => {},
  hasDecided: false,
});

export function SoundProvider({ children }: { children: ReactNode }) {
  const [isMuted, setIsMutedState] = useState(false);
  const [hasDecided, setHasDecided] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("railway-sound-muted");
    if (stored !== null) {
      setIsMutedState(stored === "true");
      setHasDecided(true);
    }
  }, []);

  const setIsMuted = (v: boolean) => {
    setIsMutedState(v);
    setHasDecided(true);
    localStorage.setItem("railway-sound-muted", v ? "true" : "false");
  };

  return (
    <SoundContext.Provider value={{ isMuted, setIsMuted, hasDecided }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  return useContext(SoundContext);
}
