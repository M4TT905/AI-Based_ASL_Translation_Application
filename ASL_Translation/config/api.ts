/**
 * API Configuration
 *
 * Single source of truth for backend connection settings.
 * For (demo day): change API_BASE_URL to the live server address.
 *   - Same-WiFi: "http://192.168.x.x:8000"
 *   - ngrok:     "https://xxxx.ngrok-free.app"
 */

// Backend host swap this when using a live server address
export const API_BASE_URL = "http://localhost:8000";
//export const API_BASE_URL = "https://damaris-oily-unflinchingly.ngrok-free.dev";

// Endpoint to call for a single-frame prediction.
export const PREDICT_ENDPOINT = "/translate/";

// JSON key that holds the predicted letter in the response.
export const RESPONSE_KEY = "translation" as const;

// Health-check endpoint, used by apiService to confirm the server is up.
export const HEALTH_ENDPOINT = "/health";

// Request timeout in milliseconds.
// 5 s is generous for a local server
export const API_TIMEOUT_MS = 5000;

// Minimum confidence score to accept a prediction (0–1).
// Frames below this threshold are silently dropped.
export const CONFIDENCE_THRESHOLD = 0.70;

// JSON key that holds the confidence score in the response.
export const CONFIDENCE_KEY = "confidence" as const;

/**
 * Mock mode: set to true to test the full UI loop without the backend.
 * The mock cycles through "hello " so you can see letters accumulate → word finalize → TTS fire.
 */
export const USE_MOCK_API = false;
