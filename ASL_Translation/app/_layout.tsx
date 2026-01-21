import { ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PaperProvider } from "react-native-paper";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  lightTheme,
  darkTheme,
  NavigationLightTheme,
  NavigationDarkTheme,
} from "@/constants/paperTheme";
import { CameraConfigProvider } from "@/contexts/CameraConfigContext";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <PaperProvider theme={isDark ? darkTheme : lightTheme}>
      <CameraConfigProvider>
        <ThemeProvider
          value={isDark ? NavigationDarkTheme : NavigationLightTheme}
        >
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="modal"
              options={{ presentation: "modal", title: "Modal" }}
            />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </CameraConfigProvider>
    </PaperProvider>
  );
}
