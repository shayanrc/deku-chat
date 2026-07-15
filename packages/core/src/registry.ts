/** Provider/capability registry shared by every Deku runtime. */

export const SYSTEM_PROMPT = `You are Deku, a sharp, friendly AI assistant living in an agentic chat app.
Be concise and concrete. Use the tools you are given when they genuinely help
(current facts, arithmetic, dates); otherwise just answer. Format with light
Markdown: short paragraphs, bullet lists where they aid scanning.`;

export const SUMMARIZE_PROMPT =
  'Compress the following chat excerpt into 1-2 short sentences that preserve every decision, name, and fact needed to continue the conversation. Reply with the summary only.';

export interface ProviderDef {
  id: string;
  name: string;
  envKey: string;
  models: { id: string; name: string; contextWindow: number }[];
  /** true = provider API is callable directly from a browser (CORS + SDK support verified) */
  browserCompatible: boolean;
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    browserCompatible: true,
    models: [
      { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', contextWindow: 200_000 },
      { id: 'claude-opus-4-1', name: 'Claude Opus 4.1', contextWindow: 200_000 },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', contextWindow: 200_000 },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    browserCompatible: true,
    models: [
      { id: 'gpt-4.1', name: 'GPT-4.1', contextWindow: 1_000_000 },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini', contextWindow: 1_000_000 },
      { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128_000 },
    ],
  },
  {
    id: 'google',
    name: 'Google',
    envKey: 'GOOGLE_API_KEY',
    browserCompatible: true,
    models: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', contextWindow: 1_048_576 },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', contextWindow: 1_048_576 },
    ],
  },
  {
    id: 'mistral',
    name: 'Mistral',
    envKey: 'MISTRAL_API_KEY',
    browserCompatible: false, // CORS unverified — flip after empirical check
    models: [
      { id: 'mistral-large-latest', name: 'Mistral Large', contextWindow: 131_072 },
      { id: 'mistral-medium-latest', name: 'Mistral Medium', contextWindow: 131_072 },
      { id: 'mistral-small-latest', name: 'Mistral Small', contextWindow: 131_072 },
    ],
  },
  {
    id: 'groq',
    name: 'Groq',
    envKey: 'GROQ_API_KEY',
    browserCompatible: true, // via OpenAI-compatible endpoint
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', contextWindow: 131_072 },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', contextWindow: 131_072 },
    ],
  },
  {
    id: 'cohere',
    name: 'Cohere',
    envKey: 'COHERE_API_KEY',
    browserCompatible: false, // CORS unverified — flip after empirical check
    models: [
      { id: 'command-a-03-2025', name: 'Command A', contextWindow: 262_144 },
      { id: 'command-r-plus', name: 'Command R+', contextWindow: 131_072 },
    ],
  },
  {
    id: 'xai',
    name: 'xAI',
    envKey: 'XAI_API_KEY',
    browserCompatible: true, // OpenAI-compatible; verify empirically
    models: [
      { id: 'grok-4', name: 'Grok 4', contextWindow: 262_144 },
      { id: 'grok-3', name: 'Grok 3', contextWindow: 131_072 },
      { id: 'grok-3-mini', name: 'Grok 3 mini', contextWindow: 131_072 },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    envKey: 'DEEPSEEK_API_KEY',
    browserCompatible: false, // api.deepseek.com widely reported to lack CORS headers
    models: [{ id: 'deepseek-chat', name: 'DeepSeek Chat', contextWindow: 131_072 }],
  },
];

export interface CapabilityDef {
  id: string;
  name: string;
  kind: 'web' | 'code' | 'tool';
  envKey: string | null;
  tokens: number;
  browserCompatible: boolean;
}

export const CAPABILITIES: CapabilityDef[] = [
  { id: 'web_search', name: 'Web search', kind: 'web', envKey: 'TAVILY_API_KEY', tokens: 400, browserCompatible: false }, // Tavily CORS unverified
  { id: 'calculator', name: 'Calculator', kind: 'code', envKey: null, tokens: 250, browserCompatible: true },
  { id: 'clock', name: 'Clock', kind: 'tool', envKey: null, tokens: 150, browserCompatible: true },
];
