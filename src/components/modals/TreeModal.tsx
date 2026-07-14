import { useMemo, useState } from 'react';
import { useApp, type ModalKind } from '../../state';
import { Modal } from './Modal';
import { CombineIcon, RewindIcon, SummarizeIcon, TreeIcon } from '../icons';
import type { Branch } from '../../../shared/types';

interface Node {
  branch: Branch;
  col: number;
  row: number;
  parent: Node | null;
}

function layoutTree(branches: Branch[]): Node[] {
  const children = new Map<string | null, Branch[]>();
  const ids = new Set(branches.map((b) => b.id));
  for (const b of branches) {
    const parent = b.forkOf && ids.has(b.forkOf.branchId) ? b.forkOf.branchId : null;
    const list = children.get(parent) ?? [];
    list.push(b);
    children.set(parent, list);
  }
  for (const list of children.values()) list.sort((a, b) => a.createdAt - b.createdAt);

  const nodes: Node[] = [];
  let nextCol = 0;
  const place = (b: Branch, parent: Node | null, inheritCol: boolean) => {
    const col = inheritCol && parent ? parent.col : nextCol++;
    const node: Node = { branch: b, col, row: parent ? parent.row + 1 : 0, parent };
    nodes.push(node);
    (children.get(b.id) ?? []).forEach((child, i) => place(child, node, i === 0));
  };
  (children.get(null) ?? []).forEach((root) => place(root, null, false));
  return nodes;
}

const X = (col: number) => 40 + col * 140;
const Y = (row: number) => 30 + row * 66;

export function TreeModal() {
  const app = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(app.conv?.activeBranchId ?? null);
  const branches = app.conv?.branches ?? [];
  const nodes = useMemo(() => layoutTree(branches), [branches]);
  const selected = branches.find((b) => b.id === selectedId) ?? null;
  // branch switching is a no-op while a reply is streaming, so gate the actions too
  const gate = selected !== null && !app.streaming;

  const width = Math.max(300, ...nodes.map((n) => X(n.col) + 220));
  const height = Math.max(120, ...nodes.map((n) => Y(n.row) + 60));

  const act = async (modal: ModalKind) => {
    if (!gate || !selected || !app.conv) return;
    if (selected.id !== app.conv.activeBranchId) await app.switchBranch(selected.id);
    app.openModal(modal);
  };

  return (
    <Modal width={Math.min(720, width + 300)} onClose={app.closeModal}>
      <div className="modal-pad">
        <div className="modal-title">
          <TreeIcon size={20} style={{ color: 'var(--color-accent)' }} />
          <div>Conversation tree</div>
        </div>
        <div className="modal-sub">
          Every path this chat has taken. Click a branch to select it, then use the actions on the right.
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, position: 'relative', height, minWidth: 300, overflow: 'auto' }}>
            <svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
              {nodes.map((n) => {
                if (!n.parent) return null;
                const x1 = X(n.parent.col);
                const y1 = Y(n.parent.row);
                const x2 = X(n.col);
                const y2 = Y(n.row);
                const activePath = n.branch.id === app.conv?.activeBranchId;
                const stroke = activePath ? 'var(--color-accent)' : 'var(--color-neutral-600)';
                if (x1 === x2) {
                  return <line key={n.branch.id} x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={2} />;
                }
                return (
                  <path
                    key={n.branch.id}
                    d={`M${x1},${y1} L${x1},${y2 - 12} Q${x1},${y2} ${x1 + 12},${y2} L${x2},${y2}`}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                );
              })}
            </svg>
            {nodes.map((n) => {
              const isActive = n.branch.id === app.conv?.activeBranchId;
              const isSelected = n.branch.id === selectedId;
              return (
                <button
                  key={n.branch.id}
                  className="btn-plain"
                  onClick={() => setSelectedId(n.branch.id)}
                  style={{ position: 'absolute', left: X(n.col) - 9, top: Y(n.row) - 9, display: 'flex', alignItems: 'center', gap: 12, width: 'auto' }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      flex: 'none',
                      // active = accent fill, root = solid neutral, other branches = hollow ring (per design)
                      background: isActive
                        ? 'var(--color-accent)'
                        : n.branch.forkOf === null
                          ? 'var(--color-neutral-500)'
                          : 'transparent',
                      border: isActive || n.branch.forkOf === null ? 'none' : '2px solid var(--color-neutral-500)',
                      boxShadow: isSelected ? '0 0 0 4px color-mix(in srgb,var(--color-accent) 25%,transparent)' : 'none',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      whiteSpace: 'nowrap',
                      color: isActive ? 'var(--color-accent)' : isSelected ? 'var(--color-accent)' : 'var(--color-neutral-500)',
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    {n.branch.name}
                    {isActive ? ' — you are here' : ''}
                    <span style={{ color: 'var(--color-neutral-600)', marginLeft: 6 }}>{n.branch.messages.length}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ flex: 'none', width: 210, display: 'flex', flexDirection: 'column', gap: 8, borderLeft: '1px solid var(--color-divider)', paddingLeft: 'var(--space-6)' }}>
            <div className="tiny-label">Actions</div>
            <div style={{ fontSize: 12, color: 'var(--color-neutral-500)', marginBottom: 4 }}>
              Selected: <b style={{ color: 'var(--color-text)' }}>{selected?.name ?? '—'}</b>
            </div>
            <button
              className="btn btn-secondary btn-block"
              style={{ justifyContent: 'flex-start', gap: 8, opacity: gate ? 1 : 0.45, pointerEvents: gate ? 'auto' : 'none' }}
              onClick={async () => {
                if (!gate || !selected) return;
                await app.switchBranch(selected.id);
                app.closeModal();
              }}
            >
              <TreeIcon />Switch to branch
            </button>
            <button
              className="btn btn-secondary btn-block"
              style={{ justifyContent: 'flex-start', gap: 8, opacity: gate ? 1 : 0.45, pointerEvents: gate ? 'auto' : 'none' }}
              onClick={() => void act('rewind')}
            >
              <RewindIcon />Rewind…
            </button>
            <button
              className="btn btn-secondary btn-block"
              style={{ justifyContent: 'flex-start', gap: 8, opacity: gate && branches.length > 1 ? 1 : 0.45, pointerEvents: gate && branches.length > 1 ? 'auto' : 'none' }}
              onClick={() => void act('combine')}
            >
              <CombineIcon />Combine…
            </button>
            <button
              className="btn btn-secondary btn-block"
              style={{ justifyContent: 'flex-start', gap: 8, opacity: gate ? 1 : 0.45, pointerEvents: gate ? 'auto' : 'none' }}
              onClick={() => void act('summarize')}
            >
              <SummarizeIcon />Summarize…
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
