'use client'
import { useState } from 'react'
import { apiDeleteSession } from '../lib/api'

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins  < 1)  return 'just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days  < 7)  return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function groupByDate(sessions) {
  const groups = {}
  for (const s of sessions) {
    const d    = s.updated_at ? new Date(s.updated_at) : new Date()
    const now  = new Date()
    const diff = Math.floor((now - d) / 86400000)
    const key  = diff === 0 ? 'Today'
               : diff === 1 ? 'Yesterday'
               : diff < 7  ? 'This week'
               : diff < 30 ? 'This month'
               : 'Older'
    if (!groups[key]) groups[key] = []
    groups[key].push(s)
  }
  return groups
}

const GROUP_ORDER = ['Today', 'Yesterday', 'This week', 'This month', 'Older']

export default function SessionsSidebar({
  sessions,
  currentSessionId,
  onResume,
  onNew,
  onDelete,
  loading,
}) {
  const [hoverId,    setHoverId]    = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const grouped = groupByDate(sessions)

  const handleDelete = async (e, sessionId) => {
    e.stopPropagation()
    setDeletingId(sessionId)
    try {
      await apiDeleteSession(sessionId)
      onDelete(sessionId)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div style={{
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>

      {/* New chat button */}
      <div style={{ padding: '8px 8px 4px' }}>
        <button
          onClick={onNew}
          disabled={loading}
          style={{
            width: '100%',
            padding: '7px 10px',
            background: 'rgba(184,134,28,0.1)',
            border: '0.5px solid rgba(184,134,28,0.25)',
            color: '#d4a030',
            fontFamily: 'var(--font-mono), monospace',
            fontSize: '10px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1,
            borderRadius: '3px',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span style={{ fontSize: '12px' }}>+</span>
          New conversation
        </button>
      </div>

      {/* Session list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 4px 8px' }}>
        {sessions.length === 0 && (
          <div style={{
            padding: '24px 12px',
            textAlign: 'center',
            color: 'rgba(255,255,255,0.2)',
            fontSize: '11px',
            fontFamily: 'var(--font-mono), monospace',
            letterSpacing: '0.06em',
            lineHeight: 1.7,
          }}>
            No conversations yet.<br/>Start a new one above.
          </div>
        )}

        {GROUP_ORDER.filter(g => grouped[g]).map(group => (
          <div key={group}>
            <div style={{
              padding: '8px 8px 3px',
              fontSize: '9px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.18)',
              fontFamily: 'var(--font-mono), monospace',
            }}>
              {group}
            </div>

            {grouped[group].map(session => {
              const isCurrent = session.id === currentSessionId
              const isHovered = hoverId === session.id
              const isDeleting = deletingId === session.id

              return (
                <div
                  key={session.id}
                  onClick={() => !isDeleting && onResume(session)}
                  onMouseEnter={() => setHoverId(session.id)}
                  onMouseLeave={() => setHoverId(null)}
                  style={{
                    padding: '7px 8px',
                    borderRadius: '3px',
                    cursor: isDeleting ? 'not-allowed' : 'pointer',
                    background: isCurrent
                      ? 'rgba(184,134,28,0.12)'
                      : isHovered
                      ? 'rgba(255,255,255,0.04)'
                      : 'transparent',
                    border: isCurrent
                      ? '0.5px solid rgba(184,134,28,0.2)'
                      : '0.5px solid transparent',
                    marginBottom: '1px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '6px',
                    opacity: isDeleting ? 0.4 : 1,
                    transition: 'background 0.1s',
                    position: 'relative',
                  }}
                >
                  {/* Active indicator */}
                  {isCurrent && (
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '2px',
                      height: '60%',
                      background: '#d4a030',
                      borderRadius: '0 1px 1px 0',
                    }} />
                  )}

                  <div style={{ flex: 1, minWidth: 0, paddingLeft: isCurrent ? '4px' : '0' }}>
                    <div style={{
                      fontSize: '11px',
                      color: isCurrent ? '#d4a030' : 'rgba(255,255,255,0.62)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      lineHeight: 1.4,
                      fontFamily: 'Georgia, serif',
                    }}>
                      {session.title || 'New conversation'}
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      marginTop: '2px',
                    }}>
                      <span style={{
                        fontSize: '9px',
                        color: 'rgba(255,255,255,0.2)',
                        fontFamily: 'var(--font-mono), monospace',
                      }}>
                        {timeAgo(session.updated_at)}
                      </span>
                      {session.selected_docs?.length > 0 && (
                        <span style={{
                          fontSize: '9px',
                          color: 'rgba(184,134,28,0.5)',
                          fontFamily: 'var(--font-mono), monospace',
                        }}>
                          · {session.selected_docs.length} doc{session.selected_docs.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Delete button — only on hover */}
                  {(isHovered || isDeleting) && (
                    <button
                      onClick={(e) => handleDelete(e, session.id)}
                      disabled={isDeleting}
                      title="Delete conversation"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255,255,255,0.2)',
                        cursor: isDeleting ? 'not-allowed' : 'pointer',
                        padding: '2px 4px',
                        fontSize: '11px',
                        lineHeight: 1,
                        flexShrink: 0,
                        borderRadius: '2px',
                        transition: 'color 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = '#b02424'}
                      onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}
                    >
                      {isDeleting ? '…' : '×'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
