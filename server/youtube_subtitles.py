from __future__ import annotations

import re
from typing import Optional
from urllib.parse import parse_qs, urlparse
from youtube_transcript_api import YouTubeTranscriptApi


def extract_video_id(url: str) -> Optional[str]:
    parsed = urlparse(url.strip())
    if parsed.hostname in {"youtu.be", "www.youtu.be"}:
        return parsed.path.lstrip("/")
    if "youtube.com" in (parsed.hostname or ""):
        if parsed.path == "/watch":
            return parse_qs(parsed.query).get("v", [None])[0]
        if parsed.path.startswith("/embed/"):
            return parsed.path.split("/")[2]
        if parsed.path.startswith("/v/"):
            return parsed.path.split("/")[2]
        if parsed.path.startswith("/shorts/"):
            return parsed.path.split("/")[2]
    return None


def fetch_youtube_subtitles(video_id: str, preferred_lang: Optional[str] = None) -> Optional[dict]:
    """
    Attempts to fetch official or auto-generated YouTube subtitles.
    Returns None if no transcripts are available on YouTube.
    """
    try:
        ytt = YouTubeTranscriptApi()
        transcript_list = ytt.list(video_id)

        all_transcripts = list(transcript_list)
        if not all_transcripts:
            return None

        chosen_transcript = None

        # 1. Look for preferred language (e.g. 'ne', 'ja', 'en')
        if preferred_lang:
            for t in all_transcripts:
                if t.language_code.startswith(preferred_lang.lower()):
                    chosen_transcript = t
                    break

        # 2. Look for manually created transcripts first
        if not chosen_transcript:
            for t in all_transcripts:
                if not t.is_generated:
                    chosen_transcript = t
                    break

        # 3. Fall back to the first available transcript (including auto-generated)
        if not chosen_transcript:
            chosen_transcript = all_transcripts[0]

        data = chosen_transcript.fetch()
        segments = []
        for i, item in enumerate(data):
            text = item.text if hasattr(item, "text") else item.get("text", "")
            start = item.start if hasattr(item, "start") else item.get("start", 0.0)
            duration = item.duration if hasattr(item, "duration") else item.get("duration", 0.0)
            clean_text = str(text).replace("\n", " ").strip()
            if clean_text:
                segments.append({
                    "id": i,
                    "start": round(float(start), 2),
                    "end": round(float(start + duration), 2),
                    "text": clean_text,
                })

        full_text = " ".join(s["text"] for s in segments)
        return {
            "source": "youtube_captions",
            "is_generated": chosen_transcript.is_generated,
            "language": chosen_transcript.language_code,
            "language_name": chosen_transcript.language,
            "segments": segments,
            "text": full_text,
        }
    except Exception:
        return None
