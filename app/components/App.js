'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import SessionsSidebar from './SessionsSidebar'
import {
  apiHealth, apiDocuments,
  apiNewSession, apiListSessions, apiGetSession, apiDeleteSession,
  apiUpload, apiChat,
} from '../lib/api'

// ── Helpers ───────────────────────────────────────────────────────────────────
function iaShort(ia) {
  const n = ia.match(/\d+/)
  return n ? `IA ${n[0]}` : ia
}

function parseFollowups(content) {
  const lines = content.split('\n')
  const items = []
  let inSection = false
  for (const line of lines) {
    if (/suggested follow.?up/i.test(line)) { inSection = true; continue }
    if (inSection && /^#{1,3}\s/.test(line) && !/suggested follow/i.test(line)) break
    if (inSection) {
      const m = line.match(/[>•\-*]\s+\*?(.+?)\*?$/)
      if (m) items.push(m[1].trim().replace(/\*$/, '').trim())
    }
  }
  return items.slice(0, 3)
}

// ── Sidebar tabs ──────────────────────────────────────────────────────────────
function SidebarTabs({ tab, onChange }) {
  return (
    <div style={{
      display: 'flex',
      borderBottom: '0.5px solid rgba(255,255,255,0.06)',
      flexShrink: 0,
    }}>
      {['Orders', 'History'].map(t => (
        <button
          key={t}
          onClick={() => onChange(t)}
          style={{
            flex: 1,
            padding: '8px 0',
            background: 'none',
            border: 'none',
            borderBottom: tab === t ? '1.5px solid #d4a030' : '1.5px solid transparent',
            color: tab === t ? '#d4a030' : 'rgba(255,255,255,0.3)',
            fontFamily: 'var(--font-mono), monospace',
            fontSize: '9px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            transition: 'color 0.12s',
            marginBottom: '-0.5px',
          }}
        >
          {t}
        </button>
      ))}
    </div>
  )
}

// ── Orders panel ──────────────────────────────────────────────────────────────
function OrdersPanel({ docs, selected, onToggle, onAll, onClear, onUpload, uploading }) {
  const fileRef = useRef()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{
        padding: '6px 8px 3px',
        fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.18)', fontFamily: 'var(--font-mono), monospace',
      }}>
        Orders ({docs.length}){selected.length > 0 ? ` · ${selected.length} selected` : ' · all'}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px 6px' }}>
        {docs.map(doc => {
          const sel = selected.includes(doc.ia_number)
          const ocb = doc.ocb_accepted
          return (
            <div
              key={doc.ia_number}
              onClick={() => onToggle(doc.ia_number)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '5px 6px', borderRadius: '3px',
                cursor: 'pointer',
                background: sel ? 'rgba(184,134,28,0.1)' : 'transparent',
                marginBottom: '1px', userSelect: 'none',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (!sel) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{
                width: '13px', height: '13px', borderRadius: '2px', flexShrink: 0,
                background: sel ? '#d4a030' : 'transparent',
                border: sel ? 'none' : '0.5px solid rgba(255,255,255,0.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '8px', color: '#0d0c0b', fontWeight: '900',
              }}>
                {sel ? '✓' : ''}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '10px', fontFamily: 'var(--font-mono), monospace',
                  color: sel ? '#d4a030' : 'rgba(255,255,255,0.55)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {iaShort(doc.ia_number)}
                </div>
                <div style={{
                  fontSize: '8px', color: 'rgba(255,255,255,0.18)',
                  textTransform: 'uppercase', fontFamily: 'var(--font-mono), monospace',
                }}>
                  {doc.outcome || 'DISMISSED'}
                </div>
              </div>
              {ocb === true && <span style={{ fontSize: '8px', padding: '1px 4px', background: 'rgba(46,122,72,0.2)', color: '#6fcf97', borderRadius: '2px', fontFamily: 'var(--font-mono), monospace', flexShrink: 0 }}>OCB</span>}
              {ocb === false && <span style={{ fontSize: '8px', padding: '1px 4px', background: 'rgba(139,24,24,0.15)', color: '#e07070', borderRadius: '2px', fontFamily: 'var(--font-mono), monospace', flexShrink: 0 }}>Plan</span>}
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: '4px', padding: '5px 6px', borderTop: '0.5px solid rgba(255,255,255,0.05)' }}>
        {['All', 'Clear'].map(label => (
          <button key={label} onClick={label === 'All' ? onAll : onClear} style={{
            flex: 1, padding: '4px', background: 'rgba(255,255,255,0.04)',
            border: '0.5px solid rgba(255,255,255,0.07)',
            color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono), monospace',
            fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase',
            cursor: 'pointer', borderRadius: '2px',
          }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding: '5px 6px', borderTop: '0.5px solid rgba(255,255,255,0.05)' }}>
        <button
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          style={{
            width: '100%', padding: '5px',
            background: 'rgba(184,134,28,0.08)', border: '0.5px solid rgba(184,134,28,0.2)',
            color: uploading ? 'rgba(184,134,28,0.4)' : '#8a6414',
            fontFamily: 'var(--font-mono), monospace',
            fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase',
            cursor: uploading ? 'not-allowed' : 'pointer', borderRadius: '2px',
          }}
        >
          {uploading ? '⏳ Uploading…' : '+ Upload PDF'}
        </button>
        <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }}
          onChange={e => { if (e.target.files[0]) { onUpload(e.target.files[0]); e.target.value = '' } }}
        />
      </div>
    </div>
  )
}

// ── Message components ────────────────────────────────────────────────────────
function RoutingBadge({ routing }) {
  if (!routing) return null
  const cls = routing.analytical === false ? { bg: 'rgba(26,74,42,0.12)', color: '#2e7a48', border: 'rgba(26,74,42,0.25)' }
    : routing.qtype === 'AGGREGATION' ? { bg: 'rgba(80,60,140,0.1)', color: '#9b8fd4', border: 'rgba(80,60,140,0.2)' }
      : { bg: 'rgba(184,134,28,0.1)', color: '#b8861c', border: 'rgba(184,134,28,0.2)' }
  return (
    <span style={{
      fontSize: '9px', padding: '2px 6px', borderRadius: '2px',
      fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.06em',
      background: cls.bg, color: cls.color, border: `0.5px solid ${cls.border}`,
    }}>
      {routing.emoji} {routing.label}
      {routing.ia_filter && ` · ${iaShort(routing.ia_filter)}`}
    </span>
  )
}

function FollowUps({ content, onSend }) {
  const items = parseFollowups(content)
  if (!items.length) return null
  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8a7e74', fontFamily: 'var(--font-mono), monospace', marginBottom: '4px' }}>
        Suggested follow-ups
      </div>
      {items.map((q, i) => (
        <button key={i} onClick={() => onSend(q)} style={{
          display: 'block', width: '100%', textAlign: 'left',
          padding: '5px 9px', marginBottom: '3px',
          border: '0.5px solid #c8bca8', background: '#faf6ee',
          color: '#524840', fontSize: '11px', cursor: 'pointer',
          fontFamily: 'Georgia, serif', borderRadius: '2px',
          transition: 'border-color 0.1s, color 0.1s',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#b8861c'; e.currentTarget.style.color = '#b8861c' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#c8bca8'; e.currentTarget.style.color = '#524840' }}
        >
          {q}
        </button>
      ))}
    </div>
  )
}

function Thinking() {
  return (
    <div style={{ display: 'flex', gap: '7px' }}>
      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#b8861c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', flexShrink: 0, marginTop: '2px' }}>⚖</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8a7e74', fontFamily: 'var(--font-mono), monospace', marginBottom: '3px' }}>Legal Copilot</div>
        <div style={{ display: 'flex', gap: '5px', padding: '10px 12px', background: '#fffdf8', border: '0.5px solid #e2d8c8', borderRadius: '0 2px 2px 2px', width: 'fit-content' }}>
          {[0, 200, 400].map(delay => (
            <div key={delay} style={{
              width: '5px', height: '5px', borderRadius: '50%', background: '#8a7e74',
              animation: `blink 1.2s ${delay}ms ease-in-out infinite`,
            }} />
          ))}
        </div>
      </div>
      <style>{`@keyframes blink { 0%,100%{opacity:.25;transform:scale(.75)} 50%{opacity:1;transform:scale(1)} }`}</style>
    </div>
  )
}

function ChatMessage({ msg, onSend }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      gap: '7px',
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      maxWidth: isUser ? '72%' : '100%',
      width: isUser ? undefined : '100%',
      animation: 'msgIn 0.2s ease',
    }}>
      <style>{`@keyframes msgIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`}</style>
      <div style={{
        width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0, marginTop: '2px',
        background: isUser ? '#0d0c0b' : '#b8861c',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: isUser ? '9px' : '11px',
        color: isUser ? '#d4a030' : '#0d0c0b',
        fontFamily: 'var(--font-mono), monospace',
      }}>
        {isUser ? 'U' : '⚖'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'wrap', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
          <span style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8a7e74', fontFamily: 'var(--font-mono), monospace' }}>
            {isUser ? 'You' : 'Legal Copilot'}
          </span>
          {!isUser && msg.routing && <RoutingBadge routing={msg.routing} />}
        </div>
        <div style={{
          padding: '9px 12px',
          background: isUser ? '#0d0c0b' : '#fffdf8',
          color: isUser ? 'rgba(255,255,255,0.82)' : '#0d0c0b',
          border: isUser ? 'none' : '0.5px solid #e2d8c8',
          borderRadius: isUser ? '2px 2px 0 2px' : '0 2px 2px 2px',
          fontSize: '13px', lineHeight: 1.7,
          fontFamily: 'Georgia, serif',
        }}>
          {isUser
            ? msg.content
            : <ReactMarkdown remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h3 style={{ fontSize: '13px', fontWeight: 700, margin: '12px 0 4px', color: '#524840', letterSpacing: '0.03em' }}>{children}</h3>,
                h2: ({ children }) => <h3 style={{ fontSize: '13px', fontWeight: 700, margin: '10px 0 4px', color: '#524840' }}>{children}</h3>,
                h3: ({ children }) => <h3 style={{ fontSize: '12px', fontWeight: 700, margin: '8px 0 3px', color: '#524840' }}>{children}</h3>,
                code: ({ inline, children }) => inline
                  ? <code style={{ fontFamily: 'var(--font-mono),monospace', fontSize: '11px', background: '#f4ede0', padding: '1px 5px', borderRadius: '2px', color: '#8b1818', border: '0.5px solid #e2d8c8' }}>{children}</code>
                  : <code style={{ fontFamily: 'var(--font-mono),monospace', fontSize: '11px', color: '#524840' }}>{children}</code>,
                pre: ({ children }) => <pre style={{ background: '#f4ede0', border: '0.5px solid #e2d8c8', padding: '10px 12px', overflowX: 'auto', margin: '6px 0', borderRadius: '2px' }}>{children}</pre>,
                blockquote: ({ children }) => <blockquote style={{ borderLeft: '2px solid #b8861c', paddingLeft: '12px', margin: '6px 0', color: '#524840', fontStyle: 'italic' }}>{children}</blockquote>,
                table: ({ children }) => <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', margin: '6px 0', fontFamily: 'var(--font-mono),monospace' }}>{children}</table>,
                th: ({ children }) => <th style={{ background: '#f4ede0', padding: '4px 8px', textAlign: 'left', border: '0.5px solid #e2d8c8', fontSize: '10px', letterSpacing: '0.05em', textTransform: 'uppercase', color: '#524840' }}>{children}</th>,
                td: ({ children }) => <td style={{ padding: '3px 8px', border: '0.5px solid #e2d8c8', color: '#2a2520' }}>{children}</td>,
                hr: () => <hr style={{ border: 'none', borderTop: '0.5px solid #e2d8c8', margin: '8px 0' }} />,
              }}
            >
              {msg.content || ''}
            </ReactMarkdown>
          }
        </div>
        {!isUser && !msg.streaming && msg.content && (
          <FollowUps content={msg.content} onSend={onSend} />
        )}
      </div>
    </div>
  )
}

// ── Suggestions ───────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  'Why were all 7 RCom IAs dismissed?',
  'Who is the applicant in IA 290?',
  'Which sections were invoked in IA 144?',
  'Quote the tribunal\'s OCB reasoning in IA 1272',
  'Compare Pattern A and Pattern B dismissals',
  'What is the Section 43 test under IBC?',
  'Which cases did the tribunal most frequently cite?',
  'Is Reliance Infratel a subsidiary in IA 290?',
]

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App({ auth, onLogout }) {
  const [docs, setDocs] = useState([])
  const [selected, setSelected] = useState([])
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [sessions, setSessions] = useState([])
  const [dbReady, setDbReady] = useState(false)
  const [sideTab, setSideTab] = useState('Orders')
  const [sessionTitle, setSessionTitle] = useState(null)
  const endRef = useRef()
  const inputRef = useRef()

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const [health, docsData, sessionData, sessionsData] = await Promise.all([
          apiHealth(),
          apiDocuments(),
          apiNewSession([]),
          apiListSessions(),
        ])
        setDbReady(health.db_ready)
        setDocs(docsData.documents || [])
        setSessionId(sessionData.session_id)
        setSessions(sessionsData.sessions || [])
      } catch (err) {
        console.error('Init failed:', err)
      }
    }
    init()
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Doc selection ──────────────────────────────────────────────────────────
  const toggleDoc = (ia) => setSelected(p => p.includes(ia) ? p.filter(x => x !== ia) : [...p, ia])
  const selectAll = () => setSelected(docs.map(d => d.ia_number))
  const clearSel = () => setSelected([])

  // ── Upload ─────────────────────────────────────────────────────────────────
  const handleUpload = async (file) => {
    const msgId = Date.now()
    const stepTexts = [`Extracting ${file.name}…`, 'Loading into database…', 'Generating embeddings…']
    const makeSteps = (activeIdx, errorIdx = -1) => stepTexts.map((text, i) => ({
      text: i === 0 && activeIdx > 0 ? `Extracted: ${file.name}` : text,
      status: errorIdx === i ? 'error' : i < activeIdx ? 'done' : i === activeIdx ? 'active' : 'pending',
    }))

    setMessages(prev => [...prev, { id: msgId, type: 'upload', steps: makeSteps(0) }])
    setUploading(true)

    const updateSteps = (steps) => setMessages(prev => prev.map(m => m.id === msgId ? { ...m, steps } : m))

    try {
      const data = await apiUpload(file, auth.token)
      updateSteps([
        { text: `Extracted: ${data.ia_number} | OCR: ${data.ocr} | Cost: ₹${data.cost_inr?.toFixed(2)}`, status: 'done' },
        { text: `Loaded: ${(data.tables || []).join(', ')}`, status: 'done' },
        { text: 'Embeddings generated', status: 'done' },
      ])
      const docsData = await apiDocuments()
      setDocs(docsData.documents || [])
      if (data.ia_number && !selected.includes(data.ia_number)) {
        setSelected(p => [...p, data.ia_number])
      }
    } catch (err) {
      updateSteps([{ text: `Failed: ${err.message}`, status: 'error' }, ...makeSteps(0).slice(1)])
    } finally {
      setUploading(false)
    }
  }

  // ── New session ────────────────────────────────────────────────────────────
  const handleNewSession = async () => {
    const data = await apiNewSession(selected)
    setSessionId(data.session_id)
    setMessages([])
    setSessionTitle(null)
    // Add optimistic entry to sessions list
    setSessions(prev => [{ id: data.session_id, title: 'New conversation', selected_docs: selected, updated_at: new Date().toISOString(), created_at: new Date().toISOString() }, ...prev])
    setSideTab('Orders')
  }

  // ── Resume session ─────────────────────────────────────────────────────────
  const handleResumeSession = async (session) => {
    try {
      const data = await apiGetSession(session.id)
      if (!data) return

      setSessionId(data.session_id)
      setSessionTitle(data.title)
      setSelected(data.selected_docs || [])

      // Reconstruct messages from persisted data
      const rebuilt = (data.messages || []).map((m, i) => ({
        id: i,
        role: m.role,
        content: m.content,
        routing: m.routing,
        streaming: false,
      }))
      setMessages(rebuilt)
      setSideTab('Orders')
    } catch (err) {
      console.error('Resume failed:', err)
    }
  }

  // ── Delete session ─────────────────────────────────────────────────────────
  const handleDeleteSession = (deletedId) => {
    setSessions(prev => prev.filter(s => s.id !== deletedId))
    if (deletedId === sessionId) {
      setMessages([])
      setSessionId(null)
      setSessionTitle(null)
      apiNewSession(selected).then(data => setSessionId(data.session_id))
    }
  }

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (questionOverride) => {
    const question = (questionOverride || input).trim()
    if (!question || loading) return

    // Create session if needed
    let sid = sessionId
    if (!sid) {
      const data = await apiNewSession(selected)
      sid = data.session_id
      setSessionId(sid)
      setSessions(prev => [{ id: sid, title: 'New conversation', selected_docs: selected, updated_at: new Date().toISOString(), created_at: new Date().toISOString() }, ...prev])
    }

    setInput('')
    setLoading(true)

    const userId = Date.now()
    const assistantId = userId + 1
    setMessages(prev => [...prev, { id: userId, role: 'user', content: question }])
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', streaming: true, routing: null }])

    try {
      for await (const event of apiChat(question, sid, selected, auth.token)) {
        if (event.type === 'routing') {
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, routing: event } : m))
        } else if (event.type === 'token') {
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: (m.content || '') + event.content } : m))
        } else if (event.type === 'title') {
          // Auto-generated title from first message
          setSessionTitle(event.title)
          setSessions(prev => prev.map(s => s.id === sid ? { ...s, title: event.title } : s))
        } else if (event.type === 'done') {
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, streaming: false } : m))
          // Refresh sessions list to update updated_at
          apiListSessions().then(d => setSessions(d.sessions || []))
        }
      }
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: `Error: ${err.message}`, streaming: false } : m))
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [input, loading, sessionId, selected, auth.token])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const scopeText = selected.length ? selected.map(iaShort).join(', ') : 'all orders'

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#0d0c0b' }}>

      {/* ── Sidebar ── */}
      <div style={{
        width: '240px', minWidth: '240px',
        background: '#0d0c0b',
        borderRight: '0.5px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '12px 10px 10px', borderBottom: '0.5px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
          <div style={{ fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#8a6414', fontFamily: 'var(--font-mono), monospace', marginBottom: '2px' }}>⚖ NCLT Copilot</div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.82)', fontFamily: 'Georgia, serif' }}>Legal Intelligence</div>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', marginTop: '1px', fontFamily: 'var(--font-mono), monospace' }}>IBC 2016 · CIRP Analysis</div>
        </div>

        {/* Tabs */}
        <SidebarTabs tab={sideTab} onChange={setSideTab} />

        {/* Tab content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {sideTab === 'Orders' ? (
            <OrdersPanel
              docs={docs}
              selected={selected}
              onToggle={toggleDoc}
              onAll={selectAll}
              onClear={clearSel}
              onUpload={handleUpload}
              uploading={uploading}
            />
          ) : (
            <SessionsSidebar
              sessions={sessions}
              currentSessionId={sessionId}
              onResume={handleResumeSession}
              onNew={handleNewSession}
              onDelete={handleDeleteSession}
              loading={loading}
            />
          )}
        </div>

        {/* User footer */}
        <div style={{ padding: '7px 10px', borderTop: '0.5px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: dbReady ? '#2e7a48' : '#d4a030', boxShadow: dbReady ? '0 0 5px rgba(46,122,72,0.5)' : 'none' }} />
            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-mono), monospace' }}>{auth.username}</span>
          </div>
          <button onClick={onLogout} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.15)', fontFamily: 'var(--font-mono), monospace', fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.color = '#b02424'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.15)'}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* ── Chat main ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#faf6ee' }}>

        {/* Header */}
        <div style={{ padding: '8px 16px', borderBottom: '0.5px solid #e2d8c8', background: '#fffdf8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#524840', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-mono), monospace' }}>
              {sessionTitle || 'NCLT Legal Analysis'}
            </div>
            <div style={{ fontSize: '9px', color: '#8a7e74', fontFamily: 'var(--font-mono), monospace', marginTop: '1px' }}>
              Scope: <span style={{ color: '#b8861c' }}>{scopeText}</span>
            </div>
          </div>
          <button
            onClick={handleNewSession}
            disabled={loading}
            style={{ padding: '3px 10px', background: 'none', border: '0.5px solid #c8bca8', color: '#8a7e74', fontFamily: 'var(--font-mono), monospace', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '2px' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#b8861c'; e.currentTarget.style.color = '#b8861c' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#c8bca8'; e.currentTarget.style.color = '#8a7e74' }}
          >
            + New Chat
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {messages.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem', animation: 'fadeIn 0.4s ease' }}>
              <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
              <div style={{ fontSize: '2.5rem', opacity: 0.15, marginBottom: '1rem' }}>⚖</div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#524840', marginBottom: '0.4rem', fontFamily: 'Georgia, serif' }}>NCLT Legal Copilot</h3>
              <p style={{ color: '#8a7e74', fontSize: '13px', maxWidth: '400px', lineHeight: 1.7, fontFamily: 'Georgia, serif' }}>
                Analytical intelligence for NCLT orders under IBC 2016. Select orders in the sidebar to scope your analysis.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '1.5rem', justifyContent: 'center', maxWidth: '560px' }}>
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => sendMessage(s)} style={{
                    padding: '5px 12px', border: '0.5px solid #c8bca8', background: '#fffdf8',
                    color: '#524840', fontSize: '12px', cursor: 'pointer', borderRadius: '2px',
                    fontFamily: 'Georgia, serif', transition: 'all 0.1s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#b8861c'; e.currentTarget.style.color = '#b8861c' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#c8bca8'; e.currentTarget.style.color = '#524840' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map(msg => {
                if (msg.type === 'upload') return (
                  <div key={msg.id} style={{ display: 'flex', gap: '7px' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#b8861c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', flexShrink: 0, marginTop: '2px' }}>⚖</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8a7e74', fontFamily: 'var(--font-mono), monospace', marginBottom: '3px' }}>System</div>
                      <div style={{ padding: '9px 12px', background: '#fffdf8', border: '0.5px solid #e2d8c8', borderRadius: '0 2px 2px 2px' }}>
                        {msg.steps.map((s, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', marginBottom: i < msg.steps.length - 1 ? '4px' : 0, fontFamily: 'var(--font-mono), monospace', color: s.status === 'done' ? '#2e7a48' : s.status === 'error' ? '#b02424' : s.status === 'active' ? '#b8861c' : '#8a7e74' }}>
                            <span>{s.status === 'done' ? '✓' : s.status === 'error' ? '✗' : s.status === 'active' ? '…' : '○'}</span>
                            <span>{s.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
                if (msg.streaming && !msg.content) return <Thinking key={msg.id} />
                return <ChatMessage key={msg.id} msg={msg} onSend={sendMessage} />
              })}
            </>
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '8px 14px 10px', borderTop: '0.5px solid #e2d8c8', background: '#fffdf8', flexShrink: 0 }}>
          <div style={{ fontSize: '9px', color: '#8a7e74', fontFamily: 'var(--font-mono), monospace', marginBottom: '5px', letterSpacing: '0.04em' }}>
            Searching: <strong style={{ color: '#b8861c' }}>{scopeText}</strong>
            {selected.length > 0 && (
              <button onClick={clearSel} style={{ background: 'none', border: 'none', color: '#8a7e74', textDecoration: 'underline', cursor: 'pointer', fontSize: '9px', fontFamily: 'var(--font-mono), monospace', marginLeft: '6px' }}>
                clear filter
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about IBC 2016, CIRP orders, tribunal reasoning…"
              rows={1}
              disabled={loading}
              style={{
                flex: 1, border: '0.5px solid #c8bca8', background: '#f4ede0',
                padding: '7px 10px', fontFamily: 'Georgia, serif', fontSize: '13px',
                color: '#0d0c0b', resize: 'none', outline: 'none',
                minHeight: '38px', maxHeight: '130px', lineHeight: '1.5',
                borderRadius: '2px', opacity: loading ? 0.6 : 1,
                transition: 'border-color 0.15s',
              }}
              onFocus={e => e.currentTarget.style.borderColor = '#b8861c'}
              onBlur={e => e.currentTarget.style.borderColor = '#c8bca8'}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              style={{
                width: '38px', height: '38px', background: '#0d0c0b', border: 'none',
                color: '#d4a030', cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px', opacity: !input.trim() || loading ? 0.35 : 1,
                borderRadius: '2px', transition: 'opacity 0.12s',
                flexShrink: 0,
              }}
            >
              →
            </button>
          </div>
          <div style={{ fontSize: '9px', color: 'rgba(0,0,0,0.18)', fontFamily: 'var(--font-mono), monospace', marginTop: '4px', letterSpacing: '0.03em' }}>
            Enter to send · Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  )
}