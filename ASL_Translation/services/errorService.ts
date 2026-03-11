export type ErrorType = "NETWORK" | "CAMERA" | "MODEL" | "PERMISSION" | "UNKNOWN";

export interface AppError {
  type: ErrorType;
  message: string;
  technical?: string;
  retryable: boolean;
}

const USER_MESSAGES: Record<ErrorType, string> = {
  NETWORK: "No internet connection. Check your network and try again.",
  CAMERA: "Camera unavailable. Restart the app or check permissions.",
  PERMISSION: "Camera permission is required for ASL translation.",
  MODEL: "Translation model failed. Please try again.",
  UNKNOWN: "Something went wrong. Please try again.",
};

export const errorService = {
  classify(error: unknown): AppError {
    const technical = error instanceof Error ? error.message : String(error);

    if (error instanceof TypeError && technical.includes("Network")) {
      return { type: "NETWORK", message: USER_MESSAGES.NETWORK, technical, retryable: true };
    }
    if (error instanceof Error && technical.toLowerCase().includes("permission")) {
      return { type: "PERMISSION", message: USER_MESSAGES.PERMISSION, technical, retryable: false };
    }
    if (error instanceof Error && technical.toLowerCase().includes("camera")) {
      return { type: "CAMERA", message: USER_MESSAGES.CAMERA, technical, retryable: true };
    }
    if (error instanceof Error && technical.toLowerCase().includes("model")) {
      return { type: "MODEL", message: USER_MESSAGES.MODEL, technical, retryable: true };
    }
    return { type: "UNKNOWN", message: USER_MESSAGES.UNKNOWN, technical, retryable: true };
  },

  log(error: AppError): void {
    console.error("[ASL]", error.type, error.technical);
  },
};
