from __future__ import annotations

import hashlib
import os
import re
import subprocess
import time
from pathlib import Path
from typing import Callable, Optional

import groq

# In-memory LRU cache to prevent duplicate API calls and save Groq free tier tokens
TRANSCRIPTION_CACHE: dict[str, dict] = {}
REFINE_CACHE: dict[str, str] = {}


def _get_cache_key(audio_path: Path, model_name: str, language: Optional[str]) -> str:
    stat = audio_path.stat()
    raw = f"{audio_path.name}:{stat.st_size}:{model_name}:{language}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _ensure_file_size_under_limit(audio_path: Path, max_bytes: int = 24 * 1024 * 1024) -> Path:
    """If the file exceeds 24MB, compress to 48kbps mono MP3 using ffmpeg to comply with Groq limits."""
    if audio_path.stat().st_size <= max_bytes:
        return audio_path

    compressed_path = audio_path.with_name("compressed_audio.mp3")
    cmd = [
        "ffmpeg", "-y", "-i", str(audio_path),
        "-vn", "-ar", "16000", "-ac", "1", "-b:a", "48k",
        str(compressed_path)
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    return compressed_path


def transcribe_with_groq(
    audio_path: Path,
    api_key: Optional[str] = None,
    language: Optional[str] = None,
    model_name: str = "whisper-large-v3",
    progress_callback: Optional[Callable[[dict], None]] = None,
    max_retries: int = 3,
) -> dict:
    """
    Ultra-fast cloud transcription via Groq Cloud Whisper API with rate-limit protection and retries.
    """
    cache_key = _get_cache_key(audio_path, model_name, language)
    if cache_key in TRANSCRIPTION_CACHE:
        cached = TRANSCRIPTION_CACHE[cache_key]
        if progress_callback:
            progress_callback({"type": "status", "step": "transcribing", "message": "Loaded from cache (0 Groq tokens used)!"})
            for seg in cached["segments"]:
                progress_callback({"type": "segment", "segment": seg, "progress": 100.0})
        return cached

    key = api_key or os.getenv("GROQ_API_KEY", "")
    client = groq.Groq(api_key=key, max_retries=1)

    if progress_callback:
        progress_callback({"type": "status", "step": "loading_model", "message": "Preparing audio for Groq LPU Cloud..."})

    processed_audio = _ensure_file_size_under_limit(audio_path)

    if progress_callback:
        progress_callback({"type": "status", "step": "transcribing", "message": f"Transcribing audio with Groq {model_name}..."})

    # Optimized bilingual code-switching prompt to prime Whisper's vocabulary for Japanese + Nepali
    prompt = (
        "JLPT N3 N4 N5 Grammar Lesson, Minna no Nihongo, Japanese lesson in Nepali. "
        "नेपालीमा जापानी भाषा व्याख्या। "
        "Kanji, Hiragana, Katakana, Romaji, Sensei, Tashikani, Naruhodo, Dekireba, "
        "例文, 文法, という, について, と言います, わけではない, ようにする。"
    )

    with open(processed_audio, "rb") as f:
        file_bytes = f.read()

    transcription = None
    last_err = None

    for attempt in range(max_retries):
        try:
            transcription = client.audio.transcriptions.create(
                file=(processed_audio.name, file_bytes),
                model=model_name,
                response_format="verbose_json",
                language=language.lower() if language else None,
                prompt=prompt,
                temperature=0.0,
            )
            break
        except groq.RateLimitError as err:
            last_err = err
            wait_seconds = min(20, (2 ** attempt) * 2 + 1)
            if progress_callback:
                progress_callback({
                    "type": "status",
                    "step": "transcribing",
                    "message": f"Free tier rate limit reached. Waiting {wait_seconds}s before auto-retrying...",
                })
            time.sleep(wait_seconds)
        except Exception as err:
            last_err = err
            break

    if transcription is None:
        raise RuntimeError(f"Groq transcription rate limit or error: {last_err}")

    raw_segments = getattr(transcription, "segments", []) or []
    cleaned_segments = []
    seen_texts: dict[str, int] = {}

    for idx, seg in enumerate(raw_segments):
        start = float(seg.get("start") if isinstance(seg, dict) else getattr(seg, "start", 0.0))
        end = float(seg.get("end") if isinstance(seg, dict) else getattr(seg, "end", start + 2.0))
        text = str(seg.get("text") if isinstance(seg, dict) else getattr(seg, "text", "")).strip()

        # Filter out repetitive hallucination loops (e.g. repeated prompt artifacts or single phrase loops)
        if not text or len(text) < 2:
            continue
        
        # Track frequency of exact text to drop spam loops (> 3 occurrences of short phrases)
        norm_text = text.lower()
        seen_texts[norm_text] = seen_texts.get(norm_text, 0) + 1
        if seen_texts[norm_text] > 3 and len(text) < 40:
            continue

        seg_dict = {
            "id": len(cleaned_segments),
            "start": round(start, 2),
            "end": round(end, 2),
            "text": text,
        }
        cleaned_segments.append(seg_dict)
        if progress_callback:
            progress_callback({
                "type": "segment",
                "segment": seg_dict,
                "progress": min(98.0, round((idx + 1) / max(len(raw_segments), 1) * 100.0, 1)),
            })

    full_text = getattr(transcription, "text", "") or " ".join(s["text"] for s in cleaned_segments)
    detected_lang = getattr(transcription, "language", language or "ne")

    result = {
        "text": full_text.strip(),
        "segments": cleaned_segments,
        "language": detected_lang,
        "language_name": f"{detected_lang.upper()} (Groq Whisper)",
    }

    # Store in memory cache (up to 50 items)
    if len(TRANSCRIPTION_CACHE) > 50:
        TRANSCRIPTION_CACHE.pop(next(iter(TRANSCRIPTION_CACHE)))
    TRANSCRIPTION_CACHE[cache_key] = result

    return result


def refine_notes_with_groq(
    transcript_text: str,
    title: Optional[str] = None,
    api_key: Optional[str] = None,
    max_retries: int = 3,
) -> str:
    """
    Refines transcript into JLPT study notes with token budgeting, model fallbacks, and rate-limit backoff.
    """
    text_hash = hashlib.sha256(transcript_text.encode()).hexdigest()
    if text_hash in REFINE_CACHE:
        return REFINE_CACHE[text_hash]

    key = api_key or os.getenv("GROQ_API_KEY", "")
    client = groq.Groq(api_key=key, max_retries=1)

    prompt = (
        "You are an expert bilingual Japanese-Nepali language editor and JLPT instructor.\n"
        "The user has provided an Automatic Speech Recognition transcript of a Japanese lesson taught in Nepali.\n"
        "Transform this transcript into clear, comprehensive, and beautiful bilingual study notes:\n"
        "1. Convert all phonetically spelled Japanese words into proper Japanese (Kanji/Hiragana/Katakana + Romaji).\n"
        "2. Fix all Nepali spelling and grammar errors in clean Devanagari script.\n"
        "3. Extract and explain all grammar patterns covered in the lesson (e.g. Noun 1 は Noun 2 について, 〜ても, 〜じゃなくて).\n"
        "4. Provide a structured timestamped table, example sentences, and a vocabulary breakdown.\n"
        "Format cleanly in Markdown with bold headers, bullet points, and tables."
    )

    # Budget token size: safely trim transcript if overly long to stay within TPM quotas
    trimmed_text = transcript_text
    if len(trimmed_text) > 10000:
        trimmed_text = trimmed_text[:10000] + "\n\n...[Transcript truncated to preserve token budget]"

    # Prioritize models with high token throughput and clean Markdown generation
    candidate_models = ["groq/compound-mini", "groq/compound", "allam-2-7b"]
    last_err = None

    for model_name in candidate_models:
        for attempt in range(max_retries):
            try:
                response = client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": prompt},
                        {
                            "role": "user",
                            "content": f"Lesson: {title or 'Japanese Lesson'}\n\nTranscript Content:\n{trimmed_text}",
                        },
                    ],
                    temperature=0.2,
                    max_tokens=2500,
                )
                raw_content = response.choices[0].message.content or ""
                cleaned_content = re.sub(r"<think>.*?</think>", "", raw_content, flags=re.DOTALL).strip()

                # Cache notes
                if len(REFINE_CACHE) > 50:
                    REFINE_CACHE.pop(next(iter(REFINE_CACHE)))
                REFINE_CACHE[text_hash] = cleaned_content
                return cleaned_content
            except groq.RateLimitError as err:
                last_err = err
                time.sleep(min(15, (attempt + 1) * 3))
                continue
            except Exception as exc:
                last_err = exc
                break  # try next model

    raise RuntimeError(f"Could not generate notes within rate limits: {last_err}")
