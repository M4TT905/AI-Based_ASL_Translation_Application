# AI-Based ASL Translation Application

A real-time mobile app that translates American Sign Language hand signs into text, achieving 97.7% test accuracy across 37 sign classes.

---

## Demo

<video src="demo.mp4" controls width="400"></video>

---

## Why We Built It

Millions of people use American Sign Language as their primary language, yet real-time translation tools accessible on everyday devices are rare. We built this app to lower the communication barrier between ASL users and non-signers, using only a smartphone camera, no specialized hardware required. The result is a lightweight, low-latency pipeline that runs inference on live video frames and surfaces predictions instantly on-screen.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Mobile Frontend | React Native (Expo) |
| Backend API | FastAPI (Python) |
| Hand Tracking | MediaPipe Hand Landmarker |
| ML Model | SVM (scikit-learn) |
| Language | Python 3, TypeScript |

---

## How It Works

1. The mobile app streams camera frames to the FastAPI backend over HTTP.
2. MediaPipe Hand Landmarker extracts 21 3D landmarks per hand. Per-hand features (x/y/z coords, finger direction angles, inter-fingertip distances) are combined with body orientation into a 166-value feature vector per frame.
3. An SVM classifier (RBF kernel, C=10) scores the vector against 37 classes: A-Z, digits 0-9, and DEL.
4. Predictions that clear the confidence threshold are returned to the app and rendered as text in real time.

---

## Model Performance

**97.7% test accuracy** across 3,234 samples. Macro-averaged precision, recall, and F1 are all 0.98.

The classifier is an SVM with an RBF kernel (C=10, gamma='scale'), preceded by z-score normalization via StandardScaler. It operates on 166 engineered features per frame, shoulder orientation for body context, plus per-hand landmark coordinates, finger direction angles, and inter-fingertip distances, and classifies across 37 signs (A-Z, 0-9, DEL).

---

## Setup

### Frontend

```bash
cd ASL_Translation
npm install
npx expo start
```

Scan the QR code with Expo Go (iOS/Android) or press `w` for web.

**API config:** `ASL_Translation/config/api.ts`
- `API_BASE_URL`, set to your server address (localhost for local dev, ngrok URL for device testing)
- `USE_MOCK_API`, set to `true` to run the UI without a live server

### Backend

```bash
cd ASL_Backend_Server
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8000
```

Run from inside `ASL_Backend_Server/`, not the repo root. The model weights and `hand_landmarker.task` are resolved relative to that directory.

> **Branch note:** The backend lives on the `NEW_integration_test` branch. To check it out alongside the frontend branch without losing your working tree, use a git worktree:
> ```bash
> git worktree add ../ASL-Backend NEW_integration_test
> ```
> Then run the server from `../ASL-Backend/ASL_Backend_Server/`.

#### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Returns `{"status": "ok"}`, verify the server is reachable |
| POST | `/translate/` | Accepts a multipart image; returns `{"translation": "letter", "confidence": 0.0-1.0}` |

Returns `{"translation": null, "confidence": 0.0}` when no hand is detected.

---


## Contributors

- [Victor S](https://github.com/amiothenes)
- [Matthew H](https://github.com/M4TT905)
- [Olamide T](https://github.com/olamidetim21)
- [Hachi N](https://github.com/hachy-kc)
