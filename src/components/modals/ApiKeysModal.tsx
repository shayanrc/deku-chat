import { useState } from 'react';
import { useApp } from '../../state';
import { Modal } from './Modal';
import { Check, KeyIcon } from '../icons';

function KeyRow({
  label,
  envKey,
  serverHasKey,
}: {
  label: string;
  envKey: string;
  serverHasKey: boolean;
}) {
  const app = useApp();
  const stored = app.apiKeys[envKey];
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(!stored);

  const save = () => {
    if (!draft.trim()) return;
    app.setApiKey(envKey, draft);
    setDraft('');
    setEditing(false);
    app.flashToast(`${label} key saved in this browser`);
  };

  return (
    <div className="key-row">
      <div style={{ width: 150, flex: 'none' }}>
        <div style={{ fontSize: 13 }}>{label}</div>
        <div className="muted" style={{ fontSize: 10, fontFamily: 'ui-monospace, Menlo, monospace' }}>{envKey}</div>
      </div>

      {stored && !editing ? (
        <>
          <span style={{ flex: 1, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13 }}>••••{stored.slice(-4)}</span>
          <span className="key-status" style={{ color: 'var(--color-accent)' }}>
            <Check size={11} style={{ verticalAlign: -1 }} /> browser
          </span>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setEditing(true)}>Replace</button>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12 }}
            onClick={() => {
              app.removeApiKey(envKey);
              setEditing(true);
            }}
          >
            Remove
          </button>
        </>
      ) : (
        <>
          <input
            className="input"
            type="password"
            placeholder={serverHasKey ? 'Server .env key active — paste to override' : 'Paste API key…'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            autoComplete="off"
          />
          {serverHasKey && !draft && <span className="key-status muted">server .env</span>}
          <button className="btn btn-primary" style={{ opacity: draft.trim() ? 1 : 0.4 }} onClick={save} disabled={!draft.trim()}>
            Save
          </button>
        </>
      )}
    </div>
  );
}

export function ApiKeysModal() {
  const app = useApp();
  const providers = app.meta?.providers ?? [];
  const toolCaps = (app.meta?.capabilities ?? []).filter((c) => c.envKey);

  return (
    <Modal width={620} onClose={app.closeModal}>
      <div className="modal-pad">
        <div className="modal-title">
          <KeyIcon size={20} style={{ color: 'var(--color-accent)' }} />
          <div>API keys</div>
        </div>
        <div className="modal-sub">
          Keys are stored only in this browser (localStorage) and sent with each request — the server never saves them.
          A key set here overrides the server's <code>.env</code> for that provider.
        </div>

        <div className="tiny-label" style={{ marginBottom: 8 }}>Model providers</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 'var(--space-4)' }}>
          {providers.map((p) => (
            <KeyRow key={p.envKey} label={p.name} envKey={p.envKey} serverHasKey={p.hasKey} />
          ))}
        </div>

        <div className="tiny-label" style={{ marginBottom: 8 }}>Tools</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {toolCaps.map((c) => (
            <KeyRow key={c.envKey} label={c.name} envKey={c.envKey!} serverHasKey={c.available} />
          ))}
        </div>
      </div>
    </Modal>
  );
}
