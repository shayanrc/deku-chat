"""JSON-file persistence — port of server/store.ts. Single-process in-memory
cache (run uvicorn with one worker), saved on every touch."""
import json
import os
from pathlib import Path

from . import ops
from .models import Conversation

DATA_DIR = Path(os.environ.get("DEKU_DATA_DIR", Path(__file__).parent.parent / "data"))
DB_PATH = DATA_DIR / "db.json"

_conversations: list[Conversation] = []


def load() -> None:
    global _conversations
    try:
        raw = json.loads(DB_PATH.read_text(encoding="utf-8"))
        _conversations = [Conversation.model_validate(c) for c in raw["conversations"]]
    except (OSError, ValueError, KeyError):
        _conversations = []


def save() -> None:
    from .models import dump

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    payload = {"conversations": [dump(c) for c in _conversations]}
    DB_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def list_conversations() -> list[Conversation]:
    return sorted(_conversations, key=lambda c: c.updated_at, reverse=True)


def get_conversation(conversation_id: str) -> Conversation | None:
    return next((c for c in _conversations if c.id == conversation_id), None)


def create_conversation() -> Conversation:
    conv = ops.new_conversation()
    _conversations.append(conv)
    save()
    return conv


def delete_conversation(conversation_id: str) -> bool:
    global _conversations
    before = len(_conversations)
    _conversations = [c for c in _conversations if c.id != conversation_id]
    save()
    return len(_conversations) < before


def touch(conv: Conversation) -> None:
    ops.touch(conv)
    save()
