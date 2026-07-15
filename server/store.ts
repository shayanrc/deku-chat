import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { forkBranch as coreForkBranch, getBranch as coreGetBranch, makeMsg, newConversation, nextName, touch as coreTouch } from '@deku/core';
import type { Branch, Conversation } from '@deku/core';

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

export const getBranch = coreGetBranch;

export function createConversation(): Conversation {
  const conv = newConversation();
  db.conversations.push(conv);
  save();
  return conv;
}

export function deleteConversation(id: string): boolean {
  const before = db.conversations.length;
  db.conversations = db.conversations.filter((c) => c.id !== id);
  save();
  return db.conversations.length < before;
}

export function touch(conv: Conversation): void {
  coreTouch(conv);
  save();
}

export { makeMsg, nextName };

export function forkBranch(conv: Conversation, from: Branch, messageId: string | null, name: string): Branch {
  return coreForkBranch(conv, from, messageId, name);
}
