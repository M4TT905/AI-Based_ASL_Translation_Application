/**
 * Camera Configuration Context
 * React Context for managing camera configuration across the app
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { CameraView } from "expo-camera";
import {
  CameraConfig,
  CapturedFrame,
  CaptureStats,
  CameraResolution,
  CaptureInterval,
  DEFAULT_CAMERA_CONFIG,
} from "@/types/camera";
import {
  cameraConfigService,
  FrameCallback,
} from "@/services/cameraConfigService";
import {
  loadCameraConfig,
  saveCameraConfig,
  clearCameraConfig,
} from "@/services/storageService";

/**
 * Context value interface
 */
interface CameraConfigContextValue {
  config: CameraConfig;
  stats: CaptureStats;
  updateResolution: (resolution: CameraResolution) => Promise<void>;
  updateCaptureInterval: (interval: CaptureInterval) => Promise<void>;
  startCapture: (
    cameraRef: React.RefObject<CameraView>,
    callback: FrameCallback
  ) => Promise<boolean>;
  stopCapture: () => void;
  pauseCapture: () => void;
  resumeCapture: () => void;
  resetConfig: () => Promise<void>;
  captureSingleImage: () => Promise<CapturedFrame | null>;
  getBufferedFrames: () => CapturedFrame[];
  getLastNFrames: (count: number) => CapturedFrame[];
  clearBuffer: () => void;
  getBufferSize: () => number;
  bufferSize: number;
  isCapturing: boolean;
  isPaused: boolean;
}

/**
 * Create context
 */
const CameraConfigContext = createContext<CameraConfigContextValue | undefined>(
  undefined
);

/**
 * Provider props
 */
interface CameraConfigProviderProps {
  children: React.ReactNode;
}

/**
 * Camera Configuration Provider Component
 */
export function CameraConfigProvider({
  children,
}: CameraConfigProviderProps): JSX.Element {
  const [config, setConfig] = useState<CameraConfig>(DEFAULT_CAMERA_CONFIG);
  const [stats, setStats] = useState<CaptureStats>({
    framesPerSecond: 0,
    totalFramesCaptured: 0,
    lastCaptureTimestamp: 0,
    averageCaptureTime: 0,
  });
  const [isCapturing, setIsCapturing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [bufferSize, setBufferSize] = useState(0);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Load saved configuration on mount
   */
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const savedConfig = await loadCameraConfig();
        setConfig(savedConfig);
        cameraConfigService.updateConfig(savedConfig);
        console.log("Loaded camera configuration:", savedConfig);
      } catch (error) {
        console.error("Error loading camera config:", error);
      }
    };

    loadConfig();

    // Cleanup on unmount
    return () => {
      cameraConfigService.cleanup();
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
    };
  }, []);

  /**
   * Start stats polling when capturing
   */
  useEffect(() => {
    if (isCapturing && !isPaused) {
      // Update stats every 100ms
      statsIntervalRef.current = setInterval(() => {
        const currentStats = cameraConfigService.getStats();
        setStats(currentStats);
        setBufferSize(cameraConfigService.getBufferSize());
      }, 100);
    } else {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
      }
    }

    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
    };
  }, [isCapturing, isPaused]);

  /**
   * Update resolution
   */
  const updateResolution = useCallback(
    async (resolution: CameraResolution): Promise<void> => {
      try {
        const newConfig = {
          ...config,
          resolution,
        };
        setConfig(newConfig);
        cameraConfigService.updateConfig({ resolution });
        await saveCameraConfig(newConfig);
        console.log("Updated resolution:", resolution);
      } catch (error) {
        console.error("Error updating resolution:", error);
      }
    },
    [config]
  );

  /**
   * Update capture interval
   */
  const updateCaptureInterval = useCallback(
    async (captureInterval: CaptureInterval): Promise<void> => {
      try {
        const newConfig = {
          ...config,
          captureInterval,
        };
        setConfig(newConfig);
        cameraConfigService.updateConfig({ captureInterval });
        await saveCameraConfig(newConfig);
        console.log("Updated capture interval:", captureInterval);
      } catch (error) {
        console.error("Error updating capture interval:", error);
      }
    },
    [config]
  );

  /**
   * Start frame capture
   */
  const startCapture = useCallback(
    async (
      cameraRef: React.RefObject<CameraView>,
      callback: FrameCallback
    ): Promise<boolean> => {
      try {
        cameraConfigService.setCameraRef(cameraRef);
        const started = await cameraConfigService.startCapture(callback);

        if (started) {
          setIsCapturing(true);
          setIsPaused(false);
          setConfig((prev) => ({
            ...prev,
            isCapturing: true,
            isPaused: false,
          }));
        }

        return started;
      } catch (error) {
        console.error("Error starting capture:", error);
        return false;
      }
    },
    []
  );

  /**
   * Stop frame capture
   */
  const stopCapture = useCallback((): void => {
    cameraConfigService.stopCapture();
    setIsCapturing(false);
    setIsPaused(false);
    setConfig((prev) => ({
      ...prev,
      isCapturing: false,
      isPaused: false,
    }));
    // Reset stats
    setStats({
      framesPerSecond: 0,
      totalFramesCaptured: 0,
      lastCaptureTimestamp: 0,
      averageCaptureTime: 0,
    });
  }, []);

  /**
   * Pause frame capture
   */
  const pauseCapture = useCallback((): void => {
    cameraConfigService.pauseCapture();
    setIsPaused(true);
    setConfig((prev) => ({
      ...prev,
      isPaused: true,
    }));
  }, []);

  /**
   * Resume frame capture
   */
  const resumeCapture = useCallback((): void => {
    cameraConfigService.resumeCapture();
    setIsPaused(false);
    setConfig((prev) => ({
      ...prev,
      isPaused: false,
    }));
  }, []);

  /**
   * Reset configuration to defaults
   */
  const resetConfig = useCallback(async (): Promise<void> => {
    try {
      await clearCameraConfig();
      const defaultConfig = { ...DEFAULT_CAMERA_CONFIG };
      setConfig(defaultConfig);
      cameraConfigService.updateConfig(defaultConfig);
      console.log("Reset to default configuration");
    } catch (error) {
      console.error("Error resetting config:", error);
    }
  }, []);

  /**
   * Capture a single image
   */
  const captureSingleImage = useCallback(async (): Promise<CapturedFrame | null> => {
    try {
      const frame = await cameraConfigService.captureSingleImage();
      if (frame) {
        console.log("Single capture successful:", frame);
      }
      return frame;
    } catch (error) {
      console.error("Error in single capture:", error);
      return null;
    }
  }, []);

  /**
   * Get all buffered frames
   */
  const getBufferedFrames = useCallback((): CapturedFrame[] => {
    return cameraConfigService.getBufferedFrames();
  }, []);

  /**
   * Get last N frames from buffer
   */
  const getLastNFrames = useCallback((count: number): CapturedFrame[] => {
    return cameraConfigService.getLastNFrames(count);
  }, []);

  /**
   * Clear frame buffer
   */
  const clearBuffer = useCallback((): void => {
    cameraConfigService.clearBuffer();
    setBufferSize(0);
  }, []);

  /**
   * Get current buffer size
   */
  const getBufferSize = useCallback((): number => {
    return cameraConfigService.getBufferSize();
  }, []);

  const value: CameraConfigContextValue = {
    config,
    stats,
    updateResolution,
    updateCaptureInterval,
    startCapture,
    stopCapture,
    pauseCapture,
    resumeCapture,
    resetConfig,
    captureSingleImage,
    getBufferedFrames,
    getLastNFrames,
    clearBuffer,
    getBufferSize,
    bufferSize,
    isCapturing,
    isPaused,
  };

  return (
    <CameraConfigContext.Provider value={value}>
      {children}
    </CameraConfigContext.Provider>
  );
}

/**
 * Hook to use camera configuration context
 */
export function useCameraConfig(): CameraConfigContextValue {
  const context = useContext(CameraConfigContext);

  if (context === undefined) {
    throw new Error(
      "useCameraConfig must be used within a CameraConfigProvider"
    );
  }

  return context;
}

/**
 * Hook for simplified camera capture operations
 */
export function useCameraCapture() {
  const { startCapture, stopCapture, pauseCapture, resumeCapture, isCapturing, isPaused } =
    useCameraConfig();

  return {
    startCapture,
    stopCapture,
    pauseCapture,
    resumeCapture,
    isCapturing,
    isPaused,
  };
}
