# AI-Based ASL Translation Application

Real-time American Sign Language translation using MediaPipe hand landmark detection and a Keras LSTM model. React Native (Expo) frontend + FastAPI backend.

---

## Repo Structure

```
AI-Based_ASL_Translation_Application/
├── ASL_Translation/          # React Native (Expo) frontend app
├── ASL_Backend_Server/       # FastAPI backend server (NEW_integration_test branch)
└── ASL_MediaPipe_Refined/    # Keras model + training notebooks
```

> **Note:** The backend server lives on the `NEW_integration_test` branch. Use a git worktree to run it alongside the app branch:
> ```
> git worktree add ../ASL-Backend NEW_integration_test
> ```

---

## Frontend Setup

```bash
cd ASL_Translation
npm install
npx expo start
```

Scan the QR code with Expo Go (iOS/Android) or press `w` for web.

**API config:** `ASL_Translation/config/api.ts`
- `API_BASE_URL`, set to server address (localhost for dev, ngrok URL for demo)
- `USE_MOCK_API`, set to `true` to test the UI loop without a running server

---

## Backend Setup

```bash
cd ASL_Backend_Server
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8000
```

**IMPORTANT:** Run from inside `ASL_Backend_Server/`, not the repo root. The model and `hand_landmarker.task` are loaded with paths relative to this directory.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Returns `{"status": "ok"}`, use to verify server is up |
| POST | `/translate/` | Accepts multipart image, returns `{"translation": "letter", "confidence": 0.0–1.0}` |

Returns `{"translation": null, "confidence": 0.0}` when no hand is detected.

---

## Model Notes

**Active model (demo):** `ASL_MediaPipe_Refined/refined_checkpoint_for_new_keypoint_collection.keras`
- Feb 12 version, 126 input features (21 landmarks × 2 hands × 3 coords)
- Loaded by `server.py` at the relative path above
- Classes: `0–9`, `hello`, `i_love_you`, `thanks`

**Hachi's Mar 23 model (NOT in use):** Same filename on `refined_MPH_model` branch
- Expects **166 input features**, incompatible with current `server.py` (which pads to 126)
- Do not swap in without updating `get_flattened_keypoints()` and the padding constant in `server.py`

---

## Demo Day

See `DEMO_CHECKLIST.md`.
