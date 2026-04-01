import { Tabs } from "expo-router";
import React from "react";
import { useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outlineVariant,
          borderTopWidth: 1,
          height: 85 + insets.bottom, // Add safe area bottom inset
          paddingBottom: insets.bottom + 10, // Bottom padding + safe area
          paddingTop: 5, // Reduced top padding
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
          fontFamily: theme.fonts?.labelMedium?.fontFamily || "System",
          marginTop: 4, // Space between icon and label
          marginBottom: 2, // Bottom margin for label
        },
        tabBarIconStyle: {
          marginTop: 8, // Top margin for icon
        },
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={focused ? 24 : 22}
              name="house.fill"
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="options"
        options={{
          title: "Options",
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={focused ? 24 : 22}
              name="slider.horizontal.3"
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
