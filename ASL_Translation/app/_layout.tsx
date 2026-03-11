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
} from "@/contexts/AccessibilityContext";

export const unstable_settings = {
  anchor: "(tabs)",
};

function ThemedApp() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { isHighContrast } = useAccessibility();

  const paperTheme = isHighContrast
    ? highContrastTheme
    : isDark
    ? darkTheme
    : lightTheme;

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
      <CameraConfigProvider>
        <ThemedApp />
      </CameraConfigProvider>
    </AccessibilityProvider>
  );
}
