import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import { api } from '../lib/api'
import CalendarPanel from '../components/CalendarPanel'
import FileTree from '../components/FileTree'
import type { Assignment } from '../../../../types/index'

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

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

  // Activity
  const [activitySessions, setActivitySessions] = useState<{ start: string; end: string; durationMinutes: number }[]>([])
  const [projectCreatedAt, setProjectCreatedAt] = useState<string | null>(null)

  // Notes (Description + Outcome)
  const [noteDescription, setNoteDescription] = useState('')
  const [noteOutcome, setNoteOutcome] = useState('')
  const descRef = useRef<HTMLTextAreaElement>(null)
  const outcomeRef = useRef<HTMLTextAreaElement>(null)

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

  useEffect(() => {
    if (!project) return
    api.getActivity(project.path).then((res) => {
      if (res.success && res.data) setActivitySessions(res.data)
    })
    api.getProjectMeta(project.path).then((res) => {
      if (res.success && res.data) setProjectCreatedAt(res.data.createdAt)
    })
  }, [project?.path]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!project) return
    api.getProjectNotes(project.path).then((res) => {
      if (res.success && res.data) {
        setNoteDescription(res.data.description)
        setNoteOutcome(res.data.outcome)
        // Grow textareas to fit loaded content
        requestAnimationFrame(() => {
          for (const ref of [descRef, outcomeRef]) {
            if (ref.current) {
              ref.current.style.height = 'auto'
              ref.current.style.height = ref.current.scrollHeight + 'px'
            }
          }
        })
      }
    })
  }, [project?.path]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const projectStats = useMemo(() => {
    const now = new Date()
    const overdue   = assignments.filter((a) => a.submissions.length === 0 && a.due_date && new Date(a.due_date) < now).length
    const remaining = assignments.filter((a) => a.submissions.length === 0 && a.due_date && new Date(a.due_date) >= now).length
    const completed = assignments.filter((a) => a.submissions.length > 0).length
    return { overdue, remaining, completed }
  }, [assignments])

  const activityDays = useMemo(() => {
    if (!projectCreatedAt) return []
    const start = new Date(projectCreatedAt)
    start.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const days: { date: string; hours: number }[] = []
    const cur = new Date(start)
    while (cur <= today) {
      const dateStr = cur.toISOString().slice(0, 10)
      const hours = activitySessions
        .filter((s) => s.start.slice(0, 10) === dateStr)
        .reduce((sum, s) => sum + s.durationMinutes / 60, 0)
      days.push({ date: dateStr, hours })
      cur.setDate(cur.getDate() + 1)
    }
    return days
  }, [activitySessions, projectCreatedAt])

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
          {/* Project title block */}
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-mute)', letterSpacing: '0.04em', marginBottom: 4 }}>
                P-101 · {activeWorkspace}
              </p>
              <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--color-ink)', margin: 0, lineHeight: 1.1 }}>
                {project.name}
              </h1>
            </div>
            <button
              onClick={() => setShowNewAssignment(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                background: 'var(--color-ink)', color: 'var(--color-bg)',
                border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, marginTop: 2,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Assignment
            </button>
          </div>

          {/* Stat strip */}
          <div
            className="flex-shrink-0 grid mb-6"
            style={{ gridTemplateColumns: 'repeat(3, 1fr)', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', marginLeft: -28, marginRight: -28 }}
          >
            {[
              { label: 'Overdue',   value: projectStats.overdue,   color: 'var(--color-danger)' },
              { label: 'Remaining', value: projectStats.remaining, color: 'var(--accent)' },
              { label: 'Completed', value: projectStats.completed, color: 'var(--color-success)' },
            ].map((s, i) => (
              <div
                key={s.label}
                style={{
                  padding: '12px 28px',
                  borderRight: i < 2 ? '1px solid var(--color-border)' : 'none',
                  display: 'flex', flexDirection: 'column', gap: 3,
                }}
              >
                <div style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--color-mute)', fontWeight: 500, textTransform: 'uppercase' }}>{s.label}</div>
                <div style={{ fontSize: 24, fontWeight: 500, color: s.color, letterSpacing: '-0.04em', lineHeight: 1 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Analytics — 1/3 donut + 2/3 assignments list */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'stretch' }}>

            {/* Donut container — 1/3 */}
            <div style={{ flex: '0 0 33.333%', padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <DonutChart overdue={projectStats.overdue} remaining={projectStats.remaining} completed={projectStats.completed} />
              {/* Legend — vertical stack, centered */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, alignSelf: 'center', minWidth: 130 }}>
                {[
                  { label: 'Overdue',   value: projectStats.overdue,   color: 'var(--color-danger)' },
                  { label: 'Remaining', value: projectStats.remaining, color: 'var(--accent)' },
                  { label: 'Completed', value: projectStats.completed, color: 'var(--color-success)' },
                ].map((item) => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11.5, color: 'var(--color-ink2)', flex: 1 }}>{item.label}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-ink)', fontFamily: '"Geist Mono", monospace' }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes container — 2/3 */}
            <div style={{ flex: '0 0 calc(66.667% - 12px)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Description */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: 'var(--color-ink)', fontWeight: 400 }}>Description</span>
                  <span style={{ fontSize: 10.5, color: countWords(noteDescription) >= 100 ? 'var(--color-danger)' : 'var(--color-mute)', fontFamily: '"Geist Mono", monospace' }}>
                    {countWords(noteDescription)} / 100
                  </span>
                </div>
                <textarea
                  ref={descRef}
                  value={noteDescription}
                  placeholder="Add a project description..."
                  rows={2}
                  onChange={(e) => {
                    if (countWords(e.target.value) > 100) return
                    setNoteDescription(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = e.target.scrollHeight + 'px'
                  }}
                  onBlur={() => api.setProjectNotes(project.path, noteDescription, noteOutcome)}
                  className="note-input"
                  style={{ width: '100%', resize: 'none', overflow: 'hidden', fontSize: 13, lineHeight: 1.6, color: 'var(--color-ink)', padding: 0 }}
                />
              </div>

              {/* Divider */}
              <div style={{ borderTop: '1px solid var(--color-border)' }} />

              {/* Outcome */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: 'var(--color-ink)', fontWeight: 400 }}>Outcome</span>
                  <span style={{ fontSize: 10.5, color: countWords(noteOutcome) >= 100 ? 'var(--color-danger)' : 'var(--color-mute)', fontFamily: '"Geist Mono", monospace' }}>
                    {countWords(noteOutcome)} / 100
                  </span>
                </div>
                <textarea
                  ref={outcomeRef}
                  value={noteOutcome}
                  placeholder="Define your desired outcome..."
                  rows={2}
                  onChange={(e) => {
                    if (countWords(e.target.value) > 100) return
                    setNoteOutcome(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = e.target.scrollHeight + 'px'
                  }}
                  onBlur={() => api.setProjectNotes(project.path, noteDescription, noteOutcome)}
                  className="note-input"
                  style={{ width: '100%', resize: 'none', overflow: 'hidden', fontSize: 13, lineHeight: 1.6, color: 'var(--color-ink)', padding: 0 }}
                />
              </div>
            </div>

          </div>

          {/* Resource Hub */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-mute)', marginBottom: 10 }}>Resource Hub</p>
            <div style={{ padding: 20 }} />
          </div>
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
          <CalendarPanel
            events={calendarEvents}
            projectId={project.id}
            completedEvents={assignments
              .filter((a) => a.submissions.length > 0)
              .map((a) => ({
                id: a.id,
                title: a.name,
                due_date: a.due_date,
                projectId: a.projectId,
                projectName: a.projectName,
                projectColor: a.projectColor,
                assignmentId: a.id,
                type: 'assignment' as const,
                isLate: false,
              }))}
          />
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

// ── Donut chart ───────────────────────────────────────────────────────────────

function DonutChart({ overdue, remaining, completed }: { overdue: number; remaining: number; completed: number }) {
  const total = overdue + remaining + completed
  const r = 52
  const cx = 76
  const cy = 76
  const strokeWidth = 14
  const circumference = 2 * Math.PI * r

  if (total === 0) {
    return (
      <svg viewBox="0 0 152 152" width={152} height={152} style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-border)" strokeWidth={strokeWidth} />
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: 13, fontWeight: 600, fill: 'var(--color-mute)', fontFamily: 'inherit' }}>
          No data
        </text>
      </svg>
    )
  }

  const pct = Math.round((completed / total) * 100)

  // Build arc segments in draw order; each circle uses dashoffset to position its slice
  const segments = [
    { value: overdue,   color: 'var(--color-danger)' },
    { value: remaining, color: 'var(--accent)' },
    { value: completed, color: 'var(--color-success)' },
  ]

  let accumulated = 0
  const arcs = segments.map((seg) => {
    const dash = (seg.value / total) * circumference
    const arc = { color: seg.color, dash, offset: -accumulated }
    accumulated += dash
    return arc
  })

  return (
    <svg viewBox="0 0 152 152" width={152} height={152} style={{ flexShrink: 0 }}>
      {/* Track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-border-s)" strokeWidth={strokeWidth} />
      {/* Segments — rotate -90 so arcs start at 12 o'clock */}
      {arcs.map((arc, i) =>
        arc.dash > 0 ? (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
            strokeDasharray={`${arc.dash} ${circumference}`}
            strokeDashoffset={arc.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ) : null
      )}
      {/* Center: percentage */}
      <text x={cx} y={cy - 7} textAnchor="middle"
        style={{ fontSize: 20, fontWeight: 700, fill: 'var(--color-ink)', fontFamily: 'inherit', letterSpacing: '-0.04em' }}>
        {pct}%
      </text>
      <text x={cx} y={cy + 11} textAnchor="middle"
        style={{ fontSize: 9.5, fontWeight: 500, fill: 'var(--color-mute)', fontFamily: 'inherit', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Complete
      </text>
    </svg>
  )
}

// ── Activity chart ────────────────────────────────────────────────────────────

/** Catmull-Rom → cubic bezier smooth path through a set of [x,y] points */
function buildSmoothPath(pts: [number, number][]): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(i + 2, pts.length - 1)]
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0]} ${p2[1]}`
  }
  return d
}

function ActivityChart({ days }: { days: { date: string; hours: number }[] }) {
  const W = 340
  const H = 110
  const padL = 28
  const padR = 8
  const padT = 8
  const padB = 22

  const chartW = W - padL - padR
  const chartH = H - padT - padB

  if (days.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--color-mute)' }}>No activity recorded yet</span>
      </div>
    )
  }

  const maxHours = Math.max(...days.map((d) => d.hours), 0.5)
  // Y axis nice max
  const yMax = maxHours <= 1 ? 1 : maxHours <= 2 ? 2 : maxHours <= 4 ? 4 : maxHours <= 8 ? 8 : Math.ceil(maxHours)
  const yTicks = yMax <= 2 ? [0, yMax / 2, yMax] : [0, yMax / 2, yMax]

  const xFor = (i: number) => padL + (days.length === 1 ? chartW / 2 : (i / (days.length - 1)) * chartW)
  const yFor = (h: number) => padT + chartH - (h / yMax) * chartH

  const pts: [number, number][] = days.map((d, i) => [xFor(i), yFor(d.hours)])
  const linePath = buildSmoothPath(pts)

  // Closed area path (line + drop to baseline)
  const areaPath = pts.length > 0
    ? `${linePath} L ${pts[pts.length - 1][0]} ${padT + chartH} L ${pts[0][0]} ${padT + chartH} Z`
    : ''

  // X-axis labels: show at most 4 evenly spaced (first, last, ~mid)
  const xLabelIndices: number[] = []
  if (days.length === 1) {
    xLabelIndices.push(0)
  } else if (days.length <= 4) {
    days.forEach((_, i) => xLabelIndices.push(i))
  } else {
    xLabelIndices.push(0)
    xLabelIndices.push(Math.round((days.length - 1) / 2))
    xLabelIndices.push(days.length - 1)
  }

  function fmtDate(dateStr: string) {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const gradId = 'actGrad'

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Y-axis grid lines + labels */}
      {yTicks.map((tick) => {
        const y = yFor(tick)
        return (
          <g key={tick}>
            <line x1={padL} y1={y} x2={W - padR} y2={y}
              stroke="var(--color-border)" strokeWidth={1} strokeDasharray="3 3" />
            <text x={padL - 5} y={y} textAnchor="end" dominantBaseline="middle"
              style={{ fontSize: 9, fill: 'var(--color-mute)', fontFamily: 'inherit' }}>
              {tick === 0 ? '' : tick % 1 === 0 ? `${tick}h` : `${tick.toFixed(1)}h`}
            </text>
          </g>
        )
      })}

      {/* Area fill */}
      {areaPath && (
        <path d={areaPath} fill={`url(#${gradId})`} />
      )}

      {/* Line */}
      {linePath && (
        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      )}

      {/* Dots on non-zero days */}
      {pts.map(([x, y], i) =>
        days[i].hours > 0 ? (
          <circle key={i} cx={x} cy={y} r={2.5} fill="var(--accent)" />
        ) : null
      )}

      {/* X-axis baseline */}
      <line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH}
        stroke="var(--color-border)" strokeWidth={1} />

      {/* X-axis labels */}
      {xLabelIndices.map((i) => (
        <text key={i} x={xFor(i)} y={H - 4} textAnchor="middle"
          style={{ fontSize: 9, fill: 'var(--color-mute)', fontFamily: 'inherit' }}>
          {fmtDate(days[i].date)}
        </text>
      ))}
    </svg>
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
