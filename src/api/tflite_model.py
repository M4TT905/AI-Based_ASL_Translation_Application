"""
TFLite model wrapper for ASL fingerspelling inference.

Loads the 1st-place Kaggle competition TFLite model and provides
character-level prediction from MediaPipe landmark sequences.
"""

import json
import numpy as np
from pathlib import Path

# Support multiple TFLite runtime packages (prefer modern ai_edge_litert)
try:
    from ai_edge_litert.interpreter import Interpreter
except ImportError:
    try:
        from tflite_runtime.interpreter import Interpreter
    except ImportError:
        from tensorflow.lite.python.interpreter import Interpreter


class ASLTFLiteModel:
    """Wraps a TFLite ASL fingerspelling model for inference."""

    REQUIRED_SIGNATURE = "serving_default"
    REQUIRED_OUTPUT = "outputs"

    # Post-processing constants from the 1st-place solution
    DUMMY_PHRASE = "2 a-e -aroe"
    MIN_FRAMES = 15

    def __init__(self, model_path: str, character_map_path: str | None = None):
        """
        Args:
            model_path: Path to the .tflite model file.
            character_map_path: Path to character_to_prediction_index.json.
                If None, uses the bundled character_map.json.
        """
        self._model_path = str(model_path)

        # Load character map
        if character_map_path is None:
            character_map_path = Path(__file__).parent / "character_map.json"
        with open(character_map_path, "r") as f:
            character_map = json.load(f)
        self._rev_character_map = {int(v): k for k, v in character_map.items()}

        # Load TFLite model
        self._interpreter = Interpreter(model_path=self._model_path)

        # Verify the required signature exists
        signatures = list(self._interpreter.get_signature_list().keys())
        if self.REQUIRED_SIGNATURE not in signatures:
            raise ValueError(
                f"Required signature '{self.REQUIRED_SIGNATURE}' not found in model. "
                f"Available signatures: {signatures}"
            )

        self._prediction_fn = self._interpreter.get_signature_runner(
            self.REQUIRED_SIGNATURE
        )

    def predict(self, landmarks: np.ndarray) -> dict:
        """Run inference on a sequence of landmark frames.

        Args:
            landmarks: float32 array of shape (num_frames, num_features).
                NaN values will be replaced with 0.

        Returns:
            dict with keys:
                - text: predicted fingerspelled string
                - num_frames: number of input frames
                - is_low_quality: True if prediction was replaced with
                  a dummy phrase due to insufficient frames
        """
        # Preprocess: fill NaN with 0, ensure float32
        landmarks = np.nan_to_num(landmarks, nan=0.0).astype(np.float32)
        num_frames = landmarks.shape[0]

        # Run the TFLite model
        output = self._prediction_fn(inputs=landmarks)
        raw_logits = output[self.REQUIRED_OUTPUT]

        # Decode: argmax per position, map indices to characters
        pred_indices = np.argmax(raw_logits, axis=1)
        prediction_str = "".join(
            self._rev_character_map.get(int(idx), "") for idx in pred_indices
        )

        # Post-processing: replace garbage predictions
        is_low_quality = num_frames < self.MIN_FRAMES
        if is_low_quality:
            prediction_str = self.DUMMY_PHRASE

        return {
            "text": prediction_str,
            "num_frames": num_frames,
            "is_low_quality": is_low_quality,
        }

    def get_model_info(self) -> dict:
        """Return metadata about the loaded model."""
        sig = self._interpreter.get_signature_list()[self.REQUIRED_SIGNATURE]
        return {
            "model_path": self._model_path,
            "signature": self.REQUIRED_SIGNATURE,
            "inputs": sig.get("inputs", {}),
            "outputs": sig.get("outputs", {}),
            "num_characters": len(self._rev_character_map),
        }
