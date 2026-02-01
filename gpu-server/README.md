# GPU Detection Server (WSL + ngrok)

This server runs on your home PC (WSL) and exposes a `/detect` endpoint for the Vercel app.

## 1) WSL setup

Install Python 3.10+ and NVIDIA GPU support for WSL.

```bash
sudo apt update
sudo apt install -y python3-venv
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 2) Run the server

```bash
export GPU_DETECT_TOKEN="your-optional-token"
export YOLO_MODEL="yolov8l.pt"
python server.py
```

The server listens on `http://0.0.0.0:8000/detect`.

## 3) Expose with ngrok

```bash
ngrok http 8000
```

Copy the HTTPS forwarding URL, e.g.:

```
https://abcd-1234.ngrok-free.app
```

Your detect endpoint will be:

```
https://abcd-1234.ngrok-free.app/detect
```

## 4) Configure Vercel env vars

Set these in Vercel project settings:

- `GPU_DETECT_URL` = `https://abcd-1234.ngrok-free.app/detect`
- `GPU_DETECT_TOKEN` = `your-optional-token`
- `VITE_USE_SERVER_DETECTION` = `true`

Redeploy after setting env vars.
