import { useApp } from '../state';
import { BranchIcon, CombineIcon, PanelLeft, RewindIcon, SummarizeIcon } from './icons';

export function ChatHeader() {
  const app = useApp();
  const manyBranches = (app.conv?.branches.length ?? 0) > 1;
  const hasMessages = (app.activeBranch?.messages.length ?? 0) > 0;

  return (
    <div className="chat-header">
      <button className="btn btn-icon" onClick={app.toggleSidebar} title="Show / hide sidebar">
        <PanelLeft size={16} />
      </button>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 17, lineHeight: 1.1 }}>{app.conv?.title ?? '…'}</div>
        <div style={{ fontSize: 11, color: 'var(--color-neutral-500)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-accent)' }} />
          On branch “{app.activeBranch?.name}”
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <button
        className="btn btn-secondary"
        title="Explore a new direction without losing this one"
        disabled={!hasMessages || !!app.streaming}
        onClick={() => void app.doBranch()}
      >
        <BranchIcon size={14} /><span className="lbl-sm">Branch</span>
      </button>
      <button
        className="btn btn-secondary"
        title="Go back to an earlier point and start fresh from there"
        disabled={!hasMessages || !!app.streaming}
        onClick={() => app.openModal('rewind')}
      >
        <RewindIcon size={14} /><span className="lbl-sm">Rewind</span>
      </button>
      <button
        className="btn btn-secondary"
        title="Merge this branch's ideas into another"
        disabled={!manyBranches || !!app.streaming}
        onClick={() => app.openModal('combine')}
      >
        <CombineIcon size={14} /><span className="lbl-sm">Combine</span>
      </button>
      <button
        className="btn btn-secondary"
        title="Compress a stretch of messages to save space"
        disabled={!hasMessages || !!app.streaming}
        onClick={() => app.openModal('summarize')}
      >
        <SummarizeIcon size={14} /><span className="lbl-sm">Summarize</span>
      </button>
    </div>
  );
}
