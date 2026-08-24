#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This setup script is intended for macOS."
  exit 1
fi

if [[ "$(uname -m)" != "arm64" ]]; then
  echo "MLX requires Apple Silicon (arm64)."
  exit 1
fi

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is required: https://brew.sh"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22+ is required. Install it before continuing."
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Installing FFmpeg…"
  brew install ffmpeg
fi

if ! command -v uv >/dev/null 2>&1; then
  echo "Installing uv…"
  brew install uv
fi

echo "Creating Python 3.12 environment…"
uv venv .venv --python 3.12

echo "Installing local transcription backend…"
uv pip install --python .venv/bin/python -r server/requirements.txt

echo "Installing React app…"
npm install

echo
printf '%s\n' "Setup complete." "Run: npm run dev:all" "Open: http://localhost:5173" "The first transcription downloads the selected MLX model once."
