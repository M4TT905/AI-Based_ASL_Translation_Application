"""
MediaPipe Holistic landmark extraction for ASL fingerspelling.

Extracts face, hand, and pose landmarks from images/video frames
and arranges them in the column order expected by the TFLite model
(as specified in inference_args.json from the 1st-place solution).
"""

import json
import numpy as np
import cv2
import mediapipe as mp


class LandmarkExtractor:
    """Extracts MediaPipe Holistic landmarks matching the model's expected input columns."""

    # Maps column name landmark types to MediaPipe result attribute names
    _RESULT_ATTRS = {
        "face": "face_landmarks",
        "left_hand": "left_hand_landmarks",
        "right_hand": "right_hand_landmarks",
        "pose": "pose_landmarks",
    }

    def __init__(self, inference_args_path: str, static_image_mode: bool = True):
        """
        Args:
            inference_args_path: Path to inference_args.json containing selected_columns.
            static_image_mode: If True, treats each frame independently (better for
                single images). If False, uses tracking between frames (better for video).
        """
        with open(inference_args_path, "r") as f:
            self.selected_columns = json.load(f)["selected_columns"]

        # Pre-parse column specs: list of (coord, landmark_type, landmark_index)
        self._column_specs = [self._parse_column(c) for c in self.selected_columns]
        self._num_features = len(self.selected_columns)

        self._holistic = mp.solutions.holistic.Holistic(
            static_image_mode=static_image_mode,
            model_complexity=2,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )

    @staticmethod
    def _parse_column(col_name: str):
        """Parse a column name like 'x_left_hand_5' into ('x', 'left_hand', 5)."""
        parts = col_name.split("_")
        coord = parts[0]  # x, y, or z
        idx = int(parts[-1])  # landmark index
        lm_type = "_".join(parts[1:-1])  # face, left_hand, right_hand, pose
        return coord, lm_type, idx

    def extract_frame(self, frame_bgr: np.ndarray) -> np.ndarray:
        """Extract landmark features from a single BGR frame.

        Args:
            frame_bgr: OpenCV BGR image array.

        Returns:
            1-D float32 array of shape (num_features,) with NaN where
            landmarks were not detected.
        """
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        results = self._holistic.process(frame_rgb)

        row = np.full(self._num_features, np.nan, dtype=np.float32)

        for i, (coord, lm_type, idx) in enumerate(self._column_specs):
            attr_name = self._RESULT_ATTRS[lm_type]
            landmarks = getattr(results, attr_name, None)
            if landmarks is not None and idx < len(landmarks.landmark):
                lm = landmarks.landmark[idx]
                row[i] = getattr(lm, coord)

        return row

    def extract_frames(self, frames_bgr: list[np.ndarray]) -> np.ndarray:
        """Extract landmarks from multiple BGR frames.

        Args:
            frames_bgr: List of OpenCV BGR image arrays.

        Returns:
            float32 array of shape (num_frames, num_features).
        """
        rows = [self.extract_frame(frame) for frame in frames_bgr]
        return np.array(rows, dtype=np.float32)

    def extract_video_file(self, video_path: str) -> np.ndarray:
        """Extract landmarks from all frames of a video file.

        Args:
            video_path: Path to a video file.

        Returns:
            float32 array of shape (num_frames, num_features).
        """
        cap = cv2.VideoCapture(video_path)
        rows = []
        try:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                rows.append(self.extract_frame(frame))
        finally:
            cap.release()

        if not rows:
            return np.empty((0, self._num_features), dtype=np.float32)
        return np.array(rows, dtype=np.float32)

    @property
    def num_features(self) -> int:
        return self._num_features

    def close(self):
        self._holistic.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
