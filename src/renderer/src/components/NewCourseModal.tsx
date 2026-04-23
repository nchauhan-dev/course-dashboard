import { useState } from 'react'
import { useApp } from '../store/AppContext'
import { api } from '../lib/api'

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#06b6d4', '#84cc16', '#a855f7'
]

interface Props {
  onClose: () => void
  onCreated?: () => void
}

export default function NewCourseModal({ onClose, onCreated }: Props) {
  const { workspacePath, addCourse } = useApp()
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

    const result = await api.createCourse({
      rootPath: workspacePath,
      name: name.trim(),
      description: description.trim(),
      color
    })

    if (!result.success || !result.data) {
      setError(result.error ?? 'Failed to create course')
      setIsCreating(false)
      return
    }

    addCourse(result.data)
    onCreated?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="card w-full max-w-md p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">New Course</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Course name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Introduction to Biology"
              required
              autoFocus
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description…"
              rows={3}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Color</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${
                    color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg border border-gray-200 p-3 flex items-center gap-3">
            <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <span className="text-sm font-medium text-gray-800 truncate">
              {name || 'Course name'}
            </span>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
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
                'Create Course'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
