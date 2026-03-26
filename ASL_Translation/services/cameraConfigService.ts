/**
 * Camera Configuration Service
 * Manages camera configuration, frame capture, and state
 */

import { CameraView } from "expo-camera";
import {
  CameraConfig,
  CapturedFrame,
  CaptureStats,
  RESOLUTION_SETTINGS,
  DEFAULT_CAMERA_CONFIG,
} from "@/types/camera";

/**
 * Type for frame capture callback
 */
export type FrameCallback = (frame: CapturedFrame) => void | Promise<void>;

/**
 * Camera Configuration Service Class
 * Singleton service for managing camera configuration and frame capture
 */
class CameraConfigService {
  private static instance: CameraConfigService;
  private config: CameraConfig;
  private captureIntervalId: NodeJS.Timeout | null = null;
  private frameCallback: FrameCallback | null = null;
  private cameraRef: React.RefObject<CameraView> | null = null;
  private stats: CaptureStats = {
    framesPerSecond: 0,
    totalFramesCaptured: 0,
    lastCaptureTimestamp: 0,
    averageCaptureTime: 0,
  };
  private captureTimings: number[] = [];
  private isCapturing: boolean = false;
  private frameBuffer: CapturedFrame[] = [];
  private maxBufferSize: number = 30;

  private constructor() {
    this.config = { ...DEFAULT_CAMERA_CONFIG };
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): CameraConfigService {
    if (!CameraConfigService.instance) {
      CameraConfigService.instance = new CameraConfigService();
    }
    return CameraConfigService.instance;
  }

  /**
   * Get current configuration
   */
  public getConfig(): CameraConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<CameraConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };

    // If capture interval changed and we're capturing, restart
    if (
      newConfig.captureInterval !== undefined &&
      this.isCapturing &&
      !this.config.isPaused
    ) {
      this.restartCapture();
    }
  }

  /**
   * Set camera reference
   */
  public setCameraRef(ref: React.RefObject<CameraView>): void {
    this.cameraRef = ref;
  }

  /**
   * Capture a single image (non-continuous)
   */
  public async captureSingleImage(): Promise<CapturedFrame | null> {
    if (!this.cameraRef || !this.cameraRef.current) {
      console.error("Camera reference not set");
      return null;
    }

    try {
      const resolutionSettings = RESOLUTION_SETTINGS[this.config.resolution];

      const photo = await this.cameraRef.current.takePictureAsync({
        quality: resolutionSettings.quality,
        base64: false,
        skipProcessing: true,
      });

      if (!photo) {
        console.warn("Failed to capture single image");
        return null;
      }

      const capturedFrame: CapturedFrame = {
        uri: photo.uri,
        base64: undefined,
        timestamp: Date.now(),
        width: resolutionSettings.width,
        height: resolutionSettings.height,
        resolution: this.config.resolution,
      };

      console.log("Single image captured:", capturedFrame.uri);
      return capturedFrame;
    } catch (error) {
      console.error("Error capturing single image:", error);
      return null;
    }
  }

  /**
   * Start frame capture
   */
  public async startCapture(callback: FrameCallback): Promise<boolean> {
    if (this.isCapturing) {
      console.warn("Capture already running");
      return false;
    }

    if (!this.cameraRef || !this.cameraRef.current) {
      console.error("Camera reference not set");
      return false;
    }

    this.frameCallback = callback;
    this.isCapturing = true;
    this.config.isCapturing = true;
    this.config.isPaused = false;

    // Reset stats
    this.stats = {
      framesPerSecond: 0,
      totalFramesCaptured: 0,
      lastCaptureTimestamp: 0,
      averageCaptureTime: 0,
    };
    this.captureTimings = [];

    console.log(
      `Starting frame capture at ${this.config.captureInterval}ms intervals`
    );

    // Start the capture interval
    this.startCaptureInterval();

    return true;
  }

  /**
   * Stop frame capture
   */
  public stopCapture(): void {
    if (!this.isCapturing) {
      return;
    }

    this.stopCaptureInterval();
    this.isCapturing = false;
    this.config.isCapturing = false;
    this.config.isPaused = false;
    this.frameCallback = null;
    this.clearBuffer();

    console.log(
      `Stopped frame capture. Total frames: ${this.stats.totalFramesCaptured}`
    );
  }

  /**
   * Pause frame capture (maintains state)
   */
  public pauseCapture(): void {
    if (!this.isCapturing || this.config.isPaused) {
      return;
    }

    this.stopCaptureInterval();
    this.config.isPaused = true;
    console.log("Frame capture paused");
  }

  /**
   * Resume frame capture
   */
  public resumeCapture(): void {
    if (!this.isCapturing || !this.config.isPaused) {
      return;
    }

    this.config.isPaused = false;
    this.startCaptureInterval();
    console.log("Frame capture resumed");
  }

  /**
   * Get current capture statistics
   */
  public getStats(): CaptureStats {
    return { ...this.stats };
  }

  /**
   * Check if currently capturing
   */
  public getIsCapturing(): boolean {
    return this.isCapturing;
  }

  /**
   * Check if currently paused
   */
  public getIsPaused(): boolean {
    return this.config.isPaused;
  }

  /**
   * Start the capture interval timer
   */
  private startCaptureInterval(): void {
    this.captureIntervalId = setInterval(() => {
      this.captureFrame();
    }, this.config.captureInterval);
  }

  /**
   * Stop the capture interval timer
   */
  private stopCaptureInterval(): void {
    if (this.captureIntervalId) {
      clearInterval(this.captureIntervalId);
      this.captureIntervalId = null;
    }
  }

  /**
   * Restart capture with new interval
   */
  private restartCapture(): void {
    this.stopCaptureInterval();
    if (!this.config.isPaused) {
      this.startCaptureInterval();
    }
  }

  /**
   * Capture a single frame
   */
  private async captureFrame(): Promise<void> {
    if (!this.cameraRef || !this.cameraRef.current || !this.frameCallback) {
      return;
    }

    const captureStartTime = Date.now();

    try {
      const resolutionSettings = RESOLUTION_SETTINGS[this.config.resolution];

      // Capture frame from camera
      const photo = await this.cameraRef.current.takePictureAsync({
        quality: resolutionSettings.quality,
        base64: false, // Set to true if you need base64
        skipProcessing: true, // Faster capture
      });

      if (!photo) {
        console.warn("Failed to capture frame");
        return;
      }

      const captureEndTime = Date.now();
      const captureTime = captureEndTime - captureStartTime;

      // Update timings for stats
      this.captureTimings.push(captureTime);
      if (this.captureTimings.length > 30) {
        this.captureTimings.shift(); // Keep only last 30 timings
      }

      // Update stats
      this.stats.totalFramesCaptured++;
      const prevTimestamp = this.stats.lastCaptureTimestamp;
      this.stats.lastCaptureTimestamp = captureEndTime;
      this.stats.averageCaptureTime =
        this.captureTimings.reduce((a, b) => a + b, 0) /
        this.captureTimings.length;

      // Calculate FPS from actual elapsed time between frames
      const actualInterval = prevTimestamp > 0 ? captureEndTime - prevTimestamp : this.config.captureInterval;
      this.stats.framesPerSecond = Math.round(1000 / actualInterval);

      // Create captured frame object
      const capturedFrame: CapturedFrame = {
        uri: photo.uri,
        base64: undefined, // Add base64 if needed
        timestamp: captureEndTime,
        width: resolutionSettings.width,
        height: resolutionSettings.height,
        resolution: this.config.resolution,
      };

      // Add to buffer
      this.addToBuffer(capturedFrame);

      // Call the callback
      await this.frameCallback(capturedFrame);
    } catch (error) {
      console.error("Error capturing frame:", error);
    }
  }

  /**
   * Add frame to circular buffer
   */
  private addToBuffer(frame: CapturedFrame): void {
    if (this.frameBuffer.length >= this.maxBufferSize) {
      this.frameBuffer.shift(); // Remove oldest frame
    }
    this.frameBuffer.push(frame);
  }

  /**
   * Get all buffered frames
   */
  public getBufferedFrames(): CapturedFrame[] {
    return [...this.frameBuffer];
  }

  /**
   * Get last N frames from buffer
   */
  public getLastNFrames(count: number): CapturedFrame[] {
    const start = Math.max(0, this.frameBuffer.length - count);
    return this.frameBuffer.slice(start);
  }

  /**
   * Clear frame buffer
   */
  public clearBuffer(): void {
    this.frameBuffer = [];
    console.log("Frame buffer cleared");
  }

  /**
   * Get buffer size
   */
  public getBufferSize(): number {
    return this.frameBuffer.length;
  }

  /**
   * Set maximum buffer size
   */
  public setMaxBufferSize(size: number): void {
    this.maxBufferSize = Math.max(1, Math.min(size, 100)); // Between 1-100
    // Trim buffer if needed
    while (this.frameBuffer.length > this.maxBufferSize) {
      this.frameBuffer.shift();
    }
    console.log(`Max buffer size set to: ${this.maxBufferSize}`);
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    this.stopCapture();
    this.cameraRef = null;
    this.frameCallback = null;
    this.captureTimings = [];
    this.clearBuffer();
  }
}

// Export singleton instance
export const cameraConfigService = CameraConfigService.getInstance();

// Export class for testing
export { CameraConfigService };
