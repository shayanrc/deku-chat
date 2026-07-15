import { createStore, del, get, set, values } from 'idb-keyval';
import {
  combineBranches,
  demoSeed,
  forkBranch,
  getBranch,
  newConversation,
  nextName,
  toSummary,
  touch,
} from '@deku/core';
import type { Conversation } from '@deku/core';
import type { ConversationStore } from '@deku/ui';

const db = createStore('deku-chat', 'conversations');

export class IdbStore implements ConversationStore {
  async list() {
    return (await values<Conversation>(db)).map(toSummary).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async create() {
    const conv = newConversation();
    await set(conv.id, conv, db);
    return conv;
  }

  async get(id: string) {
    const conv = await get<Conversation>(id, db);
    if (!conv) throw new Error('conversation not found');
    return conv;
  }

  /** persist a (mutated) conversation — also used by the browser transport */
  async put(conv: Conversation) {
    touch(conv);
    await set(conv.id, conv, db);
    return conv;
  }

  async rename(id: string, title: string) {
    const conv = await this.get(id);
    const t = title.trim().slice(0, 80);
    if (t) conv.title = t;
    return this.put(conv);
  }

  async remove(id: string) {
    await del(id, db);
  }

  async activate(id: string, branchId: string) {
    const conv = await this.get(id);
    if (!getBranch(conv, branchId)) throw new Error('branch not found');
    conv.activeBranchId = branchId;
    return this.put(conv);
  }

  async branch(id: string, branchId: string, messageId: string | null, name?: string) {
    const conv = await this.get(id);
    const from = getBranch(conv, branchId);
    if (!from) throw new Error('branch not found');
    const branch = forkBranch(conv, from, messageId, name || nextName(conv, 'Branch'));
    conv.activeBranchId = branch.id;
    return this.put(conv);
  }

  async rewind(id: string, branchId: string, messageId: string) {
    const conv = await this.get(id);
    const from = getBranch(conv, branchId);
    if (!from) throw new Error('branch not found');
    const branch = forkBranch(conv, from, messageId, nextName(conv, 'Rewind'));
    conv.activeBranchId = branch.id;
    return this.put(conv);
  }

  async combine(id: string, sourceBranchId: string, targetBranchId: string) {
    const conv = await this.get(id);
    combineBranches(conv, sourceBranchId, targetBranchId);
    return this.put(conv);
  }

  /** first-run seeding so the static demo isn't a blank page */
  async seedIfEmpty() {
    const existing = await values<Conversation>(db);
    if (existing.length) return;
    for (const conv of demoSeed()) await set(conv.id, conv, db);
  }
}
