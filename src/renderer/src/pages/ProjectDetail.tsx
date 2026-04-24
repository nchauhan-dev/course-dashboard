import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import { api } from '../lib/api'
import CalendarPanel from '../components/CalendarPanel'
import FileTree from '../components/FileTree'
import type { Assignment } from '../../../../types/index'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>()
  const { projects, calendarEvents, activeWorkspace } = useApp()

  const project = projects.find((c) => c.id === projectId)

  // Assignments
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false)
  const [showNewAssignment, setShowNewAssignment] = useState(false)

  // New assignment form
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [newPoints, setNewPoints] = useState('100')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // File tree sidebar
  const [fileTreeKey, setFileTreeKey] = useState(0)
  const [fileSearch, setFileSearch] = useState('')
  const [creatingTopFolder, setCreatingTopFolder] = useState(false)
  const [newTopFolderName, setNewTopFolderName] = useState('')
  const [treeStats, setTreeStats] = useState<{ files: number; bytes: number } | null>(null)

  // Drop-onto-project-root
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounter = useRef(0)

  useEffect(() => {
    if (!project) return
    setIsLoadingAssignments(true)
    api
      .getAssignments(project.id, project.path, project.name, project.color)
      .then((res) => {
        if (res.success && res.data) setAssignments(res.data)
        setIsLoadingAssignments(false)
      })
  }, [project]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreateTopFolder(e: React.FormEvent) {
    e.preventDefault()
    const name = newTopFolderName.trim()
    if (!name || !project) return
    await api.createFolder(`${project.path}/${name}`)
    setCreatingTopFolder(false)
    setNewTopFolderName('')
    setFileTreeKey((k) => k + 1)
  }

  async function handleCreateAssignment(e: React.FormEvent) {
    e.preventDefault()
    if (!project || !newName.trim() || !newDueDate) return
    setIsCreating(true)
    setCreateError(null)

    const result = await api.createAssignment({
      projectPath: project.path,
      projectId: project.id,
      name: newName.trim(),
      description: newDesc.trim(),
      due_date: new Date(newDueDate).toISOString(),
      points: Number(newPoints) || 0,
      instructions: ''
    })

    if (!result.success || !result.data) {
      setCreateError(result.error ?? 'Failed to create assignment')
      setIsCreating(false)
      return
    }

    setAssignments((prev) => [
      ...prev,
      { ...result.data!, projectId: project.id, projectName: project.name, projectColor: project.color }
    ])
    setNewName('')
    setNewDesc('')
    setNewDueDate('')
    setNewPoints('100')
    setShowNewAssignment(false)
    setIsCreating(false)
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center">
        <p style={{ color: 'var(--color-mute)', fontSize: 14 }}>Project not found.</p>
      </div>
    )
  }

  const now = new Date()
  const upcoming = assignments.filter((a) => a.due_date && new Date(a.due_date) >= now)
  const past = assignments.filter((a) => a.due_date && new Date(a.due_date) < now)

  return (
    <div className="flex w-full overflow-hidden" style={{ background: 'var(--color-bg)' }}>

      {/* ── Left portion: header + columns ───────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

      {/* ── Unified header ───────────────────────────────────────────────────── */}
      <header
        className="drag-region flex flex-shrink-0 items-center gap-2.5 px-5"
        style={{ height: 44, borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
      >
        <div className="flex items-center gap-1.5 no-drag" style={{ fontSize: 12, color: 'var(--color-mute)' }}>
          <span>{activeWorkspace || 'Workspace'}</span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 6 6 6-6 6" />
          </svg>
          <span>Projects</span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 6 6 6-6 6" />
          </svg>
          <span className="font-medium" style={{ color: 'var(--color-ink)' }}>{project.name}</span>
        </div>
        <div style={{ flex: 1 }} />
        {/* Search — scoped to project.path */}
        <div
          className="no-drag flex items-center gap-2 rounded-md px-2.5 py-1.5"
          style={{ background: 'var(--color-panel)', border: '1px solid var(--color-border)', fontSize: 11.5, color: 'var(--color-mute)', minWidth: 200 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
          </svg>
          <span>Search files, tasks…</span>
          <span style={{ marginLeft: 'auto', fontFamily: '"Geist Mono", monospace', fontSize: 10, color: 'var(--color-mute)' }}>⌘K</span>
        </div>
      </header>

      {/* ── Columns ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* ── Secondary sidebar: File tree ─────────────────────────────────────── */}
      <aside
        className="flex flex-col flex-shrink-0 overflow-hidden"
        style={{ width: 264, borderRight: '1px solid var(--color-border)', background: 'var(--color-sidebar)' }}
      >
        {/* FILES header + new folder button */}
        <div
          className="flex flex-shrink-0 items-center justify-between px-4 no-drag"
          style={{ height: 34, borderBottom: '1px solid var(--color-border-s)' }}
        >
          <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-mute)' }}>
            Files
          </span>
          <button
            onClick={() => { setCreatingTopFolder(true); setNewTopFolderName('') }}
            style={{ display: 'flex', padding: 3, borderRadius: 4, color: 'var(--color-mute)', background: 'transparent', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-border)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            title="New folder"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        {/* File tree */}
        <div
          className="flex-1 overflow-y-auto overflow-x-hidden no-drag py-1"
          onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setIsDragOver(true) }}
          onDragLeave={() => { dragCounter.current--; if (dragCounter.current === 0) setIsDragOver(false) }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={async (e) => {
            e.preventDefault()
            dragCounter.current = 0
            setIsDragOver(false)
            const files = Array.from(e.dataTransfer.files)
            for (const file of files) {
              const src = (file as unknown as { path: string }).path
              if (src) await api.copyFile({ sourcePath: src, destinationFolder: project.path })
            }
            setFileTreeKey((k) => k + 1)
          }}
          style={isDragOver ? { background: 'color-mix(in oklch, var(--accent) 6%, transparent)' } : undefined}
        >
          {/* Inline new top-level folder input */}
          {creatingTopFolder && (
            <form
              onSubmit={handleCreateTopFolder}
              className="flex items-center gap-2 px-3"
              style={{ height: 36 }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: '#d97706' }}>
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
              <input
                autoFocus
                type="text"
                value={newTopFolderName}
                onChange={(e) => setNewTopFolderName(e.target.value)}
                onBlur={() => { setCreatingTopFolder(false); setNewTopFolderName('') }}
                onKeyDown={(e) => { if (e.key === 'Escape') { setCreatingTopFolder(false); setNewTopFolderName('') } }}
                className="sidebar-input flex-1 min-w-0 p-0 text-sm"
                style={{ color: 'var(--color-ink2)' }}
                placeholder="Folder name"
              />
            </form>
          )}

          <FileTree
            key={fileTreeKey}
            rootPath={project.path}
            naked
            exclude={['Assignments']}
            onStatsReady={(files, bytes) => setTreeStats({ files, bytes })}
          />
        </div>

        {/* Footer */}
        <div
          className="flex flex-shrink-0 items-center justify-between px-4 no-drag"
          style={{ height: 30, borderTop: '1px solid var(--color-border-s)', fontSize: 11, color: 'var(--color-mute)' }}
        >
          {treeStats ? (
            <span>{treeStats.files} {treeStats.files === 1 ? 'file' : 'files'} · {formatBytes(treeStats.bytes)}</span>
          ) : (
            <span />
          )}
          <span className="flex items-center gap-1.5">
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block', flexShrink: 0 }} />
            synced
          </span>
        </div>
      </aside>

      {/* ── Main: Assignments ─────────────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col overflow-hidden">

        {/* Color accent strip */}
        <div style={{ height: 3, background: project.color, flexShrink: 0 }} />

        {/* Content */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '24px 28px' }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-ink)', margin: 0 }}>Assignments</h2>
          </div>

          {isLoadingAssignments ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <>
              {upcoming.length > 0 && (
                <div className="mb-6">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-mute)' }}>Upcoming</p>
                  <div className="space-y-2">
                    {upcoming.map((a) => (
                      <AssignmentRow key={a.id} assignment={a} projectId={project.id} />
                    ))}
                  </div>
                </div>
              )}

              {past.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-mute)' }}>Past</p>
                  <div className="space-y-2">
                    {past.map((a) => (
                      <AssignmentRow key={a.id} assignment={a} projectId={project.id} />
                    ))}
                  </div>
                </div>
              )}

              {assignments.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-sm" style={{ color: 'var(--color-mute)' }}>No assignments yet.</p>
                  <button
                    onClick={() => setShowNewAssignment(true)}
                    className="btn-primary mt-3 no-drag"
                    style={{ fontSize: 12 }}
                  >
                    Add First Assignment
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      </div>{/* end columns */}

      </div>{/* end left portion */}

      {/* ── Right: Calendar ───────────────────────────────────────────────────── */}
      <aside
        className="hidden lg:flex lg:flex-col flex-shrink-0 overflow-hidden"
        style={{ width: 288, borderLeft: '1px solid var(--color-border)', background: 'var(--color-panel)' }}
      >
        <div
          className="drag-region flex-shrink-0 flex items-center px-4"
          style={{ height: 44, borderBottom: '1px solid var(--color-border-s)' }}
        >
          <span className="no-drag" style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-ink)' }}>Calendar</span>
        </div>
        <div className="flex-1 overflow-y-auto no-drag" style={{ padding: '14px 16px' }}>
          <CalendarPanel events={calendarEvents} projectId={project.id} />
        </div>
      </aside>

      {/* ── New assignment modal ──────────────────────────────────────────────── */}
      {showNewAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-ink)', margin: 0 }}>New Assignment</h2>
              <button
                onClick={() => setShowNewAssignment(false)}
                style={{ display: 'flex', padding: 4, borderRadius: 6, color: 'var(--color-mute)', background: 'none', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-panel2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateAssignment} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-ink2)' }}>Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  autoFocus
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-panel)', color: 'var(--color-ink)' }}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-ink2)' }}>Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-panel)', color: 'var(--color-ink)' }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-ink2)' }}>Due date</label>
                  <input
                    type="datetime-local"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    required
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-panel)', color: 'var(--color-ink)' }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-ink2)' }}>Points</label>
                  <input
                    type="number"
                    value={newPoints}
                    onChange={(e) => setNewPoints(e.target.value)}
                    min={0}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-panel)', color: 'var(--color-ink)' }}
                  />
                </div>
              </div>
              {createError && (
                <div className="rounded-lg p-3 text-sm" style={{ background: 'var(--color-danger-soft)', color: 'var(--color-danger)' }}>{createError}</div>
              )}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowNewAssignment(false)} className="btn-secondary flex-1 justify-center">
                  Cancel
                </button>
                <button type="submit" disabled={isCreating} className="btn-primary flex-1 justify-center disabled:opacity-50">
                  {isCreating ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Assignment row ────────────────────────────────────────────────────────────

function AssignmentRow({ assignment, projectId }: { assignment: Assignment; projectId: string }) {
  const navigate = useNavigate()
  const due = new Date(assignment.due_date)
  const isOverdue = due < new Date()
  const hasLate = assignment.submissions.some((s) => s.is_late)
  const hasSubmission = assignment.submissions.length > 0

  return (
    <button
      onClick={() => navigate(`/project/${projectId}/assignment/${assignment.id}`)}
      className="card w-full p-4 text-left transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium" style={{ color: 'var(--color-ink)', fontSize: 13.5 }}>{assignment.name}</p>
          {assignment.description && (
            <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--color-mute)' }}>{assignment.description}</p>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {hasSubmission && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${hasLate ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              {hasLate ? 'Late' : 'Submitted'}
            </span>
          )}
          {!hasSubmission && isOverdue && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Overdue</span>
          )}
          {assignment.points > 0 && (
            <span className="text-xs" style={{ color: 'var(--color-mute)' }}>{assignment.points}pts</span>
          )}
        </div>
      </div>
      <p className={`mt-2 text-xs ${isOverdue && !hasSubmission ? 'text-red-500' : ''}`} style={!isOverdue || hasSubmission ? { color: 'var(--color-mute)' } : undefined}>
        Due {due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
      </p>
    </button>
  )
}
