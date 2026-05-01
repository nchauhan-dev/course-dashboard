import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import { api } from '../lib/api'
import FileTree from './FileTree'
import NewProjectModal from './NewProjectModal'
import SettingsModal from './SettingsModal'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export default function NewSidebar() {
  const { projects, rootPath, activeWorkspace, switchWorkspace, removeProject, refreshProjects } = useApp()
  const navigate = useNavigate()
  const location = useLocation()

  // Derive current project from pathname (useParams() doesn't work outside <Routes>)
  const projectId = location.pathname.startsWith('/project/')
    ? location.pathname.split('/project/')[1]
    : null
  const isDashboard = !projectId
  const currentProject = projectId ? (projects.find((p) => p.id === projectId) ?? null) : null

  // Switcher card dropdown
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const switcherRef = useRef<HTMLDivElement>(null)

  // Workspace management (dashboard switcher)
  const [workspaces, setWorkspaces] = useState<string[]>([])
  const [showNewWorkspace, setShowNewWorkspace] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false)
  const [wsBtnHovered, setWsBtnHovered] = useState(false)

  // Project context menu
  const [hoveredProject, setHoveredProject] = useState<string | null>(null)
  const [openMenuProject, setOpenMenuProject] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const [renamingProject, setRenamingProject] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmDeleteProject, setConfirmDeleteProject] = useState<string | null>(null)
  const projectMenuRef = useRef<HTMLDivElement>(null)

  // User / footer
  const [userName, setUserName] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showNewProject, setShowNewProject] = useState(false)
  const [footerMenuOpen, setFooterMenuOpen] = useState(false)
  const [footerMenuPos, setFooterMenuPos] = useState({ bottom: 0, left: 0 })
  const footerMenuBtnRef = useRef<HTMLButtonElement>(null)
  const footerMenuDropdownRef = useRef<HTMLDivElement>(null)

  // File tree stats
  const [treeStats, setTreeStats] = useState<{ files: number; bytes: number } | null>(null)

  // New top-level folder
  const [fileTreeKey, setFileTreeKey] = useState(0)
  const [creatingTopFolder, setCreatingTopFolder] = useState(false)
  const [newTopFolderName, setNewTopFolderName] = useState('')

  // Root file tree drop zone
  const [isTreeDragOver, setIsTreeDragOver] = useState(false)
  const treeDragCounter = useRef(0)

  // ── Data loading ──────────────────────────────────────────────────────────────

  function loadUserName() {
    api.loadConfig().then((res) => {
      setUserName(res.success && res.data?.userName ? res.data.userName : '')
    })
  }

  useEffect(() => { loadUserName() }, [])

  useEffect(() => {
    if (!rootPath) return
    api.getWorkspaces(rootPath).then((res) => {
      if (res.success && res.data) setWorkspaces(res.data)
    })
  }, [rootPath, activeWorkspace])

  // ── Click-outside handlers ────────────────────────────────────────────────────

  useEffect(() => {
    if (!switcherOpen) return
    function onMouseDown(e: MouseEvent) {
      if (!switcherRef.current?.contains(e.target as Node)) {
        setSwitcherOpen(false)
        setShowNewWorkspace(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [switcherOpen])

  useEffect(() => {
    if (!openMenuProject) return
    function onMouseDown(e: MouseEvent) {
      if (!projectMenuRef.current?.contains(e.target as Node)) {
        setOpenMenuProject(null)
        setConfirmDeleteProject(null)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [openMenuProject])

  useEffect(() => {
    if (!footerMenuOpen) return
    function onMouseDown(e: MouseEvent) {
      if (
        footerMenuBtnRef.current?.contains(e.target as Node) ||
        footerMenuDropdownRef.current?.contains(e.target as Node)
      ) return
      setFooterMenuOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [footerMenuOpen])

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function openProjectMenu(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 4, left: rect.left - 8 })
    setOpenMenuProject(id)
    setConfirmDeleteProject(null)
  }

  async function handleRenameProject(id: string, oldPath: string, currentName: string) {
    const newName = renameValue.trim()
    setRenamingProject(null)
    if (!newName || newName === currentName) return
    await api.renameFolder({ oldPath, newName })
    await refreshProjects()
  }

  async function handleDeleteProject(id: string, projectPath: string) {
    await api.deleteProject(projectPath)
    removeProject(id)
    setOpenMenuProject(null)
    setConfirmDeleteProject(null)
  }

  async function handleSwitchWorkspace(name: string) {
    setSwitcherOpen(false)
    setShowNewWorkspace(false)
    if (name === activeWorkspace) return
    await switchWorkspace(name)
  }

  async function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault()
    const name = newWorkspaceName.trim()
    if (!name || !rootPath) return
    setIsCreatingWorkspace(true)
    await api.createWorkspace(rootPath, name)
    await switchWorkspace(name)
    setNewWorkspaceName('')
    setShowNewWorkspace(false)
    setSwitcherOpen(false)
    setIsCreatingWorkspace(false)
  }

  async function handleCreateTopFolder(e: React.FormEvent) {
    e.preventDefault()
    const name = newTopFolderName.trim()
    if (!name || !currentProject) return
    await api.createFolder(`${currentProject.path}/${name}`)
    setCreatingTopFolder(false)
    setNewTopFolderName('')
    setFileTreeKey((k) => k + 1)
  }

  function openFooterMenu() {
    if (!footerMenuBtnRef.current) return
    const rect = footerMenuBtnRef.current.getBoundingClientRect()
    setFooterMenuPos({ bottom: window.innerHeight - rect.top + 4, left: rect.left })
    setFooterMenuOpen(true)
  }

  // ── Root file tree drop zone handlers ────────────────────────────────────────

  function handleTreeDragEnter(e: React.DragEvent) {
    e.preventDefault()
    treeDragCounter.current++
    setIsTreeDragOver(true)
  }

  function handleTreeDragLeave(e: React.DragEvent) {
    e.preventDefault()
    treeDragCounter.current--
    if (treeDragCounter.current === 0) setIsTreeDragOver(false)
  }

  function handleTreeDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  async function handleTreeDrop(e: React.DragEvent) {
    e.preventDefault()
    treeDragCounter.current = 0
    setIsTreeDragOver(false)
    if (!currentProject) return
    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return
    for (const file of files) {
      const sourcePath = (file as unknown as { path: string }).path
      if (!sourcePath) continue
      await api.copyFile({ sourcePath, destinationFolder: currentProject.path })
    }
  }

  // ── Derived display values ────────────────────────────────────────────────────

  const switcherName = isDashboard
    ? (activeWorkspace || 'Workspace')
    : (currentProject?.name ?? 'Project')
  const switcherInitial = switcherName[0].toUpperCase()
  const switcherColor = isDashboard ? null : (currentProject?.color ?? null)

  // ── Shared styles ─────────────────────────────────────────────────────────────

  const cardStyle: React.CSSProperties = {
    background: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: 10,
  }

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 10,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-mute)',
    fontWeight: 600,
    flexShrink: 0,
    whiteSpace: 'nowrap' as const,
  }

  const dropdownItemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', padding: '7px 12px',
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 12, textAlign: 'left' as const,
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <aside
        className="flex flex-shrink-0 flex-col overflow-hidden"
        style={{
          width: 232,
          background: 'var(--color-panel)',
          borderRight: '1px solid var(--color-border)',
        }}
      >
        {/* Electron drag region */}
        <div className="drag-region h-8 flex-shrink-0" />

        <div className="no-drag flex flex-1 flex-col overflow-hidden px-3 pb-3" style={{ gap: 10 }}>

          {/* ── Home + Workspace row ───────────────────────────────────────────── */}
          <div className="relative flex-shrink-0 flex" style={{ gap: 6 }} ref={switcherRef}>

            {/* Home button */}
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                ...cardStyle,
                width: 36, height: 36, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                color: isDashboard ? 'var(--color-ink)' : 'var(--color-mute)',
                transition: 'background-color 120ms ease, transform 120ms ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-border-s)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-bg)')}
              onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.92)')}
              onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11 12 3l9 8M5 10v10h14V10" />
              </svg>
            </button>

            {/* Workspace switcher button */}
            <button
              onClick={() => { setSwitcherOpen((v) => !v); setShowNewWorkspace(false) }}
              style={{
                ...cardStyle,
                borderRadius: switcherOpen ? '10px 10px 0 0' : 10,
                flex: 1, height: 36,
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '0 10px',
                cursor: 'pointer',
                transition: 'background-color 120ms ease, transform 120ms ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-border-s)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-bg)')}
              onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
              onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <span style={{
                flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--color-ink)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left',
              }}>
                {activeWorkspace || 'Workspace'}
              </span>
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={2}
                style={{
                  flexShrink: 0, color: 'var(--color-mute)',
                  transform: switcherOpen ? 'rotate(180deg)' : undefined,
                  transition: 'transform 150ms ease',
                }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Workspace dropdown */}
            <AnimatePresence>
            {switcherOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                style={{
                  ...cardStyle,
                  borderRadius: '0 0 10px 10px',
                  borderTop: 'none',
                  position: 'absolute', left: 42, right: 0, top: '100%',
                  zIndex: 50,
                  paddingTop: 4, paddingBottom: 4,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  maxHeight: 240, overflowY: 'auto',
                }}>
                {/* Workspace list */}
                {workspaces.map((ws) => (
                  <button
                    key={ws}
                    onClick={() => handleSwitchWorkspace(ws)}
                    style={{
                      ...dropdownItemStyle,
                      color: ws === activeWorkspace ? 'var(--accent)' : 'var(--color-ink2)',
                      fontWeight: ws === activeWorkspace ? 500 : 400,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-border-s)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >
                    {ws === activeWorkspace ? (
                      <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" style={{ flexShrink: 0 }}>
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <span style={{ width: 12, flexShrink: 0, display: 'inline-block' }} />
                    )}
                    {ws}
                  </button>
                ))}
                <div style={{ borderTop: '1px solid var(--color-border-s)', margin: '4px 0' }} />
                {showNewWorkspace ? (
                  <form onSubmit={handleCreateWorkspace} style={{ padding: '4px 8px 8px' }}>
                    <input
                      type="text"
                      value={newWorkspaceName}
                      onChange={(e) => setNewWorkspaceName(e.target.value)}
                      placeholder="Workspace name…"
                      autoFocus
                      className="form-input w-full rounded-md px-2 py-1 text-xs"
                      style={{ border: '1px solid var(--color-border)', background: 'var(--color-panel2)', marginBottom: 6 }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => setShowNewWorkspace(false)}
                        style={{ flex: 1, borderRadius: 6, padding: '4px 0', fontSize: 11, border: '1px solid var(--color-border)', color: 'var(--color-ink2)', background: 'none', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isCreatingWorkspace || !newWorkspaceName.trim()}
                        style={{
                          flex: 1, borderRadius: 6, padding: '4px 0', fontSize: 11, fontWeight: 500,
                          border: 'none', color: 'white', cursor: 'pointer',
                          background: 'var(--accent)', filter: wsBtnHovered ? 'brightness(0.9)' : undefined,
                        }}
                        onMouseEnter={() => setWsBtnHovered(true)}
                        onMouseLeave={() => setWsBtnHovered(false)}
                      >
                        {isCreatingWorkspace ? '…' : 'Create'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setShowNewWorkspace(true)}
                    style={{ ...dropdownItemStyle, color: 'var(--accent)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-border-s)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    New Workspace
                  </button>
                )}
              </motion.div>
            )}
            </AnimatePresence>
          </div>

          {/* ── Section label ──────────────────────────────────────────────────── */}
          <div style={{ borderTop: '1px solid var(--color-border-s)', marginTop: 2, paddingTop: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={sectionLabelStyle}>
              {isDashboard ? 'Projects' : 'Files'}
            </span>
            {!isDashboard && (
              <button
                onClick={() => { setCreatingTopFolder(true); setNewTopFolderName('') }}
                title="New folder"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 26, height: 26, borderRadius: 5,
                  color: 'var(--color-mute)', background: 'transparent', border: 'none', cursor: 'pointer',
                  transition: 'background-color 120ms ease, transform 120ms ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-border)')}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'scale(1)' }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.88)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            )}
          </div>

          {/* ── Scrollable content ────────────────────────────────────────────── */}
          <div
            style={{
              flex: 1, overflowY: 'auto', minHeight: 0,
              background: (!isDashboard && isTreeDragOver) ? 'var(--color-border-s)' : undefined,
            }}
            onDragEnter={!isDashboard ? handleTreeDragEnter : undefined}
            onDragLeave={!isDashboard ? handleTreeDragLeave : undefined}
            onDragOver={!isDashboard ? handleTreeDragOver : undefined}
            onDrop={!isDashboard ? handleTreeDrop : undefined}
          >
            {isDashboard ? (
              /* Project list */
              projects.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '24px 0', textAlign: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--color-mute)' }}>No projects yet</span>
                  <button onClick={() => setShowNewProject(true)} className="btn-accent" style={{ fontSize: 11, padding: '4px 12px' }}>
                    New Project
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {projects.map((project, index) => {
                    const isHov = hoveredProject === project.id
                    const isRenaming = renamingProject === project.id
                    return (
                      <div
                        key={project.id}
                        onClick={() => !isRenaming && navigate(`/project/${project.id}`)}
                        onMouseEnter={() => setHoveredProject(project.id)}
                        onMouseLeave={() => setHoveredProject(null)}
                        className="sidebar-item w-full"
                        style={{
                          cursor: 'pointer',
                          animation: 'sidebar-fade-in 200ms ease both',
                          animationDelay: `${index * 60}ms`,
                        }}
                      >
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: project.color, flexShrink: 0 }} />
                        {isRenaming ? (
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => handleRenameProject(project.id, project.path, project.name)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameProject(project.id, project.path, project.name)
                              if (e.key === 'Escape') setRenamingProject(null)
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="sidebar-input flex-1 min-w-0 text-sm"
                            style={{ color: 'var(--color-ink)' }}
                          />
                        ) : (
                          <span className="flex-1 min-w-0 truncate text-left text-sm" style={{ color: 'var(--color-ink2)' }}>
                            {project.name}
                          </span>
                        )}
                        {!isRenaming && (
                          <button
                            onClick={(e) => openProjectMenu(e, project.id)}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: 22, height: 22, borderRadius: 4,
                              color: 'var(--color-mute)', background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0,
                              opacity: isHov ? 1 : 0,
                              pointerEvents: isHov ? 'auto' : 'none',
                              transition: 'background-color 120ms ease, transform 120ms ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-border)')}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'scale(1)' }}
                            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.85)')}
                            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )
                  })}
                  <button
                    onClick={() => setShowNewProject(true)}
                    className="sidebar-item w-full"
                    style={{ color: 'var(--color-mute)', marginTop: 4 }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ flexShrink: 0 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    <span style={{ fontSize: 12 }}>New Project</span>
                  </button>
                </div>
              )
            ) : (
              /* File tree */
              currentProject ? (
                <>
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
                    rootPath={currentProject.path}
                    naked
                    exclude={['.git']}
                    onStatsReady={(files, bytes) => setTreeStats({ files, bytes })}
                  />
                </>
              ) : null
            )}
          </div>

          {/* ── File stats bar ────────────────────────────────────────────────── */}
          {!isDashboard && currentProject && (
            <div
              className="flex flex-shrink-0 items-center justify-between px-3"
              style={{ height: 30, borderTop: '1px solid var(--color-border-s)', fontSize: 11, color: 'var(--color-mute)', flexShrink: 0 }}
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
          )}

          {/* ── Footer card ───────────────────────────────────────────────────── */}
          <button
            ref={footerMenuBtnRef}
            onClick={openFooterMenu}
            style={{
              ...cardStyle,
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', flexShrink: 0,
              width: '100%', cursor: 'pointer', textAlign: 'left',
              transition: 'background-color 120ms ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-border-s)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-bg)')}
          >
            <div style={{
              width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
              background: 'var(--accent-soft)', color: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 600,
            }}>
              {(userName || 'U')[0].toUpperCase()}
            </div>
            <span style={{
              flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--color-ink2)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {userName || 'User'}
            </span>
          </button>

        </div>
      </aside>

      {/* ── Modals ────────────────────────────────────────────────────────────── */}
      {showNewProject && <NewProjectModal onClose={() => setShowNewProject(false)} />}
      <SettingsModal open={settingsOpen} onClose={() => { setSettingsOpen(false); loadUserName() }} />

      {/* ── Project context menu ──────────────────────────────────────────────── */}
      {openMenuProject && (() => {
        const project = projects.find((p) => p.id === openMenuProject)
        if (!project) return null
        const isConfirming = confirmDeleteProject === project.id
        return (
          <div
            ref={projectMenuRef}
            className="fixed z-50 rounded-lg py-1"
            style={{ top: menuPos.top, left: menuPos.left, minWidth: 128, border: '1px solid var(--color-border)', background: 'var(--color-panel)' }}
          >
            <button
              onClick={() => { setRenamingProject(project.id); setRenameValue(project.name); setOpenMenuProject(null) }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs"
              style={{ color: 'var(--color-ink2)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-border-s)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-mute)' }}>
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Rename
            </button>
            {isConfirming ? (
              <button
                onClick={() => handleDeleteProject(project.id, project.path)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium"
                style={{ color: 'var(--color-danger)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-danger-soft)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                </svg>
                Confirm delete
              </button>
            ) : (
              <button
                onClick={() => setConfirmDeleteProject(project.id)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs"
                style={{ color: 'var(--color-ink2)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-border-s)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-mute)' }}>
                  <path d="M3 6h18m-2 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
                Delete
              </button>
            )}
          </div>
        )
      })()}

      {/* ── Footer dropdown ───────────────────────────────────────────────────── */}
      {footerMenuOpen && createPortal(
        <div
          ref={footerMenuDropdownRef}
          style={{
            position: 'fixed', bottom: footerMenuPos.bottom, left: footerMenuPos.left,
            zIndex: 9999, minWidth: 140, borderRadius: 8, paddingTop: 4, paddingBottom: 4,
            border: '1px solid var(--color-border)', background: 'var(--color-panel)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          }}
        >
          <button
            onClick={() => { setFooterMenuOpen(false); setSettingsOpen(true) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '7px 12px', textAlign: 'left', fontSize: 13,
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink2)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-border-s)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ flexShrink: 0, color: 'var(--color-mute)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>
        </div>,
        document.body
      )}
    </>
  )
}
