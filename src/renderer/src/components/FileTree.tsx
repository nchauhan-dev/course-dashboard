import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../lib/api'
import type { TreeNode } from '../../../../types/index'

interface Props {
  rootPath: string
  naked?: boolean       // strip border/bg wrapper — use inside a sidebar
  exclude?: string[]    // folder/file names to hide at the root level
  onStatsReady?: (files: number, bytes: number) => void
  refreshKey?: number   // increment to reload tree data without remounting
}

function countStats(nodes: TreeNode[]): { files: number; bytes: number } {
  let files = 0
  let bytes = 0
  for (const n of nodes) {
    if (n.isDirectory) {
      const sub = countStats(n.children ?? [])
      files += sub.files
      bytes += sub.bytes
    } else {
      files += 1
      bytes += n.size ?? 0
    }
  }
  return { files, bytes }
}

export default function FileTree({ rootPath, naked, exclude, onStatsReady, refreshKey }: Props) {
  const [nodes, setNodes] = useState<TreeNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRootDragOver, setIsRootDragOver] = useState(false)
  const rootDragCounter = useRef(0)
  const isFirstRender = useRef(true)

  // Lifted expanded state — never reset by load(), only toggled by user
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())

  function toggleExpanded(path: string) {
    setExpandedPaths(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await api.readDirectory(rootPath)
    if (res.success && res.data) {
      const filtered = exclude?.length
        ? res.data.filter((n) => !exclude.includes(n.name))
        : res.data
      setNodes(filtered)
      if (onStatsReady) {
        const { files, bytes } = countStats(filtered)
        onStatsReady(files, bytes)
      }
    }
    setIsLoading(false)
  }, [rootPath]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  // Reload when refreshKey increments, but skip the initial mount
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    load()
  }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Root-level drop zone ───────────────────────────────────────────────────
  // Directory rows call stopPropagation on their drag events, so this only
  // fires when dropping on file rows or empty space — correctly targeting rootPath.

  function handleRootDragEnter(e: React.DragEvent) {
    e.preventDefault()
    rootDragCounter.current++
    setIsRootDragOver(true)
  }

  function handleRootDragLeave(e: React.DragEvent) {
    e.preventDefault()
    rootDragCounter.current--
    if (rootDragCounter.current === 0) setIsRootDragOver(false)
  }

  function handleRootDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  async function handleRootDrop(e: React.DragEvent) {
    e.preventDefault()
    rootDragCounter.current = 0
    setIsRootDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return
    for (const file of files) {
      const sourcePath = (file as unknown as { path: string }).path
      if (!sourcePath) continue
      await api.copyFile({ sourcePath, destinationFolder: rootPath })
    }
    load()
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div
          className="h-6 w-6 animate-spin rounded-full border-2"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  return (
    <div
      className={naked ? 'overflow-x-hidden' : 'rounded-lg border border-gray-200 bg-white overflow-x-hidden'}
      style={isRootDragOver ? { background: 'var(--color-border-s)' } : undefined}
      onDragEnter={handleRootDragEnter}
      onDragLeave={handleRootDragLeave}
      onDragOver={handleRootDragOver}
      onDrop={handleRootDrop}
    >
      {nodes.length === 0 ? (
        <p className="px-4 py-6 text-sm" style={{ color: 'var(--color-mute)' }}>
          No files yet. Drop files here to add them.
        </p>
      ) : (
        nodes.map((node, index) => (
          <TreeNodeRow
            key={node.path}
            node={node}
            depth={0}
            onRefresh={load}
            naked={naked}
            animationIndex={index}
            isExpanded={expandedPaths.has(node.path)}
            onToggleExpand={toggleExpanded}
            expandedPaths={expandedPaths}
          />
        ))
      )}
    </div>
  )
}

function TreeNodeRow({
  node,
  depth,
  onRefresh,
  naked,
  animationIndex,
  isExpanded,
  onToggleExpand,
  expandedPaths,
}: {
  node: TreeNode
  depth: number
  onRefresh: () => void
  naked?: boolean
  animationIndex?: number
  isExpanded: boolean
  onToggleExpand: (path: string) => void
  expandedPaths: Set<string>
}) {
  const [isHovered, setIsHovered] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [dropSuccess, setDropSuccess] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const dragCounter = useRef(0)
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const expandTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node
      if (
        !menuButtonRef.current?.contains(target) &&
        !dropdownRef.current?.contains(target)
      ) {
        setMenuOpen(false)
        setMenuPos(null)
        setConfirmingDelete(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [menuOpen])

  function openMenu(e: React.MouseEvent) {
    e.stopPropagation()
    if (menuOpen) { setMenuOpen(false); setMenuPos(null); return }
    const rect = menuButtonRef.current?.getBoundingClientRect()
    if (rect) setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    setMenuOpen(true)
  }

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault()
    const name = newFolderName.trim()
    if (!name) return
    const fullPath = `${node.path}/${name}`
    console.log('[FileTree] handleCreateFolder — creating:', fullPath)
    await api.createFolder(fullPath)
    setCreating(false)
    setNewFolderName('')
    if (!isExpanded) onToggleExpand(node.path)
    setTimeout(() => onRefresh(), 50)
  }

  function cancelCreate() {
    setCreating(false)
    setNewFolderName('')
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault()
    const newName = renameValue.trim()
    if (!newName || newName === node.name) { setIsRenaming(false); return }
    await api.renameFolder({ oldPath: node.path, newName })
    setIsRenaming(false)
    onRefresh()
  }

  async function handleDelete() {
    await api.deleteFolder({ folderPath: node.path })
    onRefresh()
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    setIsDragOver(true)
    if (!expandTimer.current) {
      expandTimer.current = setTimeout(() => {
        if (!isExpanded) onToggleExpand(node.path)
        expandTimer.current = null
      }, 800)
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setIsDragOver(false)
      if (expandTimer.current) {
        clearTimeout(expandTimer.current)
        expandTimer.current = null
      }
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current = 0
    setIsDragOver(false)
    if (expandTimer.current) {
      clearTimeout(expandTimer.current)
      expandTimer.current = null
    }

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    for (const file of files) {
      const sourcePath = (file as unknown as { path: string }).path
      console.log('[FileTree] drop — sourcePath:', sourcePath, '| destinationFolder:', node.path)
      if (!sourcePath) continue
      const result = await api.copyFile({ sourcePath, destinationFolder: node.path })
      console.log('[FileTree] copyFile result:', result)
    }

    setDropSuccess(true)
    if (!isExpanded) onToggleExpand(node.path)
    onRefresh()

    if (successTimer.current) clearTimeout(successTimer.current)
    successTimer.current = setTimeout(() => setDropSuccess(false), 1000)
  }

  const indent = 12 + depth * 20

  const dragHandlers = node.isDirectory
    ? { onDragEnter: handleDragEnter, onDragLeave: handleDragLeave, onDragOver: handleDragOver, onDrop: handleDrop }
    : {}

  let rowBg = isHovered ? (naked ? 'bg-[var(--color-border-s)]' : 'bg-gray-50') : (naked ? '' : 'bg-white')
  if (node.isDirectory) {
    if (dropSuccess) rowBg = 'bg-green-50'
    else if (isDragOver) rowBg = naked ? 'bg-[color-mix(in_oklch,var(--accent)_8%,transparent)]' : 'bg-amber-50'
  }

  // ── Rename mode ──────────────────────────────────────────────────────────────
  if (isRenaming) {
    return (
      <div>
        <form
          onSubmit={handleRename}
          className="flex items-center gap-2 border-b border-gray-100 pr-3"
          style={{ height: 40, paddingLeft: `${indent}px` }}
        >
          <div className="h-5 w-5 flex-shrink-0" />
          {node.isDirectory ? (
            <svg className="h-5 w-5 flex-shrink-0 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
          ) : (
            <svg className="h-5 w-5 flex-shrink-0 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
          <input
            autoFocus
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={() => setIsRenaming(false)}
            onKeyDown={(e) => { if (e.key === 'Escape') setIsRenaming(false) }}
            className="form-input flex-1 min-w-0 rounded border px-2 py-1 text-sm"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-panel)', color: 'var(--color-ink)' }}
          />
        </form>
        {node.isDirectory && isExpanded && (
          <div>
            {(node.children ?? []).map((child) => (
              <TreeNodeRow
                key={child.path} node={child} depth={depth + 1} onRefresh={onRefresh} naked={naked}
                isExpanded={expandedPaths.has(child.path)}
                onToggleExpand={onToggleExpand}
                expandedPaths={expandedPaths}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      style={depth === 0 && animationIndex !== undefined ? {
        animation: 'sidebar-fade-in 200ms ease both',
        animationDelay: `${animationIndex * 30}ms`,
      } : undefined}
    >
      {/* Row */}
      <div
        className={`flex items-center gap-2 pr-3 transition-colors ${rowBg} ${naked ? '' : 'border-b border-gray-100'}`}
        style={{ height: 36, paddingLeft: `${indent}px` }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...dragHandlers}
      >
        {node.isDirectory ? (
          <>
            <button
              onClick={() => onToggleExpand(node.path)}
              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-gray-400 hover:text-gray-600"
            >
              <svg
                className={`h-3.5 w-3.5 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <svg
              className={`flex-shrink-0 text-amber-400 transition-transform duration-150 ${isDragOver ? 'h-6 w-6 scale-110' : 'h-5 w-5'}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>

            <button
              onClick={() => onToggleExpand(node.path)}
              className="flex-1 min-w-0 text-left"
            >
              <span className="truncate text-sm" style={{ color: 'var(--color-ink)' }}>{node.name}</span>
            </button>

            {(isHovered || menuOpen) && (
              <div
                className="flex flex-shrink-0 items-center gap-0.5"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={(e) => { e.stopPropagation() }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    console.log('[FileTree] + clicked, node.path:', node.path)
                    setCreating(true)
                    if (!isExpanded) onToggleExpand(node.path)
                  }}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  title="New subfolder"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>

                <button
                  ref={menuButtonRef}
                  onClick={openMenu}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  title="More options"
                >
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                  </svg>
                </button>

                {menuOpen && menuPos && createPortal(
                  <div
                    ref={dropdownRef}
                    style={{
                      position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999,
                      width: 128, borderRadius: 8,
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-panel)',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                      overflow: 'hidden',
                    }}
                  >
                    <button
                      onClick={() => { setMenuOpen(false); setMenuPos(null); setRenameValue(node.name); setIsRenaming(true) }}
                      style={{ display: 'block', width: '100%', padding: '7px 12px', textAlign: 'left', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-border-s)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                    >
                      Rename
                    </button>
                    {confirmingDelete ? (
                      <button
                        onClick={() => { handleDelete(); setMenuOpen(false); setMenuPos(null); setConfirmingDelete(false) }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', borderRadius: 5 }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-danger-soft)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        </svg>
                        Confirm delete
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmingDelete(true)}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink2)', borderRadius: 5 }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-border-s)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-mute)' }}>
                          <path d="M3 6h18m-2 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                        Delete
                      </button>
                    )}
                  </div>,
                  document.body
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="h-5 w-5 flex-shrink-0" />

            <svg
              className="h-5 w-5 flex-shrink-0 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>

            <span className="flex-1 truncate text-sm" style={{ color: 'var(--color-ink)' }}>{node.name}</span>

            {(isHovered || menuOpen) && (
              <div className="flex flex-shrink-0 items-center gap-0.5">
                <button
                  onClick={() => api.openPath(node.path)}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  title="Open file"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>

                <button
                  ref={menuButtonRef}
                  onClick={openMenu}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  title="More options"
                >
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                  </svg>
                </button>

                {menuOpen && menuPos && createPortal(
                  <div
                    ref={dropdownRef}
                    style={{
                      position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999,
                      width: 128, borderRadius: 8,
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-panel)',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                      overflow: 'hidden',
                    }}
                  >
                    <button
                      onClick={() => { setMenuOpen(false); setMenuPos(null); setRenameValue(node.name); setIsRenaming(true) }}
                      style={{ display: 'block', width: '100%', padding: '7px 12px', textAlign: 'left', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-border-s)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                    >
                      Rename
                    </button>
                    {confirmingDelete ? (
                      <button
                        onClick={() => { handleDelete(); setMenuOpen(false); setMenuPos(null); setConfirmingDelete(false) }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', borderRadius: 5 }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-danger-soft)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        </svg>
                        Confirm delete
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmingDelete(true)}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink2)', borderRadius: 5 }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-border-s)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-mute)' }}>
                          <path d="M3 6h18m-2 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                        Delete
                      </button>
                    )}
                  </div>,
                  document.body
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Children */}
      {node.isDirectory && isExpanded && (
        <div>
          {creating && (
            <div
              className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 pr-3"
              style={{ height: 40, paddingLeft: `${indent + 20 + 8 + 4}px` }}
            >
              <svg className="h-5 w-5 flex-shrink-0 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              </svg>
              <form onSubmit={handleCreateFolder} className="flex-1 min-w-0">
                <input
                  autoFocus
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onBlur={cancelCreate}
                  onKeyDown={(e) => { if (e.key === 'Escape') cancelCreate() }}
                  className="form-input w-full rounded border px-2 py-1 text-sm"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-panel)', color: 'var(--color-ink)' }}
                  placeholder="Folder name"
                />
              </form>
            </div>
          )}
          {(node.children ?? []).map((child) => (
            <TreeNodeRow
              key={child.path} node={child} depth={depth + 1} onRefresh={onRefresh} naked={naked}
              isExpanded={expandedPaths.has(child.path)}
              onToggleExpand={onToggleExpand}
              expandedPaths={expandedPaths}
            />
          ))}
        </div>
      )}
    </div>
  )
}
