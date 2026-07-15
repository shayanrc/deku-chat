import { CAPABILITIES, PROVIDERS, SYSTEM_PROMPT } from '@deku/core';
import type { CapabilityInfo, ProviderInfo } from '@deku/core';

export { PROVIDERS, SYSTEM_PROMPT };

export function providerInfos(): ProviderInfo[] {
  return PROVIDERS.map((p) => ({
    id: p.id,
    name: p.name,
    envKey: p.envKey,
    hasKey: Boolean(process.env[p.envKey]),
    models: p.models,
  }));
}

export function capabilityInfos(): CapabilityInfo[] {
  return CAPABILITIES.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    available: c.envKey === null || Boolean(process.env[c.envKey]),
    envKey: c.envKey,
    tokens: c.tokens,
  }));
}
