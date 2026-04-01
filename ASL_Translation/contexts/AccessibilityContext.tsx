import React, { createContext, useContext, useState, useEffect } from "react";
import { AccessibilityInfo } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface AccessibilityContextType {
  isHighContrast: boolean;
  setIsHighContrast: (value: boolean) => Promise<void>;
  announce: (message: string) => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(
  undefined
);

export function AccessibilityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isHighContrast, setIsHighContrastState] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("high_contrast_enabled").then((value) => {
      setIsHighContrastState(value === "true");
    });
  }, []);

  const setIsHighContrast = async (value: boolean) => {
    setIsHighContrastState(value);
    await AsyncStorage.setItem("high_contrast_enabled", String(value));
  };

  const announce = (message: string) => {
    AccessibilityInfo.announceForAccessibility(message);
  };

  return (
    <AccessibilityContext.Provider
      value={{ isHighContrast, setIsHighContrast, announce }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility(): AccessibilityContextType {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error("useAccessibility must be used within AccessibilityProvider");
  }
  return context;
}
