"""Endpoint smoke + NDJSON contract tests against the FastAPI app."""
import json
import os
import tempfile

os.environ["DEKU_DATA_DIR"] = tempfile.mkdtemp(prefix="deku-test-")


from fastapi.testclient import TestClient  # noqa: E402

from deku_server import main  # noqa: E402

client = TestClient(main.app)


def make_conversation() -> dict:
    return client.post("/api/conversations").json()


def test_meta_shape():
    meta = client.get("/api/meta").json()
    assert [p["id"] for p in meta["providers"]] == [
        "anthropic", "openai", "google", "mistral", "groq", "cohere", "xai", "deepseek",
    ]
    assert meta["capabilities"][0]["envKey"] == "TAVILY_API_KEY"
    assert meta["systemPromptTokens"] > 0


def test_conversation_crud_and_error_strings():
    conv = make_conversation()
    assert conv["title"] == "New chat"
    assert conv["branches"][0]["forkOf"] is None  # explicit null, matching Express

    assert client.get("/api/conversations/nope").json() == {"error": "conversation not found"}
    renamed = client.patch(f"/api/conversations/{conv['id']}", json={"title": "  Named  "}).json()
    assert renamed["title"] == "Named"
    assert client.delete(f"/api/conversations/{conv['id']}").json() == {"ok": True}
    assert client.delete(f"/api/conversations/{conv['id']}").status_code == 404


def test_branch_ops_routes():
    conv = make_conversation()
    cid, bid = conv["id"], conv["branches"][0]["id"]

    r = client.post(f"/api/conversations/{cid}/combine", json={"sourceBranchId": bid, "targetBranchId": bid})
    assert r.status_code == 400 and r.json() == {"error": "bad branches"}

    r = client.post(
        f"/api/conversations/{cid}/summarize",
        json={"branchId": bid, "fromId": "x", "toId": "y",
              "provider": "anthropic", "model": "m", "apiKeys": {}},
    )
    assert r.status_code == 400 and r.json() == {"error": "bad range"}


def test_chat_ndjson_error_path_and_title():
    conv = make_conversation()
    cid, bid = conv["id"], conv["branches"][0]["id"]
    body = {
        "branchId": bid,
        "content": "a" * 60,
        "provider": "anthropic",
        "model": "claude-haiku-4-5",
        "capabilities": [],
        "apiKeys": {},  # no key anywhere → friendly error event
    }
    with client.stream("POST", f"/api/conversations/{cid}/chat", json=body) as res:
        assert res.headers["content-type"].startswith("application/x-ndjson")
        events = [json.loads(line) for line in res.iter_lines() if line.strip()]
    assert events[0]["type"] == "user"
    assert events[-1]["type"] == "error"
    assert "No API key for Anthropic" in events[-1]["message"]

    after = client.get(f"/api/conversations/{cid}").json()
    assert after["title"] == "a" * 48 + "…"  # truncation parity
    assert len(after["branches"][0]["messages"]) == 1  # user msg persisted, no assistant


def test_disconnect_persists_partial(tmp_path):
    """Real uvicorn + real socket disconnect: the CancelledError path must persist
    the partial answer with the interruption suffix (TestClient can't test this)."""
    import subprocess
    import sys
    import time

    import httpx

    port = 5611
    env = {**os.environ, "DEKU_DATA_DIR": str(tmp_path)}
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "tests.hang_app:app", "--port", str(port)],
        env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    base = f"http://127.0.0.1:{port}"
    try:
        for _ in range(50):
            try:
                httpx.get(f"{base}/api/meta", timeout=1)
                break
            except httpx.HTTPError:
                time.sleep(0.2)
        conv = httpx.post(f"{base}/api/conversations", timeout=5).json()
        cid, bid = conv["id"], conv["branches"][0]["id"]
        body = {"branchId": bid, "content": "hi", "provider": "anthropic", "model": "m",
                "capabilities": [], "apiKeys": {"ANTHROPIC_API_KEY": "k"}}
        with httpx.stream("POST", f"{base}/api/conversations/{cid}/chat", json=body, timeout=10) as res:
            it = res.iter_lines()
            assert json.loads(next(it))["type"] == "user"
            assert json.loads(next(it))["type"] == "delta"
            # walk away mid-stream: closing the response drops the socket
        deadline = time.time() + 5
        msgs = []
        while time.time() < deadline:
            msgs = httpx.get(f"{base}/api/conversations/{cid}", timeout=5).json()["branches"][0]["messages"]
            if len(msgs) == 2:
                break
            time.sleep(0.2)
        assert len(msgs) == 2
        assert msgs[1]["content"] == "partial answer\n\n*(generation interrupted)*"
    finally:
        proc.terminate()
        proc.wait(timeout=5)
