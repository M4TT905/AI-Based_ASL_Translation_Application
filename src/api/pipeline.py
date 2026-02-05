"""
End-to-end ASL fingerspelling inference pipeline.

Connects MediaPipe landmark extraction with the TFLite model
to go from raw images/video to predicted text.
"""

import numpy as np
import cv2
from pathlib import Path

from .landmark_extractor import LandmarkExtractor
from .tflite_model import ASLTFLiteModel


class ASLPipeline:
    """High-level pipeline: image/video → landmarks → TFLite → text."""

    def __init__(self, model_path: str, inference_args_path: str):
        """
        Args:
            model_path: Path to model.tflite.
            inference_args_path: Path to inference_args.json.
        """
        self.model = ASLTFLiteModel(model_path)
        self._inference_args_path = str(inference_args_path)

        # Extractor for single images (static mode)
        self._image_extractor = LandmarkExtractor(
            inference_args_path, static_image_mode=True
        )

    def predict_image(self, image_bgr: np.ndarray) -> dict:
        """Predict from a single BGR image.

        Note: a single frame captures only one hand shape, so this will
        typically predict a single character at best. For full fingerspelling
        recognition, use video or streaming.
        """
        landmarks = self._image_extractor.extract_frame(image_bgr)
        landmarks = landmarks.reshape(1, -1)
        return self.model.predict(landmarks)

    def predict_video_file(self, video_path: str) -> dict:
        """Predict from a video file (mp4, avi, etc.)."""
        with LandmarkExtractor(
            self._inference_args_path, static_image_mode=False
        ) as extractor:
            landmarks = extractor.extract_video_file(video_path)

        if landmarks.shape[0] == 0:
            return {"text": "", "num_frames": 0, "error": "No frames found in video"}

        return self.model.predict(landmarks)

    def predict_frames(self, frames_bgr: list[np.ndarray]) -> dict:
        """Predict from a list of BGR frames."""
        with LandmarkExtractor(
            self._inference_args_path, static_image_mode=False
        ) as extractor:
            landmarks = extractor.extract_frames(frames_bgr)

        if landmarks.shape[0] == 0:
            return {"text": "", "num_frames": 0, "error": "No frames provided"}

        return self.model.predict(landmarks)

    def predict_landmarks(self, landmarks: np.ndarray) -> dict:
        """Predict directly from pre-extracted landmarks.

        Useful when the frontend extracts MediaPipe landmarks client-side.

        Args:
            landmarks: float32 array of shape (num_frames, num_features).
        """
        return self.model.predict(landmarks)

    def close(self):
        self._image_extractor.close()
