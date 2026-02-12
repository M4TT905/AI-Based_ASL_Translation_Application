import { StyleSheet, View, Alert } from "react-native";
import {
  Text,
  Button,
  Surface,
  IconButton,
  useTheme,
  ActivityIndicator,
  Chip,
} from "react-native-paper";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { useState, useEffect, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, borderRadius, elevation } from "@/constants/paperTheme";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { TranslationToggleButton } from "@/components/ui/TranslationToggleButton";
import { useCameraConfig } from "@/contexts/CameraConfigContext";
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

  const [isTranslating, setIsTranslating] = useState(false);
  const [lastCapturedImage, setLastCapturedImage] = useState<CapturedFrame | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const accumulatedWord = useRef("");

  // Camera configuration context
  const {
    config,
    stats,
    startCapture,
    stopCapture,
    pauseCapture,
    resumeCapture,
    isCapturing,
    isPaused,
    captureSingleImage,
    bufferSize,
  } = useCameraConfig();

  // Load TTS preference from storage
  useEffect(() => {
    AsyncStorage.getItem("tts_enabled").then((value) => {
      setTtsEnabled(value === null ? true : value === "true");
    });
  }, []);

  // Handle frame capture callback
  const handleFrameCapture = async (frame: CapturedFrame) => {
    // TODO: Send frame to ASL recognition model and get predictedLetter
    const predictedLetter: string | null = null; // replace with model output

    if (predictedLetter === null) {
      console.log(
        `Frame captured: ${frame.width}x${frame.height} at ${frame.timestamp}`
      );
      return;
    }

    if (predictedLetter === " ") {
      const word = accumulatedWord.current.trim();
      if (word.length > 0 && ttsEnabled) {
        ttsService.speakWord(word);
      }
      accumulatedWord.current = "";
    } else {
      accumulatedWord.current += predictedLetter;
    }
  };

  const handleSingleCapture = async () => {
    if (!cameraRef.current) {
      Alert.alert("Camera Error", "Camera is not ready yet");
      return;
    }

    const frame = await captureSingleImage();
    if (frame) {
      setLastCapturedImage(frame);
      // TODO: Send to AI model
      Alert.alert(
        "Image Captured",
        `Captured ${frame.resolution} image\nReady for AI processing`,
        [{ text: "OK" }]
      );
    } else {
      Alert.alert("Capture Failed", "Could not capture image");
    }
  };

  const handleToggleTranslation = async () => {
    if (isTranslating) {
      // Stop translation
      stopCapture();
      setIsTranslating(false);
      setDebugInfo("Translation stopped");
    } else {
      // Start translation
      if (!cameraRef.current) {
        Alert.alert("Camera Error", "Camera is not ready yet");
        return;
      }

      const started = await startCapture(cameraRef, handleFrameCapture);
      if (started) {
        setIsTranslating(true);
        setDebugInfo("Translation active - capturing frames");
      } else {
        Alert.alert(
          "Capture Error",
          "Failed to start frame capture. Please try again."
        );
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
              Alert.alert(
                "Camera Permission Required",
                "Please enable camera access in your device settings to use ASL translation.",
                [{ text: "OK" }]
              );
            }
          }}
          style={{ borderRadius: borderRadius.lg }}
        >
          Grant Camera Permission
        </Button>
      </Surface>
    );
  }

  const getSupportedRatios = async () => {
    try {
      // For iOS compatibility, we'll use specific properties instead of ratios
      setDebugInfo("Camera initialized for iOS");
      console.log("Camera initialized with iOS compatibility settings");
    } catch (error) {
      console.log("Error initializing camera:", error);
      setDebugInfo("Error initializing camera");
    }
  };

  function toggleCameraFacing() {
    setFacing((current) => (current === "back" ? "front" : "back"));
    // Reinitialize camera after facing change
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
              Alert.alert(
                "Camera Error",
                "Failed to initialize camera. Please restart the app."
              );
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
              { color: theme.colors.onPrimaryContainer },
            ]}
          >
            ASL Translation {isTranslating ? "Active" : "Ready"}
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

          {/* Capture Stats */}
          {isCapturing && (
            <View style={overlayStyle.statsContainer}>
              <Chip
                mode="flat"
                compact
                style={{ marginHorizontal: spacing.xs }}
              >
                {stats.framesPerSecond} FPS
              </Chip>
              <Chip
                mode="flat"
                compact
                style={{ marginHorizontal: spacing.xs }}
              >
                {stats.totalFramesCaptured} frames
              </Chip>
              <Chip
                mode="flat"
                compact
                style={{ marginHorizontal: spacing.xs }}
              >
                Buffer: {bufferSize}
              </Chip>
              <Chip
                mode="flat"
                compact
                style={{ marginHorizontal: spacing.xs }}
              >
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
    fontSize: 16,
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
  debugText: {
    fontSize: 12,
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
    fontSize: 16,
    fontWeight: "bold",
  },
});
