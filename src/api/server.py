"""
FastAPI server for ASL fingerspelling recognition.

Endpoints:
    GET  /health          - Health check and model info
    POST /predict/image   - Predict from a single uploaded image
    POST /predict/video   - Predict from an uploaded video file
    POST /predict/landmarks - Predict from pre-extracted landmarks (JSON)
    WS   /ws/predict      - Real-time WebSocket streaming prediction

Usage:
    uvicorn src.api.server:app --host 0.0.0.0 --port 8000
"""

import asyncio
import io
import json
import os
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .landmark_extractor import LandmarkExtractor
from .pipeline import ASLPipeline

# ── Paths ────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent.parent
MODEL_PATH = BASE_DIR / "weights" / "cfg_2" / "fold-1" / "model.tflite"
INFERENCE_ARGS_PATH = BASE_DIR / "weights" / "cfg_2" / "fold-1" / "inference_args.json"

# ── Global pipeline (initialised at startup) ─────────────────────────────
pipeline: ASLPipeline | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global pipeline
    pipeline = ASLPipeline(str(MODEL_PATH), str(INFERENCE_ARGS_PATH))
    yield
    pipeline.close()


app = FastAPI(
    title="ASL Fingerspelling Recognition API",
    description=(
        "Receives images or video of ASL fingerspelling, extracts MediaPipe "
        "landmarks, and runs the 1st-place Kaggle TFLite model to return "
        "predicted text."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response schemas ───────────────────────────────────────────
class LandmarkRequest(BaseModel):
    """Pre-extracted landmarks sent as JSON from the frontend."""
    landmarks: list[list[float]]  # shape: (num_frames, num_features)


class PredictionResponse(BaseModel):
    text: str
    num_frames: int
    is_low_quality: bool = False
    error: str | None = None


# ── Helper ───────────────────────────────────────────────────────────────
def _decode_image(raw_bytes: bytes) -> np.ndarray | None:
    nparr = np.frombuffer(raw_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return img


# ── Endpoints ────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    """Health check: confirms the model is loaded and returns basic info."""
    info = {"status": "ok", "model_loaded": pipeline is not None}
    if pipeline is not None:
        info["model_info"] = pipeline.model.get_model_info()
    return info


@app.post("/predict/image", response_model=PredictionResponse)
async def predict_image(file: UploadFile = File(...)):
    """Predict from a single uploaded image (JPEG/PNG).

    A single frame will likely capture only one hand shape, so results
    may be limited. For full fingerspelling, use the video or WebSocket
    endpoints.
    """
    contents = await file.read()
    img = _decode_image(contents)
    if img is None:
        return PredictionResponse(
            text="", num_frames=0, error="Could not decode image"
        )

    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(None, pipeline.predict_image, img)
    return PredictionResponse(**result)


@app.post("/predict/video", response_model=PredictionResponse)
async def predict_video(file: UploadFile = File(...)):
    """Predict from an uploaded video file (MP4, AVI, MOV, etc.).

    The server extracts MediaPipe landmarks from every frame, then
    runs inference on the full sequence.
    """
    suffix = Path(file.filename or "video.mp4").suffix
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=suffix)
    try:
        contents = await file.read()
        os.write(tmp_fd, contents)
        os.close(tmp_fd)

        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            None, pipeline.predict_video_file, tmp_path
        )
    finally:
        os.unlink(tmp_path)

    return PredictionResponse(**result)


@app.post("/predict/landmarks", response_model=PredictionResponse)
async def predict_landmarks(req: LandmarkRequest):
    """Predict from pre-extracted MediaPipe landmarks.

    The frontend can extract landmarks client-side and send them as
    a JSON array of shape (num_frames, 286). This avoids transferring
    full images over the network.
    """
    landmarks = np.array(req.landmarks, dtype=np.float32)
    if landmarks.ndim != 2:
        return PredictionResponse(
            text="",
            num_frames=0,
            error="landmarks must be a 2-D array of shape (num_frames, num_features)",
        )

    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(None, pipeline.predict_landmarks, landmarks)
    return PredictionResponse(**result)


# ── WebSocket for real-time streaming ────────────────────────────────────
@app.websocket("/ws/predict")
async def websocket_predict(websocket: WebSocket):
    """Real-time fingerspelling recognition over WebSocket.

    Protocol:
        Client → Server (binary): JPEG-encoded video frame
        Client → Server (text):   JSON command
            {"action": "predict"}  — run inference on buffered frames, return text
            {"action": "reset"}    — clear the frame buffer
            {"action": "stop"}     — close the connection

        Server → Client (text):   JSON response
            On frame received:  {"status": "frame_received", "buffer_size": N}
            On predict:         {"text": "...", "num_frames": N, ...}
            On reset:           {"status": "buffer_cleared"}
    """
    await websocket.accept()

    extractor = LandmarkExtractor(
        str(INFERENCE_ARGS_PATH), static_image_mode=False
    )
    landmark_buffer: list[np.ndarray] = []

    try:
        while True:
            message = await websocket.receive()

            # ── Binary message: a video frame ────────────────────────
            if "bytes" in message:
                frame = _decode_image(message["bytes"])
                if frame is not None:
                    loop = asyncio.get_running_loop()
                    row = await loop.run_in_executor(
                        None, extractor.extract_frame, frame
                    )
                    landmark_buffer.append(row)
                    await websocket.send_json(
                        {
                            "status": "frame_received",
                            "buffer_size": len(landmark_buffer),
                        }
                    )
                else:
                    await websocket.send_json(
                        {"status": "error", "message": "Could not decode frame"}
                    )

            # ── Text message: a JSON command ─────────────────────────
            elif "text" in message:
                try:
                    cmd = json.loads(message["text"])
                except json.JSONDecodeError:
                    cmd = {"action": message["text"]}

                action = cmd.get("action", "")

                if action == "predict":
                    if landmark_buffer:
                        landmarks = np.array(landmark_buffer, dtype=np.float32)
                        loop = asyncio.get_running_loop()
                        result = await loop.run_in_executor(
                            None, pipeline.model.predict, landmarks
                        )
                        await websocket.send_json(result)
                    else:
                        await websocket.send_json(
                            {"text": "", "num_frames": 0, "error": "No frames buffered"}
                        )

                elif action == "reset":
                    landmark_buffer.clear()
                    await websocket.send_json({"status": "buffer_cleared"})

                elif action == "stop":
                    break

    except WebSocketDisconnect:
        pass
    finally:
        extractor.close()


# ── Standalone entry point ───────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.api.server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
