import { useEffect, useRef, useState } from 'react';
import { previewText, roleLabel, useApp } from '../../state';
import { Modal } from './Modal';
import { RewindIcon } from '../icons';

export function RewindModal() {
  const app = useApp();
  const msgs = app.activeBranch?.messages ?? [];
  const preselectIdx = app.modalPayload?.preselectMessageId
    ? msgs.findIndex((m) => m.id === app.modalPayload!.preselectMessageId)
    : -1;
  const [selected, setSelected] = useState<number | null>(preselectIdx >= 0 ? preselectIdx : null);
  const [rewinding, setRewinding] = useState(false);
  const preselectRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    preselectRef.current?.scrollIntoView({ block: 'center' });
  }, []);

  const pick = (i: number) => {
    if (rewinding) return;
    setSelected(i);
    setRewinding(true);
    // let the later rows animate away before committing
    setTimeout(async () => {
      try {
        await app.doRewind(msgs[i].id);
        app.closeModal();
      } catch {
        // toast already shown by the store — reset so the user can retry or close
        setRewinding(false);
        setSelected(preselectIdx >= 0 ? preselectIdx : null);
      }
    }, 1500);
  };

  return (
    <Modal width={640} onClose={app.closeModal} closeDisabled={rewinding}>
      <div className="modal-pad">
        <div className="modal-title">
          <RewindIcon size={20} style={{ color: 'var(--color-accent)' }} />
          <div>Rewind the conversation</div>
        </div>
        <div className="modal-sub">
          Pick where to go back to. You'll continue on a fresh branch from that point — the full history stays safe on
          “{app.activeBranch?.name}”.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {msgs.map((m, i) => (
            <button
              key={m.id}
              ref={i === preselectIdx ? preselectRef : undefined}
              className={`btn-plain pick-row row-anim ${selected === i ? 'sel' : ''} ${
                rewinding && selected !== null && i > selected ? 'row-drop' : ''
              }`}
              onClick={() => pick(i)}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-neutral-500)', width: 20, flex: 'none', paddingTop: 2 }}>
                {i + 1}
              </span>
              <span className="chip" style={{ flex: 'none' }}>{roleLabel(m)}</span>
              <span style={{ flex: 1, fontSize: 13, lineHeight: 1.4, textAlign: 'left', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {previewText(m.content)}
              </span>
              <span style={{ fontSize: 11, color: 'var(--color-accent)', flex: 'none', paddingTop: 2 }}>
                {selected === i ? 'go here' : 'rewind'}
              </span>
            </button>
          ))}
        </div>
        {rewinding && (
          <div style={{ marginTop: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--color-accent)', fontSize: 13 }}>
            <RewindIcon size={16} />Rewinding — starting a fresh branch from the point you picked…
          </div>
        )}
      </div>
    </Modal>
  );
}
