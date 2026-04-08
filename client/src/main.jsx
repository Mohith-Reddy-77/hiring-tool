import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

function Root() {
  useEffect(() => {
    // Ping the server health endpoint once on app load to wake sleeping free instances.
    // Use VITE_API_URL when provided, otherwise call relative `/api/health`.
    const apiBase = (import.meta.env && import.meta.env.VITE_API_URL) || ''
    const healthUrl = apiBase ? `${apiBase.replace(/\/$/, '')}/health` : '/api/health'

    // Fire-and-forget; don't block app startup.
    fetch(healthUrl, { method: 'GET', mode: 'no-cors' }).catch(() => {})

    // Optional: keep the instance warm while the page is open by pinging every 4 minutes.
    const interval = setInterval(() => {
      fetch(healthUrl, { method: 'GET', mode: 'no-cors' }).catch(() => {})
    }, 4 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <StrictMode>
      <App />
    </StrictMode>
  )
}

createRoot(document.getElementById('root')).render(<Root />)
