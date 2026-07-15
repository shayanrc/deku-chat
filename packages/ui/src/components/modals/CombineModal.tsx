import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../state';
import { Modal } from './Modal';
import { ChevronRight, CombineIcon } from '../icons';

const PHASE_LABELS = (active: string, target: string) => [
  'Pick a branch on the left to combine onto.',
  `Lifting “${active}” off the branch point…`,
  `Replaying your messages onto “${target}”…`,
  'Done — the two histories are now one line.',
];

export function CombineModal() {
  const app = useApp();
  const [targetId, setTargetId] = useState<string | null>(null);
  const [phase, setPhase] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const active = app.activeBranch;
  const targets = (app.conv?.branches ?? []).filter((b) => b.id !== active?.id);
  const targetName = targets.find((b) => b.id === targetId)?.name ?? targets[0]?.name ?? 'Main';

  const pick = (id: string) => {
    if (phase) return;
    setTargetId(id);
    setPhase(1);
    timers.current.push(setTimeout(() => setPhase(2), 800));
    timers.current.push(setTimeout(() => setPhase(3), 1700));
    timers.current.push(
      setTimeout(async () => {
        try {
          await app.doCombine(id);
          app.closeModal();
        } catch {
          // toast already shown by the store — rewind the animation so the user can retry
          setPhase(0);
          setTargetId(null);
        }
      }, 2700),
    );
  };

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // drag-and-drop entry: a target was already chosen by dropping one branch onto another
  const dropTarget = app.modalPayload?.combineTargetId;
  useEffect(() => {
    if (dropTarget && targets.some((b) => b.id === dropTarget)) pick(dropTarget);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moved = phase >= 2;
  const c1 = moved ? { x: 31, y: 251 } : { x: 171, y: 131 };
  const c2 = moved ? { x: 31, y: 311 } : { x: 171, y: 191 };

  return (
    <Modal width={720} onClose={app.closeModal} closeDisabled={phase > 0}>
      <div className="modal-pad">
        <div className="modal-title">
          <CombineIcon size={20} style={{ color: 'var(--color-accent)' }} />
          <div>Combine branches</div>
        </div>
        <div className="modal-sub">
          Take the messages from <b style={{ color: 'var(--color-text)' }}>“{active?.name}”</b> and replay them on top of
          another branch, so the two become one line.
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'stretch' }}>
          <div style={{ flex: 'none', width: 180 }}>
            <div className="tiny-label" style={{ marginBottom: 8 }}>Combine onto…</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {targets.map((t) => (
                <button
                  key={t.id}
                  className={`btn-plain pick-row ${targetId === t.id ? 'sel' : ''}`}
                  style={{ alignItems: 'center', padding: 10, fontSize: 13 }}
                  onClick={() => pick(t.id)}
                >
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--color-neutral-500)', flex: 'none' }} />
                  <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                  <ChevronRight size={14} style={{ color: 'var(--color-accent)', opacity: targetId === t.id ? 1 : 0.4 }} />
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, borderLeft: '1px solid var(--color-divider)', paddingLeft: 'var(--space-6)' }}>
            <div style={{ position: 'relative', width: 300, height: 360, margin: '0 auto' }}>
              <svg width={300} height={340} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
                <line x1={40} y1={20} x2={40} y2={200} stroke="var(--color-neutral-600)" strokeWidth={2} />
                <line
                  x1={40} y1={200} x2={40} y2={320}
                  stroke="var(--color-accent)" strokeWidth={2}
                  style={{ opacity: moved ? 1 : 0, transition: 'opacity .6s' }}
                />
                <path
                  d="M40,80 L40,128 Q40,140 52,140 L180,140 L180,200"
                  fill="none" stroke="var(--color-neutral-600)" strokeWidth={2} strokeLinecap="round"
                  style={{ opacity: moved ? 0 : 1, transition: 'opacity .6s' }}
                />
              </svg>
              {[11, 71, 131].map((top) => (
                <div key={top} style={{ position: 'absolute', left: 31, top, width: 18, height: 18, borderRadius: '50%', background: 'var(--color-neutral-500)' }} />
              ))}
              <div style={{ position: 'absolute', left: 31, top: 191, width: 18, height: 18, borderRadius: '50%', background: 'var(--color-neutral-400)' }} />
              <div style={{ position: 'absolute', left: 62, top: 186, fontSize: 11, color: 'var(--color-neutral-500)' }}>
                “{targetName}” tip
              </div>
              <div className={`commit ${phase === 1 ? 'pulse' : ''}`} style={{ width: 18, height: 18, left: c1.x, top: c1.y, background: 'var(--color-accent)' }} />
              <div className={`commit ${phase === 1 ? 'pulse' : ''}`} style={{ width: 18, height: 18, left: c2.x, top: c2.y, background: 'var(--color-accent)' }} />
              <div className="fadeable" style={{ position: 'absolute', left: 200, top: 132, fontSize: 11, color: 'var(--color-accent)', opacity: moved ? 0 : 1 }}>
                “{active?.name}”
              </div>
              <div style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', fontSize: 13, color: 'var(--color-accent)', minHeight: 20 }}>
                {PHASE_LABELS(active?.name ?? '', targetName)[phase]}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
