# ASL Translation App - Project Memory

## Architecture
- **DETR model** (`src/model.py`): ResNet-50 + Transformer for ASL sign detection (bounding boxes). 39 classes (3 phrases + 10 digits + 26 letters). Trained with PyTorch checkpoints in `checkpoints/`.
- **1st-place Kaggle TFLite model** (`weights/cfg_2/fold-1/model.tflite`, 40.9 MB): Squeezeformer encoder + 2-layer Transformer decoder for fingerspelling recognition. Takes MediaPipe landmarks → outputs character sequences.
- **Frontend**: React Native/Expo app in `ASL_Translation/`.
- **FastAPI server** (`src/api/server.py`): Receives images/video, extracts MediaPipe Holistic landmarks, runs TFLite inference.

## Key Files
- `weights/cfg_2/fold-1/inference_args.json` — 390 selected MediaPipe columns (130 landmarks × 3 xyz coords)
- `src/api/character_map.json` — 60 characters (0-59): space, punctuation, digits, a-z
- TFLite signature: `serving_default`, input: `inputs` (num_frames, 286), output: `outputs` (seq_len, vocab)

## API Endpoints
- `POST /predict/image` — single frame prediction
- `POST /predict/video` — video file prediction
- `POST /predict/landmarks` — pre-extracted landmarks
- `WS /ws/predict` — real-time WebSocket streaming

## Post-processing (from 1st-place solution)
- If < 15 frames → replace with dummy phrase `"2 a-e -aroe"`
- Character decoding: `argmax(output, axis=1)` → map indices via character_map

## Dependencies
- TFLite runtime: `ai-edge-litert` (preferred), `tflite_runtime`, or `tensorflow.lite`
- MediaPipe Tasks API (NOT legacy `mp.solutions` — dropped in Python 3.13+)
  - Requires .task files in `weights/mediapipe/`: hand_landmarker.task, face_landmarker.task, pose_landmarker.task
- Column naming: `{x|y|z}_{face|left_hand|right_hand|pose}_{index}`
- TFLite model input: `(num_frames, 390)` float32. 130 landmarks: 76 face + 21 left_hand + 21 right_hand + 12 pose

## Compatibility Notes
- Python 3.13: `mediapipe.solutions` not available; must use `mediapipe.tasks` API
- TF 2.20+: `tf.lite.Interpreter` deprecated → use `ai_edge_litert`
- MediaPipe Tasks requires separate Hand/Face/Pose landmarkers (no Holistic equivalent)