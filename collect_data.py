"""
collect_data.py — ASL guided data collector

For each class, walks you through 6 pose variations automatically:
  Neutral / Tilt Left / Tilt Right / Closer / Further / Tilt Up+Down

Each variation:
  - Shows what to do + a short HOLD countdown (time to reposition)
  - Captures FRAMES_PER_VARIATION frames at a slow pace
  - Augments each frame x4 (flip + noise on both)
  => ~600 samples per class total

Controls:
  SPACE   — begin sequence for current class
  N       — skip current class entirely
  Q       — quit and save

Output:
  training_data/X.npy        shape (n_samples, 166)
  training_data/y.npy        shape (n_samples,)
  training_data/classes.npy  class name list

Run from ASL-Backend/:
  python collect_data.py
"""

import cv2
import numpy as np
import os
import mediapipe as mp
import time

# ── Config ────────────────────────────────────────────────────────────────────

CLASSES = list('ABCDEFGHIJKLMNOPQRSTUVWXYZ') + [str(i) for i in range(10)] + ['DEL']

VARIATIONS = [
    ("NEUTRAL",       "Hold sign centered and steady"),
    ("TILT LEFT",     "Rotate wrist left ~15 degrees"),
    ("TILT RIGHT",    "Rotate wrist right ~15 degrees"),
    ("CLOSER",        "Move hand closer to camera"),
    ("FURTHER",       "Move hand further from camera"),
    ("TILT UP/DOWN",  "Tilt hand up then down slowly"),
]

FRAMES_PER_VARIATION = 25   # real frames captured per variation
HOLD_SECS             = 2.5  # pause between instruction showing and capture start
CAPTURE_INTERVAL_MS   = 120  # ms between frame captures (~8 fps — slow enough to vary)
NOISE_STD             = 0.015

_HERE      = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(_HERE, 'ASL_Backend_Server', 'hand_landmarker.task')
OUT_DIR    = os.path.join(_HERE, 'training_data')
os.makedirs(OUT_DIR, exist_ok=True)

# ── MediaPipe ─────────────────────────────────────────────────────────────────

BaseOptions           = mp.tasks.BaseOptions
HandLandmarker        = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
VisionRunningMode     = mp.tasks.vision.RunningMode

options = HandLandmarkerOptions(
    base_options=BaseOptions(model_asset_path=MODEL_PATH),
    running_mode=VisionRunningMode.IMAGE,
    num_hands=2,
)
landmarker = HandLandmarker.create_from_options(options)

# ── Adapters (identical to server.py) ─────────────────────────────────────────

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
        label = handedness[0].category_name
        if label == 'Left':  left  = _LandmarkList(lms)
        else:                right = _LandmarkList(lms)
    return _HolisticResult(left, right)

# ── Feature extraction (identical to server.py) ────────────────────────────────

def normalize_keypoints_enhanced(results):
    features = []
    if results.pose_landmarks:
        pose = np.array([[lm.x, lm.y, lm.z, lm.visibility]
                         for lm in results.pose_landmarks.landmark])
        ls, rs  = pose[11][:3], pose[12][:3]
        lh, rh  = pose[23][:3], pose[24][:3]
        sc      = (ls + rs) / 2
        sw      = np.linalg.norm(ls - rs)
        th      = np.linalg.norm(sc - (lh + rh) / 2)
        sf      = sw if sw > 0 else (th if th > 0 else 1.0)
        bd      = rs - ls; bd /= np.linalg.norm(bd) + 1e-6
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

def extract_features(frame_bgr):
    img = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    raw = landmarker.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=img))
    if not raw.hand_landmarks: return None
    return normalize_keypoints_enhanced(_make_holistic_result(raw))

def extract_augmented(frame_bgr):
    """Original + flip, each with noise = up to 4 samples."""
    out = []
    for frm in [frame_bgr, cv2.flip(frame_bgr, 1)]:
        f = extract_features(frm)
        if f is not None and len(f) == 166:
            out.append(f)
            out.append(f + np.random.normal(0, NOISE_STD, f.shape))
    return out

# ── Drawing helpers ────────────────────────────────────────────────────────────

ORANGE = (0, 140, 255)
GREEN  = (0, 200, 80)
WHITE  = (255, 255, 255)
GRAY   = (160, 160, 160)
RED    = (60, 60, 220)
CYAN   = (255, 220, 0)

def draw_text(frame, text, pos, scale, color, thickness=2):
    cv2.putText(frame, text, pos, cv2.FONT_HERSHEY_SIMPLEX, scale, color, thickness, cv2.LINE_AA)

def draw_ui(frame, class_name, class_idx,
            var_idx, var_name, var_hint,
            var_frame, state, hold_remaining=0):
    h, w = frame.shape[:2]

    # Top bar
    cv2.rectangle(frame, (0, 0), (w, 90), (25, 25, 25), -1)

    # Sign name
    draw_text(frame, f'Sign:  {class_name}', (18, 58), 1.9, WHITE, 3)

    # Class counter (top right)
    draw_text(frame, f'{class_idx+1}/{len(CLASSES)}', (w-110, 30), 0.7, GRAY, 1)

    # Variation progress dots
    dot_x = 18
    for i, (vn, _) in enumerate(VARIATIONS):
        color = GREEN if i < var_idx else (ORANGE if i == var_idx else (70,70,70))
        cv2.circle(frame, (dot_x + i*32, 78), 8, color, -1)

    # Variation instruction box
    box_y = 105
    cv2.rectangle(frame, (0, box_y), (w, box_y + 80), (40, 40, 40), -1)
    draw_text(frame, var_name, (18, box_y + 32), 1.1, ORANGE, 2)
    draw_text(frame, var_hint, (18, box_y + 62), 0.6, GRAY, 1)

    # State-specific overlay
    if state == 'waiting':
        tip = 'SPACE = start sequence    N = skip class    Q = quit'
        draw_text(frame, tip, (18, h-20), 0.55, GRAY, 1)

    elif state == 'hold':
        msg = f'Get into position... {hold_remaining:.1f}s'
        draw_text(frame, msg, (18, h-50), 0.9, CYAN, 2)
        draw_text(frame, 'Adjust your hand now!', (18, h-20), 0.55, GRAY, 1)

    elif state == 'capturing':
        # Red REC dot
        cv2.circle(frame, (w-28, 110), 10, (0,0,220), -1)
        draw_text(frame, 'REC', (w-70, 117), 0.55, (0,0,220), 2)

        # Frame progress bar for this variation
        bar_x, bar_y = 18, h-50
        bar_w = w - 36
        cv2.rectangle(frame, (bar_x, bar_y), (bar_x+bar_w, bar_y+18), (60,60,60), -1)
        filled = int(bar_w * var_frame / FRAMES_PER_VARIATION)
        cv2.rectangle(frame, (bar_x, bar_y), (bar_x+filled, bar_y+18), ORANGE, -1)
        draw_text(frame, f'Variation {var_idx+1}/{len(VARIATIONS)}  '
                         f'frame {var_frame}/{FRAMES_PER_VARIATION}',
                  (bar_x, h-58), 0.55, GRAY, 1)

    elif state == 'done':
        cv2.rectangle(frame, (0, h//2-40), (w, h//2+40), (0,120,0), -1)
        draw_text(frame, 'CLASS COMPLETE!', (w//2-160, h//2+12), 1.3, WHITE, 3)

    return frame

# ── Persistence ────────────────────────────────────────────────────────────────

def load_existing():
    xp, yp = os.path.join(OUT_DIR,'X.npy'), os.path.join(OUT_DIR,'y.npy')
    if os.path.exists(xp) and os.path.exists(yp):
        return list(np.load(xp)), list(np.load(yp))
    return [], []

def done_labels(y_list):
    needed = FRAMES_PER_VARIATION * len(VARIATIONS) * 2  # 2 = rough aug factor floor
    counts = {}
    for lbl in y_list:
        counts[lbl] = counts.get(lbl, 0) + 1
    return {lbl for lbl, cnt in counts.items() if cnt >= needed}

def save(X_list, y_list):
    if not X_list: return
    np.save(os.path.join(OUT_DIR,'X.npy'),       np.array(X_list, dtype=np.float32))
    np.save(os.path.join(OUT_DIR,'y.npy'),        np.array(y_list, dtype=np.int32))
    np.save(os.path.join(OUT_DIR,'classes.npy'),  np.array(CLASSES))
    print(f'  saved {len(X_list)} samples total')

# ── Main ──────────────────────────────────────────────────────────────────────

def main(only_labels=None):
    X_list, y_list = load_existing()
    finished = done_labels(y_list)
    # When targeting specific classes, remove them from finished so they get recollected
    if only_labels:
        finished -= only_labels
    print(f'Resuming: {len(X_list)} samples, {len(finished)}/{len(CLASSES)} classes done')

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print('ERROR: cannot open camera'); return

    for class_idx, class_name in enumerate(CLASSES):
        label = class_idx
        # Skip if not in target set (when targeting specific classes)
        if only_labels and label not in only_labels:
            continue
        if label in finished:
            print(f'  skip {class_name} (done)')
            continue

        # ── wait for SPACE ──────────────────────────────────────────────────
        state = 'waiting'
        while state == 'waiting':
            ret, frame = cap.read()
            if not ret: break
            frame = cv2.flip(frame, 1)
            draw_ui(frame, class_name, class_idx, 0,
                    VARIATIONS[0][0], VARIATIONS[0][1], 0, 'waiting')
            cv2.imshow('ASL Collector', frame)
            key = cv2.waitKey(30) & 0xFF
            if key == ord('q'):
                save(X_list, y_list); cap.release(); cv2.destroyAllWindows(); return
            if key == ord('n'):
                state = 'skip'; break
            if key == ord(' '):
                state = 'go'

        if state == 'skip':
            print(f'  skipped {class_name}')
            continue

        # ── guided variation loop ───────────────────────────────────────────
        skipped = False
        for var_idx, (var_name, var_hint) in enumerate(VARIATIONS):

            # Hold countdown
            hold_end = time.time() + HOLD_SECS
            while time.time() < hold_end:
                ret, frame = cap.read()
                if not ret: break
                frame = cv2.flip(frame, 1)
                remaining = hold_end - time.time()
                draw_ui(frame, class_name, class_idx,
                        var_idx, var_name, var_hint, 0, 'hold', remaining)
                cv2.imshow('ASL Collector', frame)
                key = cv2.waitKey(30) & 0xFF
                if key == ord('q'):
                    save(X_list, y_list); cap.release(); cv2.destroyAllWindows(); return
                if key == ord('n'):
                    skipped = True; break
            if skipped: break

            # Capture frames for this variation
            var_frame = 0
            last_capture = 0.0
            while var_frame < FRAMES_PER_VARIATION:
                ret, frame = cap.read()
                if not ret: break
                frame = cv2.flip(frame, 1)
                now = time.time()

                if now - last_capture >= CAPTURE_INTERVAL_MS / 1000.0:
                    augmented = extract_augmented(frame)
                    if augmented:
                        for feats in augmented:
                            X_list.append(feats)
                            y_list.append(label)
                        var_frame += 1
                        last_capture = now

                draw_ui(frame, class_name, class_idx,
                        var_idx, var_name, var_hint, var_frame, 'capturing')
                cv2.imshow('ASL Collector', frame)
                key = cv2.waitKey(1) & 0xFF
                if key == ord('q'):
                    save(X_list, y_list); cap.release(); cv2.destroyAllWindows(); return
                if key == ord('n'):
                    skipped = True; break
            if skipped: break

        # Done with class
        save(X_list, y_list)
        finished.add(label)
        samples_this = sum(1 for l in y_list if l == label)
        print(f'  {class_name}: {samples_this} samples saved')

        # Flash done screen
        done_end = time.time() + 1.2
        while time.time() < done_end:
            ret, frame = cap.read()
            if not ret: break
            frame = cv2.flip(frame, 1)
            draw_ui(frame, class_name, class_idx,
                    len(VARIATIONS), '', '', FRAMES_PER_VARIATION, 'done')
            cv2.imshow('ASL Collector', frame)
            cv2.waitKey(30)

    cap.release()
    cv2.destroyAllWindows()
    save(X_list, y_list)
    print('All done.')

if __name__ == '__main__':
    import sys
    # Optional: pass specific classes to retrain, e.g.:
    #   python collect_data.py I U K V M N
    if len(sys.argv) > 1:
        targets = [a.upper() for a in sys.argv[1:]]
        invalid = [t for t in targets if t not in CLASSES]
        if invalid:
            print(f'Unknown classes: {invalid}'); sys.exit(1)
        target_labels = {CLASSES.index(t) for t in targets}
        # Remove existing samples for those classes
        X_list, y_list = load_existing()
        if X_list:
            paired = [(x, y) for x, y in zip(X_list, y_list) if y not in target_labels]
            X_list = [p[0] for p in paired]
            y_list = [p[1] for p in paired]
            save(X_list, y_list)
            print(f'Cleared {targets} — recollecting now')
        main(only_labels=target_labels)
    else:
        main()
