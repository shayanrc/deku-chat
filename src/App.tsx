import { AppProvider, useApp } from './state';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { ChatHeader } from './components/ChatHeader';
import { MessageList } from './components/MessageList';
import { Composer } from './components/Composer';
import { RewindModal } from './components/modals/RewindModal';
import { CombineModal } from './components/modals/CombineModal';
import { SummarizeModal } from './components/modals/SummarizeModal';
import { TreeModal } from './components/modals/TreeModal';
import { ApiKeysModal } from './components/modals/ApiKeysModal';
import { Check, X } from './components/icons';

function Shell() {
  const app = useApp();
  const scope = app.theme === 'light' ? 'scope-industry' : 'scope-nocturne';

  return (
    <div className={`app ${scope}`}>
      <TopBar />
      <div className="layout">
        <Sidebar />
        <main className="main">
          <ChatHeader />
          <MessageList />
          <Composer />
        </main>
      </div>

      {app.modal === 'rewind' && <RewindModal />}
      {app.modal === 'combine' && <CombineModal />}
      {app.modal === 'summarize' && <SummarizeModal />}
      {app.modal === 'tree' && <TreeModal />}
      {app.modal === 'keys' && <ApiKeysModal />}

      {app.toast && (
        <div
          className={`toast toast-box ${app.toast.kind === 'error' ? 'error' : ''}`}
          role="status"
          onMouseEnter={app.pauseToast}
          onMouseLeave={app.resumeToast}
        >
          {app.toast.kind === 'error' ? (
            <span style={{ fontWeight: 700 }}>!</span>
          ) : (
            <Check size={16} style={{ color: 'var(--color-accent-200)' }} />
          )}
          {app.toast.msg}
          <button
            className="btn-plain"
            style={{ width: 'auto', opacity: 0.7, marginLeft: 4 }}
            onClick={app.dismissToast}
            title="Dismiss"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
