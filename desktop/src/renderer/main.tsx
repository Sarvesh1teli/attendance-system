import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles/globals.css'

import { initializeWebApiClient } from './lib/WebApiClient'

// Polyfill window.api when running in Web Browser SaaS mode (attendance.telicampus.in)
if (typeof (window as any).api === 'undefined') {
  ;(window as any).api = initializeWebApiClient()
}

// Ensure Teacher PWA service worker does not hijack /admin routes in browser
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      if (window.location.pathname.startsWith('/admin')) {
        reg.update()
      }
    }
  })
}

function Root() {
  const isWebAdmin = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')
  return (
    <BrowserRouter basename={isWebAdmin ? '/admin' : '/'}>
      <App />
    </BrowserRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
