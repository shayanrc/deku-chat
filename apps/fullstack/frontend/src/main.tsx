import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '@deku/ui';
import { httpBackend } from './http';
import '@deku/ui/styles/theme.css';
import '@deku/ui/styles/app.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App backend={httpBackend} />
  </React.StrictMode>,
);
