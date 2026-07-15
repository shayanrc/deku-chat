import { useLayoutEffect, useRef, useState } from 'react';
import { useApp } from '../state';
import { Popover } from './Popover';
import { Check, Plus, SendIcon, X } from './icons';

export function Composer() {
  const app = useApp();
  const [text, setText] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  // auto-grow the textarea with the draft, capped so it never eats the chat
  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);
  const model = app.meta?.providers.find((p) => p.id === app.providerId)?.models.find((m) => m.id === app.modelId);
  const enabled = (app.meta?.capabilities ?? []).filter((c) => app.caps.includes(c.id));

  const submit = () => {
    const content = text.trim();
    if (!content || app.streaming) return;
    setText('');
    void app.send(content);
  };

  return (
    <div className="composer-wrap">
      <div className="composer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
          <Popover
            summaryClass="btn btn-secondary"
            summary={<><Plus size={14} />Add</>}
            panelStyle={{ bottom: 'calc(100% + 6px)', left: 0, width: 230, padding: 6, fontSize: 13 }}
          >
            {(close) => (
              <>
                <div className="tiny-label" style={{ padding: '4px 8px' }}>Capabilities</div>
                {app.meta?.capabilities.map((c) => {
                  const blocked = Boolean(c.unavailableReason);
                  const ready = !blocked && (c.available || (c.envKey ? Boolean(app.apiKeys[c.envKey]) : true));
                  return (
                    <button
                      type="button"
                      key={c.id}
                      className={`btn-plain mrow ${app.caps.includes(c.id) ? 'on' : ''} ${ready ? '' : 'disabled'}`}
                      aria-disabled={!ready}
                      title={ready ? undefined : (c.unavailableReason ?? `Right-click the avatar → API keys… to add ${c.envKey}`)}
                      onClick={() => {
                        if (!ready) return;
                        app.toggleCap(c.id);
                        close();
                      }}
                    >
                      <span>{c.name}</span>
                      {app.caps.includes(c.id) && <Check style={{ color: 'var(--color-accent)' }} />}
                      {!ready && <span className="muted" style={{ fontSize: 10 }}>{blocked ? 'n/a' : 'no key'}</span>}
                    </button>
                  );
                })}
              </>
            )}
          </Popover>
          <span style={{ width: 1, height: 20, background: 'var(--color-divider)' }} />
          {enabled.map((c) => (
            <span key={c.id} className="chip">
              {c.name}
              <button className="chip-x" onClick={() => app.toggleCap(c.id)} title={`Remove ${c.name}`}>✕</button>
            </span>
          ))}
        </div>

        <textarea
          ref={taRef}
          className="input"
          placeholder="Message Deku…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
          <span style={{ fontSize: 11, color: 'var(--color-neutral-500)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-accent)', display: 'inline-block' }} />
            {model?.name}
          </span>
          <span style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>· {app.usage.pct}% context</span>
          <div style={{ flex: 1 }} />
          {app.streaming ? (
            <button className="btn btn-primary" onClick={app.stopStreaming} title="Stop generating">
              <X size={14} />Stop
            </button>
          ) : (
            <button className="btn btn-primary" onClick={submit} disabled={!text.trim()}>
              <SendIcon />Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
