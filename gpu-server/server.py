import os

import cv2
import numpy as np
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from ultralytics import YOLO

MODEL_PATH = os.getenv("YOLO_MODEL", "yolov8l.pt")
API_KEY = os.getenv("GPU_DETECT_TOKEN")

app = FastAPI()
model = YOLO(MODEL_PATH)


@app.post("/detect")
async def detect(
    file: UploadFile = File(...),
    x_api_key: str | None = Header(default=None),
):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")

    raw = await file.read()
    image = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Invalid image")

    results = model(image, verbose=False)[0]
    detections = []
    for box, cls, conf in zip(
        results.boxes.xyxy.cpu().numpy(),
        results.boxes.cls.cpu().numpy(),
        results.boxes.conf.cpu().numpy(),
    ):
        if int(cls) != 2:
            continue  # COCO: 2 = car
        x1, y1, x2, y2 = box.tolist()
        detections.append(
            {
                "class": "car",
                "score": float(conf),
                "bbox": [float(x1), float(y1), float(x2 - x1), float(y2 - y1)],
            }
        )

    return {
        "predictions": detections,
        "width": int(image.shape[1]),
        "height": int(image.shape[0]),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
