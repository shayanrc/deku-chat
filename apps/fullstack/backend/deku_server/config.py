"""Mirror of @deku/core's registry.ts — same providers, same prompt strings
(byte-identical: systemPromptTokens must match the Express server's)."""
import os

SYSTEM_PROMPT = """You are Deku, a sharp, friendly AI assistant living in an agentic chat app.
Be concise and concrete. Use the tools you are given when they genuinely help
(current facts, arithmetic, dates); otherwise just answer. Format with light
Markdown: short paragraphs, bullet lists where they aid scanning."""

SUMMARIZE_PROMPT = (
    "Compress the following chat excerpt into 1-2 short sentences that preserve every "
    "decision, name, and fact needed to continue the conversation. Reply with the summary only."
)

# id, name, envKey, init_chat_model provider prefix, models: (id, name, contextWindow)
PROVIDERS = [
    {
        "id": "anthropic", "name": "Anthropic", "envKey": "ANTHROPIC_API_KEY", "prefix": "anthropic",
        "models": [
            ("claude-sonnet-4-5", "Claude Sonnet 4.5", 200_000),
            ("claude-opus-4-1", "Claude Opus 4.1", 200_000),
            ("claude-haiku-4-5", "Claude Haiku 4.5", 200_000),
        ],
    },
    {
        "id": "openai", "name": "OpenAI", "envKey": "OPENAI_API_KEY", "prefix": "openai",
        "models": [
            ("gpt-4.1", "GPT-4.1", 1_000_000),
            ("gpt-4.1-mini", "GPT-4.1 mini", 1_000_000),
            ("gpt-4o", "GPT-4o", 128_000),
        ],
    },
    {
        "id": "google", "name": "Google", "envKey": "GOOGLE_API_KEY", "prefix": "google_genai",
        "models": [
            ("gemini-2.5-pro", "Gemini 2.5 Pro", 1_048_576),
            ("gemini-2.5-flash", "Gemini 2.5 Flash", 1_048_576),
        ],
    },
    {
        "id": "mistral", "name": "Mistral", "envKey": "MISTRAL_API_KEY", "prefix": "mistralai",
        "models": [
            ("mistral-large-latest", "Mistral Large", 131_072),
            ("mistral-medium-latest", "Mistral Medium", 131_072),
            ("mistral-small-latest", "Mistral Small", 131_072),
        ],
    },
    {
        "id": "groq", "name": "Groq", "envKey": "GROQ_API_KEY", "prefix": "groq",
        "models": [
            ("llama-3.3-70b-versatile", "Llama 3.3 70B", 131_072),
            ("llama-3.1-8b-instant", "Llama 3.1 8B", 131_072),
        ],
    },
    {
        "id": "cohere", "name": "Cohere", "envKey": "COHERE_API_KEY", "prefix": "cohere",
        "models": [
            ("command-a-03-2025", "Command A", 262_144),
            ("command-r-plus", "Command R+", 131_072),
        ],
    },
    {
        "id": "xai", "name": "xAI", "envKey": "XAI_API_KEY", "prefix": "xai",
        "models": [
            ("grok-4", "Grok 4", 262_144),
            ("grok-3", "Grok 3", 131_072),
            ("grok-3-mini", "Grok 3 mini", 131_072),
        ],
    },
    {
        "id": "deepseek", "name": "DeepSeek", "envKey": "DEEPSEEK_API_KEY", "prefix": "deepseek",
        "models": [("deepseek-chat", "DeepSeek Chat", 131_072)],
    },
]

CAPABILITIES = [
    {"id": "web_search", "name": "Web search", "kind": "web", "envKey": "TAVILY_API_KEY", "tokens": 400},
    {"id": "calculator", "name": "Calculator", "kind": "code", "envKey": None, "tokens": 250},
    {"id": "clock", "name": "Clock", "kind": "tool", "envKey": None, "tokens": 150},
]


def provider_by_id(provider_id: str) -> dict | None:
    return next((p for p in PROVIDERS if p["id"] == provider_id), None)


def provider_infos() -> list[dict]:
    return [
        {
            "id": p["id"],
            "name": p["name"],
            "envKey": p["envKey"],
            "hasKey": bool(os.environ.get(p["envKey"])),
            "models": [{"id": m[0], "name": m[1], "contextWindow": m[2]} for m in p["models"]],
        }
        for p in PROVIDERS
    ]


def capability_infos() -> list[dict]:
    return [
        {
            "id": c["id"],
            "name": c["name"],
            "kind": c["kind"],
            "available": c["envKey"] is None or bool(os.environ.get(c["envKey"])),
            "envKey": c["envKey"],
            "tokens": c["tokens"],
        }
        for c in CAPABILITIES
    ]
