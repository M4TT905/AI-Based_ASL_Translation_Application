import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { AccessibilityInfo } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEYS = {
  HIGH_CONTRAST: "high_contrast_enabled",
  TTS_ENABLED: "tts_enabled",
  FONT_SIZE: "font_size",
} as const;

export type FontSize = "small" | "medium" | "large";

interface AccessibilityContextType {
  isHighContrast: boolean;
  setIsHighContrast: (v: boolean) => Promise<void>;
  ttsEnabled: boolean;
  setTtsEnabled: (v: boolean) => Promise<void>;
  fontSize: FontSize;
  setFontSize: (v: FontSize) => Promise<void>;
  announce: (message: string) => void;
}

const AccessibilityContext = createContext<
  AccessibilityContextType | undefined
>(undefined);

interface AccessibilityProviderProps {
  children: React.ReactNode;
}

export function AccessibilityProvider({
  children,
}: AccessibilityProviderProps): JSX.Element {
  const [isHighContrast, setIsHighContrastState] = useState(false);
  const [ttsEnabled, setTtsEnabledState] = useState(true);
  const [fontSize, setFontSizeState] = useState<FontSize>("medium");

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [hc, tts, fs] = await AsyncStorage.multiGet([
          STORAGE_KEYS.HIGH_CONTRAST,
          STORAGE_KEYS.TTS_ENABLED,
          STORAGE_KEYS.FONT_SIZE,
        ]);
        if (hc[1] !== null) setIsHighContrastState(hc[1] === "true");
        if (tts[1] !== null) setTtsEnabledState(tts[1] === "true");
        if (fs[1] !== null) setFontSizeState(fs[1] as FontSize);
      } catch (error) {
        console.error("Error loading accessibility settings:", error);
      }
    };
    loadSettings();
  }, []);

  const setIsHighContrast = useCallback(async (v: boolean) => {
    setIsHighContrastState(v);
    await AsyncStorage.setItem(STORAGE_KEYS.HIGH_CONTRAST, String(v));
  }, []);

  const setTtsEnabled = useCallback(async (v: boolean) => {
    setTtsEnabledState(v);
    await AsyncStorage.setItem(STORAGE_KEYS.TTS_ENABLED, String(v));
  }, []);

  const setFontSize = useCallback(async (v: FontSize) => {
    setFontSizeState(v);
    await AsyncStorage.setItem(STORAGE_KEYS.FONT_SIZE, v);
  }, []);

  const announce = useCallback((message: string) => {
    AccessibilityInfo.announceForAccessibility(message);
  }, []);

  const value: AccessibilityContextType = {
    isHighContrast,
    setIsHighContrast,
    ttsEnabled,
    setTtsEnabled,
    fontSize,
    setFontSize,
    announce,
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility(): AccessibilityContextType {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error(
      "useAccessibility must be used within an AccessibilityProvider"
    );
  }
  return context;
}
