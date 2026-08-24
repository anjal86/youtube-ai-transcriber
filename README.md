# YouTube AI Transcriber

A local-first YouTube transcription app optimized for Apple Silicon Macs. The UI is React + Vite; the local API is FastAPI; transcription runs on the Mac GPU through Apple MLX and Whisper.

## Why this stack for an M4 Pro

- **MLX Whisper** is purpose-built for Apple Silicon and uses the Apple GPU/unified-memory architecture.
- **`mlx-community/whisper-large-v3-turbo`** is the default model: strong multilingual accuracy with a much faster decoder than full `large-v3`.
- The MLX implementation keeps the loaded model cached between transcriptions, so the first run is the expensive one and later runs avoid reloading the model.
- **yt-dlp + FFmpeg** handles YouTube audio locally.
- **Node 22+** is used both by Vite and by yt-dlp's current YouTube JavaScript challenge solver, so no extra Deno runtime is necessary.
- The React app only talks to a local HTTP API, so the transcription engine can later be swapped for another MLX/custom model without rewriting the UI.

The default MLX model download is about **1.6 GB**. It is downloaded automatically on first transcription and then cached by Hugging Face.

## Model choice — August 2026

For the first working version, the default remains **Whisper large-v3-turbo on MLX**. It is the best practical balance for a YouTube product because it is multilingual, fast on Apple Silicon, and produces timestamped segments in one pass.

A strong next engine is **Qwen3-ASR 1.7B on MLX**. Current published Qwen benchmarks show it beating Whisper large-v3 on several supported multilingual datasets, and community M4 Pro implementations report roughly 3.4 GB memory for the 1.7B model. Qwen3-ASR is therefore a good future "accuracy" backend, especially for English/Japanese/Korean/Chinese and its other supported languages. For this first version it is not the default because timestamp alignment adds another model/dependency and Whisper has broader language coverage.

The backend/UI boundary is intentionally engine-agnostic so Qwen3-ASR, a custom MLX checkpoint, or another local ASR engine can be added without rebuilding the React application.

## Architecture

```text
React / Vite :5173
       |
       | /api
       v
FastAPI :8787
       |
       +--> yt-dlp + Node EJS --> temporary MP3
       |
       +--> MLX Whisper --> Apple GPU
                           |
                           +--> transcript + timestamps
```

## Requirements

- Apple Silicon Mac (M1/M2/M3/M4; this project is tuned for M4 Pro)
- macOS
- Node.js 22+
- Python 3.12 recommended
- Homebrew
- FFmpeg

## One-command local setup

```bash
git clone https://github.com/anjal86/youtube-ai-transcriber.git
cd youtube-ai-transcriber
chmod +x scripts/setup-mac.sh
./scripts/setup-mac.sh
```

Then run both services:

```bash
npm run dev:all
```

Open:

```text
http://localhost:5173
```

## Manual setup

```bash
brew install ffmpeg uv
uv venv .venv --python 3.12
uv pip install --python .venv/bin/python -r server/requirements.txt
npm install
npm run dev:all
```

`server/requirements.txt` installs `yt-dlp[default]`, which includes the external JavaScript challenge scripts currently needed for reliable YouTube extraction. The backend explicitly enables Node as yt-dlp's JavaScript runtime.

## Local models

The UI currently exposes:

- `mlx-community/whisper-large-v3-turbo` — recommended/default
- `mlx-community/whisper-large-v3-mlx` — slower, maximum Whisper quality
- a custom MLX Hugging Face model ID

You can also change the default model with:

```bash
export WHISPER_MODEL=mlx-community/whisper-large-v3-turbo
```

## API

Health check:

```bash
curl http://127.0.0.1:8787/api/health
```

Transcribe:

```bash
curl -X POST http://127.0.0.1:8787/api/transcribe \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.youtube.com/watch?v=VIDEO_ID","model":"turbo"}'
```

## Current scope

Phase 1 is deliberately local-first:

1. paste YouTube URL
2. validate metadata and reject live/over-limit videos
3. download audio locally through current yt-dlp + Node EJS support
4. transcribe with MLX Whisper
5. return segment timestamps
6. display a searchable transcript

Next phases can add Mistral summaries/Q&A, caption-first fallback, embeddings/RAG, subtitle exports, Qwen3-ASR, diarization, streaming progress, and a persistent local history database.

## Privacy

Audio and inference stay on your Mac. YouTube audio is stored only in a temporary directory during a transcription and deleted afterward. The model weights are cached locally by Hugging Face.
