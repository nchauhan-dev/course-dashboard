import { useEffect, useMemo, useRef, useState } from 'react'
import type { TreeNode } from '../../../../types/index'
import { api } from '../lib/api'

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

export default function SearchBar({ scope, placeholder = 'Search…', projectPath }: SearchBarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [fileTree, setFileTree] = useState<TreeNode[] | null>(null)
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [fileResults, setFileResults] = useState<TreeNode[]>([])

  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Derived: flat list of all file nodes from the tree
  const flatFiles = useMemo(() => (fileTree ? flattenTree(fileTree) : []), [fileTree])

  // Autofocus input when dropdown opens
  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  // Fetch file tree once on open (project scope only); reset everything on close
  useEffect(() => {
    if (!isOpen) {
      setFileTree(null)
      setQuery('')
      setFileResults([])
      return
    }
    if (scope !== 'project' || !projectPath) return
    setIsLoadingFiles(true)
    api.readDirectory(projectPath)
      .then((res) => {
        if (res.success && res.data) setFileTree(res.data)
      })
      .finally(() => setIsLoadingFiles(false))
  }, [isOpen, scope, projectPath])

  // Filter flat file list whenever query or the tree changes
  useEffect(() => {
    if (!query.trim()) {
      setFileResults([])
      return
    }
    const q = query.toLowerCase()
    setFileResults(flatFiles.filter((n) => n.name.toLowerCase().includes(q)))
  }, [query, flatFiles])

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

      {/* Dropdown — appears below the bar when open, empty until results are wired */}
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
          {!query.trim() && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--color-mute)' }}>
              Start typing to search
            </div>
          )}

          {/* Loading */}
          {query.trim() !== '' && isLoadingFiles && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="animate-spin" style={{
                width: 16, height: 16, borderRadius: '50%',
                border: '2px solid var(--color-border)',
                borderTopColor: 'var(--color-mute)',
              }} />
            </div>
          )}

          {/* No results */}
          {query.trim() !== '' && !isLoadingFiles && fileResults.length === 0 && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--color-mute)' }}>
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {/* Result rows */}
          {fileResults.map((node, index) => {
            const relativePath = projectPath && node.path.startsWith(projectPath)
              ? node.path.slice(projectPath.length).replace(/^[\\/]/, '')
              : node.path
            return (
              <button
                key={node.path}
                onClick={async () => {
                  await api.openPath(node.path)
                  setIsOpen(false)
                  setQuery('')
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
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-border-s)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                {/* File icon */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--color-mute)' }}>
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                {/* Text */}
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
        </div>
      )}

    </div>
  )
}
