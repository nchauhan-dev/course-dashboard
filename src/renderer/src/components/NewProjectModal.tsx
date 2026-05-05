import { useState } from 'react'
import { useApp } from '../store/AppContext'
import { api } from '../lib/api'
import { PRESET_COLORS } from '../lib/constants'

interface Props {
  onClose: () => void
  onCreated?: () => void
}

export default function NewProjectModal({ onClose, onCreated }: Props) {
  const { workspacePath, addProject } = useApp()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!workspacePath || !name.trim()) return

    setIsCreating(true)
    setError(null)

    const result = await api.createProject({
      rootPath: workspacePath,
      name: name.trim(),
      description: description.trim(),
      color
    })

    if (!result.success || !result.data) {
      setError(result.error ?? 'Failed to create project')
      setIsCreating(false)
      return
    }

    addProject(result.data)
    onCreated?.()
    onClose()
  }

  const inputStyle: React.CSSProperties = {
    border: '1px solid var(--color-border)',
    background: 'var(--color-panel2)',
    color: 'var(--color-ink)',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500, color: 'var(--color-ink2)',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="card w-full max-w-md p-6 shadow-xl">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-ink)', margin: 0 }}>New Project</h2>
          <button
            onClick={onClose}
            style={{ display: 'flex', padding: 4, borderRadius: 6, color: 'var(--color-mute)', background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-border-s)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label style={labelStyle}>Project name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Introduction to Biology"
              required
              autoFocus
              className="form-input w-full rounded-lg px-3 py-2 text-sm"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description…"
              rows={3}
              className="form-input w-full resize-none rounded-lg px-3 py-2 text-sm"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Color</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', backgroundColor: c,
                    border: 'none', cursor: 'pointer', flexShrink: 0, transition: 'transform 0.1s',
                    transform: color === c ? 'scale(1.15)' : undefined,
                    boxShadow: color === c ? `inset 0 0 0 2px white, 0 0 0 2px ${c}` : undefined,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div style={{ borderRadius: 8, border: '1px solid var(--color-border)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name || 'Project name'}
            </span>
          </div>

          {error && (
            <div style={{ borderRadius: 8, padding: '10px 12px', fontSize: 13, background: 'var(--color-danger-soft)', color: 'var(--color-danger)' }}>{error}</div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !name.trim()}
              className="btn-primary flex-1 justify-center disabled:opacity-50"
            >
              {isCreating ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                'Create Project'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
