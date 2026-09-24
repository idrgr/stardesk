import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './app/App'
import { ErrorBoundary } from './app/ErrorBoundary'
import { DataProvider } from './app/data-context'
import { EpochProvider } from './app/epoch-context'
import { SettingsProvider } from './app/settings-context'
import { ToastProvider } from './components/ui/Toast'
import './styles/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <DataProvider>
          <EpochProvider>
            <SettingsProvider>
              <ToastProvider>
                <App />
              </ToastProvider>
            </SettingsProvider>
          </EpochProvider>
        </DataProvider>
      </HashRouter>
    </ErrorBoundary>
  </StrictMode>,
)
