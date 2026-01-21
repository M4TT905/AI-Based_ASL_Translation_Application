import cv2
import torch
from torch import load
from model import DETR
import albumentations as A
from utils.boxes import rescale_bboxes
from utils.setup import get_classes, get_colors
from utils.logger import get_logger
from utils.rich_handlers import DetectionHandler, create_detection_live_display
import sys
import time 


# Initialize logger and handlers
logger = get_logger("realtime")
detection_handler = DetectionHandler()

logger.print_banner()
logger.realtime("Initializing real-time sign language detection...")

transforms = A.Compose(
        [   
            A.Resize(224,224),
            A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            A.ToTensorV2()
        ]
    )

model = DETR(num_classes=39)
model.eval()
model.load_pretrained('checkpoints/99_model.pt')
CLASSES = get_classes()

# Generate colors for all classes (not just the 3 in config)
import numpy as np
COLORS = []
for i in range(len(CLASSES)):
    # Generate distinct colors using HSV to RGB conversion
    hue = (i * 137.5) % 360  # Golden angle for good distribution
    saturation = 0.7
    value = 0.9
    # Convert HSV to RGB
    c = value * saturation
    x = c * (1 - abs((hue / 60) % 2 - 1))
    m = value - c
    if 0 <= hue < 60:
        r, g, b = c, x, 0
    elif 60 <= hue < 120:
        r, g, b = x, c, 0
    elif 120 <= hue < 180:
        r, g, b = 0, c, x
    elif 180 <= hue < 240:
        r, g, b = 0, x, c
    elif 240 <= hue < 300:
        r, g, b = x, 0, c
    else:
        r, g, b = c, 0, x
    # Convert to 0-255 range and BGR for OpenCV
    COLORS.append((int((b + m) * 255), int((g + m) * 255), int((r + m) * 255))) 

logger.realtime("Starting camera capture...")
cap = cv2.VideoCapture(0)

# Add window configuration for better visibility
cv2.namedWindow('Frame', cv2.WINDOW_NORMAL)
cv2.resizeWindow('Frame', 1280, 720)

# Initialize performance tracking
frame_count = 0
fps_start_time = time.time()

while cap.isOpened(): 
    ret, frame = cap.read()
    if not ret:
        logger.error("Failed to read frame from camera")
        break
    
    # Get actual camera resolution
    frame_height, frame_width = frame.shape[:2]
        
    # Time the inference
    inference_start = time.time()
    transformed = transforms(image=frame)
    result = model(torch.unsqueeze(transformed['image'], dim=0))
    inference_time = (time.time() - inference_start) * 1000  # Convert to ms

    probabilities = result['pred_logits'].softmax(-1)[:,:,:-1] 
    max_probs, max_classes = probabilities.max(-1)
    keep_mask = max_probs > 0.2  # Very low threshold for testing undertrained model

    # Diagnostic output - show top predictions even if below threshold
    if frame_count % 30 == 0:  # Every 30 frames
        top5_probs, top5_classes = probabilities[0].max(dim=0).values.topk(5)
        print(f"\n=== Top 5 Predictions (Frame {frame_count}) ===")
        for prob, cls_idx in zip(top5_probs, top5_classes):
            if cls_idx < len(CLASSES):
                print(f"  {CLASSES[cls_idx]}: {prob.item():.4f}")
        print(f"Detections above 0.2 threshold: {keep_mask.sum().item()}")

    batch_indices, query_indices = torch.where(keep_mask) 

    bboxes = rescale_bboxes(result['pred_boxes'][batch_indices, query_indices,:], (frame_width, frame_height))
    classes = max_classes[batch_indices, query_indices]
    probas = max_probs[batch_indices, query_indices]

    # Prepare detection results for logging
    detections = []
    for bclass, bprob, bbox in zip(classes, probas, bboxes): 
        bclass_idx = bclass.detach().numpy()
        bprob_val = bprob.detach().numpy() 
        x1,y1,x2,y2 = bbox.detach().numpy()
        
        detections.append({
            'class': CLASSES[bclass_idx],
            'confidence': float(bprob_val),
            'bbox': [float(x1), float(y1), float(x2), float(y2)]
        })
        
        # Draw bounding boxes on frame
        frame = cv2.rectangle(frame, (int(x1),int(y1)), (int(x2),int(y2)), COLORS[bclass_idx], 10)
        frame_text = f"{CLASSES[bclass_idx]} - {round(float(bprob_val),4)}"
        frame = cv2.rectangle(frame, (int(x1),int(y1)-100), (int(x1)+700,int(y1)), COLORS[bclass_idx], -1)
        frame = cv2.putText(frame, frame_text, (int(x1),int(y1)), cv2.FONT_HERSHEY_DUPLEX, 2, (255,255,255), 4, cv2.LINE_AA)

    # Debug output to console
    if len(detections) > 0:
        print(f"Detected {len(detections)} sign(s): {[d['class'] for d in detections]}")

    # Calculate FPS
    frame_count += 1
    if frame_count % 30 == 0:  # Log every 30 frames
        elapsed_time = time.time() - fps_start_time
        fps = 30 / elapsed_time
        
        # Log detection results and performance
        if detections:
            detection_handler.log_detections(detections, frame_id=frame_count)
        detection_handler.log_inference_time(inference_time, fps)
        
        # Reset FPS counter
        fps_start_time = time.time()

    cv2.imshow('Frame', frame)

    if cv2.waitKey(1) & 0xFF == ord('q'): 
        logger.realtime("Stopping real-time detection...")
        break

cap.release() 
cv2.destroyAllWindows() 
