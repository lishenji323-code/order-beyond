import '@fontsource/zcool-xiaowei/400.css'
import '@fontsource-variable/noto-serif-sc/wght.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import { registerPwa } from './pwa'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

registerPwa()
