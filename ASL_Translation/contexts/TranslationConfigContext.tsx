import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  NO_HAND_TIMEOUT: "translation_no_hand_timeout_ms",
  STABILITY_FRAMES: "translation_stability_frames",
  COOLDOWN_MS: "translation_same_letter_cooldown_ms",
} as const;

export const NO_HAND_TIMEOUT_OPTIONS = [
  { value: 2500, label: "2.5s", description: "Fast" },
  { value: 5000, label: "5s",   description: "Balanced" },
  { value: 8000, label: "8s",   description: "Relaxed" },
] as const;

export const STABILITY_FRAMES_OPTIONS = [
  { value: 2, label: "2 frames", description: "Sensitive" },
  { value: 3, label: "3 frames", description: "Balanced" },
  { value: 5, label: "5 frames", description: "Strict" },
] as const;

export const COOLDOWN_MS_OPTIONS = [
  { value: 800,  label: "0.8s", description: "Fast" },
  { value: 1200, label: "1.2s", description: "Balanced" },
  { value: 2000, label: "2.0s", description: "Slow" },
] as const;

interface TranslationConfigContextType {
  noHandTimeoutMs: number;
  stabilityFrames: number;
  sameLetterCooldownMs: number;
  cycleNoHandTimeout: () => Promise<void>;
  cycleStabilityFrames: () => Promise<void>;
  cycleSameLetterCooldown: () => Promise<void>;
  resetTranslationConfig: () => Promise<void>;
}

const TranslationConfigContext = createContext<TranslationConfigContextType | undefined>(undefined);

export function TranslationConfigProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [noHandTimeoutMs, setNoHandTimeoutMs] = useState(5000);
  const [stabilityFrames, setStabilityFrames] = useState(3);
  const [sameLetterCooldownMs, setSameLetterCooldownMs] = useState(1200);

  useEffect(() => {
    AsyncStorage.multiGet([KEYS.NO_HAND_TIMEOUT, KEYS.STABILITY_FRAMES, KEYS.COOLDOWN_MS])
      .then(([t, s, c]) => {
        if (t[1] !== null) setNoHandTimeoutMs(Number(t[1]));
        if (s[1] !== null) setStabilityFrames(Number(s[1]));
        if (c[1] !== null) setSameLetterCooldownMs(Number(c[1]));
      })
      .catch(() => {});
  }, []);

  const cycleNoHandTimeout = useCallback(async () => {
    const vals = NO_HAND_TIMEOUT_OPTIONS.map(o => o.value);
    const idx = vals.indexOf(noHandTimeoutMs as typeof vals[number]);
    const next = vals[((idx >= 0 ? idx : 0) + 1) % vals.length];
    setNoHandTimeoutMs(next);
    await AsyncStorage.setItem(KEYS.NO_HAND_TIMEOUT, String(next));
  }, [noHandTimeoutMs]);

  const cycleStabilityFrames = useCallback(async () => {
    const vals = STABILITY_FRAMES_OPTIONS.map(o => o.value);
    const idx = vals.indexOf(stabilityFrames as typeof vals[number]);
    const next = vals[((idx >= 0 ? idx : 0) + 1) % vals.length];
    setStabilityFrames(next);
    await AsyncStorage.setItem(KEYS.STABILITY_FRAMES, String(next));
  }, [stabilityFrames]);

  const cycleSameLetterCooldown = useCallback(async () => {
    const vals = COOLDOWN_MS_OPTIONS.map(o => o.value);
    const idx = vals.indexOf(sameLetterCooldownMs as typeof vals[number]);
    const next = vals[((idx >= 0 ? idx : 0) + 1) % vals.length];
    setSameLetterCooldownMs(next);
    await AsyncStorage.setItem(KEYS.COOLDOWN_MS, String(next));
  }, [sameLetterCooldownMs]);

  const resetTranslationConfig = useCallback(async () => {
    setNoHandTimeoutMs(5000);
    setStabilityFrames(3);
    setSameLetterCooldownMs(1200);
    await AsyncStorage.multiRemove([KEYS.NO_HAND_TIMEOUT, KEYS.STABILITY_FRAMES, KEYS.COOLDOWN_MS]);
  }, []);

  return (
    <TranslationConfigContext.Provider value={{
      noHandTimeoutMs,
      stabilityFrames,
      sameLetterCooldownMs,
      cycleNoHandTimeout,
      cycleStabilityFrames,
      cycleSameLetterCooldown,
      resetTranslationConfig,
    }}>
      {children}
    </TranslationConfigContext.Provider>
  );
}

export function useTranslationConfig(): TranslationConfigContextType {
  const ctx = useContext(TranslationConfigContext);
  if (!ctx) throw new Error("useTranslationConfig must be used within TranslationConfigProvider");
  return ctx;
}
