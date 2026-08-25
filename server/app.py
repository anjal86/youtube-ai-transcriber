from __future__ import annotations

import json
import os
import platform
import queue
import tempfile
import threading
import time
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
from yt_dlp import YoutubeDL

from server.gemini_transcriber import transcribe_with_gemini
from server.groq_transcriber import transcribe_with_groq
from server.youtube_subtitles import extract_video_id, fetch_youtube_subtitles

DEFAULT_GROQ_KEY = os.getenv("GROQ_API_KEY", "")
MAX_VIDEO_SECONDS = int(os.getenv("MAX_VIDEO_SECONDS", "10800"))

YTDLP_COMMON_OPTIONS = {
    "quiet": True,
    "no_warnings": True,
    "noplaylist": True,
    "js_runtimes": {"node": {}},
}

app = FastAPI(title="YouTube AI Transcriber", version="0.7.0")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TranscribeRequest(BaseModel):
    url: str = Field(min_length=10, max_length=2048)
    engine: str = Field(default="groq")
    model: str = Field(default="whisper-large-v3", min_length=2, max_length=200)
    language: Optional[str] = Field(default=None, max_length=50)
    groq_api_key: Optional[str] = Field(default=None, max_length=256)
    gemini_api_key: Optional[str] = Field(default=None, max_length=256)

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


class RefineRequest(BaseModel):
    text: str = Field(min_length=1)
    title: Optional[str] = None
    groq_api_key: Optional[str] = None


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant|system)$")
    content: str = Field(min_length=1)


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    transcript: str = Field(min_length=1)
    title: Optional[str] = None
    groq_api_key: Optional[str] = None


@app.get("/api/health")
def health() -> dict:
    return {
        "ok": True,
        "platform": f"{platform.system()} {platform.machine()}",
        "default_model": "whisper-large-v3",
        "youtube_js_runtime": "node",
        "groq_supported": True,
        "gemini_supported": True,
        "youtube_captions_supported": True,
    }


def _download_audio(url: str, workdir: Path, progress_callback=None) -> tuple[Path, dict]:
    if progress_callback:
        progress_callback({"type": "status", "step": "metadata", "message": "Fetching video details from YouTube..."})

    metadata_options = {
        **YTDLP_COMMON_OPTIONS,
        "skip_download": True,
    }
    with YoutubeDL(metadata_options) as ydl:
        info = ydl.extract_info(url, download=False)

    if info.get("is_live"):
        raise HTTPException(status_code=400, detail="Live streams are not supported yet. Use a finished YouTube video.")

    duration = int(info.get("duration") or 0)
    if duration and duration > MAX_VIDEO_SECONDS:
        raise HTTPException(
            status_code=400,
            detail=f"Video is {duration // 60} minutes long. The current local limit is {MAX_VIDEO_SECONDS // 60} minutes.",
        )

    video_meta = {
        "id": str(info.get("id") or ""),
        "title": str(info.get("title") or "Untitled YouTube video"),
        "uploader": info.get("uploader") or info.get("channel"),
        "duration": info.get("duration"),
        "thumbnail": info.get("thumbnail"),
        "webpage_url": info.get("webpage_url") or url,
    }

    if progress_callback:
        progress_callback({"type": "metadata", "video": video_meta})
        progress_callback({"type": "status", "step": "downloading", "message": "Downloading audio stream..."})

    def ytdl_hook(d):
        if not progress_callback:
            return
        if d.get("status") == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            downloaded = d.get("downloaded_bytes") or 0
            speed = d.get("speed") or 0
            pct = round((downloaded / total * 100), 1) if total else 0
            speed_mb = round(speed / (1024 * 1024), 2) if speed else 0
            progress_callback({
                "type": "status",
                "step": "downloading",
                "message": f"Downloading audio ({pct}% at {speed_mb} MB/s)...",
                "download_percent": pct,
            })
        elif d.get("status") == "finished":
            progress_callback({"type": "status", "step": "converting", "message": "Extracting audio format..."})

    output_template = str(workdir / "source.%(ext)s")
    download_options = {
        **YTDLP_COMMON_OPTIONS,
        "format": "bestaudio/best",
        "outtmpl": output_template,
        "progress_hooks": [ytdl_hook],
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


@app.post("/api/transcribe/stream")
def transcribe_video_stream(payload: TranscribeRequest):
    def event_stream():
        event_queue: queue.Queue[dict | None] = queue.Queue()

        def worker():
            started = time.perf_counter()
            try:
                video_id = extract_video_id(payload.url)

                # 1. Direct YouTube Captions check if engine is "youtube"
                if payload.engine == "youtube" and video_id:
                    event_queue.put({"type": "status", "step": "metadata", "message": "Checking official YouTube subtitles..."})
                    yt_subtitles = fetch_youtube_subtitles(video_id, preferred_lang=payload.language)
                    if yt_subtitles and yt_subtitles.get("segments"):
                        with YoutubeDL({"quiet": True, "no_warnings": True, "skip_download": True}) as ydl:
                            info = ydl.extract_info(payload.url, download=False)

                        video_meta = {
                            "id": str(info.get("id") or video_id),
                            "title": str(info.get("title") or "Untitled YouTube video"),
                            "uploader": info.get("uploader") or info.get("channel"),
                            "duration": info.get("duration"),
                            "thumbnail": info.get("thumbnail"),
                            "webpage_url": info.get("webpage_url") or payload.url,
                        }
                        event_queue.put({"type": "metadata", "video": video_meta})

                        for seg in yt_subtitles["segments"]:
                            event_queue.put({"type": "segment", "segment": seg, "progress": 100.0})

                        final_payload = {
                            "type": "done",
                            "id": video_meta.get("id") or video_id,
                            "url": payload.url,
                            "video": video_meta,
                            "text": yt_subtitles["text"],
                            "segments": yt_subtitles["segments"],
                            "language": yt_subtitles["language"],
                            "language_name": f"{yt_subtitles['language_name']} (YouTube Captions)",
                            "model": "YouTube Captions",
                            "processing_seconds": round(time.perf_counter() - started, 3),
                            "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        }
                        try:
                            save_history_item(final_payload)
                        except Exception:
                            pass

                        event_queue.put(final_payload)
                        return
                    else:
                        event_queue.put({
                            "type": "status",
                            "step": "fallback",
                            "message": "No YouTube subtitles found. Automatically transcribing audio with Groq Whisper AI...",
                        })

                # 2. Download audio for AI Processing
                def cb(ev: dict):
                    event_queue.put(ev)

                with tempfile.TemporaryDirectory(prefix="localscribe-") as temp_dir:
                    audio_path, info = _download_audio(payload.url, Path(temp_dir), progress_callback=cb)

                    video_meta = {
                        "id": str(info.get("id") or ""),
                        "title": str(info.get("title") or "Untitled YouTube video"),
                        "uploader": info.get("uploader") or info.get("channel"),
                        "duration": info.get("duration"),
                        "thumbnail": info.get("thumbnail"),
                        "webpage_url": info.get("webpage_url") or payload.url,
                    }

                    # Gemini Multimodal AI Engine
                    if payload.engine == "gemini":
                        result = transcribe_with_gemini(
                            audio_path=audio_path,
                            api_key=payload.gemini_api_key,
                            progress_callback=cb,
                        )
                        engine_name = "Google Gemini 2.0 Flash"

                    # Groq Cloud Whisper Engine (Default)
                    else:
                        groq_key = payload.groq_api_key or DEFAULT_GROQ_KEY
                        groq_model = payload.model if payload.model in {"whisper-large-v3", "whisper-large-v3-turbo"} else "whisper-large-v3"
                        result = transcribe_with_groq(
                            audio_path=audio_path,
                            api_key=groq_key,
                            language=payload.language,
                            model_name=groq_model,
                            progress_callback=cb,
                        )
                        engine_name = f"Groq ({groq_model})"

                final_payload = {
                    "type": "done",
                    "id": video_meta.get("id") or str(int(time.time())),
                    "url": payload.url,
                    "video": video_meta,
                    "text": result["text"],
                    "segments": result["segments"],
                    "language": result["language"],
                    "language_name": result.get("language_name", result["language"]),
                    "model": engine_name,
                    "processing_seconds": round(time.perf_counter() - started, 3),
                    "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                }
                try:
                    save_history_item(final_payload)
                except Exception:
                    pass

                event_queue.put(final_payload)
            except Exception as exc:
                message = str(exc).strip() or exc.__class__.__name__
                event_queue.put({"type": "error", "message": message})
            finally:
                event_queue.put(None)

        worker_thread = threading.Thread(target=worker, daemon=True)
        worker_thread.start()

        while True:
            item = event_queue.get()
            if item is None:
                break
            event_name = item.get("type", "message")
            yield f"event: {event_name}\ndata: {json.dumps(item)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


from server.groq_transcriber import refine_notes_with_groq, transcribe_with_groq
from server.history_store import (
    clear_all_history,
    delete_history_item,
    get_all_history,
    save_history_item,
    update_history_study_notes,
)
from server.mistral_service import chat_with_mistral, generate_study_notes_mistral


@app.get("/api/history")
def get_history():
    return {"items": get_all_history()}


@app.post("/api/history")
def save_history(payload: dict):
    saved = save_history_item(payload)
    return {"ok": True, "item": saved}


@app.delete("/api/history/{item_id}")
def delete_history(item_id: str):
    deleted = delete_history_item(item_id)
    return {"ok": deleted}


@app.delete("/api/history")
def clear_history():
    clear_all_history()
    return {"ok": True}


@app.post("/api/refine")
def refine_transcript(payload: RefineRequest) -> dict:
    """Generates structured JLPT study notes using Mistral AI (with Groq fallback)."""
    notes = None
    try:
        notes = generate_study_notes_mistral(
            transcript_text=payload.text,
            title=payload.title,
        )
    except Exception:
        # Fallback to Groq if Mistral is unreachable
        try:
            notes = refine_notes_with_groq(
                transcript_text=payload.text,
                title=payload.title,
                api_key=payload.groq_api_key or DEFAULT_GROQ_KEY,
            )
        except Exception as exc:
            message = str(exc).strip() or exc.__class__.__name__
            raise HTTPException(status_code=500, detail=f"AI refinement failed: {message}") from exc

    if payload.title and notes:
        update_history_study_notes(payload.title, notes)
    return {"notes": notes}


@app.post("/api/chat")
def chat_with_transcript(payload: ChatRequest) -> dict:
    """Answers questions specifically grounded in the video transcript using Mistral AI (with Groq fallback)."""
    try:
        reply = chat_with_mistral(
            messages=[{"role": m.role, "content": m.content} for m in payload.messages],
            transcript_text=payload.transcript,
            title=payload.title,
        )
        return {"reply": reply}
    except Exception:
        # Fallback to Groq
        import re
        import groq

        key = payload.groq_api_key or DEFAULT_GROQ_KEY
        client = groq.Groq(api_key=key, max_retries=1)

        transcript_context = payload.transcript[:10000]
        system_instruction = (
            "You are an expert bilingual AI tutor and video study assistant. "
            "Your responses MUST be grounded in the provided video transcript. "
            "Cite timestamps in brackets like [MM:SS] (e.g. [02:15]). "
            "You can respond in English, Nepali (Devanagari), or Japanese as requested.\n\n"
            f"VIDEO TITLE: {payload.title or 'YouTube Video'}\n\n"
            f"TRANSCRIPT:\n{transcript_context}"
        )

        groq_messages = [{"role": "system", "content": system_instruction}]
        for m in payload.messages[-8:]:
            groq_messages.append({"role": m.role, "content": m.content})

        try:
            response = client.chat.completions.create(
                model="groq/compound-mini",
                messages=groq_messages,
                temperature=0.3,
                max_tokens=1000,
            )
            content = response.choices[0].message.content or ""
            content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
            return {"reply": content}
        except Exception as exc:
            message = str(exc).strip() or exc.__class__.__name__
            raise HTTPException(status_code=500, detail=f"Chat failed: {message}") from exc
