import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ApiKeys, ToolEvent, ToolKind } from '@deku/core';

const makeWebSearch = (tavilyKey: string) =>
  tool(
    async ({ query }) => {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ api_key: tavilyKey, query, max_results: 5, include_answer: true }),
      });
      if (!res.ok) throw new Error(`Tavily search failed: ${res.status}`);
      const data = (await res.json()) as { answer?: string; results?: { title: string; url: string; content: string }[] };
      const hits = (data.results ?? [])
        .map((r) => `- ${r.title} (${r.url})\n  ${r.content.slice(0, 300)}`)
        .join('\n');
      return `${data.answer ? `Answer: ${data.answer}\n\n` : ''}Results:\n${hits}`;
    },
    {
      name: 'web_search',
      description: 'Search the web for current information. Use for anything time-sensitive or factual you are unsure about.',
      schema: z.object({ query: z.string().describe('The search query') }),
    },
  );

const calculator = tool(
  async ({ expression }) => {
    if (!/^[\d+\-*/().%\s^eE,]+$/.test(expression)) throw new Error('Only arithmetic expressions are supported');
    const value = Function(`"use strict"; return (${expression.replaceAll('^', '**')});`)();
    return String(value);
  },
  {
    name: 'calculator',
    description: 'Evaluate an arithmetic expression exactly. Supports + - * / % ^ and parentheses.',
    schema: z.object({ expression: z.string().describe('e.g. (1234 * 5678) / 9') }),
  },
);

const clock = tool(
  async () => new Date().toString(),
  {
    name: 'clock',
    description: 'Get the current date and time.',
    schema: z.object({}),
  },
);

export function toolsFor(capabilities: string[], apiKeys: ApiKeys = {}) {
  const tools = [];
  const tavilyKey = apiKeys.TAVILY_API_KEY || process.env.TAVILY_API_KEY;
  if (capabilities.includes('web_search') && tavilyKey) tools.push(makeWebSearch(tavilyKey));
  if (capabilities.includes('calculator')) tools.push(calculator);
  if (capabilities.includes('clock')) tools.push(clock);
  return tools;
}

export function toolEventFor(name: string, input: unknown, output?: string): ToolEvent {
  const kinds: Record<string, ToolKind> = { web_search: 'web', calculator: 'code', clock: 'tool' };
  const labels: Record<string, string> = { web_search: 'Web search', calculator: 'Calculator', clock: 'Clock' };
  let detail = '';
  if (name === 'web_search') detail = `Searched “${(input as { query?: string })?.query ?? ''}”`;
  else if (name === 'calculator') {
    const expr = (input as { expression?: string })?.expression ?? '';
    detail = output ? `${expr} = ${output}` : `Evaluated ${expr}`;
  } else if (name === 'clock') detail = output ? `Read the clock — ${output.slice(0, 33)}` : 'Read the clock';
  else detail = JSON.stringify(input).slice(0, 120);
  return { kind: kinds[name] ?? 'tool', label: labels[name] ?? name, detail };
}
