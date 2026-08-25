from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any, Optional

HISTORY_DIR = Path("data")
HISTORY_FILE = HISTORY_DIR / "transcription_history.json"
HISTORY_LOCK = threading.RLock()


def _ensure_history_file() -> None:
    HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    if not HISTORY_FILE.exists():
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump([], f, indent=2)


def _read_history_unlocked() -> list[dict[str, Any]]:
    _ensure_history_file()
    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                return data
            return []
    except Exception:
        return []


def get_all_history() -> list[dict[str, Any]]:
    with HISTORY_LOCK:
        return _read_history_unlocked()


def save_history_item(item: dict[str, Any]) -> dict[str, Any]:
    with HISTORY_LOCK:
        history = _read_history_unlocked()
        
        # Check if item with same video.id or url already exists, update if so
        item_id = str(item.get("id") or item.get("video", {}).get("id") or len(history) + 1)
        item["id"] = item_id

        # Remove existing if present to move to top
        history = [h for h in history if str(h.get("id")) != item_id and str(h.get("video", {}).get("id")) != item_id]
        
        # Prepend new item (newest first)
        history.insert(0, item)

        # Keep up to 200 items in history
        history = history[:200]

        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(history, f, ensure_ascii=False, indent=2)

        return item


def update_history_study_notes(item_id: str, study_notes: str) -> bool:
    with HISTORY_LOCK:
        history = _read_history_unlocked()
        updated = False
        for h in history:
            if str(h.get("id")) == str(item_id) or str(h.get("video", {}).get("id")) == str(item_id) or h.get("video", {}).get("title") == str(item_id):
                h["studyNotes"] = study_notes
                updated = True
                break

        if updated:
            with open(HISTORY_FILE, "w", encoding="utf-8") as f:
                json.dump(history, f, ensure_ascii=False, indent=2)
        return updated


def delete_history_item(item_id: str) -> bool:
    with HISTORY_LOCK:
        history = _read_history_unlocked()
        initial_len = len(history)
        history = [h for h in history if str(h.get("id")) != str(item_id) and str(h.get("video", {}).get("id")) != str(item_id)]
        
        if len(history) != initial_len:
            with open(HISTORY_FILE, "w", encoding="utf-8") as f:
                json.dump(history, f, ensure_ascii=False, indent=2)
            return True
        return False


def clear_all_history() -> None:
    with HISTORY_LOCK:
        _ensure_history_file()
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump([], f, indent=2)

