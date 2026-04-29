import { useState, useEffect, useRef } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { AppProvider, useApp } from './store/AppContext'
import { api } from './lib/api'
import Setup from './pages/Setup'
import Dashboard from './pages/Dashboard'
import ProjectDetail from './pages/ProjectDetail'

import Archive from './pages/Archive'
import NewProjectModal from './components/NewProjectModal'
import SettingsModal from './components/SettingsModal'

// ── Persistent sidebar ────────────────────────────────────────────────────────

function AppSidebar() {
  const { projects, rootPath, activeWorkspace, switchWorkspace, removeProject, refreshProjects } = useApp()
  const navigate = useNavigate()
  const location = useLocation()

  const [collapsed, setCollapsed] = useState(false)
  const [showNewProject, setShowNewProject] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Workspace switcher
  const [workspaces, setWorkspaces] = useState<string[]>([])
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false)
  const [showNewWorkspace, setShowNewWorkspace] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false)
  const [wsBtnHovered, setWsBtnHovered] = useState(false)
  const workspaceMenuRef = useRef<HTMLDivElement>(null)

  // Project context menu
  const [hoveredProject, setHoveredProject] = useState<string | null>(null)
  const [openMenuProject, setOpenMenuProject] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const [renamingProject, setRenamingProject] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmDeleteProject, setConfirmDeleteProject] = useState<string | null>(null)
  const projectMenuRef = useRef<HTMLDivElement>(null)

  // User name + menu
  const [userName, setUserName] = useState('')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [userMenuPos, setUserMenuPos] = useState({ bottom: 0, left: 0 })
  const userMenuBtnRef = useRef<HTMLButtonElement>(null)
  const userMenuDropdownRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(e.target as Node)) {
        setShowWorkspaceMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (!userMenuOpen) return
    function handleClick(e: MouseEvent) {
      if (
        userMenuBtnRef.current?.contains(e.target as Node) ||
        userMenuDropdownRef.current?.contains(e.target as Node)
      ) return
      setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [userMenuOpen])

  useEffect(() => {
    if (!openMenuProject) return
    function handleClick(e: MouseEvent) {
      if (projectMenuRef.current && !projectMenuRef.current.contains(e.target as Node)) {
        setOpenMenuProject(null)
        setConfirmDeleteProject(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [openMenuProject])

  function openProjectMenu(e: React.MouseEvent, projectId: string) {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 4, left: rect.left - 8 })
    setOpenMenuProject(projectId)
    setConfirmDeleteProject(null)
  }

  async function handleRenameProject(projectId: string, oldPath: string, currentName: string) {
    const newName = renameValue.trim()
    setRenamingProject(null)
    if (!newName || newName === currentName) return
    await api.renameFolder({ oldPath, newName })
    await refreshProjects()
  }

  async function handleDeleteProject(projectId: string, projectPath: string) {
    await api.deleteProject(projectPath)
    removeProject(projectId)
    setOpenMenuProject(null)
    setConfirmDeleteProject(null)
  }

  function openUserMenu() {
    if (!userMenuBtnRef.current) return
    const rect = userMenuBtnRef.current.getBoundingClientRect()
    setUserMenuPos({ bottom: window.innerHeight - rect.top + 4, left: rect.left })
    setUserMenuOpen(true)
  }

  async function handleSwitchWorkspace(name: string) {
    setShowWorkspaceMenu(false)
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
    setShowWorkspaceMenu(false)
    setIsCreatingWorkspace(false)
  }

  const isDashboard = location.pathname === '/dashboard'
  const isArchive = location.pathname === '/archive'
  const isProjectActive = (id: string) => location.pathname.startsWith(`/project/${id}`)

  return (
    <>
      <aside
        className="flex flex-shrink-0 flex-col overflow-hidden"
        style={{
          width: collapsed ? 52 : 232,
          transition: 'width 200ms ease-in-out',
          background: 'var(--color-sidebar)',
          borderRight: '1px solid var(--color-border)',
        }}
      >
        <div className="drag-region h-8 flex-shrink-0" />

        {/* Collapsed state */}
        {collapsed && (
          <div className="flex flex-1 flex-col items-center py-2 no-drag">
            <button
              onClick={() => setCollapsed(false)}
              title="Expand sidebar"
              className="rounded-md p-1.5 transition-colors"
              style={{ color: 'var(--color-mute)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-border)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <div className="flex flex-1 items-center justify-center overflow-hidden py-4">
              <span
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', color: 'var(--color-mute)', fontSize: 11, letterSpacing: '0.05em' }}
                className="font-medium select-none"
              >
                {activeWorkspace || 'Coursework'}
              </span>
            </div>
          </div>
        )}

        {/* Expanded state */}
        {!collapsed && (
          <div className="flex flex-1 flex-col overflow-hidden px-3 pb-3">

            {/* Brand row */}
            <div className="mb-3 flex items-center gap-2 px-1 no-drag">
              <div
                className="flex h-[22px] w-[22px] items-center justify-center rounded-md flex-shrink-0"
                style={{ background: 'var(--color-ink)', color: 'var(--color-bg)', fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 14, fontWeight: 500 }}
              >
                c
              </div>
              <span className="flex-1 truncate text-sm font-semibold" style={{ color: 'var(--color-ink)', letterSpacing: '-0.02em' }}>Coursework</span>
              <button
                onClick={() => setCollapsed(true)}
                className="rounded-md p-1 transition-colors flex-shrink-0"
                style={{ color: 'var(--color-mute)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-border)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>

            {/* Workspace selector */}
            <div className="relative mb-2 no-drag" ref={workspaceMenuRef}>
              <button
                onClick={() => { setShowWorkspaceMenu((v) => !v); setShowNewWorkspace(false) }}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors"
                style={{ background: 'var(--color-panel)', border: '1px solid var(--color-border)', color: 'var(--color-ink2)' }}
              >
                <span className="truncate font-medium">
                  {activeWorkspace || 'No workspace'}
                </span>
                <svg className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--color-mute)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                </svg>
              </button>

              {showWorkspaceMenu && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg py-1 shadow-lg" style={{ border: '1px solid var(--color-border)', background: 'var(--color-panel)' }}>
                  {workspaces.map((ws) => (
                    <button
                      key={ws}
                      onClick={() => handleSwitchWorkspace(ws)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors"
                      style={{ color: ws === activeWorkspace ? 'var(--accent)' : 'var(--color-ink2)', fontWeight: ws === activeWorkspace ? 500 : 400 }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-panel2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {ws === activeWorkspace && (
                        <svg className="h-3 w-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                      <span className={ws === activeWorkspace ? '' : 'ml-4'}>{ws}</span>
                    </button>
                  ))}
                  <div className="my-1" style={{ borderTop: '1px solid var(--color-border-s)' }} />
                  {showNewWorkspace ? (
                    <form onSubmit={handleCreateWorkspace} className="px-2 py-1.5">
                      <input
                        type="text"
                        value={newWorkspaceName}
                        onChange={(e) => setNewWorkspaceName(e.target.value)}
                        placeholder="Workspace name…"
                        autoFocus
                        className="mb-1.5 w-full rounded-md px-2 py-1 text-xs"
                        style={{ border: '1px solid var(--color-border)', background: 'var(--color-panel2)' }}
                      />
                      <div className="flex gap-1.5">
                        <button type="button" onClick={() => setShowNewWorkspace(false)}
                          className="flex-1 rounded-md py-1 text-xs" style={{ border: '1px solid var(--color-border)', color: 'var(--color-ink2)' }}>
                          Cancel
                        </button>
                        <button type="submit" disabled={isCreatingWorkspace || !newWorkspaceName.trim()}
                          className="flex-1 rounded-md py-1 text-xs font-medium text-white disabled:opacity-50"
                          style={{ background: 'var(--accent)', filter: wsBtnHovered ? 'brightness(0.9)' : undefined }}
                          onMouseEnter={() => setWsBtnHovered(true)} onMouseLeave={() => setWsBtnHovered(false)}>
                          {isCreatingWorkspace ? '…' : 'Create'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button onClick={() => setShowNewWorkspace(true)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors"
                      style={{ color: 'var(--accent)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-panel2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      New Workspace
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Nav links */}
            <div className="flex-1 overflow-y-auto space-y-0.5 no-drag">
              <button
                onClick={() => navigate('/dashboard')}
                className={`sidebar-item w-full ${isDashboard ? 'active' : ''}`}
              >
                <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--color-ink2)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 11 12 3l9 8M5 10v10h14V10" />
                </svg>
                <span style={{ color: isDashboard ? 'var(--color-ink)' : 'var(--color-ink2)' }}>Dashboard</span>
              </button>

              {projects.length > 0 && (
                <div className="pt-3">
                  <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-mute)', letterSpacing: '0.1em' }}>
                    Projects
                  </p>
                  {projects.map((project) => {
                    const isActive = isProjectActive(project.id)
                    const isHov = hoveredProject === project.id
                    const isRenaming = renamingProject === project.id
                    return (
                      <div
                        key={project.id}
                        onClick={() => !isRenaming && navigate(`/project/${project.id}`)}
                        onMouseEnter={() => setHoveredProject(project.id)}
                        onMouseLeave={() => setHoveredProject(null)}
                        className={`sidebar-item w-full ${isActive ? 'active' : ''}`}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
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
                          <span className="flex-1 min-w-0 truncate text-left text-sm" style={{ color: isActive ? 'var(--color-ink)' : 'var(--color-ink2)' }}>
                            {project.name}
                          </span>
                        )}
                        {isHov && !isRenaming && (
                          <button
                            onClick={(e) => openProjectMenu(e, project.id)}
                            style={{ display: 'flex', padding: 2, borderRadius: 3, color: 'var(--color-mute)', background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-border)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Bottom actions */}
            <div className="space-y-0.5 pt-2 no-drag" style={{ borderTop: '1px solid var(--color-border)' }}>
              <button onClick={() => setShowNewProject(true)} className="sidebar-item w-full" style={{ color: 'var(--color-ink2)' }}>
                <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--color-mute)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New Project
              </button>

              <button onClick={() => navigate('/archive')} className={`sidebar-item w-full ${isArchive ? 'active' : ''}`} style={{ color: isArchive ? 'var(--color-ink)' : 'var(--color-ink2)' }}>
                <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--color-mute)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                Archive
              </button>

              {/* User avatar + name + menu */}
              <div className="flex items-center gap-2 rounded-md px-2.5 py-1.5">
                <div className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                  {(userName || 'U')[0].toUpperCase()}
                </div>
                <span className="flex-1 truncate text-sm font-medium" style={{ color: 'var(--color-ink2)' }}>
                  {userName || 'User'}
                </span>
                <button ref={userMenuBtnRef} onClick={openUserMenu}
                  className="rounded p-0.5 flex-shrink-0 transition-colors"
                  style={{ color: 'var(--color-mute)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-border)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </button>
              </div>
            </div>

          </div>
        )}
      </aside>

      {/* Modals */}
      {showNewProject && <NewProjectModal onClose={() => setShowNewProject(false)} />}

      <SettingsModal
        open={settingsOpen}
        onClose={() => { setSettingsOpen(false); loadUserName() }}
      />

      {openMenuProject && (() => {
        const project = projects.find((c) => c.id === openMenuProject)
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

      {userMenuOpen && (
        <div
          ref={userMenuDropdownRef}
          className="fixed z-50 min-w-[140px] rounded-lg py-1 shadow-lg"
          style={{ bottom: userMenuPos.bottom, left: userMenuPos.left, border: '1px solid var(--color-border)', background: 'var(--color-panel)' }}
        >
          <button
            onClick={() => { setUserMenuOpen(false); setSettingsOpen(true) }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors"
            style={{ color: 'var(--color-ink2)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-panel2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--color-mute)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>
        </div>
      )}
    </>
  )
}

// ── Route tree ────────────────────────────────────────────────────────────────

function AppRoutes() {
  const { rootPath, isLoading } = useApp()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && rootPath) {
      navigate('/dashboard', { replace: true })
    }
  }, [rootPath, isLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          <span className="text-sm" style={{ color: 'var(--color-mute)' }}>Loading…</span>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/setup" element={<Setup />} />
      <Route path="/dashboard" element={rootPath ? <Dashboard /> : <Navigate to="/setup" replace />} />
      <Route path="/project/:projectId" element={rootPath ? <ProjectDetail /> : <Navigate to="/setup" replace />} />

      <Route path="/archive" element={rootPath ? <Archive /> : <Navigate to="/setup" replace />} />
      <Route path="*" element={<Navigate to={rootPath ? '/dashboard' : '/setup'} replace />} />
    </Routes>
  )
}

// ── App shell ─────────────────────────────────────────────────────────────────

function AppShell() {
  const { rootPath, isLoading } = useApp()

  return (
    <div className="flex h-screen overflow-hidden">
      {rootPath && !isLoading && <AppSidebar />}
      <div className="flex flex-1 min-w-0 overflow-hidden">
        <AppRoutes />
      </div>
    </div>
  )
}

// ── App root ──────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <AppShell />
      </HashRouter>
    </AppProvider>
  )
}
