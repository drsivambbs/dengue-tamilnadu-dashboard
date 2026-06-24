import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { loadData } from './dataService'

const root = createRoot(document.getElementById('root')!)

function Splash({ message, error }: { message: string; error?: boolean }) {
  return (
    <div className="flex h-screen items-center justify-center bg-canvas text-ink">
      <div className="flex flex-col items-center gap-3">
        <img src="/dph.png" alt="DPH" className="h-12 w-12" />
        <p className={`text-[0.95rem] font-600 ${error ? 'text-alert' : 'text-ink-soft'}`}>{message}</p>
      </div>
    </div>
  )
}

// Load the live dataset from the API before rendering the app.
root.render(<StrictMode><Splash message="Loading surveillance data…" /></StrictMode>)
loadData()
  .then(() => root.render(<StrictMode><App /></StrictMode>))
  .catch((e) =>
    root.render(<StrictMode><Splash error message={`Could not load data — ${String(e.message || e)}. Please refresh.`} /></StrictMode>),
  )
