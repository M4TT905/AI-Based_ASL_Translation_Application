"""
MediaPipe Tasks-based landmark extraction for ASL fingerspelling.

Uses the modern MediaPipe Tasks API (HandLandmarker, FaceLandmarker,
PoseLandmarker) to extract face, hand, and pose landmarks from
images/video frames and arranges them in the column order expected
by the TFLite model (as specified in inference_args.json).
"""

import json
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# Default location for downloaded .task model files
_MEDIAPIPE_MODELS_DIR = Path(__file__).resolve().parent.parent.parent / "weights" / "mediapipe"


class LandmarkExtractor:
    """Extracts MediaPipe landmarks matching the model's expected input columns."""

    def __init__(
        self,
        inference_args_path: str,
        static_image_mode: bool = True,
        mediapipe_models_dir: str | None = None,
    ):
        """
        Args:
            inference_args_path: Path to inference_args.json with selected_columns.
            static_image_mode: True → IMAGE mode (single frames, no tracking).
                False → VIDEO mode (uses temporal tracking, needs timestamps).
            mediapipe_models_dir: Directory containing hand_landmarker.task,
                face_landmarker.task, pose_landmarker.task.
        """
        with open(inference_args_path, "r") as f:
            self.selected_columns = json.load(f)["selected_columns"]

        self._column_specs = [self._parse_column(c) for c in self.selected_columns]
        self._num_features = len(self.selected_columns)

        models_dir = Path(mediapipe_models_dir) if mediapipe_models_dir else _MEDIAPIPE_MODELS_DIR
        mode = vision.RunningMode.IMAGE if static_image_mode else vision.RunningMode.VIDEO

        self._hand_landmarker = vision.HandLandmarker.create_from_options(
            vision.HandLandmarkerOptions(
                base_options=python.BaseOptions(
                    model_asset_path=str(models_dir / "hand_landmarker.task")
                ),
                num_hands=2,
                running_mode=mode,
                min_hand_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )
        )
        self._face_landmarker = vision.FaceLandmarker.create_from_options(
            vision.FaceLandmarkerOptions(
                base_options=python.BaseOptions(
                    model_asset_path=str(models_dir / "face_landmarker.task")
                ),
                num_faces=1,
                running_mode=mode,
                min_face_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )
        )
        self._pose_landmarker = vision.PoseLandmarker.create_from_options(
            vision.PoseLandmarkerOptions(
                base_options=python.BaseOptions(
                    model_asset_path=str(models_dir / "pose_landmarker.task")
                ),
                num_poses=1,
                running_mode=mode,
                min_pose_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )
        )

        self._static_mode = static_image_mode
        self._frame_timestamp_ms = 0

    # ── Column parsing ──────────────────────────────────────────────────
    @staticmethod
    def _parse_column(col_name: str):
        """Parse 'x_left_hand_5' → ('x', 'left_hand', 5)."""
        parts = col_name.split("_")
        coord = parts[0]
        idx = int(parts[-1])
        lm_type = "_".join(parts[1:-1])
        return coord, lm_type, idx

    # ── Detection helpers ───────────────────────────────────────────────
    def _detect(self, mp_image: mp.Image):
        """Run all three landmarkers on a single MediaPipe Image."""
        if self._static_mode:
            hand_result = self._hand_landmarker.detect(mp_image)
            face_result = self._face_landmarker.detect(mp_image)
            pose_result = self._pose_landmarker.detect(mp_image)
        else:
            ts = self._frame_timestamp_ms
            hand_result = self._hand_landmarker.detect_for_video(mp_image, ts)
            face_result = self._face_landmarker.detect_for_video(mp_image, ts)
            pose_result = self._pose_landmarker.detect_for_video(mp_image, ts)
            self._frame_timestamp_ms += 33  # ~30 fps

        # Organise hand results into left/right
        left_hand_lms = None
        right_hand_lms = None
        if hand_result.hand_landmarks:
            for hand_lms, handedness in zip(
                hand_result.hand_landmarks, hand_result.handedness
            ):
                label = handedness[0].category_name  # "Left" or "Right"
                if label == "Left":
                    left_hand_lms = hand_lms
                else:
                    right_hand_lms = hand_lms

        face_lms = face_result.face_landmarks[0] if face_result.face_landmarks else None
        pose_lms = pose_result.pose_landmarks[0] if pose_result.pose_landmarks else None

        return {
            "face": face_lms,
            "left_hand": left_hand_lms,
            "right_hand": right_hand_lms,
            "pose": pose_lms,
        }

    # ── Public API ──────────────────────────────────────────────────────
    def extract_frame(self, frame_bgr: np.ndarray) -> np.ndarray:
        """Extract landmark features from a single BGR frame.

        Returns:
            1-D float32 array of shape (num_features,). NaN where not detected.
        """
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
        landmarks_by_type = self._detect(mp_image)

        row = np.full(self._num_features, np.nan, dtype=np.float32)

        for i, (coord, lm_type, idx) in enumerate(self._column_specs):
            lms = landmarks_by_type[lm_type]
            if lms is not None and idx < len(lms):
                lm = lms[idx]
                row[i] = getattr(lm, coord)

        return row

    def extract_frames(self, frames_bgr: list[np.ndarray]) -> np.ndarray:
        """Extract landmarks from multiple BGR frames.

        Returns:
            float32 array of shape (num_frames, num_features).
        """
        self._frame_timestamp_ms = 0
        rows = [self.extract_frame(frame) for frame in frames_bgr]
        return np.array(rows, dtype=np.float32)

    def extract_video_file(self, video_path: str) -> np.ndarray:
        """Extract landmarks from all frames of a video file.

        Returns:
            float32 array of shape (num_frames, num_features).
        """
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        frame_interval_ms = int(1000 / fps)
        self._frame_timestamp_ms = 0
        rows = []
        try:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                rows.append(self.extract_frame(frame))
                if not self._static_mode:
                    # In video mode, timestamps are advanced inside _detect,
                    # but we override with actual video timing
                    self._frame_timestamp_ms = len(rows) * frame_interval_ms
        finally:
            cap.release()

        if not rows:
            return np.empty((0, self._num_features), dtype=np.float32)
        return np.array(rows, dtype=np.float32)

    @property
    def num_features(self) -> int:
        return self._num_features

    def close(self):
        self._hand_landmarker.close()
        self._face_landmarker.close()
        self._pose_landmarker.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
