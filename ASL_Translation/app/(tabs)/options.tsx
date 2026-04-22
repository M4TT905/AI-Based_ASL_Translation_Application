import { StyleSheet, ScrollView, Alert } from "react-native";
import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Text,
  Surface,
  Card,
  Button,
  List,
  Switch,
  useTheme,
  Divider,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, borderRadius, elevation } from "@/constants/paperTheme";
import { useCameraConfig } from "@/contexts/CameraConfigContext";
import { useAccessibility } from "@/contexts/AccessibilityContext";
import {
  useTranslationConfig,
  NO_HAND_TIMEOUT_OPTIONS,
  STABILITY_FRAMES_OPTIONS,
  COOLDOWN_MS_OPTIONS,
} from "@/contexts/TranslationConfigContext";
import { cameraConfigService } from "@/services/cameraConfigService";
import {
  CameraResolution,
  RESOLUTION_SETTINGS,
  CAPTURE_INTERVALS,
} from "@/types/camera";

export default function OptionsScreen() {
  const [notifications, setNotifications] = useState(true);
  const [bufferSize, setBufferSize] = useState(30);
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  useEffect(() => {
    AsyncStorage.getItem("notifications_enabled").then((val) => {
      if (val !== null) setNotifications(val === "true");
    });
    setBufferSize(cameraConfigService.getMaxBufferSize());
  }, []);

  const { config, updateResolution, updateCaptureInterval, resetConfig } =
    useCameraConfig();

  const {
    isHighContrast,
    setIsHighContrast,
    ttsEnabled,
    setTtsEnabled,
    fontSize,
    setFontSize,
    announce,
  } = useAccessibility();

  const {
    noHandTimeoutMs,
    stabilityFrames,
    sameLetterCooldownMs,
    cycleNoHandTimeout,
    cycleStabilityFrames,
    cycleSameLetterCooldown,
    resetTranslationConfig,
  } = useTranslationConfig();

  const noHandOpt    = NO_HAND_TIMEOUT_OPTIONS.find(o => o.value === noHandTimeoutMs)
                    ?? NO_HAND_TIMEOUT_OPTIONS[1];
  const stabilityOpt = STABILITY_FRAMES_OPTIONS.find(o => o.value === stabilityFrames)
                    ?? STABILITY_FRAMES_OPTIONS[1];
  const cooldownOpt  = COOLDOWN_MS_OPTIONS.find(o => o.value === sameLetterCooldownMs)
                    ?? COOLDOWN_MS_OPTIONS[1];

  const handleResolutionChange = async () => {
    const resolutions = [
      CameraResolution.HD_1080P,
      CameraResolution.HD_720P,
      CameraResolution.SD_480P,
    ];
    const currentIndex = resolutions.indexOf(config.resolution);
    const nextIndex = (currentIndex + 1) % resolutions.length;
    await updateResolution(resolutions[nextIndex]);
  };

  const handleIntervalChange = async () => {
    const currentIndex = CAPTURE_INTERVALS.indexOf(config.captureInterval);
    const nextIndex = (currentIndex + 1) % CAPTURE_INTERVALS.length;
    await updateCaptureInterval(CAPTURE_INTERVALS[nextIndex]);
  };

  const handleBufferSizeChange = () => {
    const sizes = [10, 20, 30, 50];
    const currentIndex = sizes.indexOf(bufferSize);
    const nextIndex = (currentIndex + 1) % sizes.length;
    setBufferSize(sizes[nextIndex]);
    cameraConfigService.setMaxBufferSize(sizes[nextIndex]);
  };

  const handleNotificationsToggle = async () => {
    const next = !notifications;
    setNotifications(next);
    await AsyncStorage.setItem("notifications_enabled", String(next));
  };

  const handleTtsToggle = async (value: boolean) => {
    await setTtsEnabled(value);
    announce(value ? "Text to speech enabled" : "Text to speech disabled");
  };

  const handleHighContrastToggle = async (value: boolean) => {
    await setIsHighContrast(value);
    announce(value ? "High contrast enabled" : "High contrast disabled");
  };

  const FONT_SIZES = ["small", "medium", "large"] as const;
  const handleFontSizeChange = async () => {
    const next = FONT_SIZES[(FONT_SIZES.indexOf(fontSize) + 1) % 3];
    await setFontSize(next);
    announce(`Font size set to ${next}`);
  };

  const handleAbout = () => {
    Alert.alert(
      "About ASL Translation",
      "AI-Based ASL Translation Application\nVersion 1.0.0\n\nThis app uses advanced AI to translate American Sign Language gestures in real-time.",
      [{ text: "OK" }]
    );
  };

  const handleHelp = () => {
    Alert.alert(
      "Help & Support",
      "For help and support:\n\n• Point camera at ASL gestures\n• Ensure good lighting\n• Keep hands visible in frame\n• Check camera permissions\n\nContact: support@asltranslation.com",
      [{ text: "OK" }]
    );
  };

  const handleResetSettings = () => {
    Alert.alert(
      "Reset Settings",
      "Are you sure you want to reset all camera settings to default?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await resetConfig();
            await resetTranslationConfig();
            setNotifications(true);
            Alert.alert(
              "Settings Reset",
              "All settings have been reset to default values."
            );
          },
        },
      ]
    );
  };

  const handleTestCapture = () => {
    const currentResolution = RESOLUTION_SETTINGS[config.resolution];
    Alert.alert(
      "Camera Configuration",
      `Resolution: ${currentResolution.label}\n` +
        `Dimensions: ${currentResolution.width}x${currentResolution.height}\n` +
        `Quality: ${Math.round(currentResolution.quality * 100)}%\n` +
        `Capture Interval: ${config.captureInterval}ms\n` +
        `FPS Target: ${Math.round(1000 / config.captureInterval)}`,
      [{ text: "OK" }]
    );
  };

  return (
    <Surface
      style={[
        styles.container,
        { paddingTop: insets.top, backgroundColor: theme.colors.background },
      ]}
    >
      {/* Header */}
      <Surface
        style={[styles.header, { backgroundColor: theme.colors.surface }]}
        elevation={elevation.level1}
      >
        <Text
          variant="headlineMedium"
          style={[styles.title, { color: theme.colors.onSurface }]}
        >
          Options
        </Text>
      </Surface>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg }}
      >
        {/* Camera Settings */}
        <Card
          style={[
            styles.section,
            { marginHorizontal: spacing.md, marginTop: spacing.md },
          ]}
          elevation={elevation.level2}
        >
          <Card.Content>
            <Text
              variant="titleMedium"
              style={[
                styles.sectionTitle,
                { color: theme.colors.onSurface, marginBottom: spacing.md },
              ]}
            >
              Camera Settings
            </Text>

            <List.Item
              title="Resolution"
              description={RESOLUTION_SETTINGS[config.resolution].label}
              right={() => (
                <Button
                  mode="outlined"
                  onPress={handleResolutionChange}
                  style={{ borderRadius: borderRadius.md }}
                  accessibilityLabel={`Resolution: ${config.resolution}. Tap to change`}
                >
                  {config.resolution}
                </Button>
              )}
              style={styles.listItem}
            />

            <Divider style={{ marginVertical: spacing.sm }} />

            <List.Item
              title="Frame Capture Interval"
              description={`Capture every ${config.captureInterval}ms (~${Math.round(1000 / config.captureInterval)} FPS)`}
              right={() => (
                <Button
                  mode="outlined"
                  onPress={handleIntervalChange}
                  style={{ borderRadius: borderRadius.md }}
                  accessibilityLabel={`Capture interval: ${config.captureInterval}ms. Tap to change`}
                >
                  {config.captureInterval}ms
                </Button>
              )}
              style={styles.listItem}
            />

            <Divider style={{ marginVertical: spacing.sm }} />

            <List.Item
              title="Frame Buffer Size"
              description={`Store last ${bufferSize} frames in memory`}
              right={() => (
                <Button
                  mode="outlined"
                  onPress={handleBufferSizeChange}
                  style={{ borderRadius: borderRadius.md }}
                  accessibilityLabel={`Buffer size: ${bufferSize}. Tap to change`}
                >
                  {bufferSize}
                </Button>
              )}
              style={styles.listItem}
            />

            <Divider style={{ marginVertical: spacing.sm }} />

            <Button
              mode="contained-tonal"
              onPress={handleTestCapture}
              icon="test-tube"
              style={[styles.resetButton, { borderRadius: borderRadius.lg }]}
              accessibilityLabel="View current camera configuration"
            >
              View Configuration
            </Button>
          </Card.Content>
        </Card>

        {/* Detection Tuning */}
        <Card
          style={[
            styles.section,
            { marginHorizontal: spacing.md, marginTop: spacing.md },
          ]}
          elevation={elevation.level2}
        >
          <Card.Content>
            <Text
              variant="titleMedium"
              style={[styles.sectionTitle, { color: theme.colors.onSurface, marginBottom: spacing.xs }]}
            >
              Detection Tuning
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant, marginBottom: spacing.md }}
            >
              Controls how letters are detected and confirmed. Changes take effect immediately.
            </Text>

            <List.Item
              title="Word Finalize Delay"
              description={`After hand leaves frame, wait this long before speaking — ${noHandOpt.description}`}
              right={() => (
                <Button
                  mode="outlined"
                  onPress={cycleNoHandTimeout}
                  style={{ borderRadius: borderRadius.md, minWidth: 64 }}
                  accessibilityLabel={`Word finalize delay: ${noHandOpt.label}. Tap to cycle`}
                >
                  {noHandOpt.label}
                </Button>
              )}
              style={styles.listItem}
            />

            <Divider style={{ marginVertical: spacing.sm }} />

            <List.Item
              title="Letter Stability"
              description={`Consecutive matching frames needed before a letter fires — ${stabilityOpt.description}`}
              right={() => (
                <Button
                  mode="outlined"
                  onPress={cycleStabilityFrames}
                  style={{ borderRadius: borderRadius.md, minWidth: 64 }}
                  accessibilityLabel={`Letter stability: ${stabilityOpt.label}. Tap to cycle`}
                >
                  {stabilityOpt.label}
                </Button>
              )}
              style={styles.listItem}
            />

            <Divider style={{ marginVertical: spacing.sm }} />

            <List.Item
              title="Repeat Cooldown"
              description={`Minimum gap before the same letter can fire again — ${cooldownOpt.description}`}
              right={() => (
                <Button
                  mode="outlined"
                  onPress={cycleSameLetterCooldown}
                  style={{ borderRadius: borderRadius.md, minWidth: 64 }}
                  accessibilityLabel={`Repeat cooldown: ${cooldownOpt.label}. Tap to cycle`}
                >
                  {cooldownOpt.label}
                </Button>
              )}
              style={styles.listItem}
            />
          </Card.Content>
        </Card>

        {/* App Settings */}
        <Card
          style={[
            styles.section,
            { marginHorizontal: spacing.md, marginTop: spacing.md },
          ]}
          elevation={elevation.level2}
        >
          <Card.Content>
            <Text
              variant="titleMedium"
              style={[
                styles.sectionTitle,
                { color: theme.colors.onSurface, marginBottom: spacing.md },
              ]}
            >
              App Settings
            </Text>

            <List.Item
              title="Notifications"
              description="Receive translation alerts"
              accessibilityLabel={`Notifications ${notifications ? "enabled" : "disabled"}`}
              right={() => (
                <Switch
                  value={notifications}
                  onValueChange={handleNotificationsToggle}
                  thumbColor={
                    notifications ? theme.colors.primary : theme.colors.outline
                  }
                  trackColor={{
                    false: theme.colors.surfaceVariant,
                    true: theme.colors.primaryContainer,
                  }}
                  accessibilityLabel="Toggle notifications"
                />
              )}
              style={styles.listItem}
            />

            <Divider style={{ marginVertical: spacing.sm }} />

            <List.Item
              title="Text-to-Speech"
              description="Speak translated words aloud"
              accessibilityLabel={`Text-to-speech ${ttsEnabled ? "enabled" : "disabled"}`}
              right={() => (
                <Switch
                  value={ttsEnabled}
                  onValueChange={handleTtsToggle}
                  thumbColor={
                    ttsEnabled ? theme.colors.primary : theme.colors.outline
                  }
                  trackColor={{
                    false: theme.colors.surfaceVariant,
                    true: theme.colors.primaryContainer,
                  }}
                  accessibilityLabel="Toggle text-to-speech"
                />
              )}
              style={styles.listItem}
            />

            <Divider style={{ marginVertical: spacing.sm }} />

            <List.Item
              title="High Contrast"
              description="Increase visual contrast for accessibility"
              accessibilityLabel={`High contrast ${isHighContrast ? "enabled" : "disabled"}`}
              right={() => (
                <Switch
                  value={isHighContrast}
                  onValueChange={handleHighContrastToggle}
                  thumbColor={
                    isHighContrast ? theme.colors.primary : theme.colors.outline
                  }
                  trackColor={{
                    false: theme.colors.surfaceVariant,
                    true: theme.colors.primaryContainer,
                  }}
                  accessibilityLabel="Toggle high contrast mode"
                />
              )}
              style={styles.listItem}
            />

            <Divider style={{ marginVertical: spacing.sm }} />

            <List.Item
              title="Font Size"
              description={`Current: ${fontSize.charAt(0).toUpperCase() + fontSize.slice(1)}`}
              accessibilityLabel={`Font size: ${fontSize}. Tap to change`}
              right={() => (
                <Button
                  mode="outlined"
                  onPress={handleFontSizeChange}
                  style={{ borderRadius: borderRadius.md }}
                  accessibilityLabel={`Font size: ${fontSize}. Tap to cycle`}
                >
                  {fontSize.charAt(0).toUpperCase() + fontSize.slice(1)}
                </Button>
              )}
              style={styles.listItem}
            />
          </Card.Content>
        </Card>

        {/* Support & Information */}
        <Card
          style={[
            styles.section,
            { marginHorizontal: spacing.md, marginTop: spacing.md },
          ]}
          elevation={elevation.level2}
        >
          <Card.Content>
            <Text
              variant="titleMedium"
              style={[
                styles.sectionTitle,
                { color: theme.colors.onSurface, marginBottom: spacing.md },
              ]}
            >
              Support & Information
            </Text>

            <List.Item
              title="Help & Support"
              description="Get help with using the app"
              accessibilityLabel="Help and support"
              left={(props: any) => (
                <List.Icon
                  {...props}
                  icon="help-circle"
                  color={theme.colors.primary}
                />
              )}
              onPress={handleHelp}
              accessibilityLabel="Help and support"
              style={styles.listItem}
            />

            <Divider style={{ marginVertical: spacing.sm }} />

            <List.Item
              title="About"
              description="App information and version"
              accessibilityLabel="About ASL Translation"
              left={(props: any) => (
                <List.Icon
                  {...props}
                  icon="information"
                  color={theme.colors.primary}
                />
              )}
              onPress={handleAbout}
              accessibilityLabel="About this app"
              style={styles.listItem}
            />
          </Card.Content>
        </Card>

        {/* Reset Settings */}
        <Card
          style={[
            styles.section,
            { marginHorizontal: spacing.md, marginTop: spacing.md },
          ]}
          elevation={elevation.level2}
        >
          <Card.Content>
            <Text
              variant="titleMedium"
              style={[
                styles.sectionTitle,
                { color: theme.colors.onSurface, marginBottom: spacing.md },
              ]}
            >
              Reset
            </Text>

            <Button
              mode="outlined"
              onPress={handleResetSettings}
              icon="restore"
              style={[
                styles.resetButton,
                {
                  borderColor: theme.colors.error,
                  borderRadius: borderRadius.lg,
                },
              ]}
              textColor={theme.colors.error}
              accessibilityLabel="Reset all settings to defaults"
            >
              Reset All Settings
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  title: {
    fontWeight: "bold",
  },
  scrollView: {
    flex: 1,
  },
  section: {
    borderRadius: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    fontWeight: "600",
  },
  listItem: {
    paddingVertical: 4,
  },
  resetButton: {
    marginTop: 8,
  },
});
