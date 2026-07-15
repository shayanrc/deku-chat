"""Fixture-driven parity tests: the same JSON vectors that drive the vitest suite
(packages/core/fixtures/ops) must produce identical results from the Python ops."""
import json
import re
from pathlib import Path

import pytest

from deku_server import ops
from deku_server.models import Conversation, dump

FIXTURES = Path(__file__).parent.parent.parent.parent.parent / "packages" / "core" / "fixtures" / "ops"
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


def normalize(value):
    if isinstance(value, list):
        return [normalize(v) for v in value]
    if isinstance(value, dict):
        out = {}
        for k, v in value.items():
            if k in ("id", "branchId", "messageId") and isinstance(v, str) and UUID_RE.match(v):
                out[k] = "NEW"
            elif k in ("createdAt", "updatedAt") and isinstance(v, (int, float)) and v > 1e12:
                out[k] = 0
            else:
                out[k] = normalize(v)
        return out
    return value


def fixture_files():
    return sorted(FIXTURES.glob("*.json"))


def test_fixtures_exist():
    assert fixture_files(), f"no fixtures found at {FIXTURES}"


@pytest.mark.parametrize("path", fixture_files(), ids=lambda p: p.stem)
def test_fixture(path: Path):
    fx = json.loads(path.read_text(encoding="utf-8"))
    conv = Conversation.model_validate(fx["conversation"])
    op, args = fx["op"], fx["args"]

    if op == "forkBranch":
        ops.fork_branch(conv, ops.get_branch(conv, args["branchId"]), args["messageId"], args["name"])
        assert normalize(dump(conv)) == fx["expected"]
    elif op == "combineBranches":
        ops.combine_branches(conv, args["sourceBranchId"], args["targetBranchId"])
        assert normalize(dump(conv)) == fx["expected"]
    elif op == "spliceSummary":
        branch = ops.get_branch(conv, args["branchId"])
        ops.splice_summary(branch, args["fromId"], args["toId"], args["summaryText"])
        assert normalize(dump(conv)) == fx["expected"]
    elif op == "nextName":
        assert ops.next_name(conv, args["base"]) == fx["expected"]
    else:
        raise AssertionError(f"unknown op {op}")


def test_fork_unknown_message():
    conv = ops.new_conversation()
    with pytest.raises(ValueError, match="message not found"):
        ops.fork_branch(conv, conv.branches[0], "nope", "X")


def test_combine_identical():
    conv = ops.new_conversation()
    with pytest.raises(ValueError, match="bad branches"):
        ops.combine_branches(conv, conv.branches[0].id, conv.branches[0].id)


def test_summary_fallback_shape():
    msgs = [ops.make_msg("user", "x" * 200 + "\nrest"), ops.make_msg("assistant", "end")]
    assert ops.summary_fallback(msgs) == "x" * 90 + " → end"
