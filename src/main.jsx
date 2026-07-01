import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Detecta si la web se esta ejecutando como app instalada (PWA), no como
// pestana normal del navegador, y le agrega una clase al <body> para poder
// ajustar el diseno (zonas seguras del notch, sin necesitar la barra del navegador, etc.)
const esStandalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true // iOS

if (esStandalone) {
  document.body.classList.add('pwa-standalone')
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
