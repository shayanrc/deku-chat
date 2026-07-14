import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state';
import { fmtTokens } from '../state';
import { Markdown } from '../markdown';
import { BranchIcon, ChevronDown, CodeIcon, RewindIcon, SearchIcon, SummarizeIcon } from './icons';
import type { Msg, ToolEvent } from '../../shared/types';

function ToolChips({ events }: { events: ToolEvent[] }) {
  const kinds = new Set(events.map((e) => e.kind));
  const skills = events.filter((e) => e.kind === 'skill').length;
  const tools = events.length - skills;
  const label = [
    tools > 0 && `${tools} tool${tools > 1 ? 's' : ''}`,
    skills > 0 && `${skills} skill${skills > 1 ? 's' : ''}`,
  ]
    .filter(Boolean)
    .join(' & ');
  return (
    <details className="work">
      <summary>
        <span style={{ display: 'inline-flex', gap: 6, color: 'var(--color-accent)' }}>
          {kinds.has('web') && <SearchIcon size={14} />}
          {(kinds.has('code') || kinds.has('tool') || kinds.has('mcp') || kinds.has('skill')) && <CodeIcon size={14} />}
        </span>
        Used {label} · <b style={{ color: 'var(--color-text)' }}>Show the work</b>
        <ChevronDown size={13} style={{ marginLeft: 'auto' }} />
      </summary>
      <div className="work-body">
        {events.map((e, i) => (
          <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
            <span className="chip">{e.kind.toUpperCase()}</span>
            <span>{e.detail}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

function SummaryCard({ m, fresh }: { m: Msg; fresh: boolean }) {
  const [showOriginal, setShowOriginal] = useState(false);
  const n = m.summaryOf?.length ?? 0;
  return (
    <div>
      <div
        className={`summary-card ${fresh ? 'fade-in' : ''}`}
        style={fresh ? { border: '1px solid color-mix(in srgb,var(--color-accent) 30%,transparent)' } : undefined}
      >
        <SummarizeIcon size={18} style={{ color: 'var(--color-accent)', marginTop: 1, flex: 'none' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14 }}>Summarized {n} earlier message{n === 1 ? '' : 's'}</div>
          <div style={{ fontSize: 12, color: 'var(--color-neutral-500)', marginTop: 2 }}>
            {m.content} {m.freedTokens ? `Freed ~${fmtTokens(m.freedTokens)} tokens.` : ''}
          </div>
        </div>
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowOriginal((v) => !v)}>
          {showOriginal ? 'Hide original' : 'Show original'}
        </button>
      </div>
      {showOriginal && (
        <div
          style={{
            marginTop: 8,
            marginLeft: 12,
            paddingLeft: 14,
            borderLeft: '2px solid color-mix(in srgb,var(--color-accent) 40%,transparent)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {m.summaryOf?.map((o) => (
            <div key={o.id} style={{ fontSize: 13, lineHeight: 1.5 }}>
              <span className="chip" style={{ marginRight: 8 }}>{o.role === 'user' ? 'you' : 'Deku'}</span>
              {o.content}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MessageList() {
  const app = useApp();
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // stick to the bottom only while the user is already there
  const stickRef = useRef(true);
  const msgs = app.activeBranch?.messages ?? [];

  // only show the live stream on the conversation+branch it belongs to
  const streamHere =
    app.streaming !== null &&
    app.streaming.convId === app.conv?.id &&
    app.streaming.branchId === app.conv?.activeBranchId;

  useEffect(() => {
    if (stickRef.current) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs.length, app.streaming?.content, app.streaming?.toolEvents.length]);

  // Which branches fork off each message shown here. Shown on every branch that
  // shares the fork-point message — the design's own transcript is a child branch
  // and still shows "Branched here → Playful tone · Formal tone".
  const forksAt = (messageId: string) => {
    if (!app.conv) return [];
    return app.conv.branches.filter((b) => b.forkOf?.messageId === messageId).map((b) => b.name);
  };

  const empty = msgs.length === 0 && !streamHere;

  return (
    <div
      className="msgs"
      ref={scrollRef}
      onScroll={() => {
        const el = scrollRef.current;
        if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
    >
      {empty && (
        <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--color-neutral-500)' }}>
          <div style={{ fontSize: 22, marginBottom: 8, color: 'var(--color-text)' }}>What are we working on?</div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            Ask anything. Branch to explore directions, rewind to undo,<br />
            combine branches when ideas converge, summarize to save context.
          </div>
        </div>
      )}

      {msgs.map((m) => {
        const forks = forksAt(m.id);
        return (
          <div key={m.id} style={{ display: 'contents' }}>
            {m.kind === 'summary' ? (
              <SummaryCard m={m} fresh={m.id === app.freshSummaryId} />
            ) : m.role === 'user' ? (
              <div className="msg-user">
                <div className="bubble">{m.content}</div>
                <button
                  className="rewind-here"
                  disabled={!!app.streaming}
                  style={app.streaming ? { opacity: 0.4, cursor: 'default' } : undefined}
                  onClick={() => app.openModal('rewind', { preselectMessageId: m.id })}
                >
                  <RewindIcon size={12} />Rewind to here
                </button>
              </div>
            ) : (
              <div className="msg-assistant" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', alignSelf: 'flex-start' }}>
                {(m.toolEvents?.length ?? 0) > 0 && <ToolChips events={m.toolEvents!} />}
                <div>
                  <Markdown text={m.content} />
                </div>
              </div>
            )}
            {forks.length > 0 && (
              <div className="branch-divider">
                <div className="line-l" />
                <BranchIcon size={14} />
                <span style={{ fontSize: 11, letterSpacing: '.04em' }}>Branched here → {forks.join(' · ')}</span>
                <div className="line-r" />
              </div>
            )}
          </div>
        );
      })}

      {streamHere && app.pendingUser && (
        <div className="msg-user">
          <div className="bubble">{app.pendingUser}</div>
        </div>
      )}

      {streamHere && app.streaming && (
        <div className="msg-assistant" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', alignSelf: 'flex-start' }}>
          {app.streaming.toolEvents.length > 0 && <ToolChips events={app.streaming.toolEvents} />}
          <div>
            {app.streaming.content ? <Markdown text={app.streaming.content} /> : <span className="muted" style={{ fontSize: 13 }}>Thinking…</span>}
            <span className="caret" />
          </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
