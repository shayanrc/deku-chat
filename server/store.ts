import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import type { Branch, Conversation, Msg, Role } from '../shared/types.js';

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

interface Db {
  conversations: Conversation[];
}

let db: Db = { conversations: [] };

export function load(): void {
  try {
    db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    db = { conversations: [] };
  }
}

export function save(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

export function listConversations(): Conversation[] {
  return [...db.conversations].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getConversation(id: string): Conversation | undefined {
  return db.conversations.find((c) => c.id === id);
}

export function getBranch(conv: Conversation, branchId: string): Branch | undefined {
  return conv.branches.find((b) => b.id === branchId);
}

export function deleteConversation(id: string): boolean {
  const before = db.conversations.length;
  db.conversations = db.conversations.filter((c) => c.id !== id);
  save();
  return db.conversations.length < before;
}

export function createConversation(): Conversation {
  const now = Date.now();
  const main: Branch = { id: randomUUID(), name: 'Main', forkOf: null, messages: [], createdAt: now };
  const conv: Conversation = {
    id: randomUUID(),
    title: 'New chat',
    branches: [main],
    activeBranchId: main.id,
    createdAt: now,
    updatedAt: now,
  };
  db.conversations.push(conv);
  save();
  return conv;
}

export function touch(conv: Conversation): void {
  conv.updatedAt = Date.now();
  save();
}

export function makeMsg(role: Role, content: string): Msg {
  return { id: randomUUID(), role, kind: 'message', content, createdAt: Date.now() };
}

/** New branch containing this branch's messages up to and including messageId (null = full copy). */
export function forkBranch(conv: Conversation, from: Branch, messageId: string | null, name: string): Branch {
  let prefix = from.messages;
  if (messageId !== null) {
    const idx = from.messages.findIndex((m) => m.id === messageId);
    if (idx === -1) throw new Error('message not found in branch');
    prefix = from.messages.slice(0, idx + 1);
  }
  const branch: Branch = {
    id: randomUUID(),
    name,
    forkOf: { branchId: from.id, messageId: messageId ?? from.messages.at(-1)?.id ?? null },
    messages: prefix.map((m) => ({ ...m })),
    createdAt: Date.now(),
  };
  conv.branches.push(branch);
  return branch;
}

export function nextName(conv: Conversation, base: string): string {
  const n = conv.branches.filter((b) => b.name.startsWith(base)).length + 1;
  return `${base} ${n}`;
}
