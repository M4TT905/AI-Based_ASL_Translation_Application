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
import { useState, useEffect, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, borderRadius, elevation } from "@/constants/paperTheme";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { TranslationToggleButton } from "@/components/ui/TranslationToggleButton";
import { useCameraConfig } from "@/contexts/CameraConfigContext";
import { useAccessibility } from "@/contexts/AccessibilityContext";
import { speakWord as speakTranslation } from "@/services/ttsService";
import { errorService } from "@/services/errorService";
import { apiService } from "@/services/apiService";
import { CapturedFrame } from "@/types/camera";
import * as ttsService from "@/services/ttsService";

export default function HomeScreen() {
  const [facing, setFacing] = useState<CameraType>("back");
  const [permission, requestPermission] = useCameraPermissions();
  const [isReady, setIsReady] = useState(false);
  const [debugInfo, setDebugInfo] = useState("Initializing...");
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { announce } = useAccessibility();

  const [isTranslating, setIsTranslating] = useState(false);
  const [translationText, setTranslationText] = useState("");
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [serverConnected, setServerConnected] = useState(false);
  const accumulatedWord = useRef("");

  const {
    config,
    stats,
    startCapture,
    stopCapture,
    isCapturing,
    captureSingleImage,
    bufferSize,
  } = useCameraConfig();

  const { ttsEnabled, announce, fontScale } = useAccessibility();

  // Called when the model recognizes a complete word (space received)
  const finalizeWord = (word: string) => {
    setTranslationText(word);
    if (ttsEnabled) {
      speakTranslation(word);
    } else {
      announce(word);
    }
  };

  const handleFrameCapture = async (frame: CapturedFrame) => {
    const letter = await apiService.predictFrame(frame);
    if (!letter) return;

    if (letter === " ") {
      // Space = word boundary: finalise the accumulated word, reset buffer
      if (accumulatedWord.current.length > 0) {
        finalizeWord(accumulatedWord.current);
        accumulatedWord.current = "";
      }
    } else {
      // Regular letter: append and update live display
      accumulatedWord.current += letter;
      setTranslationText(accumulatedWord.current);
    }
  };

  const handleSingleCapture = async () => {
    if (!cameraRef.current) {
      setSnackbarMessage("Camera is not ready yet");
      setSnackbarVisible(true);
      return;
    }

    try {
      const frame = await captureSingleImage();
      if (frame) {
        setSnackbarMessage(`Captured ${frame.resolution} image — ready for AI processing`);
        setSnackbarVisible(true);
      } else {
        setSnackbarMessage("Could not capture image");
        setSnackbarVisible(true);
      }
    } catch (e) {
      const err = errorService.classify(e);
      errorService.log(err);
      setSnackbarMessage(err.message);
      setSnackbarVisible(true);
    }
  };

  const handleToggleTranslation = async () => {
    if (isTranslating) {
      stopCapture();
      apiService.disconnect();
      setIsTranslating(false);
      setServerConnected(false);
      setDebugInfo("Translation stopped");
      accumulatedWord.current = "";
      announce("Translation stopped");
    } else {
      if (!cameraRef.current) {
        setSnackbarMessage("Camera is not ready yet");
        setSnackbarVisible(true);
        return;
      }

      // Check backend before starting capture
      const connected = await apiService.checkConnection();
      setServerConnected(connected);
      if (!connected) {
        setSnackbarMessage("Cannot reach the ASL server. Make sure it is running.");
        setSnackbarVisible(true);
        return;
      }

      try {
        const started = await startCapture(cameraRef, handleFrameCapture);
        if (started) {
          setIsTranslating(true);
          setDebugInfo("Translation active - capturing frames");
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

  useEffect(() => {
    console.log("Camera permission status:", permission);
    if (permission?.granted) {
      setIsReady(true);
      setDebugInfo("Permission granted, camera should load");
    } else if (permission === null) {
      setDebugInfo("Checking permissions...");
    } else {
      setDebugInfo("Permission denied");
    }
  }, [permission]);

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
          onPress={async () => {
            console.log("Requesting camera permission...");
            const result = await requestPermission();
            console.log("Permission result:", result);
            if (!result.granted) {
              setSnackbarMessage(
                "Please enable camera access in your device settings to use ASL translation."
              );
              setSnackbarVisible(true);
            }
          }}
          style={{ borderRadius: borderRadius.lg }}
          accessibilityLabel="Grant camera permission for ASL translation"
        >
          Grant Camera Permission
        </Button>
      </Surface>
    );
  }

  const getSupportedRatios = async () => {
    try {
      setDebugInfo("Camera initialized for iOS");
      console.log("Camera initialized with iOS compatibility settings");
    } catch (error) {
      console.log("Error initializing camera:", error);
      setDebugInfo("Error initializing camera");
    }
  };

  function toggleCameraFacing() {
    const next = facing === "back" ? "front" : "back";
    setFacing(next);
    announce(`Camera switched to ${next}`);
    setTimeout(() => {
      getSupportedRatios();
    }, 100);
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
            onCameraReady={async () => {
              console.log("Camera is ready!");
              setIsReady(true);
              setDebugInfo("Camera ready and streaming");
              await getSupportedRatios();
            }}
            onMountError={(error: any) => {
              console.log("Camera mount error:", error);
              setDebugInfo(`Camera error: ${error}`);
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

        {/* Camera Toggle Button */}
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
            accessibilityLabel="Flip camera"
          />
        </Surface>

        {/* Translation Overlay */}
        <Surface
          style={[
            overlayStyle.container,
            {
              backgroundColor: theme.colors.primaryContainer,
              bottom: insets.bottom,
              borderTopLeftRadius: borderRadius.lg,
              borderTopRightRadius: borderRadius.lg,
            },
          ]}
          elevation={elevation.level2}
        >
          <Text
            variant="headlineSmall"
            style={[
              overlayStyle.text,
              { color: theme.colors.onPrimaryContainer, fontSize: Math.round(18 * fontScale) },
            ]}
          >
            ASL Translation {isTranslating ? "Active" : "Ready"}
          </Text>

          {/* Translation Output */}
          <Text
            variant="headlineLarge"
            style={[
              overlayStyle.translationOutput,
              { color: theme.colors.onPrimaryContainer },
            ]}
            accessibilityLabel={
              translationText
                ? `Translated text: ${translationText}`
                : isTranslating
                ? "Translating"
                : ""
            }
          >
            {translationText || (isTranslating ? "..." : "")}
          </Text>

          <Text
            variant="bodySmall"
            style={[
              overlayStyle.debugText,
              { color: theme.colors.onPrimaryContainer },
            ]}
          >
            {debugInfo}
          </Text>

          {/* Server status, always visible when translation is toggled on */}
          {isTranslating && (
            <Chip
              mode="flat"
              compact
              icon={serverConnected ? "check-circle" : "alert-circle"}
              style={{ alignSelf: "center", marginBottom: spacing.xs }}
              accessibilityLabel={serverConnected ? "Server connected" : "Server offline"}
            >
              {serverConnected ? "Server connected" : "Server offline"}
            </Chip>
          )}

          {/* Capture Stats */}
          {isCapturing && (
            <View style={overlayStyle.statsContainer}>
              <Chip mode="flat" compact style={{ marginHorizontal: spacing.xs }}>
                {stats.framesPerSecond} FPS
              </Chip>
              <Chip mode="flat" compact style={{ marginHorizontal: spacing.xs }}>
                {stats.totalFramesCaptured} frames
              </Chip>
              <Chip mode="flat" compact style={{ marginHorizontal: spacing.xs }}>
                Buffer: {bufferSize}
              </Chip>
              <Chip mode="flat" compact style={{ marginHorizontal: spacing.xs }}>
                {config.resolution}
              </Chip>
            </View>
          )}

          {/* Single Capture Button */}
          <Button
            mode="contained"
            icon="camera"
            onPress={handleSingleCapture}
            disabled={isCapturing}
            style={{
              marginTop: spacing.md,
              borderRadius: borderRadius.lg,
            }}
            accessibilityLabel="Capture single image for ASL translation"
          >
            Capture Single Image
          </Button>

          <TranslationToggleButton
            isTranslating={isTranslating}
            onToggle={handleToggleTranslation}
          />
        </Surface>

        {/* Loading Indicator */}
        {!isReady && (
          <Surface style={loadingStyle.container} elevation={0}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text
              variant="bodyLarge"
              style={[
                loadingStyle.text,
                { color: theme.colors.onSurface, marginTop: spacing.sm },
              ]}
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
    minHeight: "25%",
  },
  text: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  translationOutput: {
    textAlign: "center",
    marginTop: 8,
    minHeight: 44,
  },
  debugText: {
    textAlign: "center",
    marginTop: 8,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 8,
    flexWrap: "wrap",
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
