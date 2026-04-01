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
import { cameraConfigService } from "@/services/cameraConfigService";
import {
  CameraResolution,
  RESOLUTION_SETTINGS,
  CAPTURE_INTERVALS,
} from "@/types/camera";

export default function OptionsScreen() {
  const [notifications, setNotifications] = useState(true);
  const [bufferSize, setBufferSize] = useState(30);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { isHighContrast, setIsHighContrast, announce } = useAccessibility();

  // Camera configuration context
  const { config, updateResolution, updateCaptureInterval, resetConfig } =
    useCameraConfig();

  useEffect(() => {
    AsyncStorage.getItem("tts_enabled").then((value) => {
      setTtsEnabled(value === null ? true : value === "true");
    });
  }, []);

  const handleTtsToggle = async (value: boolean) => {
    setTtsEnabled(value);
    await AsyncStorage.setItem("tts_enabled", String(value));
    announce(value ? "Text to speech enabled" : "Text to speech disabled");
  };

  const handleHighContrastToggle = async (value: boolean) => {
    await setIsHighContrast(value);
    announce(value ? "High contrast enabled" : "High contrast disabled");
  };

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

  const handleNotificationsToggle = () => {
    setNotifications(!notifications);
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
                  accessibilityLabel={`Change resolution, current: ${config.resolution}`}
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
                  accessibilityLabel={`Change capture interval, current: ${config.captureInterval}ms`}
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
                  accessibilityLabel={`Change frame buffer size, current: ${bufferSize}`}
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
              style={[
                styles.resetButton,
                {
                  borderRadius: borderRadius.lg,
                },
              ]}
              accessibilityLabel="View current camera configuration"
            >
              View Configuration
            </Button>
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
                  accessibilityLabel={`Notifications ${notifications ? "on" : "off"}`}
                />
              )}
              style={styles.listItem}
            />

            <Divider style={{ marginVertical: spacing.sm }} />

            <List.Item
              title="Text-to-Speech"
              description="Speak translated words aloud"
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
                  accessibilityLabel={`Text to speech ${ttsEnabled ? "on" : "off"}`}
                />
              )}
              style={styles.listItem}
            />

            <Divider style={{ marginVertical: spacing.sm }} />

            <List.Item
              title="High Contrast"
              description="Increase text and UI contrast"
              accessibilityLabel={`High contrast ${isHighContrast ? "on" : "off"}`}
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
              accessibilityLabel="Reset all settings to default"
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
