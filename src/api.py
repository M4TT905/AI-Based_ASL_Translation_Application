import base64
import cv2
import numpy as np
import torch
import albumentations as A
from fastapi import FastAPI
from pydantic import BaseModel

from model import DETR
from utils.setup import get_classes, get_colors
from utils.boxes import rescale_bboxes

app = FastAPI()

# same transforms used in realtime.py
transforms = A.Compose([
    A.Resize(224, 224),
    A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    A.ToTensorV2()
])

CLASSES = get_classes()

model = None
device = "cuda" if torch.cuda.is_available() else "cpu"

class FrameRequest(BaseModel):
    image_b64: str           # base64-encoded jpg/png
    width: int               # original frame width
    height: int              # original frame height
    threshold: float = 0.8   # confidence threshold

@app.on_event("startup")
def load_model():
    global model
    num_classes = len(CLASSES)
    model = DETR(num_classes=num_classes).to(device)
    model.eval()

    # pick a checkpoint you want to deploy
    ckpt_path = "checkpoints/99_model.pt"
    state = torch.load(ckpt_path, map_location=device)
    model.load_state_dict(state)

@app.post("/predict")
def predict(req: FrameRequest):
    # decode base64 -> image
    img_bytes = base64.b64decode(req.image_b64)
    np_arr = np.frombuffer(img_bytes, np.uint8)
    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)  # BGR

    # preprocess
    transformed = transforms(image=frame)
    x = transformed["image"].unsqueeze(0).to(device)

    with torch.no_grad():
        result = model(x)

    probs = result["pred_logits"].softmax(-1)[:, :, :-1]
    max_probs, max_classes = probs.max(-1)
    keep = max_probs > req.threshold

    batch_idx, query_idx = torch.where(keep)
    if len(query_idx) == 0:
        return {"detections": []}

    # predicted boxes are normalized cxcywh in [0,1] (because sigmoid)
    # rescale to original frame size
    bboxes = rescale_bboxes(
        result["pred_boxes"][batch_idx, query_idx, :],
        (req.width, req.height)
    )

    detections = []
    for cls_idx, conf, bbox in zip(
        max_classes[batch_idx, query_idx],
        max_probs[batch_idx, query_idx],
        bboxes
    ):
        c = int(cls_idx.item())
        x1, y1, x2, y2 = bbox.detach().cpu().numpy().tolist()
        detections.append({
            "class": CLASSES[c],
            "confidence": float(conf.item()),
            "bbox": [x1, y1, x2, y2]
        })

    return {"detections": detections}
