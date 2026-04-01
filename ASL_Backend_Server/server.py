# server.py
#
# For ngrok (demo day): run ngrok in a separate terminal after starting the server:
#   ngrok http 8000
# Then update API_BASE_URL in ASL_Translation/config/api.ts with the ngrok URL.

from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from tensorflow.keras.models import load_model
import numpy as np
from PIL import Image
import io
import os
import mediapipe as mp
from collections import deque

_HERE = os.path.dirname(os.path.abspath(__file__))
model = load_model(os.path.join(_HERE, "..", "ASL_MediaPipe_Refined", "refined_checkpoint_for_new_keypoint_collection.keras"))

keypoints_buffer = deque(maxlen=30)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MediaPipe HandLandmarker (Tasks API, works on mediapipe 0.10.x) ---
BaseOptions          = mp.tasks.BaseOptions
HandLandmarker       = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
VisionRunningMode    = mp.tasks.vision.RunningMode

options = HandLandmarkerOptions(
    base_options=BaseOptions(model_asset_path=os.path.join(_HERE, "hand_landmarker.task")),
    running_mode=VisionRunningMode.IMAGE,
    num_hands=2
)
landmarker = HandLandmarker.create_from_options(options)

# --- Adapter: wrap Tasks API landmarks so normalize_keypoints_enhanced can read them ---
class _LandmarkList:
    """Wraps a list of NormalizedLandmark into an object with a .landmark attribute."""
    def __init__(self, landmarks):
        self.landmark = landmarks

class _HolisticResult:
    """Mimics the mp.solutions.holistic result shape expected by normalize_keypoints_enhanced."""
    def __init__(self, left_hand=None, right_hand=None):
        self.left_hand_landmarks  = left_hand   # _LandmarkList or None
        self.right_hand_landmarks = right_hand  # _LandmarkList or None
        self.pose_landmarks       = None        # no pose — falls back to scale=1, center=[0,0,0]

def _make_holistic_result(result):
    """Separate HandLandmarker output into left/right using handedness classifications."""
    left = right = None
    for hand_lms, handedness in zip(result.hand_landmarks, result.handedness):
        label = handedness[0].category_name  # "Left" or "Right"
        wrapped = _LandmarkList(hand_lms)
        if label == "Left":
            left = wrapped
        else:
            right = wrapped
    return _HolisticResult(left_hand=left, right_hand=right)

# --- 166-feature extraction (mirrors Hachi's normalize_keypoints_enhanced) ---
def normalize_keypoints_enhanced(results):
    features = []

    # Pose normalization — no pose available, use defaults
    scale_factor    = 1.0
    shoulder_center = np.array([0.0, 0.0, 0.0])
    features.extend([0.0, 0.0])  # body direction placeholder

    for hand_landmarks in [results.left_hand_landmarks, results.right_hand_landmarks]:
        if hand_landmarks:
            hand = np.array([[lm.x, lm.y, lm.z] for lm in hand_landmarks.landmark])
            hand_normalized = (hand - shoulder_center) / (scale_factor + 1e-6)
            features.extend(hand_normalized.flatten())

            # Finger angles (sin + cos) for all 5 fingers
            finger_pairs = [(5, 8), (9, 12), (13, 16), (17, 20), (1, 4)]
            for base_idx, tip_idx in finger_pairs:
                if len(hand) > tip_idx:
                    vec   = hand_normalized[tip_idx] - hand_normalized[base_idx]
                    angle = np.arctan2(vec[1], vec[0])
                    features.extend([np.sin(angle), np.cos(angle)])

            # Inter-fingertip distances
            tip_indices = [8, 12, 16, 20]
            for i in range(len(tip_indices) - 1):
                if len(hand) > tip_indices[i + 1]:
                    features.append(np.linalg.norm(
                        hand_normalized[tip_indices[i]] - hand_normalized[tip_indices[i + 1]]))

            # Hand openness: tip distances to palm center + mean spread
            if len(hand) > 20:
                palm_center = np.mean(hand_normalized[0:5], axis=0)
                all_tips    = hand_normalized[[4, 8, 12, 16, 20]]
                dists       = [np.linalg.norm(t - palm_center) for t in all_tips]
                features.extend(dists)
                features.append(np.mean(dists))
        else:
            features.extend(np.zeros(21 * 3))  # positions
            features.extend(np.zeros(5 * 2))   # finger angles
            features.extend(np.zeros(3))        # inter-finger distances
            features.extend(np.zeros(6))        # tip distances + mean spread

    return np.array(features)

classes = [
    "hello", "thanks", "iloveyou",
    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
    "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T",
    "U", "V", "W", "X", "Y", "Z"
]

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/translate/")
async def translate_image(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        pil_img     = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_np      = np.array(pil_img)

        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_np)
        raw      = landmarker.detect(mp_image)

        if not raw.hand_landmarks:
            keypoints_buffer.clear()
            return JSONResponse({"translation": None, "confidence": 0.0, "buffer_frames": 0})

        result    = _make_holistic_result(raw)
        keypoints = normalize_keypoints_enhanced(result)

        keypoints_buffer.append(keypoints)
        n = len(keypoints_buffer)

        if n == 30:
            sequence = np.array(keypoints_buffer)   # (30, 166)
            sequence = np.expand_dims(sequence, 0)  # (1, 30, 166)
        else:
            kp       = np.expand_dims(keypoints, 0)
            kp       = np.expand_dims(kp, 1)
            sequence = np.repeat(kp, 30, axis=1)    # (1, 30, 166)

        prediction = model.predict(sequence, verbose=0)
        pred_class = int(np.argmax(prediction, axis=1)[0])
        confidence = float(np.max(prediction))

        if pred_class >= len(classes):
            return JSONResponse({"translation": None, "confidence": 0.0})

        translated = classes[pred_class]
        print(translated, confidence, f"({n}/30 frames)")
        return JSONResponse({"translation": translated, "confidence": confidence, "buffer_frames": n})

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
