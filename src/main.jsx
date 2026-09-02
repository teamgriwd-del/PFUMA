import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import CertificateVerify from './components/CertificateVerify/CertificateVerify.jsx'
import './index.css'

// No router in this app — activeTab state handles everything once logged
// in. A certificate-verification link has to work for a bank/insurer loan
// officer with no PFUMA account at all, so it's the one URL checked before
// the normal (authenticated) app ever mounts.
const certMatch = window.location.pathname.match(/^\/verify\/certificate\/([^/]+)\/?$/);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {certMatch ? <CertificateVerify code={decodeURIComponent(certMatch[1])} /> : <App />}
  </React.StrictMode>,
)

// Required for Chrome/Android to consider the page installable
// ("Add to Home Screen"); harmless no-op cache-wise, see public/sw.js.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
