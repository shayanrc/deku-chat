import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

/**
 * Lazy per-provider model constructors: each @langchain provider package is
 * dynamic-imported so Vite splits it into its own chunk, downloaded on first use.
 * Browser SDKs need their "allow browser" flags — keys here come from the user's
 * own localStorage, so the usual "don't ship keys to browsers" concern is moot.
 */
type Loader = (model: string, apiKey: string) => Promise<BaseChatModel>;

export const MODEL_LOADERS: Record<string, Loader> = {
  anthropic: async (model, apiKey) => {
    const { ChatAnthropic } = await import('@langchain/anthropic');
    return new ChatAnthropic({
      model,
      apiKey,
      maxTokens: 4096,
      clientOptions: { dangerouslyAllowBrowser: true },
    });
  },
  openai: async (model, apiKey) => {
    const { ChatOpenAI } = await import('@langchain/openai');
    return new ChatOpenAI({ model, apiKey, configuration: { dangerouslyAllowBrowser: true } });
  },
  google: async (model, apiKey) => {
    const { ChatGoogleGenerativeAI } = await import('@langchain/google-genai');
    return new ChatGoogleGenerativeAI({ model, apiKey });
  },
  // ChatGroq@0.2 doesn't reliably expose groq-sdk's browser flag; Groq speaks
  // the OpenAI wire protocol, so go through ChatOpenAI with a baseURL instead.
  groq: async (model, apiKey) => {
    const { ChatOpenAI } = await import('@langchain/openai');
    return new ChatOpenAI({
      model,
      apiKey,
      configuration: { baseURL: 'https://api.groq.com/openai/v1', dangerouslyAllowBrowser: true },
    });
  },
  mistral: async (model, apiKey) => {
    const { ChatMistralAI } = await import('@langchain/mistralai');
    return new ChatMistralAI({ model, apiKey });
  },
  // @langchain/cohere pulls the AWS SDK (Bedrock) with Node-only credential code
  // into the bundle, and Cohere is browser-blocked in the registry anyway.
  cohere: async () => {
    throw new Error('Cohere is not callable from a browser — use the fullstack edition.');
  },
  xai: async (model, apiKey) => {
    const { ChatXAI } = await import('@langchain/xai');
    // ChatXAI extends ChatOpenAI; the configuration passthrough isn't in its input type
    return new ChatXAI({ model, apiKey, configuration: { dangerouslyAllowBrowser: true } } as never);
  },
  deepseek: async (model, apiKey) => {
    const { ChatDeepSeek } = await import('@langchain/deepseek');
    return new ChatDeepSeek({ model, apiKey, configuration: { dangerouslyAllowBrowser: true } } as never);
  },
};
