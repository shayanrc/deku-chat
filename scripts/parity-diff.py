#!/usr/bin/env python3
"""Endpoint parity diff: replays the same operation sequence against the Express
(:5175) and FastAPI (:5176) backends — both freshly seeded with the SAME db.json —
and diffs every parsed response after normalizing generated ids/timestamps.

Usage: python3 scripts/parity-diff.py
"""
import json
import re
import sys
import urllib.request

EXPRESS = "http://localhost:5175"
FASTAPI = "http://localhost:5176"
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")

failures = []


def req(base, method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(
        f"{base}{path}", data=data, method=method, headers={"content-type": "application/json"}
    )
    try:
        with urllib.request.urlopen(r) as res:
            return res.status, res.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def normalize(value, idmap):
    if isinstance(value, list):
        return [normalize(v, idmap) for v in value]
    if isinstance(value, dict):
        out = {}
        for k, v in sorted(value.items()):
            if k in ("id", "branchId", "messageId", "activeBranchId") and isinstance(v, str) and UUID_RE.match(v):
                out[k] = idmap.setdefault(v, f"NEW{len(idmap) + 1}")
            elif k in ("createdAt", "updatedAt") and isinstance(v, (int, float)) and v > 1.7e12 + 1e9:
                out[k] = 0  # generated during this run (seed uses now=1.75e12 exactly)
            else:
                out[k] = normalize(v, idmap)
        return out
    return value


def compare(step, method, path, body=None, ndjson=False):
    se, be = req(EXPRESS, method, path, body), req(FASTAPI, method, path, body)
    if se[0] != be[0]:
        failures.append(f"{step}: status {se[0]} vs {be[0]}")
        return
    if ndjson:
        ex = [json.loads(line) for line in se[1].splitlines() if line.strip()]
        py = [json.loads(line) for line in be[1].splitlines() if line.strip()]
        if [e["type"] for e in ex] != [e["type"] for e in py]:
            failures.append(f"{step}: event sequence {[e['type'] for e in ex]} vs {[e['type'] for e in py]}")
        else:
            print(f"  OK {step} (events: {[e['type'] for e in ex]})")
        return ex, py
    ex = normalize(json.loads(se[1]), idmap_ex)
    py = normalize(json.loads(be[1]), idmap_py)
    if ex != py:
        failures.append(f"{step}:\n  express: {json.dumps(ex)[:400]}\n  fastapi: {json.dumps(py)[:400]}")
    else:
        print(f"  OK {step}")
    return ex, py


idmap_ex, idmap_py = {}, {}

print("read endpoints:")
compare("GET /api/meta", "GET", "/api/meta")
compare("GET /api/conversations", "GET", "/api/conversations")
compare("GET conversation", "GET", "/api/conversations/conv-q3")
compare("404 conversation", "GET", "/api/conversations/nope")

print("mutations (same order on both):")
compare("rewind to m5", "POST", "/api/conversations/conv-q3/rewind", {"branchId": "br-playful", "messageId": "m5"})
compare("branch from formal", "POST", "/api/conversations/conv-q3/branch", {"branchId": "br-formal", "messageId": None})
compare("combine formal→main", "POST", "/api/conversations/conv-q3/combine",
        {"sourceBranchId": "br-formal", "targetBranchId": "br-main"})
compare("bad combine", "POST", "/api/conversations/conv-q3/combine",
        {"sourceBranchId": "br-main", "targetBranchId": "br-main"})
compare("summarize m4..m6 (fallback)", "POST", "/api/conversations/conv-onb-main/summarize"
        .replace("conv-onb-main", "conv-onb"),
        {"branchId": "conv-onb-main", "fromId": "conv-onb-m1", "toId": "conv-onb-m2",
         "provider": "anthropic", "model": "claude-haiku-4-5", "apiKeys": {}})
compare("bad summarize range", "POST", "/api/conversations/conv-onb/summarize",
        {"branchId": "conv-onb-main", "fromId": "zzz", "toId": "zzz",
         "provider": "anthropic", "model": "m", "apiKeys": {}})
compare("rename", "PATCH", "/api/conversations/conv-comp", {"title": "  Renamed teardown  "})
compare("activate main", "POST", "/api/conversations/conv-q3/activate", {"branchId": "br-main"})

print("chat (no key → friendly error):")
ex, py = compare("chat NDJSON", "POST", "/api/conversations/conv-comp/chat",
                 {"branchId": "conv-comp-main", "content": "parity test message",
                  "provider": "anthropic", "model": "claude-haiku-4-5", "capabilities": [], "apiKeys": {}},
                 ndjson=True)
if ex and py and ex[-1]["type"] == "error" == py[-1]["type"]:
    if ex[-1]["message"] != py[-1]["message"]:
        failures.append(f"chat error message: {ex[-1]['message']!r} vs {py[-1]['message']!r}")
    else:
        print(f"  OK error message parity: {ex[-1]['message'][:60]}…")

compare("post-chat state", "GET", "/api/conversations/conv-comp")
compare("delete", "DELETE", "/api/conversations/conv-onb")
compare("list after all ops", "GET", "/api/conversations")

if failures:
    print("\nFAILURES:")
    for f in failures:
        print(" -", f)
    sys.exit(1)
print("\nPARITY: all endpoints identical after normalization")
