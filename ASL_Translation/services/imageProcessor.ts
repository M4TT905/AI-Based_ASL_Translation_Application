/**
 * Image Processor Service
 *
 * Responsible for one thing: take a CapturedFrame, send it to the backend,
 * return the predicted letter (or null on failure).
 *
 * The server (NEW_integration_test/ASL_Backend_Server/server.py) expects a
 * multipart file upload — React Native FormData with a file URI satisfies this.
 * No base64 encoding needed.
 *
 * Response shape: { [RESPONSE_KEY]: "letter" }
 * { "translation": "h" } 
 */

import {
  API_BASE_URL,
  PREDICT_ENDPOINT,
  RESPONSE_KEY,
  CONFIDENCE_KEY,
  CONFIDENCE_THRESHOLD,
  API_TIMEOUT_MS,
  USE_MOCK_API,
} from "@/config/api";
import { CapturedFrame } from "@/types/camera";

// ---------------------------------------------------------------------------
// Mock mode
// Cycles through "hello " so the UI loop (accumulate > finalize word > TTS)
// can be tested end-to-end before the server is available.
// ---------------------------------------------------------------------------
const MOCK_SEQUENCE = ["h", "e", "l", "l", "o", " "];
let mockIndex = 0;

async function mockPredict(): Promise<string> {
  // Simulate ~200 ms network latency
  await new Promise<void>((resolve) => setTimeout(resolve, 200));
  const letter = MOCK_SEQUENCE[mockIndex % MOCK_SEQUENCE.length];
  mockIndex++;
  return letter;
}

// ---------------------------------------------------------------------------
// Real prediction
// ---------------------------------------------------------------------------
async function realPredict(frame: CapturedFrame): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const formData = new FormData();
    if (frame.uri.startsWith("blob:") || frame.uri.startsWith("data:")) {
      // Web: URI is a blob/data URL — fetch it to get a real Blob
      const res = await fetch(frame.uri);
      const blob = await res.blob();
      formData.append("file", blob, "frame.jpg");
    } else {
      // Native: React Native accepts { uri, type, name } as a file entry
      formData.append("file", {
        uri: frame.uri,
        type: "image/jpeg",
        name: "frame.jpg",
      } as unknown as Blob);
    }

    const response = await fetch(`${API_BASE_URL}${PREDICT_ENDPOINT}`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
      headers: {
          "ngrok-skip-browser-warning": "true",
        },
    });

    if (!response.ok) {
      console.warn(`[imageProcessor] Server returned ${response.status}`);
      return null;
    }

    const data: Record<string, unknown> = await response.json();
    const result = data[RESPONSE_KEY];
    const confidence = data[CONFIDENCE_KEY];

    // No hand detected — server returns null translation
    if (result === null || result === undefined) {
      return null;
    }

    if (typeof result !== "string") {
      console.warn("[imageProcessor] Unexpected response shape:", data);
      return null;
    }

    // Drop low-confidence predictions
    if (typeof confidence === "number" && confidence < CONFIDENCE_THRESHOLD) {
      return null;
    }

    return result;
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        console.warn("[imageProcessor] Request timed out");
      } else {
        console.warn("[imageProcessor] Request failed:", error.message);
      }
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send a captured frame to the ASL backend and return the predicted letter.
 *
 * Returns:
 *   - A single character string (e.g. "h", "A", " ") on success
 *   - null on network error, timeout, or unexpected response
 *
 * The caller (handleFrameCapture in index.tsx) decides what to do with the letter.
 */
export async function sendFrameToAPI(
  frame: CapturedFrame
): Promise<string | null> {
  if (USE_MOCK_API) {
    return mockPredict();
  }
  return realPredict(frame);
}
