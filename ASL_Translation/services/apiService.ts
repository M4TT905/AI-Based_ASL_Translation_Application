/**
 * API Service
 *
 * Sits above imageProcessor and manages connection state.
 * index.tsx imports this, not imageProcessor directly.
 *
 * Responsibilities:
 *   - Health-check the server on demand (checkConnection)
 *   - Expose isConnected so the UI can show "Server offline"
 *   - Forward frame predictions to imageProcessor
 *
 * In mock mode (USE_MOCK_API = true) the health check always passes so the
 * UI behaves as if the server is up.
 */

import { API_BASE_URL, HEALTH_ENDPOINT, API_TIMEOUT_MS, USE_MOCK_API } from "@/config/api";
import { CapturedFrame } from "@/types/camera";
import { sendFrameToAPI } from "@/services/imageProcessor";

class ApiService {
  private _isConnected: boolean = false;

  get isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * Ping /health and update isConnected.
   * Call this when the translation toggle is turned ON.
   * Returns true if the server is up (or mock mode is active).
   */
  async checkConnection(): Promise<boolean> {
    if (USE_MOCK_API) {
      this._isConnected = true;
      return true;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE_URL}${HEALTH_ENDPOINT}`, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "ngrok-skip-browser-warning": "true",
        },
      });
      this._isConnected = response.ok;
    } catch {
      this._isConnected = false;
    } finally {
      clearTimeout(timeoutId);
    }

    return this._isConnected;
  }

  /**
   * Send a frame to the backend and return the predicted letter.
   * Returns null on any failure (network, timeout, server error).
   */
  async predictFrame(frame: CapturedFrame): Promise<string | null> {
    return sendFrameToAPI(frame);
  }

  /** Call when translation is stopped, resets connection state. */
  disconnect(): void {
    this._isConnected = false;
  }
}

// Singleton, one shared instance across the app
export const apiService = new ApiService();
