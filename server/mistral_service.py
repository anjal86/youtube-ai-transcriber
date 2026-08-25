from __future__ import annotations

import hashlib
import os
import time
from typing import Optional

from mistralai.client import Mistral

DEFAULT_MISTRAL_KEY = os.getenv("MISTRAL_API_KEY", "")
MISTRAL_CACHE: dict[str, str] = {}


def generate_study_notes_mistral(
    transcript_text: str,
    title: Optional[str] = None,
    api_key: Optional[str] = None,
) -> str:
    """Uses Mistral AI to transform transcript into clean JLPT study notes with free-tier rate limit protection."""
    text_hash = hashlib.sha256(transcript_text.encode()).hexdigest()
    if text_hash in MISTRAL_CACHE:
        return MISTRAL_CACHE[text_hash]

    key = api_key or DEFAULT_MISTRAL_KEY
    client = Mistral(api_key=key)

    # Budget token size: safely trim transcript if overly long
    trimmed_text = transcript_text
    if len(trimmed_text) > 10000:
        trimmed_text = trimmed_text[:10000] + "\n\n...[Transcript truncated to preserve token budget]"

    prompt = (
        "You are an expert bilingual Japanese-Nepali language editor and JLPT instructor.\n"
        "Transform the provided speech-to-text transcript into clear, comprehensive, and beautiful bilingual study notes:\n"
        "1. Convert all phonetically spelled Japanese words into proper Japanese (Kanji/Hiragana/Katakana + Romaji).\n"
        "2. Fix all Nepali spelling and grammar errors in clean Devanagari script.\n"
        "3. Extract and explain all grammar patterns covered in the lesson.\n"
        "4. Provide a structured timestamped table, example sentences, and a vocabulary breakdown.\n"
        "Format cleanly in Markdown with bold headers, bullet points, and tables."
    )

    models = ["open-mistral-nemo", "mistral-small-latest", "mistral-large-latest"]
    last_err = None

    for model_name in models:
        try:
            res = client.chat.complete(
                model=model_name,
                messages=[
                    {"role": "system", "content": prompt},
                    {
                        "role": "user",
                        "content": f"Lesson Title: {title or 'Japanese Lesson'}\n\nTranscript Content:\n{trimmed_text}",
                    },
                ],
                temperature=0.2,
                max_tokens=2500,
            )
            content = res.choices[0].message.content or ""
            if content.strip():
                if len(MISTRAL_CACHE) > 50:
                    MISTRAL_CACHE.pop(next(iter(MISTRAL_CACHE)))
                MISTRAL_CACHE[text_hash] = content.strip()
                return content.strip()
        except Exception as exc:
            last_err = exc
            time.sleep(1)
            continue

    raise RuntimeError(f"Mistral study notes generation failed: {last_err}")


def chat_with_mistral(
    messages: list[dict],
    transcript_text: str,
    title: Optional[str] = None,
    api_key: Optional[str] = None,
) -> str:
    """Answers user questions about the video using Mistral AI."""
    key = api_key or DEFAULT_MISTRAL_KEY
    client = Mistral(api_key=key)

    transcript_context = transcript_text
    if len(transcript_context) > 10000:
        transcript_context = transcript_context[:10000] + "\n...[Remaining transcript truncated for length]"

    system_instruction = (
        "You are an expert bilingual AI tutor and video study assistant. "
        "The user is asking questions about a YouTube video. "
        "Your responses MUST be grounded in the provided video transcript below. "
        "Whenever referencing points, examples, or grammar rules from the video, "
        "cite the exact timestamp in brackets like [MM:SS] (e.g. [02:15]) so the user can easily jump to it. "
        "You can respond in English, Nepali (Devanagari), or Japanese as requested. "
        "Be friendly, concise, helpful, and format your response cleanly with Markdown.\n\n"
        f"VIDEO TITLE: {title or 'YouTube Video'}\n\n"
        f"FULL VIDEO TRANSCRIPT (WITH TIMESTAMPS):\n{transcript_context}"
    )

    mistral_messages = [{"role": "system", "content": system_instruction}]
    for m in messages[-8:]:
        mistral_messages.append({"role": m["role"], "content": m["content"]})

    models = ["mistral-small-latest", "open-mistral-nemo"]
    last_err = None

    for model_name in models:
        try:
            res = client.chat.complete(
                model=model_name,
                messages=mistral_messages,
                temperature=0.3,
                max_tokens=1000,
            )
            content = res.choices[0].message.content or ""
            if content.strip():
                return content.strip()
        except Exception as exc:
            last_err = exc
            continue

    raise RuntimeError(f"Mistral chat failed: {last_err}")
