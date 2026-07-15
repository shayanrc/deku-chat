import { useEffect, useRef, useState } from 'react';
import { fmtTokens, useApp } from '../state';
import { Popover } from './Popover';
import { Check, ChevronDown, Moon, Sun, SummarizeIcon, TreeIcon } from './icons';

function AvatarMenu({
  x,
  y,
  onClose,
  anchorRef,
}: {
  x: number;
  y: number;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
}) {
  const app = useApp();
  useEffect(() => {
    const close = (e: MouseEvent) => {
      // let the avatar's own click handler toggle the menu instead of fighting it
      if (anchorRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, anchorRef]);

  const keyCount = Object.keys(app.apiKeys).length;

  return (
    <div
      className="ctx-menu"
      style={{ left: Math.min(x, window.innerWidth - 230), top: Math.min(y, window.innerHeight - 140) }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="menu-head">MK · local profile</div>
      <button
        type="button"
        role="menuitem"
        className="btn-plain mrow"
        onClick={() => {
          onClose();
          app.openModal('keys');
        }}
      >
        <span>API keys…</span>
        {keyCount > 0 && <span className="chip" style={{ padding: '1px 7px' }}>{keyCount}</span>}
      </button>
      <button
        type="button"
        role="menuitem"
        className={`btn-plain mrow ${keyCount === 0 ? 'disabled' : ''}`}
        aria-disabled={keyCount === 0}
        onClick={() => {
          if (!keyCount) return;
          for (const k of Object.keys(app.apiKeys)) app.removeApiKey(k);
          onClose();
          app.flashToast('Cleared all API keys from this browser');
        }}
      >
        Clear stored keys
      </button>
    </div>
  );
}

export function TopBar() {
  const app = useApp();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);

  const toggleMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (menu) {
      setMenu(null);
    } else {
      const r = avatarRef.current?.getBoundingClientRect();
      // anchor under the avatar for clicks; at the pointer for context-menu
      setMenu(e.type === 'contextmenu' ? { x: e.clientX, y: e.clientY } : { x: r?.left ?? e.clientX, y: (r?.bottom ?? e.clientY) + 6 });
    }
  };
  const provider = app.meta?.providers.find((p) => p.id === app.providerId);
  const model = provider?.models.find((m) => m.id === app.modelId) ?? provider?.models[0];
  const u = app.usage;

  return (
    <div className="topbar">
      <div className="brand">Deku</div>

      <Popover
        summary={
          <>
            <span className="tiny-label provider-label" style={{ letterSpacing: '.08em' }}>Provider</span>
            {provider?.name ?? '…'}
            <ChevronDown size={13} style={{ color: 'var(--color-neutral-500)' }} />
          </>
        }
        panelStyle={{ top: 'calc(100% + 6px)', left: 0, width: 200 }}
      >
        {(close) =>
          app.meta?.providers.map((p) => {
            const blocked = Boolean(p.unavailableReason);
            const ready = !blocked && app.providerReady(p.envKey);
            return (
              <button
                type="button"
                key={p.id}
                className={`btn-plain mrow ${p.id === app.providerId ? 'on' : ''} ${ready ? '' : 'disabled'}`}
                aria-disabled={!ready}
                title={ready ? undefined : (p.unavailableReason ?? 'Right-click the avatar → API keys… to add one')}
                onClick={() => {
                  if (!ready) return;
                  app.setProvider(p.id);
                  close();
                }}
              >
                <span>{p.name}</span>
                {p.id === app.providerId && <Check style={{ color: 'var(--color-accent)' }} />}
                {!ready && (
                  <span style={{ fontSize: 10 }} className="muted">{blocked ? 'n/a' : 'no key'}</span>
                )}
              </button>
            );
          })
        }
      </Popover>

      <Popover
        summary={
          <>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-accent)', display: 'inline-block' }} />
            {model?.name ?? '…'}
            <ChevronDown size={13} style={{ color: 'var(--color-neutral-500)' }} />
          </>
        }
        panelStyle={{ top: 'calc(100% + 6px)', left: 0, width: 240 }}
      >
        {(close) => (
          <>
            <div className="tiny-label" style={{ padding: '4px 8px' }}>{provider?.name} models</div>
            {provider?.models.map((m) => (
              <button
                type="button"
                key={m.id}
                className={`btn-plain mrow ${m.id === model?.id ? 'on' : ''}`}
                onClick={() => {
                  app.setModel(m.id);
                  close();
                }}
              >
                <span>{m.name}</span>
                {m.id === model?.id && <Check style={{ color: 'var(--color-accent)' }} />}
              </button>
            ))}
          </>
        )}
      </Popover>

      <div style={{ flex: 1 }} />

      <button className="btn btn-secondary" onClick={() => app.openModal('tree')} title="See the whole conversation tree">
        <TreeIcon size={14} /><span className="lbl-sm">Tree</span>
      </button>

      <div className="seg">
        <button className={app.theme === 'light' ? 'on' : ''} onClick={() => app.setTheme('light')} title="Light mode">
          <Sun />
        </button>
        <button className={app.theme === 'dark' ? 'on' : ''} onClick={() => app.setTheme('dark')} title="Dark mode">
          <Moon />
        </button>
      </div>

      <Popover
        summaryStyle={{ fontSize: 12, gap: 9 }}
        summary={
          <>
            <span className="muted ctx-label">Context</span>
            <span className="ctx-track">
              <span className="ctx-fill" style={{ width: `${u.pct}%` }} />
            </span>
            <b>{u.pct}%</b>
          </>
        }
        panelStyle={{ top: 'calc(100% + 6px)', right: 0, width: 300, padding: 'var(--space-4)' }}
      >
        {(close) => (
          <>
            <div style={{ fontSize: 16, marginBottom: 'var(--space-3)' }}>What's using the context</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 13 }}>
              {(
                [
                  ['System & instructions', u.system],
                  ['Tools & skills', u.tools],
                  ['Conversation', u.conversation],
                  ['Summaries', u.summaries],
                ] as const
              ).map(([label, n]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="muted">{label}</span>
                  <b>{fmtTokens(n)}</b>
                </div>
              ))}
            </div>
            <hr className="hr" style={{ margin: 'var(--space-3) 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 'var(--space-3)' }}>
              <b>{fmtTokens(u.used)} of {fmtTokens(u.window)} used</b>
              <span className="muted">{fmtTokens(Math.max(0, u.window - u.used))} left</span>
            </div>
            <button
              className="btn btn-primary btn-block"
              onClick={() => {
                close();
                app.openModal('summarize');
              }}
            >
              <SummarizeIcon />Compact conversation
            </button>
          </>
        )}
      </Popover>

      <button
        ref={avatarRef}
        className="avatar"
        style={{ cursor: 'pointer', border: 'none', font: 'inherit', fontSize: 12, padding: 0 }}
        title="Account options"
        aria-haspopup="menu"
        aria-expanded={!!menu}
        onClick={toggleMenu}
        onContextMenu={toggleMenu}
      >
        MK
      </button>

      {menu && <AvatarMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)} anchorRef={avatarRef} />}
    </div>
  );
}
