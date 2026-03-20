const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

function getToken() {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(localStorage.getItem('nclt_auth') || 'null')?.token }
  catch { return null }
}

function authHeaders(extra = {}) {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

export async function apiLogin(username, password) {
  const res  = await fetch(`${API}/auth/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ username, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Login failed')
  return data
}

export async function apiHealth() {
  const res = await fetch(`${API}/api/health`, { headers: authHeaders() })
  return res.json()
}

export async function apiDocuments() {
  const res = await fetch(`${API}/api/documents`, { headers: authHeaders() })
  return res.json()
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function apiNewSession(selectedDocs = []) {
  const res = await fetch(`${API}/api/session/new`, {
    method:  'POST',
    headers: authHeaders(),
    body:    JSON.stringify({ selected_docs: selectedDocs }),
  })
  return res.json()
}

export async function apiListSessions() {
  const res = await fetch(`${API}/api/sessions`, { headers: authHeaders() })
  return res.json()
}

export async function apiGetSession(sessionId) {
  const res = await fetch(`${API}/api/session/${sessionId}`, { headers: authHeaders() })
  if (!res.ok) return null
  return res.json()
}

export async function apiDeleteSession(sessionId) {
  await fetch(`${API}/api/session/${sessionId}`, {
    method:  'DELETE',
    headers: authHeaders(),
  })
}

// ── Upload ────────────────────────────────────────────────────────────────────

export async function apiUpload(file, token) {
  const formData = new FormData()
  formData.append('file', file)
  const res  = await fetch(`${API}/api/upload`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}` },
    body:    formData,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Upload failed')
  return data
}

// ── Chat (SSE streaming) ──────────────────────────────────────────────────────

export async function* apiChat(question, sessionId, selectedDocs, token) {
  const res = await fetch(`${API}/api/chat`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body:    JSON.stringify({ question, session_id: sessionId, selected_docs: selectedDocs }),
  })

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let   buffer  = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try { yield JSON.parse(line.slice(6)) }
      catch {}
    }
  }
}
