import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '@deku/ui';
import type { Backend } from '@deku/ui';
import { IdbStore } from './store/idb';
import { BrowserTransport } from './agent/transport';
import '@deku/ui/styles/theme.css';
import '@deku/ui/styles/app.css';

const store = new IdbStore();
await store.seedIfEmpty();
const backend: Backend = { store, transport: new BrowserTransport(store) };

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App backend={backend} />
  </React.StrictMode>,
);
