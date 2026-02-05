# Copilot Instructions for AI Coding Agents

## Big Picture Architecture
- Frontend is a Vite + React SPA under [src/](src/) with entry in [src/main.tsx](src/main.tsx); dashboard section switching lives in [src/App.tsx](src/App.tsx) and pages in [src/sections/](src/sections/).
- There is a parallel Next.js-style App Router tree under [app/](app/) (e.g. [app/command-center/page.tsx](app/command-center/page.tsx)). If you edit a screen, check whether both the Vite section and the Next route need matching updates.
- Serverless API handlers live in [api/](api/): GPU detection proxy in [api/detect.ts](api/detect.ts) and Wetmet proxy endpoints in [api/wetmet/](api/wetmet/).
- Python backends:
  - GPU detection server in [gpu-server/](gpu-server/) exposes /detect locally and is surfaced to the web app via ngrok.
  - Tile tracker client library in [backend/pytile/](backend/pytile/) is an async aiohttp-based package.

## Critical Workflows
- Frontend dev/build/preview use Vite scripts in [package.json](package.json): npm run dev | build | preview.
- GPU detection backend: follow [gpu-server/README.md](gpu-server/README.md) to create a venv, install requirements, run python server.py, then expose via ngrok.
- pytile usage and async patterns are documented in [backend/pytile/README.md](backend/pytile/README.md).

## Project-Specific Conventions
- Section navigation uses React state in `App` in [src/App.tsx](src/App.tsx); new sections typically live in [src/sections/](src/sections/).
- Prefer Radix-based primitives in [components/ui/](components/ui/) for UI building blocks; Tailwind is the styling layer.
- Wetmet HLS playlists are rewritten so segment fetches stay on the proxy; see [api/wetmet/proxy.ts](api/wetmet/proxy.ts) and dev middleware in [vite.config.ts](vite.config.ts).

## Integration Points & Env
- GPU detection: [api/detect.ts](api/detect.ts) forwards multipart JPEG frames to GPU_DETECT_URL and passes x-api-key when GPU_DETECT_TOKEN is set.
- Wetmet proxy exists in both serverless handlers [api/wetmet/](api/wetmet/) and Vite dev middleware in [vite.config.ts](vite.config.ts) for local parity.
- PWA configuration (manifest, assets) is owned by [vite.config.ts](vite.config.ts) and public assets under [public/](public/).
