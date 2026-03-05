import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'javascript' || label === 'typescript') {
      return new tsWorker()
    }
    return new editorWorker()
  },
}

import '@radix-ui/themes/styles.css'
import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Theme } from '@radix-ui/themes'
import App from './App.jsx'

createRoot(document.getElementById('app')).render(
  <StrictMode>
    <Theme appearance="dark" accentColor="iris" grayColor="slate" radius="small">
      <App />
    </Theme>
  </StrictMode>
)
