/**
 * Canonical demo seed ("Q3 campaign messaging" + two extras), materialized from
 * seed.json where every timestamp is a negative offset from `now` and a branch
 * message entry of {"$ref": "<branchId>"} splices in that branch's message list
 * (copy-on-branch shared prefix).
 */
import raw from './seed.json';
import type { Branch, Conversation, Msg } from './types.ts';

interface RawDb {
  conversations: (Omit<Conversation, 'branches'> & {
    branches: (Omit<Branch, 'messages'> & { messages: unknown[] })[];
  })[];
}

export function demoSeed(now: number = Date.now()): Conversation[] {
  const db = structuredClone(raw) as unknown as RawDb;
  return db.conversations.map((conv) => {
    const built: Branch[] = [];
    for (const b of conv.branches) {
      const messages: Msg[] = [];
      for (const entry of b.messages) {
        const ref = (entry as { $ref?: string }).$ref;
        if (ref) {
          const src = built.find((x) => x.id === ref);
          if (!src) throw new Error(`seed $ref to unknown branch: ${ref}`);
          messages.push(...src.messages.map((m) => ({ ...m })));
        } else {
          messages.push(materializeMsg(entry as Msg, now));
        }
      }
      built.push({ ...b, messages, createdAt: now + b.createdAt });
    }
    return { ...conv, branches: built, createdAt: now + conv.createdAt, updatedAt: now + conv.updatedAt };
  });
}

function materializeMsg(m: Msg, now: number): Msg {
  return {
    ...m,
    createdAt: now + m.createdAt,
    summaryOf: m.summaryOf?.map((o) => materializeMsg(o, now)),
  };
}
