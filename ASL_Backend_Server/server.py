# server.py — ASL SVM backend (single-frame, no buffer)
#
# Demo day: run ngrok in a separate terminal after starting:
#   ngrok http 8000
# Then update API_BASE_URL in ASL_Translation/config/api.ts with the ngrok URL.

from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
from PIL import Image, ImageOps
import io, os, pickle
import mediapipe as mp
import wordsegment
wordsegment.load()

_HERE = os.path.dirname(os.path.abspath(__file__))

# ── Load SVM model ────────────────────────────────────────────────────────────

with open(os.path.join(_HERE, '..', 'model', 'asl_svm.pkl'), 'rb') as f:
    clf = pickle.load(f)
classes = np.load(os.path.join(_HERE, '..', 'model', 'classes.npy'))
print(f'Loaded SVM — {len(classes)} classes: {list(classes)}')

# ── MediaPipe ─────────────────────────────────────────────────────────────────

BaseOptions           = mp.tasks.BaseOptions
HandLandmarker        = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
VisionRunningMode     = mp.tasks.vision.RunningMode

options = HandLandmarkerOptions(
    base_options=BaseOptions(model_asset_path=os.path.join(_HERE, 'hand_landmarker.task')),
    running_mode=VisionRunningMode.IMAGE,
    num_hands=2,
)
landmarker = HandLandmarker.create_from_options(options)

# ── Adapters ──────────────────────────────────────────────────────────────────

class _LandmarkList:
    def __init__(self, lms): self.landmark = lms

class _HolisticResult:
    def __init__(self, left=None, right=None):
        self.left_hand_landmarks  = left
        self.right_hand_landmarks = right
        self.pose_landmarks       = None

def _make_holistic_result(result):
    left = right = None
    for lms, handedness in zip(result.hand_landmarks, result.handedness):
        if handedness[0].category_name == 'Left': left  = _LandmarkList(lms)
        else:                                      right = _LandmarkList(lms)
    return _HolisticResult(left, right)

# ── Feature extraction (identical to collect_data.py / train.py) ──────────────

def normalize_keypoints_enhanced(results):
    features = []
    if results.pose_landmarks:
        pose = np.array([[lm.x, lm.y, lm.z, lm.visibility]
                         for lm in results.pose_landmarks.landmark])
        ls, rs = pose[11][:3], pose[12][:3]
        lh, rh = pose[23][:3], pose[24][:3]
        sc     = (ls + rs) / 2
        sw     = np.linalg.norm(ls - rs)
        th     = np.linalg.norm(sc - (lh + rh) / 2)
        sf     = sw if sw > 0 else (th if th > 0 else 1.0)
        bd     = rs - ls; bd /= np.linalg.norm(bd) + 1e-6
        features.extend(bd[:2])
    else:
        sf = 1.0; sc = np.zeros(3); features.extend([0.0, 0.0])

    def process_hand(hand_lms):
        if not hand_lms:
            return [0.0] * (21*3 + 5*2 + 3 + 6)
        hand = np.array([[lm.x, lm.y, lm.z] for lm in hand_lms.landmark])
        hn   = (hand - (sc if results.pose_landmarks else hand[0])) / (sf + 1e-6)
        feats = list(hn.flatten())
        def angle(b, t):
            if len(hand) > t:
                v = hn[t] - hn[b]; a = np.arctan2(v[1], v[0])
                feats.extend([np.sin(a), np.cos(a)])
        angle(5,8); angle(9,12); angle(13,16); angle(17,20); angle(1,4)
        for a, b in [(8,12),(12,16),(16,20)]:
            if len(hand) > b: feats.append(np.linalg.norm(hn[a] - hn[b]))
        if len(hand) > 20:
            pc    = np.mean(hn[0:5], axis=0)
            tips  = hn[[4,8,12,16,20]]
            dists = [np.linalg.norm(t - pc) for t in tips]
            feats.extend(dists); feats.append(np.mean(dists))
        return feats

    features.extend(process_hand(results.left_hand_landmarks))
    features.extend(process_hand(results.right_hand_landmarks))
    return np.array(features)

# ── FastAPI ───────────────────────────────────────────────────────────────────

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])

CONFIDENCE_THRESHOLD = 0.60

@app.get('/health')
async def health():
    return {'status': 'ok'}

class SegmentRequest(BaseModel):
    text: str

@app.post('/segment')
async def segment_text(req: SegmentRequest):
    words = wordsegment.segment(req.text.lower())
    return JSONResponse({'result': ' '.join(w.upper() for w in words)})

@app.post('/translate/')
async def translate_image(file: UploadFile = File(...)):
    try:
        img_bytes = await file.read()
        pil_img   = Image.open(io.BytesIO(img_bytes))
        pil_img   = ImageOps.exif_transpose(pil_img)   # fix mobile rotation
        pil_img   = pil_img.convert('RGB')
        img_np    = np.array(pil_img)

        mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_np)
        raw    = landmarker.detect(mp_img)

        if not raw.hand_landmarks:
            return JSONResponse({'translation': None, 'confidence': 0.0})

        feats = normalize_keypoints_enhanced(_make_holistic_result(raw))
        if len(feats) != 166:
            return JSONResponse({'translation': None, 'confidence': 0.0})

        proba      = clf.predict_proba([feats])[0]
        pred_idx   = int(np.argmax(proba))
        confidence = float(proba[pred_idx])

        if confidence < CONFIDENCE_THRESHOLD:
            return JSONResponse({'translation': None, 'confidence': 0.0})

        label = str(classes[pred_idx])
        print(f'  {label} ({confidence*100:.1f}%)')
        return JSONResponse({'translation': label, 'confidence': confidence})

    except Exception as e:
        return JSONResponse({'error': str(e)}, status_code=500)

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)
