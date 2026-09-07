import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles/globals.css'

function Root() {
  if (typeof (window as any).api === 'undefined') {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-900 text-white p-6">
        <div className="max-w-lg text-center bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl">
          <div className="text-4xl mb-4">🖥️</div>
          <h1 className="text-xl font-bold mb-2">Desktop App Window Required</h1>
          <p className="text-sm text-slate-300 mb-4">
            This URL was opened in a standard web browser where <code>window.api</code> is not available.
            The desktop application uses local SQLite, hardware cameras, and IPC, and must run inside the <strong>Electron desktop window</strong>.
          </p>
          <div className="bg-slate-950 text-left text-xs font-mono p-3 rounded border border-slate-800 mb-4 text-emerald-400">
            cd C:\git_project\attendance-system\desktop<br />
            npm run dev
          </div>
          <p className="text-xs text-slate-400">
            If you want to test the mobile/web interface for teachers, open the <strong>Teacher PWA</strong>:
          </p>
          <a
            href="http://localhost:5179"
            className="inline-block mt-2 text-sm font-semibold text-blue-400 underline hover:text-blue-300"
          >
            http://localhost:5179 (Teacher PWA)
          </a>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
