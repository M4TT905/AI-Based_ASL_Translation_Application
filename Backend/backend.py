import torch
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import io
import numpy as np
import albumentations as A
from albumentations.pytorch import ToTensorV2

from src.model import DETR
from src.utils.setup import get_classes, get_colors
from src.utils.boxes import rescale_bboxes

# Server setup
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:7001", "http://127.0.0.1:7001"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# Device
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Classes
CLASSES = get_classes()
COLORS = get_colors()
num_classes = len(CLASSES)

# Load model
model = DETR(num_classes=num_classes)
state_dict = torch.load("./checkpoints/99_model.pt", map_location=device)
model.load_state_dict(state_dict)
model.to(device)
model.eval()
print("Model is up and running")

# Preprocessing (matches realtime.py)
preprocess = A.Compose([
    A.Resize(224, 224),
    A.Normalize(mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]),
    ToTensorV2()
])

# Detect endpoint
@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    # Load image
    contents = await file.read()
    img = Image.open(io.BytesIO(contents)).convert("RGB")
    W, H = img.size
    img_np = np.array(img)

    # Preprocess
    transformed = preprocess(image=img_np)
    x = transformed['image'].unsqueeze(0).to(device)

    # Model inference
    with torch.no_grad():
        outputs = model(x)

    logits = outputs["pred_logits"]
    boxes = outputs["pred_boxes"]

    # Convert logits to probabilities
    probs = logits.softmax(-1)[:, :, :-1]  # ignore "no-object" class
    max_probs, max_classes = probs.max(-1)

    # Filter by confidence threshold
    threshold = 0.3  # lower threshold so we don't lose boxes
    keep_mask = max_probs > threshold
    batch_indices, query_indices = torch.where(keep_mask)

    # Fallback: if no box passes threshold, take top 5
    if len(query_indices) == 0:
        topk = min(5, max_probs.numel())
        max_probs_flat, topk_idx = max_probs.view(-1).topk(topk)
        batch_indices = topk_idx // max_probs.shape[1]
        query_indices = topk_idx % max_probs.shape[1]

    bboxes = rescale_bboxes(boxes[batch_indices, query_indices, :], (W, H))
    classes = max_classes[batch_indices, query_indices]
    probas = max_probs[batch_indices, query_indices]

    # Prepare results
    results = []
    for bclass, bprob, bbox in zip(classes, probas, bboxes):
        x1, y1, x2, y2 = bbox.tolist()
        results.append({
            "label": CLASSES[int(bclass.item())],
            "score": float(bprob.item()),
            "box": [float(x1), float(y1), float(x2), float(y2)]
        })

    return {"detections": results}