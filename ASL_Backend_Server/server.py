# server.py
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from tensorflow.keras.models import load_model
import numpy as np
from PIL import Image
import io
import mediapipe as mp

model = load_model("../ASL_MediaPipe_Refined/refined_checkpoint_for_new_keypoint_collection.keras")

app = FastAPI()

origins = [
    "http://localhost:8081",
    "http://127.0.0.1:8081",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

HAND_MODEL_PATH = "./hand_landmarker.task"

BaseOptions = mp.tasks.BaseOptions
HandLandmarker = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

options = HandLandmarkerOptions(
    base_options=BaseOptions(model_asset_path=HAND_MODEL_PATH),
    running_mode=VisionRunningMode.IMAGE,
    num_hands=2
)

landmarker = HandLandmarker.create_from_options(options)

def get_flattened_keypoints(ml_result):
    all_coords = []
    if ml_result.hand_landmarks:
        for hand_landmarks in ml_result.hand_landmarks:
            for lm in hand_landmarks:
                all_coords.extend([lm.x, lm.y, lm.z])

    # pad zeros if < 126
    while len(all_coords) < 126:
        all_coords.append(0.0)

    return np.array(all_coords)

classes = ["0","1","2","3","4","5","6","7","8","9","hello","i_love_you","thanks"]

@app.post("/translate/")
async def translate_image(file: UploadFile = File(...)):
    try:
        # Read uploaded image bytes
        image_bytes = await file.read()
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_np = np.array(pil_img)

        # Convert to Mediapipe Image
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_np)

        # Detect landmarks
        result = landmarker.detect(mp_image)

        # Flatten to shape (126,)
        keypoints = get_flattened_keypoints(result)

        # Prepare shape (1, 30, 126)
        keypoints = np.expand_dims(keypoints, 0)  # (1,126)
        keypoints = np.expand_dims(keypoints, 1)  # (1,1,126)
        keypoints = np.repeat(keypoints, 30, axis=1)  # (1,30,126)

        # Predict
        prediction = model.predict(keypoints)
        pred_class = np.argmax(prediction, axis=1)[0]
        translated = classes[pred_class]

        print(translated)
        return JSONResponse({"translation": translated})

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

# Run server
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)