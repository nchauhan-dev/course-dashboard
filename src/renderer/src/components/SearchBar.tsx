import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { TreeNode, Project, CalendarEvent, ProjectLink } from '../../../../types/index'
import { api } from '../lib/api'
import { useApp } from '../store/AppContext'

type SearchBarProps = {
  scope: 'global' | 'project'
  placeholder?: string
  projectPath?: string
}

// Recursively collect only file nodes (non-directories)
function flattenTree(nodes: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = []
  for (const node of nodes) {
    if (!node.isDirectory) {
      result.push(node)
    }
    if (node.children) {
      result.push(...flattenTree(node.children))
    }
  }
  return result
}

function formatDueDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function domainColor(seed: string, offset: number): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return `hsl(${(h + offset) % 360}, 45%, 55%)`
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: 'var(--color-mute)',
  padding: '8px 14px 4px', flexShrink: 0,
}

export default function SearchBar({ scope, placeholder = 'Search…', projectPath }: SearchBarProps) {
  const navigate = useNavigate()
  const { projects, calendarEvents, activeWorkspace, workspacePath, openAssignmentModal } = useApp()

  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')

  // Project scope state
  const [fileTree, setFileTree] = useState<TreeNode[] | null>(null)
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [fileResults, setFileResults] = useState<TreeNode[]>([])
  const [allLinks, setAllLinks] = useState<ProjectLink[]>([])
  const [linkResults, setLinkResults] = useState<ProjectLink[]>([])

  // Global scope state
  const [projectResults, setProjectResults] = useState<Project[]>([])
  const [assignmentResults, setAssignmentResults] = useState<CalendarEvent[]>([])
  const [globalFileTree, setGlobalFileTree] = useState<TreeNode[] | null>(null)
  const [globalFileResults, setGlobalFileResults] = useState<TreeNode[]>([])

  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Derived: flat list of all file nodes from the trees
  const flatFiles = useMemo(() => (fileTree ? flattenTree(fileTree) : []), [fileTree])
  const globalFlatFiles = useMemo(() => (globalFileTree ? flattenTree(globalFileTree) : []), [globalFileTree])

  // Autofocus input when dropdown opens
  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  // Fetch file tree once on open; reset everything on close
  useEffect(() => {
    if (!isOpen) {
      setFileTree(null)
      setGlobalFileTree(null)
      setQuery('')
      setFileResults([])
      setLinkResults([])
      setAllLinks([])
      setProjectResults([])
      setAssignmentResults([])
      setGlobalFileResults([])
      return
    }
    if (scope === 'project' && projectPath) {
      setIsLoadingFiles(true)
      api.readDirectory(projectPath)
        .then((res) => {
          if (res.success && res.data) setFileTree(res.data)
        })
        .finally(() => setIsLoadingFiles(false))
      api.getLinks(projectPath).then((res) => {
        if (res.success && res.data) setAllLinks(res.data)
      })
    }
    if (scope === 'global' && workspacePath) {
      api.readDirectory(workspacePath)
        .then((res) => {
          if (res.success && res.data) setGlobalFileTree(res.data)
        })
    }
  }, [isOpen, scope, projectPath, workspacePath])

  // Project scope: filter flat file list and links whenever query changes
  useEffect(() => {
    if (scope !== 'project') return
    if (!query.trim()) { setFileResults([]); setLinkResults([]); return }
    const q = query.toLowerCase()
    setFileResults(flatFiles.filter((n) => n.name.toLowerCase().includes(q)))
    setLinkResults(allLinks.filter((l) => l.title.toLowerCase().includes(q) || l.url.toLowerCase().includes(q)))
  }, [query, flatFiles, allLinks, scope])

  // Global scope: filter projects, assignments, and files in memory
  useEffect(() => {
    if (scope !== 'global') return
    if (!query.trim()) { setProjectResults([]); setAssignmentResults([]); setGlobalFileResults([]); return }
    const q = query.toLowerCase()
    setProjectResults(projects.filter((p) => p.name.toLowerCase().includes(q)))
    setAssignmentResults(calendarEvents.filter((ev) => ev.title.toLowerCase().includes(q)))
    setGlobalFileResults(globalFlatFiles.filter((n) => n.name.toLowerCase().includes(q)))
  }, [query, projects, calendarEvents, globalFlatFiles, scope])

  // ⌘K / Ctrl+K to open; Escape to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
        return
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen])

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [isOpen])

  function close() {
    setIsOpen(false)
    setQuery('')
  }

  const hasQuery = query.trim() !== ''
  const globalNoResults = scope === 'global' && hasQuery && projectResults.length === 0 && assignmentResults.length === 0 && globalFileResults.length === 0
  const projectNoResults = scope === 'project' && hasQuery && !isLoadingFiles && fileResults.length === 0 && linkResults.length === 0

  return (
    <div ref={containerRef} className="no-drag" style={{ position: 'relative', flexShrink: 0 }}>

      {/* Bar — pixel-identical to the original static mockup at all times */}
      <div
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-md px-2.5 py-1.5"
        style={{
          background: 'var(--color-panel)',
          border: '1px solid var(--color-border)',
          fontSize: 11.5,
          color: 'var(--color-mute)',
          width: 220,
          cursor: 'pointer',
        }}
      >
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>

        {/* Input sits invisibly in place of the placeholder span when open */}
        {isOpen ? (
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="search-input"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              boxShadow: 'none',
              background: 'transparent',
              fontSize: 11.5,
              color: 'var(--color-mute)',
              fontFamily: 'inherit',
              padding: 0,
              margin: 0,
              minWidth: 'auto',
            }}
          />
        ) : (
          <span style={{ flex: 1 }}>{placeholder}</span>
        )}

        <span style={{ fontFamily: '"Geist Mono", monospace', fontSize: 10, color: 'var(--color-mute)' }}>
          ⌘K
        </span>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: 'var(--color-panel)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            zIndex: 100,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            height: 336,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Empty query */}
          {!hasQuery && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--color-mute)' }}>
              Start typing to search
            </div>
          )}

          {/* ── Project scope ────────────────────────────────────────────────── */}

          {/* Loading (project scope only) */}
          {scope === 'project' && hasQuery && isLoadingFiles && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="animate-spin" style={{
                width: 16, height: 16, borderRadius: '50%',
                border: '2px solid var(--color-border)',
                borderTopColor: 'var(--color-mute)',
              }} />
            </div>
          )}

          {/* No results (project scope) */}
          {projectNoResults && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--color-mute)' }}>
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {/* Links section (project scope) */}
          {scope === 'project' && linkResults.length > 0 && (
            <>
              <span style={sectionLabelStyle}>Links</span>
              {linkResults.map((link, index) => {
                let domain = ''
                try { domain = new URL(link.url).hostname.replace(/^www\./, '') } catch { /* ignore */ }
                const c1 = domainColor(domain, 0)
                const c2 = domainColor(domain, 60)
                return (
                  <button
                    key={link.id}
                    onClick={async () => { await api.openExternal(link.url); close() }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      height: 56, flexShrink: 0,
                      padding: '0 14px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      textAlign: 'left', width: '100%',
                      transition: 'background-color 120ms ease',
                      animation: 'sidebar-fade-in 200ms ease both',
                      animationDelay: `${index * 40}ms`,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-border-s)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >
                    <div style={{
                      width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                      background: `linear-gradient(135deg, ${c1}, ${c2})`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700, color: '#fff', textTransform: 'uppercase',
                    }}>
                      {domain.charAt(0) || '?'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {link.title || link.url}
                      </span>
                      <span style={{ fontSize: 10.5, color: 'var(--color-mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {domain}
                      </span>
                    </div>
                  </button>
                )
              })}
            </>
          )}

          {/* File result rows */}
          {scope === 'project' && fileResults.length > 0 && <span style={sectionLabelStyle}>Files</span>}
          {scope === 'project' && fileResults.map((node, index) => {
            const relativePath = projectPath && node.path.startsWith(projectPath)
              ? node.path.slice(projectPath.length).replace(/^[\\/]/, '')
              : node.path
            return (
              <button
                key={node.path}
                onClick={async () => {
                  await api.openPath(node.path)
                  close()
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  height: 56, flexShrink: 0,
                  padding: '0 14px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  textAlign: 'left', width: '100%',
                  transition: 'background-color 120ms ease',
                  animation: 'sidebar-fade-in 200ms ease both',
                  animationDelay: `${index * 40}ms`,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-border-s)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--color-mute)' }}>
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {node.name}
                  </span>
                  <span style={{ fontSize: 10.5, color: 'var(--color-mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {relativePath}
                  </span>
                </div>
              </button>
            )
          })}

          {/* ── Global scope ─────────────────────────────────────────────────── */}

          {/* No results (global scope) */}
          {globalNoResults && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--color-mute)' }}>
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {/* Projects section */}
          {scope === 'global' && projectResults.length > 0 && (
            <>
              <span style={sectionLabelStyle}>Projects</span>
              {projectResults.map((project, index) => (
                <button
                  key={project.id}
                  onClick={() => { navigate(`/project/${project.id}`); close() }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    height: 56, flexShrink: 0,
                    padding: '0 14px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left', width: '100%',
                    transition: 'background-color 120ms ease',
                    animation: 'sidebar-fade-in 200ms ease both',
                    animationDelay: `${index * 40}ms`,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-border-s)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  {/* Folder icon with project color */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: project.color }}>
                    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  </svg>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {project.name}
                    </span>
                    <span style={{ fontSize: 10.5, color: 'var(--color-mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {activeWorkspace}
                    </span>
                  </div>
                </button>
              ))}
            </>
          )}

          {/* Files section (global scope) */}
          {scope === 'global' && globalFileResults.length > 0 && (
            <>
              <span style={sectionLabelStyle}>Files</span>
              {globalFileResults.map((node, index) => {
                const relativePath = workspacePath && node.path.startsWith(workspacePath)
                  ? node.path.slice(workspacePath.length).replace(/^[\\/]/, '')
                  : node.path
                return (
                  <button
                    key={node.path}
                    onClick={async () => { await api.openPath(node.path); close() }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      height: 56, flexShrink: 0,
                      padding: '0 14px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      textAlign: 'left', width: '100%',
                      transition: 'background-color 120ms ease',
                      animation: 'sidebar-fade-in 200ms ease both',
                      animationDelay: `${(projectResults.length + assignmentResults.length + index) * 40}ms`,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-border-s)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--color-mute)' }}>
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {node.name}
                      </span>
                      <span style={{ fontSize: 10.5, color: 'var(--color-mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {relativePath}
                      </span>
                    </div>
                  </button>
                )
              })}
            </>
          )}

          {/* Assignments section */}
          {scope === 'global' && assignmentResults.length > 0 && (
            <>
              <span style={sectionLabelStyle}>Assignments</span>
              {assignmentResults.map((ev, index) => (
                <button
                  key={ev.id}
                  onClick={() => { openAssignmentModal(ev.projectId, ev.assignmentId); close() }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    height: 56, flexShrink: 0,
                    padding: '0 14px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left', width: '100%',
                    transition: 'background-color 120ms ease',
                    animation: 'sidebar-fade-in 200ms ease both',
                    animationDelay: `${(projectResults.length + index) * 40}ms`,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-border-s)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  {/* Task circle icon */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--color-mute)' }}>
                    <circle cx="12" cy="12" r="9" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ev.title}
                    </span>
                    <span style={{ fontSize: 10.5, color: 'var(--color-mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ev.projectName} · Due {formatDueDate(ev.due_date)}
                    </span>
                  </div>
                </button>
              ))}
            </>
          )}

        </div>
      )}

    </div>
  )
}
