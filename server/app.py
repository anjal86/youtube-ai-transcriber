from __future__ import annotations

import os
import platform
import tempfile
import threading
import time
from pathlib import Path
from urllib.parse import urlparse

import mlx_whisper
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from yt_dlp import YoutubeDL

DEFAULT_MODEL = os.getenv("WHISPER_MODEL", "mlx-community/whisper-large-v3-turbo")
MAX_VIDEO_SECONDS = int(os.getenv("MAX_VIDEO_SECONDS", "10800"))

MODEL_PRESETS = {
    "turbo": "mlx-community/whisper-large-v3-turbo",
    "accurate": "mlx-community/whisper-large-v3-mlx",
}

# MLX model execution is intentionally serialized for phase 1. Running multiple
# large Whisper jobs simultaneously on unified memory hurts latency and can
# create memory pressure on laptops.
INFERENCE_LOCK = threading.Lock()

app = FastAPI(title="YouTube AI Transcriber", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class TranscribeRequest(BaseModel):
    url: str = Field(min_length=10, max_length=2048)
    model: str = Field(default="turbo", min_length=2, max_length=200)

    @field_validator("url")
    @classmethod
    def validate_youtube_url(cls, value: str) -> str:
        parsed = urlparse(value.strip())
        host = (parsed.hostname or "").lower()
        allowed_hosts = {
            "youtube.com",
            "www.youtube.com",
            "m.youtube.com",
            "music.youtube.com",
            "youtu.be",
            "www.youtu.be",
            "youtube-nocookie.com",
            "www.youtube-nocookie.com",
        }
        if parsed.scheme not in {"http", "https"} or host not in allowed_hosts:
            raise ValueError("Please provide a valid YouTube URL.")
        return value.strip()


@app.get("/api/health")
def health() -> dict:
    return {
        "ok": True,
        "platform": f"{platform.system()} {platform.machine()}",
        "default_model": DEFAULT_MODEL,
    }


def _resolve_model(requested: str) -> str:
    requested = requested.strip()
    if requested in MODEL_PRESETS:
        return MODEL_PRESETS[requested]

    # Custom models are deliberately limited to Hugging Face-style IDs for now.
    # Local filesystem model loading can be added later with an explicit path allowlist.
    if "/" not in requested or requested.startswith(("/", ".")):
        raise HTTPException(status_code=400, detail="Custom model must be a Hugging Face model ID such as mlx-community/whisper-large-v3-turbo.")
    return requested


def _download_audio(url: str, workdir: Path) -> tuple[Path, dict]:
    # First fetch metadata without downloading so an accidental playlist or very
    # long video does not start a large transfer.
    metadata_options = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "skip_download": True,
    }
    with YoutubeDL(metadata_options) as ydl:
        info = ydl.extract_info(url, download=False)

    duration = int(info.get("duration") or 0)
    if duration and duration > MAX_VIDEO_SECONDS:
        raise HTTPException(
            status_code=400,
            detail=f"Video is {duration // 60} minutes long. The current local limit is {MAX_VIDEO_SECONDS // 60} minutes.",
        )

    output_template = str(workdir / "source.%(ext)s")
    download_options = {
        "format": "bestaudio/best",
        "outtmpl": output_template,
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "128",
            }
        ],
    }

    with YoutubeDL(download_options) as ydl:
        downloaded_info = ydl.extract_info(url, download=True)

    audio_path = workdir / "source.mp3"
    if not audio_path.exists():
        matches = list(workdir.glob("source.*"))
        if not matches:
            raise RuntimeError("yt-dlp finished but no audio file was produced.")
        audio_path = matches[0]

    merged_info = {**info, **(downloaded_info or {})}
    return audio_path, merged_info


def _clean_segments(raw_segments: list[dict]) -> list[dict]:
    cleaned = []
    for index, segment in enumerate(raw_segments):
        text = str(segment.get("text") or "").strip()
        if not text:
            continue
        cleaned.append(
            {
                "id": int(segment.get("id", index)),
                "start": float(segment.get("start", 0.0)),
                "end": float(segment.get("end", 0.0)),
                "text": text,
            }
        )
    return cleaned


@app.post("/api/transcribe")
def transcribe_video(payload: TranscribeRequest) -> dict:
    model_id = _resolve_model(payload.model)
    started = time.perf_counter()

    try:
        with tempfile.TemporaryDirectory(prefix="localscribe-") as temp_dir:
            audio_path, info = _download_audio(payload.url, Path(temp_dir))

            with INFERENCE_LOCK:
                result = mlx_whisper.transcribe(
                    str(audio_path),
                    path_or_hf_repo=model_id,
                    verbose=False,
                    word_timestamps=False,
                    condition_on_previous_text=True,
                )

        segments = _clean_segments(result.get("segments", []))
        return {
            "video": {
                "id": str(info.get("id") or ""),
                "title": str(info.get("title") or "Untitled YouTube video"),
                "uploader": info.get("uploader") or info.get("channel"),
                "duration": info.get("duration"),
                "thumbnail": info.get("thumbnail"),
                "webpage_url": info.get("webpage_url") or payload.url,
            },
            "text": str(result.get("text") or "").strip(),
            "segments": segments,
            "language": result.get("language"),
            "model": model_id,
            "processing_seconds": round(time.perf_counter() - started, 3),
        }
    except HTTPException:
        raise
    except Exception as exc:
        message = str(exc).strip() or exc.__class__.__name__
        raise HTTPException(status_code=500, detail=f"Local transcription failed: {message}") from exc
