"""FastAPI port of server/index.ts — same routes, same JSON shapes, same NDJSON
chat stream, so the frontend cannot tell this backend from the Express one."""
import asyncio
import json
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from . import ops, store
from .agent import run_agent, summarize_messages
from .config import SYSTEM_PROMPT, capability_infos, provider_infos
from .models import Conversation, dump

load_dotenv()
store.load()

app = FastAPI(title="deku-server")


def _json(payload, status: int = 200) -> JSONResponse:
    return JSONResponse(payload, status_code=status)


def _conv_or_404(conversation_id: str) -> Conversation | JSONResponse:
    conv = store.get_conversation(conversation_id)
    if conv is None:
        return _json({"error": "conversation not found"}, 404)
    return conv


def _line(payload: dict) -> str:
    return json.dumps(payload, ensure_ascii=False) + "\n"


@app.get("/api/meta")
def meta():
    return _json({
        "providers": provider_infos(),
        "capabilities": capability_infos(),
        "systemPromptTokens": ops.estimate_tokens(SYSTEM_PROMPT),
    })


@app.get("/api/conversations")
def list_conversations():
    return _json([dump(ops.to_summary(c)) for c in store.list_conversations()])


@app.post("/api/conversations")
def create_conversation():
    return _json(dump(store.create_conversation()))


@app.get("/api/conversations/{conversation_id}")
def get_conversation(conversation_id: str):
    conv = _conv_or_404(conversation_id)
    if isinstance(conv, JSONResponse):
        return conv
    return _json(dump(conv))


@app.patch("/api/conversations/{conversation_id}")
async def rename_conversation(conversation_id: str, request: Request):
    conv = _conv_or_404(conversation_id)
    if isinstance(conv, JSONResponse):
        return conv
    body = await request.json()
    title = str(body.get("title") or "").strip()[:80]
    if title:
        conv.title = title
    store.touch(conv)
    return _json(dump(conv))


@app.delete("/api/conversations/{conversation_id}")
def delete_conversation(conversation_id: str):
    if not store.delete_conversation(conversation_id):
        return _json({"error": "conversation not found"}, 404)
    return _json({"ok": True})


@app.post("/api/conversations/{conversation_id}/activate")
async def activate(conversation_id: str, request: Request):
    conv = _conv_or_404(conversation_id)
    if isinstance(conv, JSONResponse):
        return conv
    body = await request.json()
    branch = ops.get_branch(conv, body.get("branchId"))
    if branch is None:
        return _json({"error": "branch not found"}, 404)
    conv.active_branch_id = branch.id
    store.touch(conv)
    return _json(dump(conv))


@app.post("/api/conversations/{conversation_id}/branch")
async def branch(conversation_id: str, request: Request):
    conv = _conv_or_404(conversation_id)
    if isinstance(conv, JSONResponse):
        return conv
    body = await request.json()
    from_branch = ops.get_branch(conv, body.get("branchId") or conv.active_branch_id)
    if from_branch is None:
        return _json({"error": "branch not found"}, 404)
    new_branch = ops.fork_branch(
        conv, from_branch, body.get("messageId"), body.get("name") or ops.next_name(conv, "Branch")
    )
    conv.active_branch_id = new_branch.id
    store.touch(conv)
    return _json(dump(conv))


@app.post("/api/conversations/{conversation_id}/rewind")
async def rewind(conversation_id: str, request: Request):
    conv = _conv_or_404(conversation_id)
    if isinstance(conv, JSONResponse):
        return conv
    body = await request.json()
    from_branch = ops.get_branch(conv, body.get("branchId"))
    if from_branch is None:
        return _json({"error": "branch not found"}, 404)
    new_branch = ops.fork_branch(conv, from_branch, body.get("messageId"), ops.next_name(conv, "Rewind"))
    conv.active_branch_id = new_branch.id
    store.touch(conv)
    return _json(dump(conv))


@app.post("/api/conversations/{conversation_id}/combine")
async def combine(conversation_id: str, request: Request):
    conv = _conv_or_404(conversation_id)
    if isinstance(conv, JSONResponse):
        return conv
    body = await request.json()
    try:
        ops.combine_branches(conv, body.get("sourceBranchId"), body.get("targetBranchId"))
    except ValueError:
        return _json({"error": "bad branches"}, 400)
    store.touch(conv)
    return _json(dump(conv))


@app.post("/api/conversations/{conversation_id}/summarize")
async def summarize(conversation_id: str, request: Request):
    conv = _conv_or_404(conversation_id)
    if isinstance(conv, JSONResponse):
        return conv
    body = await request.json()
    branch = ops.get_branch(conv, body.get("branchId"))
    if branch is None:
        return _json({"error": "branch not found"}, 404)
    ids = [m.id for m in branch.messages]
    from_id, to_id = body.get("fromId"), body.get("toId")
    if from_id not in ids or to_id not in ids or ids.index(from_id) > ids.index(to_id):
        return _json({"error": "bad range"}, 400)
    lo, hi = ids.index(from_id), ids.index(to_id)
    content = await summarize_messages(
        body.get("provider"), body.get("model"), branch.messages[lo : hi + 1], body.get("apiKeys") or {}
    )
    ops.splice_summary(branch, from_id, to_id, content)
    store.touch(conv)
    return _json(dump(conv))


@app.post("/api/conversations/{conversation_id}/chat")
async def chat(conversation_id: str, request: Request):
    conv = _conv_or_404(conversation_id)
    if isinstance(conv, JSONResponse):
        return conv
    body = await request.json()
    branch = ops.get_branch(conv, body.get("branchId"))
    if branch is None:
        return _json({"error": "branch not found"}, 404)
    content = body.get("content") or ""
    provider, model = body.get("provider"), body.get("model")
    capabilities = body.get("capabilities") or []
    api_keys = body.get("apiKeys") or {}

    async def gen():
        user_msg = ops.make_msg("user", content)
        branch.messages.append(user_msg)
        if conv.title == "New chat":
            conv.title = content[:48] + ("…" if len(content) > 48 else "")
        store.touch(conv)
        yield _line({"type": "user", "message": dump(user_msg)})

        assistant = ops.make_msg("assistant", "")
        assistant.tool_events = []
        try:
            async for ev in run_agent(provider, model, capabilities, branch.messages, api_keys):
                if ev["type"] == "delta":
                    assistant.content += ev["text"]
                else:
                    from .models import ToolEvent

                    assistant.tool_events.append(ToolEvent.model_validate(ev["event"]))
                yield _line(ev)
            if not assistant.content.strip():
                assistant.content = "(no response)"
            branch.messages.append(assistant)
            store.touch(conv)
            yield _line({"type": "done", "conversation": dump(conv)})
        except asyncio.CancelledError:
            # client disconnected (Stop button / closed tab) — Starlette cancels the
            # generator; keep the partial answer, never emit an error event on abort
            if assistant.content.strip():
                assistant.content += "\n\n*(generation interrupted)*"
                branch.messages.append(assistant)
            store.touch(conv)
            raise
        except Exception as err:  # noqa: BLE001 — surface every provider failure to the client
            if assistant.content.strip():
                assistant.content += "\n\n*(generation interrupted)*"
                branch.messages.append(assistant)
            store.touch(conv)
            yield _line({"type": "error", "message": str(err)})

    return StreamingResponse(gen(), media_type="application/x-ndjson")


# production: serve the built frontend (mirrors the Express NODE_ENV=production block)
_DIST = Path(__file__).parent.parent.parent / "frontend" / "dist"
if _DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=_DIST / "assets"), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        target = _DIST / path
        if path and target.is_file():
            return FileResponse(target)
        return FileResponse(_DIST / "index.html")
