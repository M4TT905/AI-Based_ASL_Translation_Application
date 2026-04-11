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
from collections import deque, defaultdict
import time
import json

_HERE = os.path.dirname(os.path.abspath(__file__))
model = load_model(os.path.join(_HERE, "..", "ASL_MediaPipe_Refined", "refined_checkpoint_for_new_keypoint_collection.keras"))
print(model.input_shape)
print(model.output_shape)
model.summary()
print("MODEL PATH:", os.path.join(_HERE, "..", "ASL_MediaPipe_Refined", "asl_model.h5"))

keypoints_buffer = deque(maxlen=30)
prediction_history = deque(maxlen=5)
class_hits = defaultdict(int)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_HAND_LANDMARKS = 21 * 3
EXTRA_FEATURES = 10 + 3 + 5 + 1
HAND_FEATURE_SIZE = BASE_HAND_LANDMARKS + EXTRA_FEATURES
TOTAL_FEATURE_SIZE = 2 + 2 * HAND_FEATURE_SIZE

# --- MediaPipe HandLandmarker (Tasks API, works on mediapipe 0.10.x) ---
BaseOptions          = mp.tasks.BaseOptions
HandLandmarker       = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
VisionRunningMode    = mp.tasks.vision.RunningMode

options = HandLandmarkerOptions(
    base_options=BaseOptions(model_asset_path=os.path.join(_HERE, "hand_landmarker.task")),
    running_mode=VisionRunningMode.VIDEO,
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

def motion_level(seq):
    diffs = np.diff(seq, axis=0)

    # normalize per-frame movement
    frame_norms = np.linalg.norm(diffs, axis=1)

    # normalize by feature magnitude (VERY important)
    scale = np.mean(np.linalg.norm(seq, axis=1)) + 1e-6

    return np.mean(frame_norms) / scale

# --- 166-feature extraction (mirrors Hachi's normalize_keypoints_enhanced) ---
def normalize_keypoints_enhanced(results):
    features = []

    # ============================
    # POSE NORMALIZATION (EXACT MATCH)
    # ============================
    if results.pose_landmarks:
        pose = np.array([[lm.x, lm.y, lm.z, lm.visibility]
                        for lm in results.pose_landmarks.landmark])

        left_shoulder = pose[11][:3]
        right_shoulder = pose[12][:3]
        left_hip = pose[23][:3]
        right_hip = pose[24][:3]

        shoulder_center = (left_shoulder + right_shoulder) / 2
        hip_center = (left_hip + right_hip) / 2

        shoulder_width = np.linalg.norm(left_shoulder - right_shoulder)
        torso_height = np.linalg.norm(shoulder_center - hip_center)

        if shoulder_width > 0:
            scale_factor = shoulder_width
        elif torso_height > 0:
            scale_factor = torso_height
        else:
            scale_factor = 1.0

        body_direction = right_shoulder - left_shoulder
        body_direction = body_direction / (np.linalg.norm(body_direction) + 1e-6)
        features.extend(body_direction[:2])

    else:
        scale_factor = 1.0
        shoulder_center = np.array([0, 0, 0])
        features.extend([0, 0])

    # ============================
    # HAND PROCESSOR (TRAIN MATCH)
    # ============================
    def process_hand(hand_landmarks):
        if not hand_landmarks:
            return (
                [0.0] * (21 * 3) +   # raw coords
                [0.0] * (5 * 2) +    # finger angles
                [0.0] * 3 +          # distances
                [0.0] * 6            # openness
            )

        hand = np.array([[lm.x, lm.y, lm.z] for lm in hand_landmarks.landmark])

        # --- center + scale (EXACT TRAINING LOGIC) ---
        if results.pose_landmarks:
            hand_centered = hand - shoulder_center
        else:
            hand_centered = hand - hand[0]

        hand_normalized = hand_centered / (scale_factor + 1e-6)

        feats = []

        # ============================
        # 1. RAW COORDS (PRIMARY SIGNAL)
        # ============================
        feats.extend(hand_normalized.flatten())

        # ============================
        # 2. FINGER ANGLES (SIN/COS)
        # ============================
        def add_angle(base, tip):
            if len(hand) > tip:
                vec = hand_normalized[tip] - hand_normalized[base]
                angle = np.arctan2(vec[1], vec[0])
                feats.extend([np.sin(angle), np.cos(angle)])

        # index, middle, ring, pinky, thumb
        add_angle(5, 8)
        add_angle(9, 12)
        add_angle(13, 16)
        add_angle(17, 20)
        add_angle(1, 4)

        # ============================
        # 3. INTER-FINGER DISTANCES
        # ============================
        if len(hand) > 12:
            feats.append(np.linalg.norm(hand_normalized[8] - hand_normalized[12]))
        if len(hand) > 16:
            feats.append(np.linalg.norm(hand_normalized[12] - hand_normalized[16]))
        if len(hand) > 20:
            feats.append(np.linalg.norm(hand_normalized[16] - hand_normalized[20]))

        # ============================
        # 4. HAND OPENNESS
        # ============================
        if len(hand) > 20:
            palm_center = np.mean(hand_normalized[0:5], axis=0)
            tips = hand_normalized[[4, 8, 12, 16, 20]]
            dists = [np.linalg.norm(t - palm_center) for t in tips]
            feats.extend(dists)
            feats.append(np.mean(dists))

        return feats

    # ============================
    # LEFT + RIGHT HANDS
    # ============================
    features.extend(process_hand(results.left_hand_landmarks))
    features.extend(process_hand(results.right_hand_landmarks))

    return np.array(features)

classes = [
            'hello', 'thanks', 'iloveyou',
           '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
           'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
           'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
           'U', 'V', 'W', 'X', 'Y', 'Z', 'student', 'from', 'please',
           'consider', 'hire', 'me', 'engineering', 'hope', 'you',
           'enjoy', 'presentation'
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
        timestamp = int(time.perf_counter() * 1000)
        raw      = landmarker.detect_for_video(mp_image, timestamp)

        if not raw.hand_landmarks:
            keypoints_buffer.clear()
            response_data = {
                "translation": None,
                "confidence": 0.0,
                "buffer_frames": 0
            }
            with open("prediction_log.json", "a") as f:
                json.dump(response_data, f, indent=4)
            return JSONResponse(response_data)

        result    = _make_holistic_result(raw)
        keypoints = normalize_keypoints_enhanced(result)

        keypoints_buffer.append(keypoints)
        print("FEATURE LEN:", len(keypoints))
        n = len(keypoints_buffer)

        if n < 30:
            response_data = {
                "translation": None,
                "confidence": 0.0,
                "buffer_frames": n
            }
            with open("prediction_log.json", "a") as f:
                json.dump(response_data, f, indent=4)
            return JSONResponse(response_data)

        sequence = np.array(keypoints_buffer)
        sequence = np.expand_dims(sequence, 0)

        motion_raw = motion_level(sequence[0])

        # breakdown diagnostics
        frame_diffs = np.diff(sequence[0], axis=0)
        frame_norms = np.linalg.norm(frame_diffs, axis=1)

        motion_mean = float(np.mean(frame_norms))
        motion_max  = float(np.max(frame_norms))
        motion_std  = float(np.std(frame_norms))

        motion = float(np.clip(motion_raw, 0.0, 1.0))
        
        print("MOTION DEBUG")
        print("motion:", motion)
        print(f"raw:   {motion_raw:.6f}")
        print(f"mean:  {motion_mean:.6f}")
        print(f"max:   {motion_max:.6f}")
        print(f"std:   {motion_std:.6f}")

        prediction = model.predict(sequence, verbose=0)[0]
        
        penalty_strength = 0.7   # tune this (0.5–1.0 range)

        motion_penalty = max(0.0, 1.0 - penalty_strength * motion_mean)

        prediction = prediction * motion_penalty
    
        
        threshold = 1e-5
        percentages = np.where(prediction < threshold, 0.0, prediction * 100)
        print("PREDICTIONS (%):")
        for i, pct in enumerate(percentages):
            if pct > 0:
                print(f"{classes[i]:>12}: {pct:.4f}%")
        top_k = 10
        top_indices = np.argsort(prediction)[-top_k:][::-1]  # descending

        print("TOP 10 PREDICTIONS:")
        for i in top_indices:
            pct = 0.0 if prediction[i] < 1e-5 else prediction[i] * 100
            print(f"{classes[i]:>12}: {pct:.4f}% (idx={i})")
        print("MAX CONF:", np.max(prediction))
        print("CLASS IDX:", np.argmax(prediction))

        # reduce confidence for motion-heavy sequences

        confidence = float(np.max(prediction))
        pred_class = int(np.argmax(prediction))
        
        class_hits[pred_class] += 1
        print("CLASS COUNTS:")
        for k in sorted(class_hits):
            print(f"class_{k}: {class_hits[k]}")
        
        print("PRED CLASS:", classes[pred_class])

        if confidence < 0.70:
            response_data = {
                "translation": None,
                "confidence": 0.0,
                "buffer_frames": n
            }
            with open("prediction_log.json", "a") as f:
                json.dump(response_data, f, indent=4)
            return JSONResponse(response_data)

        if pred_class >= len(classes):
            response_data = {
                "translation": None,
                "confidence": 0.0,
                "buffer_frames": n
            }
            with open("prediction_log.json", "a") as f:
                json.dump(response_data, f, indent=4)
            return JSONResponse(response_data)

        prediction_history.append(pred_class)

        if len(prediction_history) == 5:
            pred_class = max(set(prediction_history), key=prediction_history.count)

        translated = classes[pred_class]

        print(translated, confidence, f"({n}/30 frames)")


        response_data = {
            "translation": translated,
            "confidence": confidence,
            "buffer_frames": n
        }
        with open("prediction_log.json", "a") as f:
            json.dump(response_data, f, indent=4)
        return JSONResponse(response_data)

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
