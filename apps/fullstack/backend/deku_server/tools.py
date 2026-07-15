"""Port of server/tools.ts — same names/descriptions/output shapes so tool
events and model behavior match the JS editions."""
import ast
import re
from datetime import datetime

import httpx
from langchain_core.tools import tool
from pydantic import BaseModel, Field

from .models import ToolEvent

_CALC_RE = re.compile(r"^[\d+\-*/().%\s^eE,]+$")

_ALLOWED_NODES = (
    ast.Expression, ast.BinOp, ast.UnaryOp, ast.Constant,
    ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Mod, ast.Pow, ast.USub, ast.UAdd,
)


def _safe_eval(expression: str) -> float:
    tree = ast.parse(expression.replace("^", "**"), mode="eval")
    for node in ast.walk(tree):
        if not isinstance(node, _ALLOWED_NODES):
            raise ValueError("Only arithmetic expressions are supported")
        if isinstance(node, ast.Constant) and not isinstance(node.value, (int, float)):
            raise ValueError("Only arithmetic expressions are supported")
    return eval(compile(tree, "<calculator>", "eval"))  # noqa: S307 — AST-whitelisted


class CalculatorInput(BaseModel):
    expression: str = Field(description="e.g. (1234 * 5678) / 9")


@tool(args_schema=CalculatorInput)
def calculator(expression: str) -> str:
    """Evaluate an arithmetic expression exactly. Supports + - * / % ^ and parentheses."""
    if not _CALC_RE.match(expression):
        raise ValueError("Only arithmetic expressions are supported")
    value = _safe_eval(expression)
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return str(value)


@tool
def clock() -> str:
    """Get the current date and time."""
    # shaped like JS Date.toString() — the UI slices 33 chars of it into the tool chip
    now = datetime.now().astimezone()
    return now.strftime("%a %b %d %Y %H:%M:%S GMT%z (%Z)")


class WebSearchInput(BaseModel):
    query: str = Field(description="The search query")


def make_web_search(tavily_key: str):
    @tool(args_schema=WebSearchInput)
    async def web_search(query: str) -> str:
        """Search the web for current information.

        Use for anything time-sensitive or factual you are unsure about."""
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.post(
                "https://api.tavily.com/search",
                json={"api_key": tavily_key, "query": query, "max_results": 5, "include_answer": True},
            )
        if res.status_code != 200:
            raise RuntimeError(f"Tavily search failed: {res.status_code}")
        data = res.json()
        hits = "\n".join(
            f"- {r['title']} ({r['url']})\n  {r['content'][:300]}" for r in data.get("results", [])
        )
        answer = data.get("answer")
        return f"{f'Answer: {answer}\n\n' if answer else ''}Results:\n{hits}"

    return web_search


def tools_for(capabilities: list[str], api_keys: dict[str, str]):
    import os

    tools = []
    tavily_key = api_keys.get("TAVILY_API_KEY") or os.environ.get("TAVILY_API_KEY")
    if "web_search" in capabilities and tavily_key:
        tools.append(make_web_search(tavily_key))
    if "calculator" in capabilities:
        tools.append(calculator)
    if "clock" in capabilities:
        tools.append(clock)
    return tools


_KINDS = {"web_search": "web", "calculator": "code", "clock": "tool"}
_LABELS = {"web_search": "Web search", "calculator": "Calculator", "clock": "Clock"}


def tool_event_for(name: str, tool_input, output: str | None = None) -> ToolEvent:
    if isinstance(tool_input, dict) and "input" in tool_input and len(tool_input) == 1:
        tool_input = tool_input["input"]  # some langchain versions wrap the args
    tool_input = tool_input or {}
    if name == "web_search":
        detail = f"Searched “{tool_input.get('query', '')}”"
    elif name == "calculator":
        expr = tool_input.get("expression", "")
        detail = f"{expr} = {output}" if output else f"Evaluated {expr}"
    elif name == "clock":
        detail = f"Read the clock — {output[:33]}" if output else "Read the clock"
    else:
        import json as _json

        detail = _json.dumps(tool_input)[:120]
    return ToolEvent(kind=_KINDS.get(name, "tool"), label=_LABELS.get(name, name), detail=detail)
