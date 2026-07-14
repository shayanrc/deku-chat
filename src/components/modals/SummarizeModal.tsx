import { useState } from 'react';
import { previewText, roleLabel, useApp } from '../../state';
import { Modal } from './Modal';
import { SummarizeIcon } from '../icons';

export function SummarizeModal() {
  const app = useApp();
  const [from, setFrom] = useState<number | null>(null);
  const [to, setTo] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const msgs = app.activeBranch?.messages ?? [];

  const lo = from;
  const hi = to ?? from;
  const inRange = (i: number) => lo !== null && hi !== null && i >= lo && i <= hi;
  const count = lo === null || hi === null ? 0 : hi - lo + 1;

  const pick = (i: number) => {
    if (busy) return;
    if (from === null) {
      setFrom(i);
      setTo(null);
    } else if (to === null) {
      if (i === from) setFrom(null);
      else {
        setTo(Math.max(from, i));
        setFrom(Math.min(from, i));
      }
    } else {
      setFrom(i);
      setTo(null);
    }
  };

  const status =
    lo === null
      ? 'Click a message to set the start of the range.'
      : to === null
        ? `Start set at message ${lo + 1}. Click another to set the end — or summarize just this one.`
        : `Selected messages ${lo + 1}–${hi! + 1} (${count}).`;

  const run = () => {
    if (count === 0 || busy || lo === null || hi === null) return;
    setBusy(true);
    // let the selected rows animate away, then summarize for real
    setTimeout(async () => {
      try {
        await app.doSummarize(msgs[lo].id, msgs[hi].id);
        app.closeModal();
      } catch {
        // toast already shown by the store — restore the rows so the user can retry
        setBusy(false);
      }
    }, 1200);
  };

  return (
    <Modal width={640} onClose={app.closeModal} closeDisabled={busy}>
      <div className="modal-pad">
        <div className="modal-title">
          <SummarizeIcon size={20} style={{ color: 'var(--color-accent)' }} />
          <div>Summarize messages</div>
        </div>
        <div className="modal-sub">
          Pick a start and an end — or just one message. Everything in between becomes a single short summary.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {msgs.map((m, i) => (
            <button
              key={m.id}
              className={`btn-plain pick-row row-anim ${inRange(i) ? 'sel' : ''} ${busy && inRange(i) ? 'row-drop' : ''}`}
              onClick={() => pick(i)}
            >
              <span style={{ width: 16, flex: 'none', paddingTop: 2 }}>{inRange(i) ? '●' : '○'}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-neutral-500)', width: 16, flex: 'none', paddingTop: 2 }}>
                {i + 1}
              </span>
              <span className="chip" style={{ flex: 'none' }}>{roleLabel(m)}</span>
              <span style={{ flex: 1, fontSize: 13, lineHeight: 1.4, textAlign: 'left', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {previewText(m.content)}
              </span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
          <div style={{ flex: 1, fontSize: 13, color: 'var(--color-neutral-500)' }}>
            {busy ? 'Summarizing…' : status}
          </div>
          <button className="btn btn-ghost" onClick={app.closeModal} disabled={busy}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={run}
            style={{ opacity: count > 0 && !busy ? 1 : 0.4, pointerEvents: count > 0 && !busy ? 'auto' : 'none' }}
          >
            <SummarizeIcon />
            {count > 0 ? `Summarize ${count} message${count > 1 ? 's' : ''}` : 'Summarize'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
