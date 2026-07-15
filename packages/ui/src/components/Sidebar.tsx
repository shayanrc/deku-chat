import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state';
import { ChevronDown, ChevronRight, Pencil, Plus, Trash } from './icons';

const BRANCH_MIME = 'application/x-deku-branch';

function ConvTitle({
  id,
  title,
  active,
  onSelect,
}: {
  id: string;
  title: string;
  active: boolean;
  onSelect: () => void;
}) {
  const app = useApp();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(title);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const disarmTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(disarmTimer.current), []);

  const commitRename = () => {
    setRenaming(false);
    if (draft.trim() && draft.trim() !== title) void app.renameConversation(id, draft);
  };

  if (renaming) {
    return (
      <input
        className="input"
        style={{ minHeight: 28, fontSize: 13, padding: '2px 8px' }}
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitRename}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitRename();
          else if (e.key === 'Escape') {
            setDraft(title);
            setRenaming(false);
          }
        }}
      />
    );
  }

  return (
    <>
      <button
        className="btn-plain"
        style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'inherit' }}
        onClick={onSelect}
        title={title}
      >
        {title}
      </button>
      <span className="conv-actions">
        <button
          className="btn-plain"
          title="Rename"
          onClick={() => {
            setDraft(title);
            setRenaming(true);
          }}
        >
          <Pencil size={12} />
        </button>
        <button
          className="btn-plain"
          title={deleteArmed ? 'Click again to delete' : 'Delete conversation'}
          style={deleteArmed ? { color: '#e5484d' } : undefined}
          onClick={() => {
            if (deleteArmed) {
              setDeleteArmed(false);
              void app.deleteConversation(id);
            } else {
              setDeleteArmed(true);
              clearTimeout(disarmTimer.current);
              disarmTimer.current = setTimeout(() => setDeleteArmed(false), 2500);
            }
          }}
        >
          <Trash size={12} />
        </button>
      </span>
      {active && (
        <span style={{ fontSize: 10, color: 'var(--color-accent)', flex: 'none' }}>{app.conv?.branches.length}</span>
      )}
    </>
  );
}

export function Sidebar() {
  const app = useApp();
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => setCollapsed(false), [app.conv?.id]);

  const dropCombine = async (sourceId: string, targetId: string) => {
    if (app.streaming || sourceId === targetId) return;
    // combine always replays the *active* branch, so switch to the dragged one first
    if (sourceId !== app.conv?.activeBranchId) await app.switchBranch(sourceId);
    app.openModal('combine', { combineTargetId: targetId });
  };

  if (!app.sidebarOpen) return null;

  return (
    <aside className="sidebar">
      <button
        className="btn btn-primary btn-block"
        style={{ marginTop: 0, justifyContent: 'flex-start', gap: 8 }}
        onClick={() => void app.newChat()}
      >
        <Plus />New chat
      </button>

      <div>
        <div className="side-label">Recent</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {app.convs.map((c) => {
            const active = c.id === app.conv?.id;
            return (
              <div key={c.id}>
                <div className={`conv-row ${active ? 'on' : ''}`}>
                  {active ? (
                    <button
                      className="btn-plain"
                      style={{ width: 14, flex: 'none', color: 'var(--color-accent)', display: 'grid', placeItems: 'center' }}
                      onClick={() => setCollapsed((v) => !v)}
                      title={collapsed ? 'Show branches' : 'Hide branches'}
                    >
                      {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    </button>
                  ) : (
                    <span style={{ width: 14, flex: 'none' }} />
                  )}
                  <ConvTitle id={c.id} title={c.title} active={active} onSelect={() => void app.selectConversation(c.id)} />
                </div>

                {active && !collapsed && app.conv && (
                  <div className="branch-list">
                    {app.conv.branches.map((b) => {
                      const on = b.id === app.conv!.activeBranchId;
                      const isMain = b.forkOf === null;
                      return (
                        <button
                          key={b.id}
                          className="btn-plain branch-row"
                          onClick={() => void app.switchBranch(b.id)}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData(BRANCH_MIME, b.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragOver={(e) => {
                            if (e.dataTransfer.types.includes(BRANCH_MIME)) {
                              e.preventDefault();
                              setDragOverId(b.id);
                            }
                          }}
                          onDragLeave={() => setDragOverId((id) => (id === b.id ? null : id))}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragOverId(null);
                            const src = e.dataTransfer.getData(BRANCH_MIME);
                            if (src && src !== b.id) void dropCombine(src, b.id);
                          }}
                          style={{
                            background: on ? 'color-mix(in srgb,var(--color-accent) 22%,transparent)' : 'transparent',
                            boxShadow: on ? 'inset 2px 0 0 var(--color-accent)' : 'none',
                            color: on ? 'var(--color-text)' : 'var(--color-neutral-500)',
                            outline: dragOverId === b.id ? '1.5px dashed var(--color-accent)' : 'none',
                            outlineOffset: -1,
                          }}
                        >
                          <span
                            style={{
                              width: 9,
                              height: 9,
                              borderRadius: '50%',
                              flex: 'none',
                              background: on ? 'var(--color-accent)' : isMain ? 'var(--color-neutral-500)' : 'transparent',
                              border: on || isMain ? 'none' : '1.5px solid var(--color-neutral-500)',
                            }}
                          />
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.name}>
                            {b.name}
                          </span>
                          {on ? (
                            <span className="chip" style={{ padding: '1px 7px' }}>on</span>
                          ) : (
                            <span style={{ fontSize: 10, color: 'var(--color-neutral-500)' }}>{b.messages.length || ''}</span>
                          )}
                        </button>
                      );
                    })}
                    {app.conv.branches.length > 1 && (
                      <button className="btn-plain combine-hint" onClick={() => app.openModal('combine')}>
                        Drag a branch onto another — or click here — to{' '}
                        <b style={{ color: 'var(--color-accent)', fontWeight: 600 }}>combine</b> them.
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
