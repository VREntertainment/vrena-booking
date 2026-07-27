import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

const root = document.getElementById('app')

if (!root) throw new Error('Zalo Mini App root element was not found.')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
