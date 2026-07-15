"""Pydantic mirrors of @deku/core's types.ts — camelCase on the wire, snake_case here.

Wire parity rules (the frontend can't tell this backend from the Express one):
- dump through `dump()`, which keeps `forkOf: null` (TS emits it explicitly) but
  OMITS optional Msg/meta fields when absent (TS leaves `undefined` out entirely)
- timestamps are epoch MILLISECONDS
"""
from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ToolEvent(ApiModel):
    kind: Literal["web", "code", "mcp", "skill", "tool"]
    label: str
    detail: str


class Msg(ApiModel):
    id: str
    role: Literal["user", "assistant"]
    kind: Literal["message", "summary"]
    content: str
    tool_events: list[ToolEvent] | None = None
    summary_of: list["Msg"] | None = None
    freed_tokens: int | None = None
    created_at: int


class ForkOf(ApiModel):
    branch_id: str
    message_id: str | None


class Branch(ApiModel):
    id: str
    name: str
    fork_of: ForkOf | None
    messages: list[Msg]
    created_at: int


class Conversation(ApiModel):
    id: str
    title: str
    branches: list[Branch]
    active_branch_id: str
    created_at: int
    updated_at: int


class ConversationSummary(ApiModel):
    id: str
    title: str
    branch_count: int
    updated_at: int


class ModelInfo(ApiModel):
    id: str
    name: str
    context_window: int


class ProviderInfo(ApiModel):
    id: str
    name: str
    env_key: str
    has_key: bool
    models: list[ModelInfo]
    unavailable_reason: str | None = None


class CapabilityInfo(ApiModel):
    id: str
    name: str
    kind: Literal["web", "code", "mcp", "skill", "tool"]
    available: bool
    env_key: str | None
    tokens: int
    unavailable_reason: str | None = None


class Meta(ApiModel):
    providers: list[ProviderInfo]
    capabilities: list[CapabilityInfo]
    system_prompt_tokens: int


# TS omits absent optional fields entirely; `forkOf: null` however is emitted.
_OMIT_WHEN_NONE = {"toolEvents", "summaryOf", "freedTokens", "unavailableReason"}


def _clean(value):
    if isinstance(value, dict):
        return {k: _clean(v) for k, v in value.items() if not (v is None and k in _OMIT_WHEN_NONE)}
    if isinstance(value, list):
        return [_clean(v) for v in value]
    return value


def dump(model: BaseModel) -> dict:
    """Serialize to the exact JSON shape the Express server produced."""
    return _clean(model.model_dump(by_alias=True))
