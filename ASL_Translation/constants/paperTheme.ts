import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { DefaultTheme, DarkTheme } from '@react-navigation/native';

// Material 3 Color Palette for ASL Translation App
const customColors = {
  light: {
    primary: '#2563eb', // Blue 600 - Professional, trustworthy
    onPrimary: '#ffffff',
    primaryContainer: '#dbeafe', // Blue 100
    onPrimaryContainer: '#1e3a8a', // Blue 800
    secondary: '#10b981', // Emerald 500 - Success, positive
    onSecondary: '#ffffff',
    secondaryContainer: '#d1fae5', // Emerald 100
    onSecondaryContainer: '#064e3b', // Emerald 900
    tertiary: '#8b5cf6', // Violet 500 - Technology, AI
    onTertiary: '#ffffff',
    tertiaryContainer: '#ede9fe', // Violet 100
    onTertiaryContainer: '#4c1d95', // Violet 900
    error: '#dc2626', // Red 600
    onError: '#ffffff',
    errorContainer: '#fecaca', // Red 200
    onErrorContainer: '#7f1d1d', // Red 900
    background: '#fafafa', // Neutral 50
    onBackground: '#171717', // Neutral 900
    surface: '#ffffff',
    onSurface: '#171717',
    surfaceVariant: '#f4f4f5', // Neutral 100
    onSurfaceVariant: '#525252', // Neutral 600
    outline: '#a3a3a3', // Neutral 400
    outlineVariant: '#e5e5e5', // Neutral 200
  },
  dark: {
    primary: '#60a5fa', // Blue 400
    onPrimary: '#1e3a8a', // Blue 800
    primaryContainer: '#1d4ed8', // Blue 700
    onPrimaryContainer: '#dbeafe', // Blue 100
    secondary: '#34d399', // Emerald 400
    onSecondary: '#064e3b', // Emerald 900
    secondaryContainer: '#059669', // Emerald 600
    onSecondaryContainer: '#d1fae5', // Emerald 100
    tertiary: '#a78bfa', // Violet 400
    onTertiary: '#4c1d95', // Violet 900
    tertiaryContainer: '#7c3aed', // Violet 600
    onTertiaryContainer: '#ede9fe', // Violet 100
    error: '#f87171', // Red 400
    onError: '#7f1d1d', // Red 900
    errorContainer: '#dc2626', // Red 600
    onErrorContainer: '#fecaca', // Red 200
    background: '#0a0a0a', // Nearly black
    onBackground: '#fafafa', // Neutral 50
    surface: '#171717', // Neutral 900
    onSurface: '#fafafa',
    surfaceVariant: '#262626', // Neutral 800
    onSurfaceVariant: '#a3a3a3', // Neutral 400
    outline: '#525252', // Neutral 600
    outlineVariant: '#404040', // Neutral 700
  },
};

// Custom light theme
export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    ...customColors.light,
  },
  roundness: 12, // Material 3 standard
};

// Custom dark theme
export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    ...customColors.dark,
  },
  roundness: 12,
};

// Simple navigation themes using default React Navigation themes
export const NavigationLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: customColors.light.primary,
    background: customColors.light.background,
    card: customColors.light.surface,
    text: customColors.light.onSurface,
    border: customColors.light.outline,
    notification: customColors.light.error,
  },
};

export const NavigationDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: customColors.dark.primary,
    background: customColors.dark.background,
    card: customColors.dark.surface,
    text: customColors.dark.onSurface,
    border: customColors.dark.outline,
    notification: customColors.dark.error,
  },
};

// Common spacing and sizing constants
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
};

// Elevation levels for Material 3 (compatible with React Native Paper)
export const elevation = {
  none: 0 as const,
  level1: 1 as const,
  level2: 2 as const,
  level3: 3 as const,
  level4: 4 as const,
  level5: 5 as const,
};