'use client'
import { useState } from 'react'
import { apiLogin } from '../lib/api'

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await apiLogin(username, password)
      onLogin(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-root">
      <div className="login-left">
        <div className="login-card">
          <div className="login-logo">
            <span className="login-logo-glyph">⚖</span>
            <h2>NCLT Legal Copilot</h2>
            <p>IBC 2016 · CIRP Intelligence</p>
          </div>
          <div className="login-divider" />

          {error && <div className="login-error">{error}</div>}

          <form onSubmit={submit}>
            <div className="field">
              <label>Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter username"
                autoFocus
                required
                disabled={loading}
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                disabled={loading}
              />
            </div>
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Authenticating…' : 'Access System →'}
            </button>
          </form>
        </div>
      </div>

      <div className="login-right">
        <div className="login-right-bg" />
        <div className="login-tagline">
          <span className="login-tagline-glyph">⚖</span>
          <h1>NCLT Order<br />Intelligence</h1>
          <p>
            Preferential Transaction Analysis<br />
            IBC 2016 · Section 43 · CIRP<br />
            RCom Corpus · pgvector RAG
          </p>
        </div>
      </div>
    </div>
  )
}
