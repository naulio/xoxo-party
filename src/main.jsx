import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/outfit'
import './styles.css'
import App from './App.jsx'
import { boot } from './store.js'
import { IS_PAGES } from './net.js'

// Anciennes adresses servies par le PC (/c/<token>, /bar…) → routage par ancre.
if (!IS_PAGES && location.pathname !== '/' && !location.hash) {
  location.replace('/#' + location.pathname + location.search)
}

boot()

// Service worker enregistré dès le chargement : requis pour que Chrome
// propose l'installation (beforeinstallprompt) et prêt avant tout abonnement
// aux notifications. Sans handler fetch → aucun impact sur le réseau.
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./sw.js').catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
