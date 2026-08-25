from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path
from typing import Callable, Optional

from google import genai
from google.genai import types


def transcribe_with_gemini(
    audio_path: Path,
    api_key: Optional[str] = None,
    progress_callback: Optional[Callable[[dict], None]] = None,
    model_name: str = "gemini-2.0-flash",
) -> dict:
    """
    Transcribes audio using Google Gemini multimodal audio API.
    Understands mixed language code-switching (e.g. Nepali + Japanese + English).
    """
    key = api_key or os.getenv("GEMINI_API_KEY")
    if not key:
        raise ValueError("Google Gemini API Key is required. Get a free key at https://aistudio.google.com/")

    client = genai.Client(api_key=key)

    if progress_callback:
        progress_callback({"type": "status", "step": "loading_model", "message": "Uploading audio to Gemini Cloud..."})

    # Upload file
    uploaded_file = client.files.upload(file=str(audio_path))

    if progress_callback:
        progress_callback({"type": "status", "step": "transcribing", "message": f"Transcribing mixed audio with {model_name}..."})

    prompt = (
        "You are an expert multilingual speech transcription system.\n"
        "Transcribe this entire audio file verbatim from start to finish.\n"
        "Context: The audio features a speaker teaching Japanese language lessons in Nepali (with mixed Japanese grammar terms and English loan words).\n"
        "Rules:\n"
        "1. Write Nepali words accurately in Devanagari script (e.g. नेपाली).\n"
        "2. Write Japanese vocabulary and phrases in standard Japanese script (Kanji/Kana) or Romaji as spoken.\n"
        "3. Write English terms cleanly in English.\n"
        "4. Output MUST be valid JSON with the following structure:\n"
        "{\n"
        '  "language": "ne",\n'
        '  "language_name": "Nepali (with Japanese & English)",\n'
        '  "segments": [\n'
        '    {"id": 0, "start": 0.0, "end": 4.5, "text": "..."},\n'
        '    {"id": 1, "start": 4.5, "end": 9.2, "text": "..."}\n'
        "  ],\n"
        '  "full_text": "..."\n'
        "}\n"
        "Ensure all segments have start and end timestamps in seconds (floats), and text contains the clean spoken dialogue."
    )

    response = client.models.generate_content(
        model=model_name,
        contents=[
            uploaded_file,
            prompt,
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.2,
        ),
    )

    # Clean up uploaded file
    try:
        client.files.delete(name=uploaded_file.name)
    except Exception:
        pass

    raw_text = response.text.strip()
    # Parse JSON
    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError:
        # If wrapped in markdown ```json ... ```
        match = re.search(r"```(?:json)?\s*(.*?)\s*```", raw_text, re.DOTALL)
        if match:
            data = json.loads(match.group(1))
        else:
            raise ValueError(f"Could not parse Gemini JSON output: {raw_text[:200]}")

    segments = []
    for idx, seg in enumerate(data.get("segments", [])):
        start = float(seg.get("start", 0.0))
        end = float(seg.get("end", start + 3.0))
        text = str(seg.get("text", "")).strip()
        if text:
            seg_dict = {
                "id": idx,
                "start": round(start, 2),
                "end": round(end, 2),
                "text": text,
            }
            segments.append(seg_dict)
            if progress_callback:
                progress_callback({
                    "type": "segment",
                    "segment": seg_dict,
                    "progress": min(95.0, round((idx + 1) / max(len(data.get("segments", [])), 1) * 100.0, 1)),
                })

    full_text = data.get("full_text") or " ".join(s["text"] for s in segments)

    return {
        "text": full_text,
        "segments": segments,
        "language": data.get("language", "ne"),
        "language_name": data.get("language_name", "Nepali (Multilingual)"),
    }
