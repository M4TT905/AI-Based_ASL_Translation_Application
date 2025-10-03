import {
  StyleSheet,
  Text,
  View,
  Button,
  TouchableOpacity,
  Alert,
} from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { useState, useEffect, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function HomeScreen() {
  const [facing, setFacing] = useState<CameraType>("back");
  const [permission, requestPermission] = useCameraPermissions();
  const [isReady, setIsReady] = useState(false);
  const [debugInfo, setDebugInfo] = useState("Initializing...");
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();

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
      <View style={permissionButtonStyle.container}>
        <Text>Loading camera permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={permissionButtonStyle.container}>
        <Text style={permissionButtonStyle.text}>
          We need your permission to show the camera for ASL translation
        </Text>
        <Button
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
          title="Grant Camera Permission"
        />
      </View>
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
      <TouchableOpacity
        style={[buttonStyle.container, { top: insets.top + 10 }]}
      >
        <Text style={buttonStyle.text}>Options</Text>
      </TouchableOpacity>

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
          <View
            style={[
              cameraStyle.camera,
              {
                backgroundColor: "#333",
                justifyContent: "center",
                alignItems: "center",
              },
            ]}
          >
            <Text style={{ color: "white", fontSize: 16 }}>
              No camera permission
            </Text>
          </View>
        )}
        {!isReady && permission?.granted && (
          <View style={loadingStyle.container}>
            <Text style={loadingStyle.text}>Initializing camera...</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[toggleButtonStyle.container, { top: insets.top + 10 }]}
        onPress={toggleCameraFacing}
      >
        <Text style={toggleButtonStyle.text}>Flip Camera</Text>
      </TouchableOpacity>

      <View style={[overlayStyle.container, { paddingBottom: insets.bottom }]}>
        <Text style={overlayStyle.text}>ASL Translation will appear here</Text>
        <Text style={overlayStyle.debugText}>
          Debug: {debugInfo} | Ready: {isReady ? "Yes" : "No"} | Camera:{" "}
          {facing}
        </Text>
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
    backgroundColor: "white",
    padding: 20,
  },
  text: {
    textAlign: "center",
    marginBottom: 20,
    fontSize: 16,
  },
});

const buttonStyle = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#FFF",
    position: "absolute",
    zIndex: 1,
    left: "5%",
    top: "7%",
    opacity: 0.9,
  },
  text: {
    color: "blue",
    fontWeight: "bold",
  },
});

const toggleButtonStyle = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#FFF",
    position: "absolute",
    zIndex: 1,
    right: "5%",
    top: "7%",
    opacity: 0.9,
  },
  text: {
    color: "blue",
    fontWeight: "bold",
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
    bottom: 0,
    padding: 15,
    width: "100%",
    height: "25%",
    backgroundColor: "rgba(170, 255, 170, 0.85)",
  },
  text: {
    fontSize: 18,
    color: "black",
    fontWeight: "bold",
    textAlign: "center",
  },
  debugText: {
    fontSize: 12,
    color: "darkgreen",
    textAlign: "center",
    marginTop: 5,
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
