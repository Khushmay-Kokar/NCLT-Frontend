'use client'
import { useState, useEffect } from 'react'
import Login from './components/Login'
import App   from './components/App'

export default function Page() {
  const [auth, setAuth] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('nclt_auth')
      if (stored) setAuth(JSON.parse(stored))
    } catch {}
    setReady(true)
  }, [])

  if (!ready) return null

  const handleLogin = (data) => {
    localStorage.setItem('nclt_auth', JSON.stringify(data))
    setAuth(data)
  }

  const handleLogout = () => {
    localStorage.removeItem('nclt_auth')
    setAuth(null)
  }

  if (!auth) return <Login onLogin={handleLogin} />
  return <App auth={auth} onLogout={handleLogout} />
}
