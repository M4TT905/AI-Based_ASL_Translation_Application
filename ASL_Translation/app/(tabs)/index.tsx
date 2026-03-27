import { StyleSheet, View } from "react-native";
import {
  Text,
  Button,
  Surface,
  IconButton,
  useTheme,
  ActivityIndicator,
  Chip,
  Snackbar,
} from "react-native-paper";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { useState, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { spacing, borderRadius, elevation } from "@/constants/paperTheme";

import { TranslationToggleButton } from "@/components/ui/TranslationToggleButton";
import { useCameraConfig } from "@/contexts/CameraConfigContext";
import { useAccessibility } from "@/contexts/AccessibilityContext";
import { speakWord as speakTranslation } from "@/services/ttsService";
import { errorService } from "@/services/errorService";
import { apiService } from "@/services/apiService";
import { CapturedFrame } from "@/types/camera";

// How long (ms) with no hand detected before the accumulated text is finalized + cleared
const NO_HAND_TIMEOUT_MS = 5000;

export default function HomeScreen() {
  const [facing, setFacing] = useState<CameraType>("back");
  const [permission, requestPermission] = useCameraPermissions();
  const [isReady, setIsReady] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationText, setTranslationText] = useState("");
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [serverConnected, setServerConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const accumulatedWord = useRef("");
  const noHandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { startCapture, stopCapture } = useCameraConfig();

  const { ttsEnabled, announce, fontScale } = useAccessibility();

  const finalizeWord = (word: string) => {
    setTranslationText(word);
    if (ttsEnabled) {
      speakTranslation(word);
    } else {
      announce(word);
    }
  };

  const clearAccumulator = () => {
    if (noHandTimerRef.current) {
      clearTimeout(noHandTimerRef.current);
      noHandTimerRef.current = null;
    }
    accumulatedWord.current = "";
    setTranslationText("");
  };

  const handleFrameCapture = async (frame: CapturedFrame) => {
    const letter = await apiService.predictFrame(frame);

    if (!letter) {
      // Start the no-hand timer only if there's accumulated text to finalize
      if (!noHandTimerRef.current && accumulatedWord.current.length > 0) {
        noHandTimerRef.current = setTimeout(() => {
          if (accumulatedWord.current.length > 0) {
            finalizeWord(accumulatedWord.current);
            accumulatedWord.current = "";
          }
          noHandTimerRef.current = null;
        }, NO_HAND_TIMEOUT_MS);
      }
      return;
    }

    // Hand is back — cancel any pending finalize timer
    if (noHandTimerRef.current) {
      clearTimeout(noHandTimerRef.current);
      noHandTimerRef.current = null;
    }

    if (letter === " ") {
      if (accumulatedWord.current.length > 0) {
        finalizeWord(accumulatedWord.current);
        accumulatedWord.current = "";
      }
    } else {
      accumulatedWord.current += letter;
      setTranslationText(accumulatedWord.current);
    }
  };

  const handleToggleTranslation = async () => {
    if (isTranslating) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      stopCapture();
      apiService.disconnect();
      setIsTranslating(false);
      setServerConnected(false);
      clearAccumulator();
      announce("Translation stopped");
    } else {
      if (!cameraRef.current) {
        setSnackbarMessage("Camera is not ready yet");
        setSnackbarVisible(true);
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsConnecting(true);

      const connected = await apiService.checkConnection();
      setServerConnected(connected);
      setIsConnecting(false);

      if (!connected) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setSnackbarMessage("Cannot reach the ASL server. Make sure it is running.");
        setSnackbarVisible(true);
        return;
      }

      try {
        const started = await startCapture(cameraRef, handleFrameCapture);
        if (started) {
          setIsTranslating(true);
          announce("Translation started");
        } else {
          setSnackbarMessage("Failed to start frame capture. Please try again.");
          setSnackbarVisible(true);
        }
      } catch (e) {
        const err = errorService.classify(e);
        errorService.log(err);
        setSnackbarMessage(err.message);
        setSnackbarVisible(true);
      }
    }
  };

  if (!permission) {
    return (
      <Surface
        style={[
          permissionButtonStyle.container,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text
          variant="bodyLarge"
          style={{ marginTop: spacing.md, color: theme.colors.onBackground }}
        >
          Loading camera permissions...
        </Text>
      </Surface>
    );
  }

  if (!permission.granted) {
    return (
      <Surface
        style={[
          permissionButtonStyle.container,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <Text
          variant="bodyLarge"
          style={[
            permissionButtonStyle.text,
            { color: theme.colors.onBackground, marginBottom: spacing.lg },
          ]}
        >
          We need your permission to show the camera for ASL translation
        </Text>
        <Button
          mode="contained"
          onPress={requestPermission}
          style={{ borderRadius: borderRadius.lg }}
          accessibilityLabel="Grant camera permission for ASL translation"
        >
          Grant Camera Permission
        </Button>
      </Surface>
    );
  }

  function toggleCameraFacing() {
    const next = facing === "back" ? "front" : "back";
    setFacing(next);
    announce(`Camera switched to ${next}`);
  }

  return (
    <View style={mainStyle.container}>
      <View style={cameraStyle.container}>
        {permission?.granted ? (
          <CameraView
            ref={cameraRef}
            style={cameraStyle.camera}
            facing={facing}
            mode="picture"
            mirror={false}
            animateShutter={false}
            onCameraReady={() => setIsReady(true)}
            onMountError={(error: any) => {
              const err = errorService.classify(
                new Error(`camera mount error: ${error}`)
              );
              setSnackbarMessage(err.message);
              setSnackbarVisible(true);
            }}
          />
        ) : (
          <Surface
            style={[
              cameraStyle.camera,
              {
                backgroundColor: theme.colors.surfaceVariant,
                justifyContent: "center",
                alignItems: "center",
              },
            ]}
            elevation={0}
          >
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              No camera permission
            </Text>
          </Surface>
        )}

        {/* Camera flip button */}
        <Surface
          style={[
            toggleButtonStyle.container,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.outline,
              top: insets.top + spacing.md,
              right: spacing.md,
            },
          ]}
          elevation={elevation.level3}
        >
          <IconButton
            icon="camera-flip"
            size={24}
            iconColor={theme.colors.primary}
            onPress={toggleCameraFacing}
            accessibilityLabel="Flip camera"
          />
        </Surface>

        {/* Translation overlay */}
        <Surface
          style={[
            overlayStyle.container,
            {
              backgroundColor: theme.colors.primaryContainer,
              bottom: 0,
              paddingBottom: insets.bottom + spacing.md,
              borderTopLeftRadius: borderRadius.lg,
              borderTopRightRadius: borderRadius.lg,
            },
          ]}
          elevation={elevation.level2}
        >
          {/* Status row */}
          <View style={overlayStyle.statusRow}>
            <Text
              variant="titleMedium"
              style={[overlayStyle.statusText, { color: theme.colors.onPrimaryContainer, fontSize: Math.round(16 * fontScale) }]}
            >
              ASL Translation {isTranslating ? "Active" : "Ready"}
            </Text>

            {isTranslating && (
              <Chip
                mode="flat"
                compact
                icon={serverConnected ? "check-circle" : "alert-circle"}
                accessibilityLabel={serverConnected ? "Server connected" : "Server offline"}
              >
                {serverConnected ? "Connected" : "Offline"}
              </Chip>
            )}
          </View>

          {/* Translation output */}
          <View style={overlayStyle.outputRow}>
            {isTranslating && translationText === "" ? (
              <ActivityIndicator
                size="small"
                color={theme.colors.onPrimaryContainer}
                style={overlayStyle.translationSpinner}
                accessibilityLabel="Translating"
              />
            ) : (
              <Text
                variant="headlineLarge"
                style={[
                  overlayStyle.translationOutput,
                  { color: theme.colors.onPrimaryContainer, fontSize: Math.round(36 * fontScale) },
                ]}
                numberOfLines={2}
                adjustsFontSizeToFit
                accessibilityLabel={
                  translationText ? `Translated text: ${translationText}` : ""
                }
              >
                {translationText}
              </Text>
            )}

            {translationText.length > 0 && (
              <IconButton
                icon="close-circle"
                size={28}
                iconColor={theme.colors.onPrimaryContainer}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  clearAccumulator();
                }}
                accessibilityLabel="Clear translation"
                style={overlayStyle.clearButton}
              />
            )}
          </View>

          <TranslationToggleButton
            isTranslating={isTranslating}
            isConnecting={isConnecting}
            onToggle={handleToggleTranslation}
          />
        </Surface>

        {/* Camera loading indicator */}
        {!isReady && (
          <Surface style={loadingStyle.container} elevation={0}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text
              variant="bodyLarge"
              style={[loadingStyle.text, { marginTop: spacing.sm }]}
            >
              Initializing Camera...
            </Text>
          </Surface>
        )}
      </View>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={4000}
        action={{ label: "OK", onPress: () => setSnackbarVisible(false) }}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
}

const mainStyle = StyleSheet.create({
  container: {
    flex: 1,
  },
});

const permissionButtonStyle = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  text: {
    textAlign: "center",
  },
});

const toggleButtonStyle = StyleSheet.create({
  container: {
    position: "absolute",
    zIndex: 1,
    borderRadius: 12,
    borderWidth: 1,
  },
});

const cameraStyle = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    overflow: "hidden",
  },
  camera: {
    flex: 1,
    aspectRatio: undefined,
  },
});

const overlayStyle = StyleSheet.create({
  container: {
    position: "absolute",
    padding: 20,
    width: "100%",
    minHeight: "22%",
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  statusText: {
    fontWeight: "bold",
  },
  outputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 60,
    marginBottom: spacing.md,
  },
  translationOutput: {
    flex: 1,
    textAlign: "center",
    fontWeight: "bold",
  },
  translationSpinner: {
    flex: 1,
  },
  clearButton: {
    margin: 0,
  },
});

const loadingStyle = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  text: {
    color: "white",
    fontWeight: "bold",
  },
});
