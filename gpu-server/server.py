import os
import time

import cv2
import numpy as np
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from aiohttp import ClientSession
from pytile import async_login
from dotenv import load_dotenv
from ultralytics import YOLO

load_dotenv()

MODEL_PATH = os.getenv("YOLO_MODEL", "yolov8l.pt")
API_KEY = os.getenv("GPU_DETECT_TOKEN")
TILE_EMAIL = os.getenv("TILE_EMAIL")
TILE_PASSWORD = os.getenv("TILE_PASSWORD")
TILE_CLIENT_UUID = os.getenv("TILE_CLIENT_UUID")
TILE_CACHE_SECONDS = int(os.getenv("TILE_CACHE_SECONDS", "30"))
CORS_ALLOW_ORIGINS = os.getenv("CORS_ALLOW_ORIGINS", "*")

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in CORS_ALLOW_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
model = YOLO(MODEL_PATH)
_tile_cache: dict[str, object] = {"ts": 0.0, "data": []}


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


@app.get("/devices")
async def devices():
    if not TILE_EMAIL or not TILE_PASSWORD:
        raise HTTPException(status_code=500, detail="Tile credentials not configured")

    now = time.time()
    if now - float(_tile_cache["ts"]) < TILE_CACHE_SECONDS:
        return {"devices": _tile_cache["data"], "cached": True}

    async with ClientSession() as session:
        api = await async_login(
            TILE_EMAIL, TILE_PASSWORD, session, client_uuid=TILE_CLIENT_UUID
        )
        tiles = await api.async_get_tiles()
        devices = []
        for tile in tiles.values():
            devices.append(
                {
                    "uuid": tile.uuid,
                    "name": tile.name,
                    "lat": tile.latitude,
                    "lon": tile.longitude,
                    "accuracy": tile.accuracy,
                    "altitude": tile.altitude,
                    "last_timestamp": tile.last_timestamp,
                    "kind": tile.kind,
                    "dead": tile.dead,
                    "lost": tile.lost,
                    "visible": tile.visible,
                }
            )

    _tile_cache["ts"] = now
    _tile_cache["data"] = devices
    return {"devices": devices, "cached": False}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
