/**
 * Storage Service
 * Handles persistence of camera configuration using AsyncStorage
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  CameraConfig,
  DEFAULT_CAMERA_CONFIG,
  CameraResolution,
  CaptureInterval,
  CAPTURE_INTERVALS,
} from "@/types/camera";

// Storage keys
const STORAGE_KEYS = {
  CAMERA_CONFIG: "@asl_translation:camera_config",
  CONFIG_VERSION: "@asl_translation:config_version",
};

// Current schema version for future migrations
const CURRENT_VERSION = "1.0.0";

/**
 * Validate camera configuration object
 */
function isValidCameraConfig(config: any): config is CameraConfig {
  if (!config || typeof config !== "object") return false;

  // Validate resolution
  const validResolutions = Object.values(CameraResolution);
  if (!validResolutions.includes(config.resolution)) return false;

  // Validate capture interval
  if (!CAPTURE_INTERVALS.includes(config.captureInterval)) return false;

  // Validate boolean fields
  if (typeof config.isPaused !== "boolean") return false;
  if (typeof config.isCapturing !== "boolean") return false;

  return true;
}

/**
 * Save camera configuration to persistent storage
 */
export async function saveCameraConfig(
  config: CameraConfig
): Promise<boolean> {
  try {
    const configData = {
      ...config,
      // Don't persist runtime state
      isCapturing: false,
      isPaused: false,
    };

    await AsyncStorage.multiSet([
      [STORAGE_KEYS.CAMERA_CONFIG, JSON.stringify(configData)],
      [STORAGE_KEYS.CONFIG_VERSION, CURRENT_VERSION],
    ]);

    console.log("Camera config saved:", configData);
    return true;
  } catch (error) {
    console.error("Error saving camera config:", error);
    return false;
  }
}

/**
 * Load camera configuration from persistent storage
 */
export async function loadCameraConfig(): Promise<CameraConfig> {
  try {
    const [[, configJson], [, version]] = await AsyncStorage.multiGet([
      STORAGE_KEYS.CAMERA_CONFIG,
      STORAGE_KEYS.CONFIG_VERSION,
    ]);

    // No saved config, return defaults
    if (!configJson) {
      console.log("No saved config found, using defaults");
      return { ...DEFAULT_CAMERA_CONFIG };
    }

    // Parse and validate config
    const parsedConfig = JSON.parse(configJson);

    // Check version for future migration support
    if (version && version !== CURRENT_VERSION) {
      console.log(`Config version mismatch: ${version} vs ${CURRENT_VERSION}`);
      // Future: add migration logic here
    }

    // Validate the loaded config
    if (!isValidCameraConfig(parsedConfig)) {
      console.warn("Invalid saved config, using defaults");
      return { ...DEFAULT_CAMERA_CONFIG };
    }

    console.log("Camera config loaded:", parsedConfig);
    return {
      ...parsedConfig,
      // Always reset runtime state on load
      isCapturing: false,
      isPaused: false,
    };
  } catch (error) {
    console.error("Error loading camera config:", error);
    return { ...DEFAULT_CAMERA_CONFIG };
  }
}

/**
 * Clear all stored camera configuration
 */
export async function clearCameraConfig(): Promise<boolean> {
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.CAMERA_CONFIG,
      STORAGE_KEYS.CONFIG_VERSION,
    ]);
    console.log("Camera config cleared");
    return true;
  } catch (error) {
    console.error("Error clearing camera config:", error);
    return false;
  }
}

/**
 * Update specific camera config field and persist
 */
export async function updateCameraConfigField<K extends keyof CameraConfig>(
  field: K,
  value: CameraConfig[K]
): Promise<CameraConfig | null> {
  try {
    const currentConfig = await loadCameraConfig();
    const updatedConfig = {
      ...currentConfig,
      [field]: value,
    };

    const saved = await saveCameraConfig(updatedConfig);
    return saved ? updatedConfig : null;
  } catch (error) {
    console.error("Error updating camera config field:", error);
    return null;
  }
}

/**
 * Get storage info for debugging
 */
export async function getStorageInfo(): Promise<{
  hasConfig: boolean;
  version: string | null;
  config: CameraConfig | null;
}> {
  try {
    const [[, configJson], [, version]] = await AsyncStorage.multiGet([
      STORAGE_KEYS.CAMERA_CONFIG,
      STORAGE_KEYS.CONFIG_VERSION,
    ]);

    return {
      hasConfig: !!configJson,
      version: version || null,
      config: configJson ? JSON.parse(configJson) : null,
    };
  } catch (error) {
    console.error("Error getting storage info:", error);
    return {
      hasConfig: false,
      version: null,
      config: null,
    };
  }
}
