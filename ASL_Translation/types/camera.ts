/**
 * Camera Configuration Types
 * Type definitions for camera configuration service
 */

/**
 * Standard camera resolution presets
 */
export enum CameraResolution {
  HD_1080P = "1080p",
  HD_720P = "720p",
  SD_480P = "480p",
}

/**
 * Resolution settings with dimensions and quality
 */
export interface ResolutionSettings {
  width: number;
  height: number;
  quality: number; // 0-1 scale
  label: string;
}

/**
 * Mapping of resolution presets to their settings
 */
export const RESOLUTION_SETTINGS: Record<CameraResolution, ResolutionSettings> = {
  [CameraResolution.HD_1080P]: {
    width: 1920,
    height: 1080,
    quality: 0.9,
    label: "1080p (Full HD)",
  },
  [CameraResolution.HD_720P]: {
    width: 1280,
    height: 720,
    quality: 0.85,
    label: "720p (HD)",
  },
  [CameraResolution.SD_480P]: {
    width: 640,
    height: 480,
    quality: 0.8,
    label: "480p (SD)",
  },
};

/**
 * Frame capture interval in milliseconds
 */
export type CaptureInterval = 100 | 200 | 500 | 1000;

/**
 * Available capture interval options
 */
export const CAPTURE_INTERVALS: CaptureInterval[] = [100, 200, 500, 1000];

/**
 * Capture mode enum
 */
export enum CaptureMode {
  SINGLE = "single",
  CONTINUOUS = "continuous",
}

/**
 * Buffer configuration interface
 */
export interface BufferConfig {
  enabled: boolean;
  maxSize: number;
}

/**
 * Camera configuration interface
 */
export interface CameraConfig {
  resolution: CameraResolution;
  captureInterval: CaptureInterval;
  isPaused: boolean;
  isCapturing: boolean;
  captureMode: CaptureMode;
  bufferConfig: BufferConfig;
}

/**
 * Default camera configuration
 */
export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  resolution: CameraResolution.HD_720P,
  captureInterval: 200,
  isPaused: false,
  isCapturing: false,
  captureMode: CaptureMode.CONTINUOUS,
  bufferConfig: {
    enabled: true,
    maxSize: 30,
  },
};

/**
 * Captured frame data structure
 */
export interface CapturedFrame {
  uri: string;
  base64?: string;
  timestamp: number;
  width: number;
  height: number;
  resolution: CameraResolution;
}

/**
 * Frame capture statistics
 */
export interface CaptureStats {
  framesPerSecond: number;
  totalFramesCaptured: number;
  lastCaptureTimestamp: number;
  averageCaptureTime: number;
}
