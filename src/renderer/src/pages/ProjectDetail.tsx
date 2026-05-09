import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import { api } from '../lib/api'
import CalendarPanel from '../components/CalendarPanel'
import FileTree from '../components/FileTree'
import Header from '../components/Header'
import { USE_NEW_SIDEBAR } from '../App'
import type { Assignment, LinksFile, ProjectLink } from '../../../../types/index'

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

const chevBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 7, border: '1px solid var(--color-border)',
  background: 'transparent', color: 'var(--color-mute)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
  transition: 'background-color 120ms ease, color 120ms ease, transform 120ms ease',
}

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
  const { projects, calendarEvents, activeWorkspace, refreshCalendar, openAssignmentModal } = useApp()

  const project = projects.find((c) => c.id === projectId)

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
  const [creatingTopFolder, setCreatingTopFolder] = useState(false)
  const [newTopFolderName, setNewTopFolderName] = useState('')
  const [treeStats, setTreeStats] = useState<{ files: number; bytes: number } | null>(null)

  // Activity
  const [activitySessions, setActivitySessions] = useState<{ start: string; end: string; durationMinutes: number }[]>([])
  const [projectCreatedAt, setProjectCreatedAt] = useState<string | null>(null)

  // Resource Hub
  const [links, setLinks] = useState<LinksFile | null>(null)
  const [isAddingLink, setIsAddingLink] = useState(false)
  const [newLinkUrl, setNewLinkUrl] = useState('')
  const [isSavingLink, setIsSavingLink] = useState(false)
  const [isLinkDragOver, setIsLinkDragOver] = useState(false)
  const [openLinkMenu, setOpenLinkMenu] = useState<{ linkId: string; x: number; y: number } | null>(null)
  const [renamingLinkId, setRenamingLinkId] = useState<string | null>(null)
  const [renameLinkValue, setRenameLinkValue] = useState('')
  const isSavingRename = useRef(false)
  const [linkSort, setLinkSort] = useState<'date_desc' | 'date_asc' | 'alpha_asc' | 'alpha_desc'>('date_desc')
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const sortBtnRef = useRef<HTMLButtonElement>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [moveSubmenuOpen, setMoveSubmenuOpen] = useState(false)
  const [categoryMenu, setCategoryMenu] = useState<{ name: string; x: number; y: number } | null>(null)
  const [renamingCategory, setRenamingCategory] = useState<string | null>(null)
  const [renameCategoryValue, setRenameCategoryValue] = useState('')
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null)

  // Assignment modal
  const [openAssignmentId, setOpenAssignmentId] = useState<string | null>(null)

  // Lifted calendar nav state
  const todayDate = new Date()
  const [calViewDate, setCalViewDate] = useState(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1))
  const calYear  = calViewDate.getFullYear()
  const calMonth = calViewDate.getMonth()
  function prevCalMonth() { setCalViewDate(new Date(calYear, calMonth - 1, 1)) }
  function nextCalMonth() { setCalViewDate(new Date(calYear, calMonth + 1, 1)) }

  // Delegate to global modal in AppContext
  useEffect(() => {
    if (!openAssignmentId || !project) return
    openAssignmentModal(project.id, openAssignmentId)
    setOpenAssignmentId(null)
  }, [openAssignmentId, project, openAssignmentModal])

  // Notes (Outcome)
  const [noteOutcome, setNoteOutcome] = useState('')
  const outcomeRef = useRef<HTMLTextAreaElement>(null)

  // Drop-onto-project-root
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounter = useRef(0)

  useEffect(() => {
    if (!project) return
    api.getActivity(project.path).then((res) => {
      if (res.success && res.data) setActivitySessions(res.data)
    })
    api.getProjectMeta(project.path).then((res) => {
      if (res.success && res.data) setProjectCreatedAt(res.data.createdAt)
    })
    api.getLinks(project.path).then((res) => {
      if (res.success && res.data) setLinks(res.data)
      else setLinks({ categories: [], links: [] })
    })
  }, [project?.path]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!project) return
    api.getProjectNotes(project.path).then((res) => {
      if (res.success && res.data) {
        setNoteOutcome(res.data.outcome)
        // Grow textarea to fit loaded content
        requestAnimationFrame(() => {
          if (outcomeRef.current) {
            outcomeRef.current.style.height = 'auto'
            outcomeRef.current.style.height = outcomeRef.current.scrollHeight + 'px'
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

    setNewName('')
    setNewDesc('')
    setNewDueDate('')
    setNewPoints('100')
    setShowNewAssignment(false)
    setIsCreating(false)
    await refreshCalendar()
  }

  const projectStats = useMemo(() => {
    const events = calendarEvents.filter((e) => e.projectId === projectId)
    const overdue   = events.filter((e) => !e.completed && e.isLate).length
    const remaining = events.filter((e) => !e.completed && !e.isLate).length
    const completed = events.filter((e) => e.completed).length
    return { overdue, remaining, completed }
  }, [calendarEvents, projectId])

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

  async function saveLinkRename(linkId: string, title: string) {
    if (isSavingRename.current) return
    const trimmed = title.trim()
    if (!trimmed || !project) { setRenamingLinkId(null); setRenameLinkValue(''); return }
    isSavingRename.current = true
    try {
      await api.saveRename(project.path, linkId, trimmed)
      const res = await api.getLinks(project.path)
      if (res.success && res.data) setLinks(res.data)
      setRenamingLinkId(null)
      setRenameLinkValue('')
    } finally {
      isSavingRename.current = false
    }
  }

  async function handleRenameCategory(oldName: string, newName: string) {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === oldName || !project) { setRenamingCategory(null); setRenameCategoryValue(''); return }
    await api.renameCategory(project.path, oldName, trimmed)
    const res = await api.getLinks(project.path)
    if (res.success && res.data) setLinks(res.data)
    setRenamingCategory(null)
    setRenameCategoryValue('')
  }

  async function handleMoveCategory(name: string, direction: 'up' | 'down') {
    if (!project) return
    const cats = [...(links?.categories ?? [])]
    const idx = cats.indexOf(name)
    if (idx === -1) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= cats.length) return
    ;[cats[idx], cats[swapIdx]] = [cats[swapIdx], cats[idx]]
    await api.reorderCategories(project.path, cats)
    const res = await api.getLinks(project.path)
    if (res.success && res.data) setLinks(res.data)
  }

  async function handleMoveLink(linkId: string, category: string) {
    if (!project) return
    await api.moveLink(project.path, linkId, category)
    const res = await api.getLinks(project.path)
    if (res.success && res.data) setLinks(res.data)
    setOpenLinkMenu(null)
    setMoveSubmenuOpen(false)
  }

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault()
    const name = newCategoryName.trim()
    if (!name || !project) return
    await api.addCategory(project.path, name)
    const res = await api.getLinks(project.path)
    if (res.success && res.data) setLinks(res.data)
    setIsAddingCategory(false)
    setNewCategoryName('')
  }

  // Close link context menu on outside click
  useEffect(() => {
    if (!openLinkMenu) return
    const handler = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('[data-link-menu]')) { setOpenLinkMenu(null); setMoveSubmenuOpen(false) } }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openLinkMenu])

  // Close sort menu on outside click
  useEffect(() => {
    if (!sortMenuOpen) return
    const handler = () => setSortMenuOpen(false)
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [sortMenuOpen])

  // Close category three-dot menu on outside click
  useEffect(() => {
    if (!categoryMenu) return
    const handler = () => setCategoryMenu(null)
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [categoryMenu])

  // Cancel add-category on outside click
  useEffect(() => {
    if (!isAddingCategory) return
    const handler = () => { setIsAddingCategory(false); setNewCategoryName('') }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isAddingCategory])

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center">
        <p style={{ color: 'var(--color-mute)', fontSize: 14 }}>Project not found.</p>
      </div>
    )
  }

  return (
    <div className="flex w-full overflow-hidden" style={{ background: 'var(--color-bg)' }}>

      {/* ── Left portion: header + columns ───────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

      {/* ── Unified header ───────────────────────────────────────────────────── */}
      <Header />

      {/* ── Stat strip ───────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 grid"
        style={{ gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
      >
        {[
          { label: 'Overdue',   value: projectStats.overdue,   color: 'var(--color-danger)' },
          { label: 'Remaining', value: projectStats.remaining, color: 'var(--accent)' },
          { label: 'Completed', value: projectStats.completed, color: 'var(--color-success)' },
          { label: 'Score',     value: '—',                    color: 'var(--color-ink)' },
        ].map((s, i) => (
          <div
            key={s.label}
            style={{
              padding: '12px 20px',
              borderRight: i < 3 ? '1px solid var(--color-border)' : 'none',
              display: 'flex', flexDirection: 'column', gap: 3,
            }}
          >
            <div style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--color-mute)', fontWeight: 500, textTransform: 'uppercase' }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 500, color: s.color, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── Columns ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* ── Secondary sidebar: File tree ─────────────────────────────────────── */}
      {!USE_NEW_SIDEBAR && <aside
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
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, borderRadius: 5,
              color: 'var(--color-mute)', background: 'transparent', border: 'none', cursor: 'pointer',
              transition: 'background-color 120ms ease, transform 120ms ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-border)')}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'scale(1)' }}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.88)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
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
      </aside>}

      {/* ── Main: Assignments ─────────────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col overflow-hidden">


        {/* Content */}
        <div
          className="flex-1 overflow-y-auto"
          style={{ padding: '24px 28px' }}
          onDragOver={(e) => { e.preventDefault(); setIsLinkDragOver(true) }}
          onDragEnter={(e) => { e.preventDefault(); setIsLinkDragOver(true) }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsLinkDragOver(false) }}
          onDrop={async (e) => {
            e.preventDefault()
            setIsLinkDragOver(false)
            const url = (e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')).trim()
            if (!url || !url.startsWith('http') || !project) return
            setIsSavingLink(true)
            await api.saveLink(project.path, url)
            const res = await api.getLinks(project.path)
            if (res.success && res.data) setLinks(res.data)
            setIsSavingLink(false)
          }}
        >
          {/* Project title block */}
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-mute)', letterSpacing: '0.04em', marginBottom: 4 }}>
                P-101 · {activeWorkspace}
              </p>
              <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--color-ink)', margin: 0, lineHeight: 1.1 }}>
                {project.name}
              </h1>
              {project.description && (
                <p style={{ fontSize: 14, color: 'var(--color-mute)', margin: 0, marginTop: 4 }}>
                  {project.description}
                </p>
              )}
            </div>
            <button
              onClick={() => setShowNewAssignment(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                background: 'var(--color-ink)', color: 'var(--color-bg)',
                border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, marginTop: 2,
                transition: 'filter 120ms ease, transform 120ms ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.15)')}
              onMouseLeave={e => (e.currentTarget.style.filter = '')}
              onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.96)')}
              onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Assignment
            </button>
          </div>

          {/* Outcome card */}
          <div style={{
            marginBottom: 24,
              background: 'var(--color-panel)', border: '1px solid var(--color-border)',
              borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              {/* Card header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-mute)', flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="6" />
                    <circle cx="12" cy="12" r="2" />
                  </svg>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' }}>Outcome</span>
                </div>
                <span style={{ fontSize: 10.5, color: countWords(noteOutcome) >= 100 ? 'var(--color-danger)' : 'var(--color-mute)', fontFamily: '"Geist Mono", monospace', fontVariantNumeric: 'tabular-nums' }}>
                  {countWords(noteOutcome)} / 100
                </span>
              </div>
              {/* Textarea */}
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
                onBlur={() => api.setProjectNotes(project.path, '', noteOutcome)}
                className="note-input"
                style={{ width: '100%', resize: 'none', overflow: 'hidden', fontSize: 13, lineHeight: 1.6, color: 'var(--color-ink)', padding: 0, background: 'transparent', border: 'none' }}
              />
          </div>

          {/* Resource Hub */}
          <div
            style={{
              marginBottom: 24,
              borderRadius: 10,
              padding: isLinkDragOver ? '10px' : 0,
              background: isLinkDragOver ? 'var(--color-border-s)' : 'transparent',
              border: isLinkDragOver ? '1px dashed var(--color-border)' : '1px dashed transparent',
              transition: 'background 120ms ease, border-color 120ms ease, padding 120ms ease',
            }}
          >
            {/* Header row */}
            <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-mute)' }}>
                Resource Hub
              </span>
              <div className="flex items-center" style={{ gap: 6 }}>
                {/* Sort dropdown button */}
                <button
                  ref={sortBtnRef}
                  onMouseDown={(e) => { e.stopPropagation(); setSortMenuOpen(o => !o) }}
                  style={{
                    height: 22, borderRadius: 6, border: '1px solid var(--color-border)',
                    background: sortMenuOpen ? 'var(--color-border-s)' : 'transparent',
                    color: linkSort !== 'date_desc' ? 'var(--color-ink)' : 'var(--color-mute)',
                    display: 'flex', alignItems: 'center', gap: 4,
                    cursor: 'pointer', padding: '0 6px',
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                    <path d="M1 3h10M2 6h7M3 9h5" />
                  </svg>
                  <span style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: '0.02em', lineHeight: 1 }}>
                    {linkSort === 'date_desc' ? 'Newest' : linkSort === 'date_asc' ? 'Oldest' : linkSort === 'alpha_asc' ? 'A→Z' : 'Z→A'}
                  </span>
                </button>
                {/* Add link */}
                <button
                  onClick={() => setIsAddingLink(true)}
                  style={{
                    width: 22, height: 22, borderRadius: 6, border: '1px solid var(--color-border)',
                    background: 'transparent', color: 'var(--color-mute)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <path d="M6 1v10M1 6h10" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Add link input row */}
            {isAddingLink && (
              <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
                <input
                  autoFocus
                  type="url"
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  placeholder="Paste a URL and press Enter..."
                  disabled={isSavingLink}
                  onKeyDown={async (e) => {
                    if (e.key === 'Escape') { setIsAddingLink(false); setNewLinkUrl(''); return }
                    if (e.key === 'Enter') {
                      const url = newLinkUrl.trim()
                      if (!url || !project) return
                      setIsSavingLink(true)
                      await api.saveLink(project.path, url)
                      const res = await api.getLinks(project.path)
                      if (res.success && res.data) setLinks(res.data)
                      setIsSavingLink(false)
                      setIsAddingLink(false)
                      setNewLinkUrl('')
                    }
                  }}
                  className="sidebar-input flex-1 min-w-0"
                  style={{ fontSize: 13, color: 'var(--color-ink2)', opacity: isSavingLink ? 0.5 : 1 }}
                />
                {isSavingLink && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
                    style={{ color: 'var(--color-mute)', flexShrink: 0, animation: 'spin 0.8s linear infinite' }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                )}
              </div>
            )}
            {isSavingLink && !isAddingLink && (
              <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
                  style={{ color: 'var(--color-mute)', animation: 'spin 0.8s linear infinite' }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                <span style={{ fontSize: 12, color: 'var(--color-mute)' }}>Saving link…</span>
              </div>
            )}

            {/* Grouped link display */}
            {links !== null && links.links.length === 0 && !isAddingLink ? (
              <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: 'var(--color-mute)' }}>
                Drop a link or click + to add
              </div>
            ) : (() => {
              // Sort all links
              const sortedLinks = [...(links?.links ?? [])].sort((a, b) => {
                if (linkSort === 'alpha_asc') return (a.title || a.url).localeCompare(b.title || b.url)
                if (linkSort === 'alpha_desc') return (b.title || b.url).localeCompare(a.title || a.url)
                if (linkSort === 'date_asc') return a.createdAt.localeCompare(b.createdAt)
                return b.createdAt.localeCompare(a.createdAt)
              })

              // Build ordered group names from links.categories (Uncategorized included)
              const allCats = links?.categories ?? ['Uncategorized']
              // Pick up any stray categories not yet in the list
              const extraCats = [...new Set(
                sortedLinks.map(l => l.category || 'Uncategorized').filter(c => !allCats.includes(c))
              )]
              const allGroupNames = [...allCats, ...extraCats]
              const groups = allGroupNames
                .map(cat => ({ name: cat, links: sortedLinks.filter(l => (l.category || 'Uncategorized') === cat) }))

              // Shared link-card renderer
              function domainColor(seed: string, offset: number): string {
                let h = 0
                for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
                return `hsl(${(h + offset) % 360}, 45%, 55%)`
              }
              function renderLinkCard(link: ProjectLink) {
                let domain = ''
                try { domain = new URL(link.url).hostname.replace(/^www\./, '') } catch { /* ignore */ }
                const rawTitle = link.title || link.url
                const cleanTitle = rawTitle.includes('\\') || rawTitle.includes('/')
                  ? rawTitle.split(/[\\\/]/).map((s: string) => s.trim()).filter(Boolean).pop() ?? rawTitle
                  : rawTitle
                const c1 = domainColor(domain, 0)
                const c2 = domainColor(domain, 60)
                return (
                  <div
                    key={link.id}
                    onClick={() => api.openExternal(link.url)}
                    onContextMenu={(e) => { e.preventDefault(); setMoveSubmenuOpen(false); setOpenLinkMenu({ linkId: link.id, x: e.clientX, y: e.clientY }) }}
                    style={{
                      background: 'var(--color-panel)', border: '1px solid var(--color-border)',
                      borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
                      display: 'flex', flexDirection: 'row', alignItems: 'center',
                      gap: 10, padding: '8px 10px',
                    }}
                  >
                    {/* Icon */}
                    <div style={{
                      width: 40, height: 40, flexShrink: 0, borderRadius: 8,
                      background: `linear-gradient(135deg, ${c1}, ${c2})`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {link.favicon ? (
                        <img
                          src={link.favicon}
                          alt=""
                          width={20}
                          height={20}
                          style={{ borderRadius: 3 }}
                          onError={(e) => {
                            const el = e.currentTarget
                            el.style.display = 'none'
                            const letter = el.parentElement?.querySelector('.link-letter') as HTMLElement | null
                            if (letter) letter.style.display = 'flex'
                          }}
                        />
                      ) : null}
                      <div
                        className="link-letter"
                        style={{
                          display: link.favicon ? 'none' : 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          fontSize: 15, fontWeight: 600, color: '#fff', textTransform: 'uppercase',
                        }}
                      >
                        {domain.charAt(0) || '?'}
                      </div>
                    </div>
                    {/* Text */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                      {renamingLinkId === link.id ? (
                        <input
                          autoFocus
                          value={renameLinkValue}
                          onChange={e => setRenameLinkValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur() }
                            if (e.key === 'Escape') { setRenamingLinkId(null); setRenameLinkValue('') }
                          }}
                          onBlur={() => saveLinkRename(link.id, renameLinkValue)}
                          onClick={e => e.stopPropagation()}
                          className="sidebar-input"
                          style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-ink)', width: '100%', padding: 0 }}
                        />
                      ) : (
                        <div style={{
                          fontSize: 12, fontWeight: 500, color: 'var(--color-ink)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {cleanTitle}
                        </div>
                      )}
                      <div style={{
                        fontSize: 11, color: 'var(--color-mute)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {domain}
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {groups.map((group) => {
                    const isCollapsed = collapsedGroups.has(group.name)
                    const isUncategorized = group.name === 'Uncategorized'
                    const allCatsOrdered = links?.categories ?? []
                    const catIdx = allCatsOrdered.indexOf(group.name)
                    const isFirst = catIdx === 0
                    const isLast = catIdx === allCatsOrdered.length - 1
                    const arrowBtnStyle = (disabled: boolean): React.CSSProperties => ({
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 18, height: 18, borderRadius: 4,
                      border: 'none', background: 'transparent', padding: 0,
                      color: disabled ? 'var(--color-border)' : 'var(--color-mute)',
                      cursor: disabled ? 'default' : 'pointer',
                      flexShrink: 0,
                      transition: 'color 100ms ease',
                    })
                    return (
                      <div key={group.name}>
                        {/* Group header — delete confirmation replaces it entirely */}
                        {deletingCategory === group.name ? (
                          <div
                            className="flex items-center gap-2"
                            style={{ marginBottom: 8, userSelect: 'none' }}
                          >
                            <span style={{ fontSize: 11, color: 'var(--color-ink2)' }}>
                              Move links to Uncategorized and delete?
                            </span>
                            <button
                              style={{
                                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5,
                                background: 'var(--color-danger)', color: '#fff',
                                border: 'none', cursor: 'pointer',
                              }}
                              onClick={async () => {
                                if (!project) return
                                await api.deleteCategory(project.path, group.name)
                                const res = await api.getLinks(project.path)
                                if (res.success && res.data) setLinks(res.data)
                                setDeletingCategory(null)
                              }}
                            >
                              Confirm
                            </button>
                            <button
                              style={{
                                fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 5,
                                background: 'var(--color-border)', color: 'var(--color-ink)',
                                border: 'none', cursor: 'pointer',
                              }}
                              onClick={() => setDeletingCategory(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div
                            className="flex items-center gap-2"
                            style={{ marginBottom: 8, cursor: 'pointer', userSelect: 'none' }}
                            onClick={() => setCollapsedGroups(prev => {
                              const next = new Set(prev)
                              if (next.has(group.name)) next.delete(group.name)
                              else next.add(group.name)
                              return next
                            })}
                          >
                            <svg
                              width="10" height="10" viewBox="0 0 10 10"
                              fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
                              style={{
                                color: 'var(--color-mute)', flexShrink: 0,
                                transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                                transition: 'transform 120ms ease',
                              }}
                            >
                              <path d="M2 3.5 5 6.5 8 3.5" />
                            </svg>
                            {/* Name — inline rename input when editing */}
                            {renamingCategory === group.name ? (
                              <input
                                autoFocus
                                value={renameCategoryValue}
                                onChange={e => setRenameCategoryValue(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') { e.preventDefault(); handleRenameCategory(group.name, renameCategoryValue) }
                                  if (e.key === 'Escape') { setRenamingCategory(null); setRenameCategoryValue('') }
                                }}
                                onClick={e => e.stopPropagation()}
                                className="sidebar-input"
                                style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-ink2)', letterSpacing: '0.02em', padding: 0, width: 120 }}
                              />
                            ) : (
                              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-ink2)', letterSpacing: '0.02em' }}>
                                {group.name}
                              </span>
                            )}
                            <span style={{ fontSize: 10.5, color: 'var(--color-mute)' }}>
                              {group.links.length}
                            </span>
                            {/* Right-side controls */}
                            <div
                              className="flex items-center"
                              style={{ marginLeft: 'auto', gap: 2 }}
                              onClick={e => e.stopPropagation()}
                            >
                              {/* Three-dot menu — non-Uncategorized only */}
                              {!isUncategorized && (
                                <button
                                  style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    width: 18, height: 18, borderRadius: 4,
                                    border: 'none', background: 'transparent', padding: 0,
                                    color: 'var(--color-mute)', cursor: 'pointer', flexShrink: 0,
                                    transition: 'color 100ms ease',
                                  }}
                                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-ink)')}
                                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-mute)')}
                                  onClick={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect()
                                    setCategoryMenu({ name: group.name, x: rect.left, y: rect.bottom + 4 })
                                  }}
                                  title="Category options"
                                >
                                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                    <circle cx="2" cy="8" r="1.5" />
                                    <circle cx="8" cy="8" r="1.5" />
                                    <circle cx="14" cy="8" r="1.5" />
                                  </svg>
                                </button>
                              )}
                              {/* Reorder arrows */}
                              <button
                                style={arrowBtnStyle(isFirst)}
                                disabled={isFirst}
                                onMouseEnter={e => { if (!isFirst) (e.currentTarget as HTMLElement).style.color = 'var(--color-ink)' }}
                                onMouseLeave={e => { if (!isFirst) (e.currentTarget as HTMLElement).style.color = 'var(--color-mute)' }}
                                onClick={() => handleMoveCategory(group.name, 'up')}
                                title="Move up"
                              >
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                                  <path d="M2 6.5 5 3.5 8 6.5" />
                                </svg>
                              </button>
                              <button
                                style={arrowBtnStyle(isLast)}
                                disabled={isLast}
                                onMouseEnter={e => { if (!isLast) (e.currentTarget as HTMLElement).style.color = 'var(--color-ink)' }}
                                onMouseLeave={e => { if (!isLast) (e.currentTarget as HTMLElement).style.color = 'var(--color-mute)' }}
                                onClick={() => handleMoveCategory(group.name, 'down')}
                                title="Move down"
                              >
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                                  <path d="M2 3.5 5 6.5 8 3.5" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        )}
                        {/* Cards grid */}
                        {!isCollapsed && (
                          group.links.length === 0
                            ? <div style={{ fontSize: 11.5, color: 'var(--color-mute)', padding: '2px 0 4px' }}>No links yet</div>
                            : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                                {group.links.map(link => renderLinkCard(link))}
                              </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Add Category */}
                  <div>
                    {isAddingCategory ? (
                      <div onMouseDown={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          autoFocus
                          value={newCategoryName}
                          onChange={e => setNewCategoryName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleAddCategory(e as any)
                            }
                            if (e.key === 'Escape') {
                              setIsAddingCategory(false)
                              setNewCategoryName('')
                            }
                          }}
                          placeholder="Category name…"
                          className="sidebar-input flex-1 min-w-0"
                          style={{ fontSize: 12 }}
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsAddingCategory(true)}
                        style={{
                          fontSize: 11.5, color: 'var(--color-mute)', background: 'none',
                          border: 'none', cursor: 'pointer', padding: 0,
                          display: 'flex', alignItems: 'center', gap: 4, transition: 'color 100ms ease',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-ink)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-mute)')}
                      >
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                          <path d="M6 1v10M1 6h10" />
                        </svg>
                        Add Category
                      </button>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      </main>

      {/* Link context menu portal */}
      {openLinkMenu && (() => {
        const menuLink = (links?.links ?? []).find(l => l.id === openLinkMenu.linkId)
        if (!menuLink) return null
        const rowStyle: React.CSSProperties = {
          padding: '8px 12px', cursor: 'pointer', fontSize: 13,
          color: 'var(--color-ink)', transition: 'background 80ms ease',
        }
        // All categories the link could be moved to (exclude current)
        const LINK_MENU_HEIGHT = 190
        const moveTargets = ['Uncategorized', ...(links?.categories ?? [])].filter(c => c !== (menuLink.category || 'Uncategorized'))
        const isFlipped = openLinkMenu.y + LINK_MENU_HEIGHT > window.innerHeight - 16
        return createPortal(
          <AnimatePresence>
          <motion.div
            data-link-menu
            initial={{ opacity: 0, y: isFlipped ? 6 : -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: isFlipped ? 6 : -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: isFlipped ? openLinkMenu.y - LINK_MENU_HEIGHT : openLinkMenu.y,
              left: openLinkMenu.x,
              zIndex: 9999, width: 168,
              background: 'var(--color-panel)', border: '1px solid var(--color-border)',
              borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              overflow: 'hidden',
            }}
          >
            <div
              data-link-menu
              style={rowStyle}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-border-s)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              onClick={() => { setOpenLinkMenu(null); setRenamingLinkId(menuLink.id); setRenameLinkValue(menuLink.title || menuLink.url) }}
            >
              Rename
            </div>
            <div
              data-link-menu
              style={rowStyle}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-border-s)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              onClick={() => { api.openExternal(menuLink.url); setOpenLinkMenu(null) }}
            >
              Open in Browser
            </div>
            <div
              data-link-menu
              style={rowStyle}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-border-s)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              onClick={() => { navigator.clipboard.writeText(menuLink.url); setOpenLinkMenu(null) }}
            >
              Copy URL
            </div>
            {/* Move to... */}
            {moveTargets.length > 0 && (
              <>
                <div
                  data-link-menu
                  style={{ ...rowStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-border-s)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => setMoveSubmenuOpen(o => !o)}
                >
                  <span data-link-menu>Move to…</span>
                  <svg
                    data-link-menu
                    width="10" height="10" viewBox="0 0 10 10"
                    fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
                    style={{ color: 'var(--color-mute)', transform: moveSubmenuOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 120ms ease' }}
                  >
                    <path d="M2 3.5 5 6.5 8 3.5" />
                  </svg>
                </div>
                {moveSubmenuOpen && (
                  <div data-link-menu style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-panel2)' }}>
                    {moveTargets.map(cat => (
                      <div
                        data-link-menu
                        key={cat}
                        style={{ ...rowStyle, paddingLeft: 20, fontSize: 12 }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-border-s)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        onClick={() => handleMoveLink(menuLink.id, cat)}
                      >
                        {cat}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            <div data-link-menu style={{ height: 1, background: 'var(--color-border)' }} />
            <div
              data-link-menu
              style={{ ...rowStyle, color: 'var(--color-danger)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-border-s)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              onClick={async () => {
                setOpenLinkMenu(null)
                if (!project) return
                await api.deleteLink(project.path, menuLink.id)
                const res = await api.getLinks(project.path)
                if (res.success && res.data) setLinks(res.data)
              }}
            >
              Delete
            </div>
          </motion.div>
          </AnimatePresence>,
          document.body
        )
      })()}

      {/* Sort dropdown portal */}
      <AnimatePresence>
      {sortMenuOpen && (() => {
        const rect = sortBtnRef.current?.getBoundingClientRect()
        if (!rect) return null
        const options: { label: string; value: typeof linkSort }[] = [
          { label: 'Newest First', value: 'date_desc' },
          { label: 'Oldest First', value: 'date_asc' },
          { label: 'A → Z',        value: 'alpha_asc' },
          { label: 'Z → A',        value: 'alpha_desc' },
        ]
        const rowStyle: React.CSSProperties = {
          padding: '7px 10px', cursor: 'pointer', fontSize: 12.5,
          color: 'var(--color-ink)', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 8,
          transition: 'background 80ms ease',
        }
        return createPortal(
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: rect.bottom + 4,
              left: rect.left,
              zIndex: 9999,
              width: 140,
              background: 'var(--color-panel)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              overflow: 'hidden',
            }}
          >
            {options.map((opt) => (
              <div
                key={opt.value}
                style={rowStyle}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-border-s)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={() => { setLinkSort(opt.value); setSortMenuOpen(false) }}
              >
                <span>{opt.label}</span>
                {linkSort === opt.value && (
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)', flexShrink: 0 }}>
                    <path d="M1.5 6.5 4.5 9.5 10.5 2.5" />
                  </svg>
                )}
              </div>
            ))}
          </motion.div>,
          document.body
        )
      })()}
      </AnimatePresence>

      {/* Category three-dot menu portal */}
      <AnimatePresence>
      {categoryMenu && (() => {
        const rowStyle: React.CSSProperties = {
          padding: '8px 12px', cursor: 'pointer', fontSize: 13,
          color: 'var(--color-ink)', transition: 'background 80ms ease',
        }
        return createPortal(
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: 'fixed', top: categoryMenu.y, left: categoryMenu.x,
              zIndex: 9999, width: 140,
              background: 'var(--color-panel)', border: '1px solid var(--color-border)',
              borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              overflow: 'hidden',
            }}
          >
            <div
              style={rowStyle}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-border-s)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              onClick={() => {
                setRenamingCategory(categoryMenu.name)
                setRenameCategoryValue(categoryMenu.name)
                setCategoryMenu(null)
              }}
            >
              Rename
            </div>
            <div
              style={{ ...rowStyle, color: 'var(--color-danger)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-border-s)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              onClick={() => {
                setDeletingCategory(categoryMenu.name)
                setCategoryMenu(null)
              }}
            >
              Delete
            </div>
          </motion.div>,
          document.body
        )
      })()}
      </AnimatePresence>

      </div>{/* end columns */}

      </div>{/* end left portion */}

      {/* ── Right: Calendar ───────────────────────────────────────────────────── */}
      <aside
        className="hidden lg:flex lg:flex-col flex-shrink-0 overflow-hidden"
        style={{ width: 288, borderLeft: '1px solid var(--color-border)', background: 'var(--color-panel)' }}
      >
        <div
          className="drag-region flex-shrink-0 flex items-center justify-between px-4"
          style={{ height: 44, borderBottom: '1px solid var(--color-border-s)' }}
        >
          <button className="no-drag" onClick={prevCalMonth} style={chevBtn}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-border-s)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-ink)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--color-mute)' }}
            onMouseDown={e => ((e.currentTarget as HTMLElement).style.transform = 'scale(0.88)')}
            onMouseUp={e => ((e.currentTarget as HTMLElement).style.transform = 'scale(1)')}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 6-6 6 6 6" />
            </svg>
          </button>
          <span className="no-drag" style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)', letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>
            {MONTHS[calMonth]} {calYear}
          </span>
          <button className="no-drag" onClick={nextCalMonth} style={chevBtn}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-border-s)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-ink)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--color-mute)' }}
            onMouseDown={e => ((e.currentTarget as HTMLElement).style.transform = 'scale(0.88)')}
            onMouseUp={e => ((e.currentTarget as HTMLElement).style.transform = 'scale(1)')}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto no-drag" style={{ padding: '14px 16px' }}>
          <CalendarPanel
            events={calendarEvents.filter((e) => !e.completed)}
            projectId={project.id}
            onSelectAssignment={(_pid, aid) => setOpenAssignmentId(aid)}
            completedEvents={calendarEvents.filter((e) => e.projectId === project.id && e.completed)}
            month={calMonth}
            year={calYear}
            onPrevMonth={prevCalMonth}
            onNextMonth={nextCalMonth}
            hideMonthNav
          />
        </div>
      </aside>

      {showNewAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-ink)', margin: 0 }}>New Assignment</h2>
              <button
                onClick={() => setShowNewAssignment(false)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: 7,
                  color: 'var(--color-mute)', background: 'none', border: 'none', cursor: 'pointer',
                  transition: 'background-color 120ms ease, transform 120ms ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-panel2)')}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.transform = 'scale(1)' }}
                onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.88)')}
                onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
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
                  className="form-input w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-panel)', color: 'var(--color-ink)' }}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-ink2)' }}>Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={2}
                  className="form-input w-full resize-none rounded-lg border px-3 py-2 text-sm"
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
                    className="form-input w-full rounded-lg border px-3 py-2 text-sm"
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
                    className="form-input w-full rounded-lg border px-3 py-2 text-sm"
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
        style={{ fontSize: 20, fontWeight: 700, fill: 'var(--color-ink)', fontFamily: 'inherit', letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>
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

function AssignmentRow({ assignment, onOpen }: { assignment: Assignment; projectId: string; onOpen: () => void }) {
  const due = new Date(assignment.due_date)
  const isOverdue = due < new Date()
  const hasLate = assignment.submissions.some((s) => s.is_late)
  const hasSubmission = assignment.submissions.length > 0

  return (
    <button
      onClick={onOpen}
      className="card w-full p-4 text-left"
      style={{ transition: 'box-shadow 150ms ease, transform 120ms ease' }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}
      onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.99)')}
      onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
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
            <span style={{ borderRadius: 99, padding: '1px 8px', fontSize: 11, fontWeight: 500, background: hasLate ? 'var(--color-danger-soft)' : 'color-mix(in oklch, var(--color-success) 15%, transparent)', color: hasLate ? 'var(--color-danger)' : 'var(--color-success)' }}>
              {hasLate ? 'Late' : 'Submitted'}
            </span>
          )}
          {!hasSubmission && isOverdue && (
            <span style={{ borderRadius: 99, padding: '1px 8px', fontSize: 11, fontWeight: 500, background: 'var(--color-danger-soft)', color: 'var(--color-danger)' }}>Overdue</span>
          )}
          {assignment.points > 0 && (
            <span className="text-xs" style={{ color: 'var(--color-mute)' }}>{assignment.points}pts</span>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs" style={{ color: isOverdue && !hasSubmission ? 'var(--color-danger)' : 'var(--color-mute)' }}>
        Due {due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
      </p>
    </button>
  )
}
