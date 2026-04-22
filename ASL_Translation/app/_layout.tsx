import { ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PaperProvider } from "react-native-paper";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  lightTheme,
  darkTheme,
  highContrastTheme,
  NavigationLightTheme,
  NavigationDarkTheme,
} from "@/constants/paperTheme";
import { CameraConfigProvider } from "@/contexts/CameraConfigContext";
import {
  AccessibilityProvider,
  useAccessibility,
  FontSize,
} from "@/contexts/AccessibilityContext";
import { TranslationConfigProvider } from "@/contexts/TranslationConfigContext";

export const unstable_settings = {
  anchor: "(tabs)",
};

const FONT_SCALE: Record<FontSize, number> = { small: 0.8, medium: 1, large: 1.3 };

type AnyTheme = typeof lightTheme;

function applyFontScale(theme: AnyTheme, scale: number): AnyTheme {
  if (scale === 1) return theme;
  const scaledFonts = Object.fromEntries(
    Object.entries(theme.fonts).map(([key, value]) => [
      key,
      typeof value === "object" && value !== null && "fontSize" in value
        ? {
            ...value,
            fontSize: Math.round((value as { fontSize: number }).fontSize * scale),
            lineHeight: Math.round((value as { lineHeight: number }).lineHeight * scale),
          }
        : value,
    ])
  );
  return { ...theme, fonts: scaledFonts as AnyTheme["fonts"] };
}

function ThemedApp() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { isHighContrast, fontSize } = useAccessibility();

  const baseTheme = isHighContrast
    ? highContrastTheme
    : isDark
    ? darkTheme
    : lightTheme;
  const paperTheme = applyFontScale(baseTheme, FONT_SCALE[fontSize]);

  return (
    <PaperProvider theme={paperTheme}>
      <ThemeProvider value={isDark ? NavigationDarkTheme : NavigationLightTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="modal"
            options={{ presentation: "modal", title: "Modal" }}
          />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </PaperProvider>
  );
}

export default function RootLayout() {
  return (
    <AccessibilityProvider>
      <TranslationConfigProvider>
        <CameraConfigProvider>
          <ThemedApp />
        </CameraConfigProvider>
      </TranslationConfigProvider>
    </AccessibilityProvider>
  );
}
